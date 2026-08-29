'use client';

import { useMemo, useState } from 'react';
import * as THREE from 'three';
import { MarchingCubes, MarchingCube } from '@react-three/drei';
import useVoxelStore from '@/store/useVoxelStore';

export default function VoxelTerrain() {
  const { blocks, mode, selectedColor, isCameraMode, saveHistory, addBlock, removeBlock, paintBlock } = useVoxelStore();
  const [hoverPos, setHoverPos] = useState(null);

  // Convert blocks Map to an array
  const blocksArray = useMemo(() => {
    const arr = [];
    blocks.forEach((data, key) => {
      const [x, y, z] = key.split(',').map(Number);
      arr.push({ x, y, z, color: data.color, key });
    });
    return arr;
  }, [blocks]);

  const handlePlanePointerMove = (e) => {
    if (isCameraMode) {
      setHoverPos(null);
      return;
    }
    e.stopPropagation();
    
    const p = e.point;
    const x = Math.round(p.x);
    const z = Math.round(p.z);
    
    if (mode === 'build') {
      setHoverPos([x, 0, z]);
    } else {
      setHoverPos(null);
    }
  };

  const handleCubesPointerMove = (e) => {
    if (isCameraMode) {
      setHoverPos(null);
      return;
    }
    e.stopPropagation();

    const p = e.point;
    // For MarchingCubes surface, e.face may not have normal properly oriented outward, 
    // but typically it does. We use it to step inside or outside.
    const n = e.face?.normal || new THREE.Vector3(0, 1, 0);
    // Convert normal to world space if needed, but mesh is unrotated so it's fine.

    if (mode === 'build') {
      const bx = Math.round(p.x + n.x * 0.5);
      const by = Math.round(p.y + n.y * 0.5);
      const bz = Math.round(p.z + n.z * 0.5);
      setHoverPos([bx, Math.max(0, by), bz]);
    } else {
      // dig or paint -> inside the volume
      const bx = Math.round(p.x - n.x * 0.5);
      const by = Math.round(p.y - n.y * 0.5);
      const bz = Math.round(p.z - n.z * 0.5);
      setHoverPos([bx, Math.max(0, by), bz]);
    }
  };

  const handlePointerOut = () => {
    setHoverPos(null);
  };

  const handlePointerDown = (e) => {
    if (isCameraMode || !hoverPos) return;
    e.stopPropagation();
    
    const isRightClick = e.button === 2;
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
      setHoverPos(null);
    } else if (effectiveMode === 'paint') {
      paintBlock(x, y, z, selectedColor);
    }
  };

  return (
    <group>
      {/* Invisible Base Plane */}
      <mesh 
        rotation={[-Math.PI / 2, 0, 0]} 
        position={[0, -0.5, 0]} 
        onPointerMove={handlePlanePointerMove}
        onPointerOut={handlePointerOut}
        onPointerDown={handlePointerDown}
        visible={false}
      >
        <planeGeometry args={[100, 100]} />
        <meshBasicMaterial />
      </mesh>

      {/* Marching Cubes rendering */}
      {blocksArray.length > 0 && (
        <group onPointerMove={handleCubesPointerMove} onPointerOut={handlePointerOut} onPointerDown={handlePointerDown}>
          <MarchingCubes
            resolution={60}
            maxPolyCount={100000}
            enableUvs={false}
            enableColors={true}
            scale={[25, 25, 25]}
            position={[25, 25, 25]}
          >
            <meshStandardMaterial vertexColors roughness={0.8} />
            {blocksArray.map((block) => {
              const localX = (block.x / 25) - 1;
              const localY = (block.y / 25) - 1;
              const localZ = (block.z / 25) - 1;
              return (
                <MarchingCube
                  key={block.key}
                  position={[localX, localY, localZ]}
                  strength={0.5}
                  subtract={12}
                  color={block.color}
                />
              );
            })}
          </MarchingCubes>
        </group>
      )}

      {/* Ghost Block / Cursor */}
      {hoverPos && !isCameraMode && (
        <mesh position={hoverPos} pointerEvents="none">
          <boxGeometry args={[1.02, 1.02, 1.02]} />
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
