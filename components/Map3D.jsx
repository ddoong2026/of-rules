'use client';

import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Text, useCursor, Html, useGLTF, useTexture, Cloud } from '@react-three/drei';
import { useState, Suspense, useRef } from 'react';
import { useRouter } from 'next/navigation';
import * as THREE from 'three';
import styles from './Map3D.module.css';

function Flag({ position }) {
  const texture = useTexture('/flag.jpg');
  const meshRef = useRef();
  
  useFrame((state) => {
    if (meshRef.current) {
      const time = state.clock.getElapsedTime();
      const positionAttribute = meshRef.current.geometry.attributes.position;
      const vertex = new THREE.Vector3();
      for (let i = 0; i < positionAttribute.count; i++) {
        vertex.fromBufferAttribute(positionAttribute, i);
        // waveX is 0 at the left edge (x = -5) and 10 at the right edge (x = 5)
        const waveX = vertex.x + 5; 
        vertex.z = Math.sin(waveX * 0.5 - time * 5) * (waveX * 0.15);
        positionAttribute.setXYZ(i, vertex.x, vertex.y, vertex.z);
      }
      meshRef.current.geometry.attributes.position.needsUpdate = true;
      meshRef.current.geometry.computeVertexNormals();
    }
  });

  return (
    <group position={position}>
      {/* Flag pole */}
      <mesh position={[-5.1, 15, 0]}>
        <cylinderGeometry args={[0.3, 0.3, 30, 16]} />
        <meshStandardMaterial color="#6b7280" metalness={0.6} roughness={0.4} />
      </mesh>
      
      {/* Flag cloth */}
      <mesh ref={meshRef} position={[0, 26, 0]}>
        <planeGeometry args={[10, 6, 20, 20]} />
        <meshStandardMaterial map={texture} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

function Building({ position, label, path, onClick, scale = 1 }) {
  const [hovered, setHovered] = useState(false);
  useCursor(hovered, 'pointer', 'auto');

  // Load the GLTF model
  const { scene } = useGLTF(path);

  return (
    <group position={position}>
      <mesh
        onDoubleClick={onClick}
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
            더블클릭하여 {label}로 이동
          </div>
        </Html>
      )}
    </group>
  );
}

function TimeMachine({ position, scale = 1, onZoomStart, onZoomComplete }) {
  const { scene } = useGLTF('/models/timemachin.glb');
  const meshRef = useRef();
  const [hovered, setHovered] = useState(false);
  const [zoomStage, setZoomStage] = useState(0); // 0: none, 1: focus, 2: enter
  useCursor(hovered, 'pointer', 'auto');

  useFrame((state, delta) => {
    if (meshRef.current) {
      meshRef.current.position.y = position[1] + Math.sin(state.clock.elapsedTime) * 2; // Hover effect
    }
    
    if (zoomStage === 1) {
      // Pan camera upwards to show text without tilting
      const focusPos = new THREE.Vector3(position[0], position[1] + 5, position[2] + 40); 
      state.camera.position.lerp(focusPos, delta * 4);
      state.camera.lookAt(position[0], position[1] + 5, position[2] - 10);
    } else if (zoomStage === 2) {
      // Animate camera deep into the dark part of the cave
      const targetPos = new THREE.Vector3(position[0], position[1] - 3, position[2] - 10);
      state.camera.position.lerp(targetPos, delta * 3.5);
      state.camera.lookAt(position[0], position[1] - 3, position[2] - 100);
    }
  });

  const handleClick = (e) => {
    e.stopPropagation();
    if (zoomStage === 0) {
      setZoomStage(1);
      onZoomStart(); // Disable OrbitControls
    } else if (zoomStage === 1) {
      setZoomStage(2);
      setTimeout(() => {
        onZoomComplete();
      }, 1500); // 1.5 seconds zoom animation before routing
    }
  };

  return (
    <group 
      position={position} 
      ref={meshRef}
      onClick={handleClick}
      onPointerOver={(e) => { e.stopPropagation(); setHovered(true); }}
      onPointerOut={() => setHovered(false)}
    >
      <Cloud 
        position={[0, -5, 0]} // Positioned slightly lower
        scale={scale * 0.1} // Increased base scale
        opacity={0.6} 
        speed={0.4} 
        width={100} // Much wider X area
        depth={100} // Much deeper Z area
        segments={60} // More particles to fill the area
        color="#ffffff"
      />
      
      <primitive object={scene.clone()} scale={scale} />
      <Text
        position={[0, 15, 0]} 
        fontSize={6}
        color="#fbbf24"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.3}
        outlineColor="#000000"
      >
        타임머신 발견!
      </Text>
    </group>
  );
}

export default function Map3D() {
  const router = useRouter();
  const [isZooming, setIsZooming] = useState(false);

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
          <Flag position={[0, 0, 0]} />
          
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
          
          {/* Time Machine high in the sky and further back */}
          <TimeMachine 
            position={[0, 110, -50]} 
            scale={35} 
            onZoomStart={() => setIsZooming(true)}
            onZoomComplete={() => router.push('/fieldtrip')}
          />
        </Suspense>

        {/* Controls */}
        <OrbitControls 
          enabled={!isZooming}
          enablePan={true}
          minPolarAngle={Math.PI / 6}
          maxPolarAngle={Math.PI / 2.2}
          minDistance={20}
          maxDistance={250}
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
