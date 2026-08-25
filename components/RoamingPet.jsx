'use client';

import { useRef, useEffect, useState, useMemo } from 'react';
import { usePathname } from 'next/navigation';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF, useAnimations } from '@react-three/drei';
import { SkeletonUtils } from 'three-stdlib';
import * as THREE from 'three';

function PetModel() {
  const group = useRef();
  const { scene, animations } = useGLTF('/models/charactor.glb');
  
  // Clone the scene safely for skinned meshes so it doesn't conflict with the 3D map
  const clonedScene = useMemo(() => SkeletonUtils.clone(scene), [scene]);
  
  const { actions } = useAnimations(animations, group);
  
  const [isMoving, setIsMoving] = useState(false);
  const [isDancing, setIsDancing] = useState(false);
  const speed = 10; // Movement speed
  
  // Track global mouse position and keyboard
  const mouseX = useRef(0);
  const keys = useRef({ space: false });

  useEffect(() => {
    const handleMouseMove = (e) => {
      // Normalize X to -1 to 1
      mouseX.current = (e.clientX / window.innerWidth) * 2 - 1;
    };
    
    const handleKeyDown = (e) => {
      if (e.key === ' ') keys.current.space = true;
    };
    
    const handleKeyUp = (e) => {
      if (e.key === ' ') keys.current.space = false;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);
  
  useEffect(() => {
    if (!actions || Object.keys(actions).length === 0) return;
    const actionNames = Object.keys(actions);
    
    // Find animations
    const walkName = actionNames.find(n => n.toLowerCase().includes('walk') || n.toLowerCase().includes('run')) || actionNames[0];
    const danceName = actionNames.find(n => n.toLowerCase().includes('dance')) || actionNames[0];
    const idleName = actionNames.find(n => n.toLowerCase().includes('idle')) || (actionNames.length > 1 ? actionNames.find(n => n !== walkName && n !== danceName) : walkName);
    
    const walkAction = actions[walkName];
    const idleAction = actions[idleName];
    const danceAction = actions[danceName];

    if (isDancing) {
      walkAction?.fadeOut(0.2);
      idleAction?.fadeOut(0.2);
      danceAction?.reset().fadeIn(0.2).play();
    } else if (isMoving) {
      danceAction?.fadeOut(0.2);
      idleAction?.fadeOut(0.2);
      walkAction?.reset().fadeIn(0.2).play();
    } else {
      walkAction?.fadeOut(0.2);
      danceAction?.fadeOut(0.2);
      idleAction?.reset().fadeIn(0.2).play();
    }
  }, [isMoving, isDancing, actions]);

  useFrame((state, delta) => {
    if (!group.current) return;
    
    const { space } = keys.current;
    
    // Calculate target X position in 3D space based on mouseX and viewport width
    // state.viewport.width gives the width of the visible frustum at z=0
    const targetX = mouseX.current * (state.viewport.width / 2 - 2); // -2 padding
    
    const currentX = group.current.position.x;
    const diff = targetX - currentX;
    const distance = Math.abs(diff);
    
    const threshold = 0.5; // stop moving if close enough
    
    if (space) {
      if (!isDancing) setIsDancing(true);
      if (isMoving) setIsMoving(false);
    } else {
      if (isDancing) setIsDancing(false);
      
      if (distance > threshold) {
        if (!isMoving) setIsMoving(true);
        
        // Move towards target
        const direction = Math.sign(diff);
        group.current.position.x += direction * speed * delta;
        
        // Clamp position so it doesn't overshoot in one frame
        if (direction > 0 && group.current.position.x > targetX) {
          group.current.position.x = targetX;
        } else if (direction < 0 && group.current.position.x < targetX) {
          group.current.position.x = targetX;
        }
        
        // Rotate to face direction
        // +direction means moving right (Math.PI/2), -direction means moving left (-Math.PI/2)
        const targetRotation = direction > 0 ? Math.PI / 2 : -Math.PI / 2;
        group.current.rotation.y = THREE.MathUtils.lerp(group.current.rotation.y, targetRotation, 10 * delta);
        
      } else {
        if (isMoving) setIsMoving(false);
        // Look at screen when idle
        group.current.rotation.y = THREE.MathUtils.lerp(group.current.rotation.y, 0, 10 * delta);
      }
    }
  });

  return (
    <group ref={group} position={[0, -2.5, 0]} rotation={[0, 0, 0]}>
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
