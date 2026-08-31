'use client';

import { useEffect, useState, useRef } from 'react';
import useMapStore, { GRID_SIZE, VERTEX_COUNT } from '@/store/useMapStore';
import * as THREE from 'three';

export default function FluidSystem() {
  const { heightsTop, waterSources } = useMapStore();
  const workerRef = useRef(null);
  
  // Instance mesh for dynamic water particles/blocks
  const instancedMeshRef = useRef(null);
  const [waterPositions, setWaterPositions] = useState([]);
  
  // Static Water Level
  const WATER_LEVEL = 0;

  // Initialize Web Worker
  useEffect(() => {
    workerRef.current = new Worker(new URL('/workers/fluidWorker.js', window.location.origin));
    
    workerRef.current.onmessage = (e) => {
      setWaterPositions(e.data.waterPositions);
    };

    return () => {
      if (workerRef.current) workerRef.current.terminate();
    };
  }, []);

  // Send data to worker when heights or waterSources change
  useEffect(() => {
    if (workerRef.current && waterSources.length > 0) {
      workerRef.current.postMessage({
        heights: heightsTop,
        waterSources: waterSources,
        gridSize: GRID_SIZE
      });
    }
  }, [heightsTop, waterSources]);

  // Update InstancedMesh
  useEffect(() => {
    if (instancedMeshRef.current && waterPositions.length > 0) {
      const dummy = new THREE.Object3D();
      waterPositions.forEach((pos, i) => {
        dummy.position.set(pos.x, pos.y, pos.z);
        dummy.scale.set(pos.amount, pos.amount, pos.amount);
        dummy.updateMatrix();
        instancedMeshRef.current.setMatrixAt(i, dummy.matrix);
      });
      instancedMeshRef.current.count = waterPositions.length;
      instancedMeshRef.current.instanceMatrix.needsUpdate = true;
    }
  }, [waterPositions]);

  return (
    <group>
      {/* Static Water is now handled by Terrain.jsx */}

      {/* Dynamic Water Particles */}
      {waterPositions.length > 0 && (
        <instancedMesh ref={instancedMeshRef} args={[null, null, 5000]}>
          <boxGeometry args={[1, 0.5, 1]} />
          <meshStandardMaterial color="#60a5fa" transparent opacity={0.8} />
        </instancedMesh>
      )}
    </group>
  );
}
