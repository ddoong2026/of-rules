'use client';

import { useRef, useEffect, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF, useAnimations } from '@react-three/drei';
import * as THREE from 'three';

export function Character() {
  const groupRef = useRef();
  const { scene, animations } = useGLTF('/models/charactor2.glb');
  const { actions } = useAnimations(animations, groupRef);
  
  // Track pressed keys
  const keys = useRef({ w: false, a: false, s: false, d: false, space: false });
  const [isMoving, setIsMoving] = useState(false);
  const [isDancing, setIsDancing] = useState(false);

  // Desired camera offset relative to the world
  const cameraOffset = new THREE.Vector3(0, 10, -20); // Behind and above
  const lookAtOffset = new THREE.Vector3(0, 2, 0); // Look slightly above the character's feet

  useEffect(() => {
    const handleKeyDown = (e) => {
      switch (e.key.toLowerCase()) {
        case 'w': case 'arrowup': keys.current.w = true; break;
        case 'a': case 'arrowleft': keys.current.a = true; break;
        case 's': case 'arrowdown': keys.current.s = true; break;
        case 'd': case 'arrowright': keys.current.d = true; break;
        case ' ': keys.current.space = true; break;
      }
    };
    
    const handleKeyUp = (e) => {
      switch (e.key.toLowerCase()) {
        case 'w': case 'arrowup': keys.current.w = false; break;
        case 'a': case 'arrowleft': keys.current.a = false; break;
        case 's': case 'arrowdown': keys.current.s = false; break;
        case 'd': case 'arrowright': keys.current.d = false; break;
        case ' ': keys.current.space = false; break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Handle Animations
  useEffect(() => {
    if (!actions || Object.keys(actions).length === 0) return;

    const actionNames = Object.keys(actions);
    
    // Find animation by name matching
    const walkName = actionNames.find(n => n.toLowerCase().includes('walk') || n.toLowerCase().includes('run'));
    const walkAction = walkName ? actions[walkName] : null;

    if (isMoving && walkAction) {
      walkAction.reset().fadeIn(0.2).play();
    } else {
      if (walkAction && walkAction.isRunning()) {
        walkAction.fadeOut(0.2);
      }
      // 혹시 모를 다른 모든 액션 중지
      Object.values(actions).forEach(action => {
        if (action !== walkAction && action.isRunning()) action.fadeOut(0.2);
      });
    }
  }, [isMoving, actions]);

  useFrame((state, delta) => {
    if (!groupRef.current) return;

    const speed = 25 * delta; 

    const { w, a, s, d, space } = keys.current;
    
    // Update moving and dancing state for animation
    const currentlyMoving = (w || s || a || d) && !space;
    if (isMoving !== currentlyMoving) {
      setIsMoving(currentlyMoving);
    }
    if (isDancing !== space) {
      setIsDancing(space);
    }

    // --- Mouse Follow Logic ---
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(state.pointer, state.camera);
    
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const target = new THREE.Vector3();
    
    raycaster.ray.intersectPlane(plane, target);
    
    if (target && !space) {
      // Calculate angle towards mouse cursor
      // atan2(x, z) because we rotate on Y axis.
      const angle = Math.atan2(target.x - groupRef.current.position.x, target.z - groupRef.current.position.z);
      groupRef.current.rotation.y = angle;
    }

    // --- Movement Logic (World-relative) ---
    const moveDir = new THREE.Vector3(0, 0, 0);
    if (w) moveDir.z += 1;
    if (s) moveDir.z -= 1;
    if (a) moveDir.x += 1; // +X is left relative to camera facing +Z
    if (d) moveDir.x -= 1; // -X is right relative to camera facing +Z
    
    if (moveDir.lengthSq() > 0 && !space) {
      moveDir.normalize();
      groupRef.current.position.addScaledVector(moveDir, speed);
    }

    // Limit boundaries (optional, to prevent falling off the 150x150 map)
    groupRef.current.position.x = THREE.MathUtils.clamp(groupRef.current.position.x, -70, 70);
    groupRef.current.position.z = THREE.MathUtils.clamp(groupRef.current.position.z, -70, 70);

    // --- Camera Follow Logic ---
    const currentPosition = groupRef.current.position.clone();
    
    // Fixed camera offset relative to the world
    const idealCameraPos = currentPosition.clone().add(cameraOffset);
    
    // Lerp camera position for smooth following
    state.camera.position.lerp(idealCameraPos, 0.1);

    // Calculate ideal lookAt point
    const idealLookAt = currentPosition.clone().add(lookAtOffset);
    state.camera.lookAt(idealLookAt);
  });

  return (
    <group ref={groupRef} position={[0, 0, 0]}>
      <primitive object={scene} scale={2} />
    </group>
  );
}

useGLTF.preload('/models/charactor2.glb');
