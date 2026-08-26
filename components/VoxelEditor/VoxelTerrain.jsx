'use client';

import { useRef, useMemo, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import useVoxelStore from '@/store/useVoxelStore';

const tempObject = new THREE.Object3D();
const tempColor = new THREE.Color();

export default function VoxelTerrain() {
  const { blocks, mode, selectedColor, isCameraMode, saveHistory, addBlock, removeBlock, paintBlock } = useVoxelStore();
  const meshRef = useRef();

  // Convert blocks Map to an array for easier mapping/updating InstancedMesh
  const blocksArray = useMemo(() => {
    const arr = [];
    blocks.forEach((data, key) => {
      const [x, y, z] = key.split(',').map(Number);
      arr.push({ x, y, z, color: data.color, key });
    });
    return arr;
  }, [blocks]);

  // Update instanced mesh matrices and colors
  useFrame(() => {
    if (!meshRef.current) return;
    
    blocksArray.forEach((block, i) => {
      tempObject.position.set(block.x, block.y, block.z);
      tempObject.updateMatrix();
      meshRef.current.setMatrixAt(i, tempObject.matrix);
      
      tempColor.set(block.color);
      meshRef.current.setColorAt(i, tempColor);
    });
    
    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
  });

  // Hover state for ghost block
  const [hoverPos, setHoverPos] = useState(null);

  const handlePointerMove = (e) => {
    if (isCameraMode) {
      setHoverPos(null);
      return;
    }
    
    e.stopPropagation();
    
    // Calculate the position for the ghost block
    if (e.object.uuid === meshRef.current?.uuid) {
      // Hovering over an existing block
      const instanceId = e.instanceId;
      if (instanceId !== undefined && blocksArray[instanceId]) {
        const block = blocksArray[instanceId];
        
        if (mode === 'build') {
          // Normal indicates which face was intersected
          const normal = e.face.normal;
          setHoverPos([block.x + normal.x, block.y + normal.y, block.z + normal.z]);
        } else if (mode === 'dig' || mode === 'paint') {
          // Highlight the block itself
          setHoverPos([block.x, block.y, block.z]);
        }
      }
    } else {
      // Hovering over the invisible base plane
      const p = e.point;
      const x = Math.round(p.x);
      const z = Math.round(p.z);
      if (mode === 'build') {
        setHoverPos([x, 0, z]);
      } else {
        setHoverPos(null);
      }
    }
  };

  const handlePointerOut = () => {
    setHoverPos(null);
  };

  const handlePointerDown = (e) => {
    if (isCameraMode || !hoverPos) return;
    e.stopPropagation();
    
    const isRightClick = e.button === 2;
    // Determine effective mode based on right click inversion
    let effectiveMode = mode;
    if (isRightClick) {
      if (mode === 'build') effectiveMode = 'dig';
      else if (mode === 'dig') effectiveMode = 'build';
    }

    const [x, y, z] = hoverPos;

    saveHistory();
    if (effectiveMode === 'build') {
      addBlock(x, y, z, selectedColor);
    } else if (effectiveMode === 'dig') {
      removeBlock(x, y, z);
      setHoverPos(null); // Reset hover after dig to avoid ghosting deleted block
    } else if (effectiveMode === 'paint') {
      paintBlock(x, y, z, selectedColor);
    }
  };

  return (
    <group>
      {/* Invisible Base Plane for starting building */}
      <mesh 
        rotation={[-Math.PI / 2, 0, 0]} 
        position={[0, -0.5, 0]} 
        onPointerMove={handlePointerMove}
        onPointerOut={handlePointerOut}
        onPointerDown={handlePointerDown}
        visible={false}
      >
        <planeGeometry args={[100, 100]} />
        <meshBasicMaterial />
      </mesh>

      {/* Instanced Mesh for rendering all blocks */}
      {blocksArray.length > 0 && (
        <instancedMesh
          ref={meshRef}
          args={[null, null, blocksArray.length]}
          onPointerMove={handlePointerMove}
          onPointerOut={handlePointerOut}
          onPointerDown={handlePointerDown}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial roughness={0.8} />
        </instancedMesh>
      )}

      {/* Ghost Block / Cursor */}
      {hoverPos && !isCameraMode && (
        <mesh position={hoverPos} pointerEvents="none">
          <boxGeometry args={[1.02, 1.02, 1.02]} /> {/* Slightly larger to avoid Z-fighting */}
          <meshBasicMaterial 
            color={mode === 'dig' ? '#ef4444' : (mode === 'paint' ? selectedColor : '#ffffff')} 
            transparent 
            opacity={mode === 'build' ? 0.3 : 0.6} 
            wireframe={mode !== 'paint'}
            depthTest={false}
          />
        </mesh>
      )}
    </group>
  );
}
