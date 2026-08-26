'use client';

import { Canvas } from '@react-three/fiber';
import { OrbitControls, Sky } from '@react-three/drei';
import Terrain from './Terrain';
import AssetManager from './AssetManager';
import FluidSystem from './FluidSystem';
import useMapStore from '@/store/useMapStore';

export default function EditorCanvas() {
  const { mode, isCameraMode } = useMapStore();

  return (
    <Canvas
      camera={{ position: [0, 20, 20], fov: 60 }}
      style={{ background: '#87CEEB', cursor: isCameraMode ? 'grab' : (mode === 'erase' ? 'cell' : 'crosshair') }}
      shadows
    >
      <Sky distance={450000} sunPosition={[0, 1, 0]} inclination={0} azimuth={0.25} />
      <ambientLight intensity={0.5} />
      <directionalLight 
        castShadow 
        position={[20, 30, 10]} 
        intensity={1.5} 
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
