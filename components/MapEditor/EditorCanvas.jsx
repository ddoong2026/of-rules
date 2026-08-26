'use client';

import { Canvas } from '@react-three/fiber';
import { OrbitControls, Sky } from '@react-three/drei';
import Terrain from './Terrain';
import AssetManager from './AssetManager';
import FluidSystem from './FluidSystem';
import useMapStore from '@/store/useMapStore';

export default function EditorCanvas() {
  const { mode, isCameraMode, sunTime } = useMapStore();

  // Calculate sun position based on time (0-24)
  // 6 = sunrise, 12 = noon, 18 = sunset
  const timeOffset = (sunTime - 6) / 24; 
  const angle = timeOffset * Math.PI * 2;
  
  const sunX = Math.cos(angle) * 50;
  const sunY = Math.sin(angle) * 50;
  const sunZ = Math.cos(angle) * 20; // slight curve
  const sunPosition = [sunX, sunY, sunZ];

  return (
    <Canvas
      camera={{ position: [0, 20, 20], fov: 60 }}
      style={{ background: '#87CEEB', cursor: isCameraMode ? 'grab' : (mode === 'erase' ? 'cell' : 'crosshair') }}
      onContextMenu={(e) => e.preventDefault()}
      shadows
    >
      <Sky distance={450000} sunPosition={sunPosition} />
      <ambientLight intensity={sunY > 0 ? 0.5 : 0.1} />
      <directionalLight 
        castShadow 
        position={sunPosition} 
        intensity={Math.max(0, sunY) * 0.05 + 0.1} 
        shadow-mapSize-width={2048} 
        shadow-mapSize-height={2048}
        shadow-camera-far={100}
        shadow-camera-left={-30}
        shadow-camera-right={30}
        shadow-camera-top={30}
        shadow-camera-bottom={-30}
      />
      
      <Terrain />
      <AssetManager />
      <FluidSystem />
      
      <OrbitControls 
        makeDefault 
        enabled={isCameraMode}
        maxPolarAngle={Math.PI / 2 - 0.05} // don't go below ground
        minDistance={5}
        maxDistance={100}
      />
    </Canvas>
  );
}
