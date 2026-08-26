'use client';

import { Canvas } from '@react-three/fiber';
import { Sky, OrbitControls, Environment } from '@react-three/drei';
import { useEffect, useState } from 'react';
import useVoxelStore from '@/store/useVoxelStore';
import VoxelTerrain from './VoxelTerrain';
import * as THREE from 'three';

export default function VoxelCanvas() {
  const { isCameraMode, setCameraMode } = useVoxelStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.code === 'Space' && !e.repeat) {
        setCameraMode(true);
      }
    };
    const handleKeyUp = (e) => {
      if (e.code === 'Space') {
        setCameraMode(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [setCameraMode]);

  // Prevent context menu to allow right-click actions
  const handleContextMenu = (e) => e.preventDefault();

  if (!mounted) return null;

  return (
    <div 
      style={{ width: '100%', height: '100%', position: 'relative' }} 
      onContextMenu={handleContextMenu}
    >
      <Canvas shadows camera={{ position: [15, 15, 15], fov: 50 }}>
        <color attach="background" args={['#87CEEB']} />
        
        {/* Basic Lighting */}
        <ambientLight intensity={0.4} />
        <directionalLight 
          position={[10, 20, 10]} 
          intensity={1.5} 
          castShadow 
          shadow-mapSize={[2048, 2048]}
        >
          <orthographicCamera attach="shadow-camera" args={[-20, 20, 20, -20, 0.1, 50]} />
        </directionalLight>

        <Sky sunPosition={[10, 20, 10]} />
        
        {/* Environment for better reflections on paint/water */}
        <Environment preset="city" />

        {/* Instanced Voxel Terrain */}
        <VoxelTerrain />

        {/* OrbitControls enabled only when Space is held */}
        <OrbitControls 
          enabled={isCameraMode} 
          enableDamping 
          dampingFactor={0.05} 
          maxPolarAngle={Math.PI / 2 - 0.05} // Prevent going below ground
        />
        
        {/* Grid Helper to show ground plane */}
        <gridHelper args={[50, 50, '#888888', '#cccccc']} position={[0, -0.5, 0]} />
      </Canvas>

      {/* Crosshair or Camera Mode Indicator */}
      <div style={{
        position: 'absolute',
        top: 20,
        left: 20,
        background: 'rgba(255,255,255,0.8)',
        padding: '8px 12px',
        borderRadius: '8px',
        fontWeight: 'bold',
        color: isCameraMode ? '#3b82f6' : '#4b5563',
        pointerEvents: 'none',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        {isCameraMode ? '📷 카메라 모드 (회전/이동)' : '🔨 조작 모드 (Space 키로 카메라 모드 전환)'}
      </div>
    </div>
  );
}
