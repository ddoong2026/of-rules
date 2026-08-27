'use client';

import { Canvas } from '@react-three/fiber';
import { OrbitControls, Sky } from '@react-three/drei';
import Terrain from './Terrain';
import AssetManager from './AssetManager';
import FluidSystem from './FluidSystem';
import Player from './Player';
import InventoryUI from './InventoryUI';
import useMapStore from '@/store/useMapStore';

export default function EditorCanvas() {
  const { mode, isCameraMode, isPlaying, sunTime } = useMapStore();

  // Calculate sun position based on time (0-24)
  // 6 = sunrise, 12 = noon, 18 = sunset
  const timeOffset = (sunTime - 6) / 24; 
  const angle = timeOffset * Math.PI * 2;
  
  const sunX = Math.cos(angle) * 50;
  const sunY = Math.sin(angle) * 50;
  const sunZ = Math.cos(angle) * 20; // slight curve
  const sunPosition = [sunX, sunY, sunZ];

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <Canvas
        camera={{ position: [0, 20, 20], fov: 60 }}
        style={{ background: '#87CEEB', cursor: isPlaying ? 'none' : (isCameraMode ? 'grab' : (mode === 'erase' ? 'cell' : 'crosshair')) }}
        onContextMenu={(e) => e.preventDefault()}
        dpr={1}
        performance={{ min: 0.5 }}
      >
        <Sky distance={450000} sunPosition={sunPosition} />
        <ambientLight intensity={sunY > 0 ? 0.5 : 0.1} />
        <directionalLight 
          position={sunPosition} 
          intensity={Math.max(0, sunY) * 0.05 + 0.1} 
        />
        
        <Terrain />
        <AssetManager />
        <FluidSystem />
        
        {isPlaying && <Player />}
        
        <OrbitControls 
          makeDefault 
          enabled={!isPlaying && isCameraMode}
          maxPolarAngle={Math.PI / 2 - 0.05} // don't go below ground
          minDistance={5}
          maxDistance={100}
        />
      </Canvas>

      {/* Crosshair for Play Mode */}
      {isPlaying && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '6px',
          height: '6px',
          backgroundColor: 'rgba(255, 255, 255, 0.8)',
          borderRadius: '50%',
          border: '1px solid rgba(0, 0, 0, 0.5)',
          pointerEvents: 'none'
        }} />
      )}

      <InventoryUI />
    </div>
  );
}
