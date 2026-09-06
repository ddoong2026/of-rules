'use client';

import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Text, useCursor, Html, useGLTF, useTexture, Cloud, Stars } from '@react-three/drei';
import { useEffect, useState, Suspense, useRef, useMemo } from 'react';
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

function TimeMachine({ position, scale = 1, onZoomStart, onZoomComplete, zoomStage, setZoomStage }) {
  const { scene } = useGLTF('/models/timemachin.glb');
  const meshRef = useRef();
  const [hovered, setHovered] = useState(false);
  useCursor(hovered, 'pointer', 'auto');

  const clonedScene = useMemo(() => scene.clone(), [scene]);

  useFrame((state, delta) => {
    if (meshRef.current) {
      meshRef.current.position.y = position[1] + Math.sin(state.clock.elapsedTime) * 0.8; // Reduced hover effect range
    }
    
    if (zoomStage === 1) {
      // Pan camera slightly lower and zoom in closer
      const focusPos = new THREE.Vector3(position[0], position[1] + 2, position[2] + 45); 
      state.camera.position.lerp(focusPos, delta * 4);
      state.camera.lookAt(position[0], position[1] + 2, position[2] - 10);
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

      
      <primitive object={clonedScene} scale={scale} />
      <Text
        position={[0, 15, 0]} 
        fontSize={3.2}
        color="#fbbf24"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.3}
        outlineColor="#000000"
        font="/fonts/GowunBatang.ttf"
      >
        타임머신 발견!
      </Text>
    </group>
  );
}

export default function Map3D() {
  const router = useRouter();
  const [zoomStage, setZoomStage] = useState(0);

  useEffect(() => {
    if (zoomStage > 0) {
      window.dispatchEvent(new Event('hideNavbarForce'));
    } else {
      window.dispatchEvent(new Event('showNavbarForce'));
    }
    
    return () => {
      window.dispatchEvent(new Event('showNavbarForce'));
    };
  }, [zoomStage]);

  return (
    <div 
      className={styles.canvasContainer}
      style={{
        height: zoomStage > 0 ? '100vh' : 'calc(100vh - 70px)',
        position: zoomStage > 0 ? 'fixed' : 'relative',
        top: zoomStage > 0 ? 0 : 'auto',
        left: 0,
        zIndex: zoomStage > 0 ? 90 : 1,
        backgroundColor: '#f3f4f6'
      }}
    >
      <div 
        style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'linear-gradient(to bottom, #000510 0%, #000510 70%, #080310 85%, #140208 95%, #1a0700 100%)',
          opacity: zoomStage > 0 ? 1 : 0,
          transition: 'opacity 1.5s ease-in-out',
          zIndex: 0
        }}
      />
      <Canvas style={{ position: 'relative', zIndex: 1 }} camera={{ position: [0, 40, 60], fov: 45 }} dpr={1} performance={{ min: 0.5 }}>
        {/* Lighting */}
        <ambientLight intensity={1.5} />
        <directionalLight position={[50, 100, 50]} intensity={2} />
        <pointLight position={[-50, -50, -50]} intensity={0.5} />

        {/* Environment / Ground - Kept normal size */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]}>
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
            zoomStage={zoomStage}
            setZoomStage={setZoomStage}
            onZoomStart={() => setZoomStage(1)}
            onZoomComplete={() => router.push('/fieldtrip')}
          />
        </Suspense>

        {/* Controls */}
        <OrbitControls 
          enabled={zoomStage === 0}
          enablePan={true}
          minPolarAngle={Math.PI / 6}
          maxPolarAngle={Math.PI / 2.2}
          minDistance={20}
          maxDistance={250}
        />
      </Canvas>
      
      {zoomStage === 0 && (
        <div className={styles.overlay}>
          <div className="glass-panel" style={{ padding: '1rem', textAlign: 'center' }}>
            <h2>규칙의 나라에 오신 것을 환영합니다!</h2>
            <p>원하는 기관을 클릭하여 이동하세요.</p>
          </div>
        </div>
      )}
    </div>
  );
}
