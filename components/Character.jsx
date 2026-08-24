'use client';

import { useRef, useEffect, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF, useAnimations } from '@react-three/drei';
import * as THREE from 'three';

export function Character() {
  const groupRef = useRef();
  const { scene, animations } = useGLTF('/models/charactor.glb');
  const { actions } = useAnimations(animations, groupRef);
  
  // Track pressed keys
  const keys = useRef({ w: false, a: false, s: false, d: false });
  const [isMoving, setIsMoving] = useState(false);

  // Desired camera offset relative to the character
  const cameraOffset = new THREE.Vector3(0, 5, -15); // Behind and slightly above
  const lookAtOffset = new THREE.Vector3(0, 2, 0); // Look slightly above the character's feet

  useEffect(() => {
    const handleKeyDown = (e) => {
      switch (e.key.toLowerCase()) {
        case 'w': case 'arrowup': keys.current.w = true; break;
        case 'a': case 'arrowleft': keys.current.a = true; break;
        case 's': case 'arrowdown': keys.current.s = true; break;
        case 'd': case 'arrowright': keys.current.d = true; break;
      }
    };
    
    const handleKeyUp = (e) => {
      switch (e.key.toLowerCase()) {
        case 'w': case 'arrowup': keys.current.w = false; break;
        case 'a': case 'arrowleft': keys.current.a = false; break;
        case 's': case 'arrowdown': keys.current.s = false; break;
        case 'd': case 'arrowright': keys.current.d = false; break;
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
    
    // Find animation by name matching (fallback to whatever is available)
    const walkName = actionNames.find(n => n.toLowerCase().includes('walk') || n.toLowerCase().includes('run')) || actionNames[0];
    const idleName = actionNames.find(n => n.toLowerCase().includes('idle')) || (actionNames.length > 1 ? actionNames.find(n => n !== walkName) : walkName);

    const walkAction = actions[walkName];
    const idleAction = actions[idleName];

    if (isMoving) {
      idleAction?.fadeOut(0.2);
      walkAction?.reset().fadeIn(0.2).play();
    } else {
      walkAction?.fadeOut(0.2);
      idleAction?.reset().fadeIn(0.2).play();
    }
  }, [isMoving, actions]);

  useFrame((state, delta) => {
    if (!groupRef.current) return;

    const speed = 25 * delta; 
    const rotationSpeed = 3 * delta; 

    const { w, a, s, d } = keys.current;
    
    // Update moving state for animation
    const currentlyMoving = w || s;
    if (isMoving !== currentlyMoving) {
      setIsMoving(currentlyMoving);
    }

    // Rotate character
    if (a) groupRef.current.rotation.y += rotationSpeed;
    if (d) groupRef.current.rotation.y -= rotationSpeed;

    // Forward direction relative to character rotation
    const direction = new THREE.Vector3(0, 0, 1);
    direction.applyQuaternion(groupRef.current.quaternion);

    // Move character forward/backward
    if (w) groupRef.current.position.addScaledVector(direction, speed);
    if (s) groupRef.current.position.addScaledVector(direction, -speed);

    // Limit boundaries (optional, to prevent falling off the 150x150 map)
    groupRef.current.position.x = THREE.MathUtils.clamp(groupRef.current.position.x, -70, 70);
    groupRef.current.position.z = THREE.MathUtils.clamp(groupRef.current.position.z, -70, 70);

    // --- Camera Follow Logic ---
    const currentPosition = groupRef.current.position.clone();
    
    // Calculate ideal camera position (rotated by character's orientation)
    const idealCameraPos = currentPosition.clone().add(
      cameraOffset.clone().applyQuaternion(groupRef.current.quaternion)
    );
    
    // Lerp camera position for smooth following
    state.camera.position.lerp(idealCameraPos, 0.1);

    // Calculate ideal lookAt point
    const idealLookAt = currentPosition.clone().add(lookAtOffset);
    state.camera.lookAt(idealLookAt);
  });

  return (
    <group ref={groupRef} position={[0, 0, 0]}>
      {/* 
        We might need to adjust the scale or rotation of the imported model. 
        Assuming it faces +Z by default.
      */}
      <primitive object={scene} scale={2} />
    </group>
  );
}

// Preload the character model
useGLTF.preload('/models/charactor.glb');
