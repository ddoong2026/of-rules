'use client';

import { Canvas } from '@react-three/fiber';
import { OrbitControls, Text, useCursor, Html, useGLTF } from '@react-three/drei';
import { useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import styles from './Map3D.module.css';

function Building({ position, label, path, onClick, scale = 1 }) {
  const [hovered, setHovered] = useState(false);
  useCursor(hovered, 'pointer', 'auto');

  // Load the GLTF model
  const { scene } = useGLTF(path);

  return (
    <group position={position}>
      <mesh
        onClick={onClick}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
        position={[0, Math.sin(hovered ? 0.2 : 0) * (scale * 0.15), 0]} // Slight hover bounce proportional to size
      >
        <primitive object={scene.clone()} scale={scale} />
      </mesh>
      
      {/* 3D Label */}
      <Text
        position={[0, 17, 0]} // Set fixed height closer to the building
        fontSize={4}
        color="#1f2937"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.15}
        outlineColor="#ffffff"
      >
        {label}
      </Text>

      {/* HTML tooltip on hover */}
      {hovered && (
        <Html position={[0, 23, 0]} center>
          <div className={styles.tooltip}>
            클릭하여 {label}로 이동
          </div>
        </Html>
      )}
    </group>
  );
}

export default function Map3D() {
  const router = useRouter();

  return (
    <div className={styles.canvasContainer}>
      <Canvas camera={{ position: [0, 40, 60], fov: 45 }}>
        {/* Lighting */}
        <ambientLight intensity={1.5} />
        <directionalLight position={[50, 100, 50]} intensity={2} castShadow />
        <pointLight position={[-50, -50, -50]} intensity={0.5} />

        {/* Environment / Ground - Kept normal size */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]} receiveShadow>
          <planeGeometry args={[150, 150]} />
          <meshStandardMaterial color="#e5e7eb" roughness={0.8} />
        </mesh>

        {/* Grid helper for aesthetics */}
        <gridHelper args={[150, 100, '#d1d5db', '#f3f4f6']} position={[0, -0.09, 0]} />

        <Suspense fallback={null}>
          {/* Buildings - Kept Large but map is normal */}
          <Building 
            position={[-40, 12, -15]} 
            scale={30}
            label="국회" 
            path="/models/Congress.glb"
            onClick={() => router.push('/assembly')}
          />
          
          <Building 
            position={[0, 8, 30]} 
            scale={30}
            label="정부" 
            path="/models/blue house.glb"
            onClick={() => router.push('/government')}
          />
          
          <Building 
            position={[40, 12, -15]} 
            scale={30}
            label="법원" 
            path="/models/courthouse.glb"
            onClick={() => router.push('/court')}
          />
        </Suspense>

        {/* Controls */}
        <OrbitControls 
          enablePan={false}
          minPolarAngle={Math.PI / 6}
          maxPolarAngle={Math.PI / 2.2}
          minDistance={20}
          maxDistance={120}
        />
      </Canvas>
      
      <div className={styles.overlay}>
        <div className="glass-panel" style={{ padding: '1rem', textAlign: 'center' }}>
          <h2>규칙의 나라에 오신 것을 환영합니다!</h2>
          <p>원하는 기관을 클릭하여 이동하세요.</p>
        </div>
      </div>
    </div>
  );
}
