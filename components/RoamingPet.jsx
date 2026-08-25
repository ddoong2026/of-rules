'use client';

import { useRef, useEffect, useState, useMemo } from 'react';
import { usePathname } from 'next/navigation';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF, useAnimations } from '@react-three/drei';
import { SkeletonUtils } from 'three-stdlib';

function PetModel() {
  const group = useRef();
  const { scene, animations } = useGLTF('/models/charactor.glb');
  
  // Clone the scene safely for skinned meshes so it doesn't conflict with the 3D map
  const clonedScene = useMemo(() => SkeletonUtils.clone(scene), [scene]);
  
  const { actions } = useAnimations(animations, group);
  
  const [direction, setDirection] = useState(1); // 1 = right, -1 = left
  const speed = 2.5; 
  const bound = 25; // How far it walks left/right
  
  useEffect(() => {
    if (!actions || Object.keys(actions).length === 0) return;
    const actionNames = Object.keys(actions);
    
    // Find walk or run animation
    const walkName = actionNames.find(n => n.toLowerCase().includes('walk') || n.toLowerCase().includes('run')) || actionNames[0];
    
    if (actions[walkName]) {
      actions[walkName].reset().fadeIn(0.2).play();
    }
  }, [actions]);

  useFrame((state, delta) => {
    if (group.current) {
      group.current.position.x += speed * direction * delta;
      
      // Turn around when hitting boundaries
      if (group.current.position.x > bound) {
        setDirection(-1);
        group.current.rotation.y = -Math.PI / 2; // Face left
      } else if (group.current.position.x < -bound) {
        setDirection(1);
        group.current.rotation.y = Math.PI / 2; // Face right
      }
    }
  });

  return (
    <group ref={group} position={[-bound + 2, -2.5, 0]} rotation={[0, Math.PI / 2, 0]}>
      <primitive object={clonedScene} scale={2} />
    </group>
  );
}

export default function RoamingPet() {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);
  
  // 메인 3D 지도 화면(/) 에서는 펫을 숨기고, 나머지 화면(국회, 정부, 법원 등)에서만 렌더링
  if (!mounted || pathname === '/') return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      width: '100vw',
      height: '180px',
      pointerEvents: 'none',
      zIndex: 9999,
      overflow: 'hidden'
    }}>
      <Canvas camera={{ position: [0, 0, 15], fov: 30 }}>
        <ambientLight intensity={1.2} />
        <directionalLight position={[10, 10, 10]} intensity={1.5} />
        <PetModel />
      </Canvas>
    </div>
  );
}
