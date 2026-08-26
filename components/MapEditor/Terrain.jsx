'use client';

import { useRef, useEffect, useState } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import useMapStore, { GRID_SIZE, VERTEX_COUNT } from '@/store/useMapStore';

export default function Terrain() {
  const meshRef = useRef();
  const geomRef = useRef();
  const { 
    mode, brushSize, brushIntensity, selectedColor, selectedAsset, selectedDecalImage,
    heights, colors, updateHeights, updateColors, addAsset, addDecal, addWaterSource,
    isCameraMode, saveHistory 
  } = useMapStore();
  
  const { camera, gl } = useThree();
  const [isPointerDown, setIsPointerDown] = useState(false);

  // Initialize Geometry
  useEffect(() => {
    if (geomRef.current) {
      geomRef.current.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      
      const pos = geomRef.current.attributes.position;
      for (let i = 0; i < VERTEX_COUNT; i++) {
        pos.setZ(i, heights[i]);
      }
      geomRef.current.computeVertexNormals();
      pos.needsUpdate = true;
    }
  }, []);

  // Update Geometry on state change
  useEffect(() => {
    if (!geomRef.current) return;
    
    const pos = geomRef.current.attributes.position;
    let posChanged = false;
    for (let i = 0; i < VERTEX_COUNT; i++) {
      if (pos.getZ(i) !== heights[i]) {
        pos.setZ(i, heights[i]);
        posChanged = true;
      }
    }
    if (posChanged) {
      geomRef.current.computeVertexNormals();
      pos.needsUpdate = true;
    }

    const col = geomRef.current.attributes.color;
    let colChanged = false;
    for (let i = 0; i < colors.length; i++) {
      if (col.array[i] !== colors[i]) {
        col.array[i] = colors[i];
        colChanged = true;
      }
    }
    if (colChanged) {
      col.needsUpdate = true;
    }
  }, [heights, colors]);

  const applyBrush = (point, isShift) => {
    if (!geomRef.current) return;
    const pos = geomRef.current.attributes.position;
    
    // Find closest vertex
    // Plane is size 50x50 centered at 0,0. Range -25 to 25.
    const halfSize = 25;
    const segSize = 50 / GRID_SIZE;
    
    const xIdx = Math.round((point.x + halfSize) / segSize);
    const yIdx = Math.round((point.z + halfSize) / segSize); // Z in world is Y in plane (rotated)

    if (xIdx < 0 || xIdx > GRID_SIZE || yIdx < 0 || yIdx > GRID_SIZE) return;

    let modified = false;
    const newHeights = new Float32Array(heights);
    const newColors = new Float32Array(colors);
    const targetColor = new THREE.Color(selectedColor);

    // Apply brush in radius
    for (let i = -brushSize; i <= brushSize; i++) {
      for (let j = -brushSize; j <= brushSize; j++) {
        if (i*i + j*j > brushSize*brushSize) continue;
        
        const cx = xIdx + i;
        const cy = yIdx + j;
        if (cx < 0 || cx > GRID_SIZE || cy < 0 || cy > GRID_SIZE) continue;
        
        const idx = cy * (GRID_SIZE + 1) + cx;
        const dist = Math.sqrt(i*i + j*j);
        const falloff = 1 - (dist / (brushSize + 1));
        
        if (mode === 'sculpt') {
          const delta = brushIntensity * falloff * (isShift ? -1 : 1);
          newHeights[idx] += delta;
          modified = true;
        } else if (mode === 'paint') {
          const r = idx * 3;
          const g = idx * 3 + 1;
          const b = idx * 3 + 2;
          
          const currentColor = new THREE.Color(newColors[r], newColors[g], newColors[b]);
          currentColor.lerp(targetColor, falloff * brushIntensity * 0.2); // 0.2 makes it gradual
          
          newColors[r] = currentColor.r;
          newColors[g] = currentColor.g;
          newColors[b] = currentColor.b;
          modified = true;
        }
      }
    }

    if (modified) {
      if (mode === 'sculpt') updateHeights(newHeights);
      if (mode === 'paint') updateColors(newColors);
    }
  };

  const handlePointerDown = (e) => {
    if (isCameraMode || (e.button !== 0 && e.button !== 2)) return;
    setIsPointerDown(true);
    e.stopPropagation();

    if (mode === 'sculpt' || mode === 'paint') {
      saveHistory(); // Save state before stroke
      applyBrush(e.point, e.button === 2 || e.shiftKey); // right click or shift for inverted sculpt
    } else if (mode === 'water') {
      addWaterSource(e.point.x, e.point.z);
    } else if (mode === 'asset') {
      addAsset({
        id: crypto.randomUUID(),
        type: selectedAsset,
        position: [e.point.x, e.point.y, e.point.z]
      });
    } else if (mode === 'decal' && selectedDecalImage) {
      addDecal({
        id: crypto.randomUUID(),
        url: selectedDecalImage,
        position: [e.point.x, e.point.y, e.point.z],
        scale: [brushSize * 2, brushSize * 2, brushSize * 2] // Arbitrary scaling based on brush
      });
    }
  };

  const handlePointerMove = (e) => {
    if (!isPointerDown || isCameraMode) return;
    if (mode === 'sculpt' || mode === 'paint') {
      e.stopPropagation();
      applyBrush(e.point, e.buttons === 2 || e.shiftKey);
    }
  };

  const handlePointerUp = () => {
    setIsPointerDown(false);
  };

  return (
    <mesh 
      ref={meshRef} 
      rotation={[-Math.PI / 2, 0, 0]} 
      receiveShadow 
      castShadow
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerOut={handlePointerUp}
      onContextMenu={(e) => e.preventDefault()}
    >
      <planeGeometry ref={geomRef} args={[50, 50, GRID_SIZE, GRID_SIZE]} />
      <meshStandardMaterial vertexColors side={THREE.DoubleSide} wireframe={false} roughness={0.8} />
    </mesh>
  );
}
