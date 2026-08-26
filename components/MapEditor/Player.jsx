'use client';

import { useRef, useState, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useGLTF, useAnimations } from '@react-three/drei';
import * as THREE from 'three';
import useMapStore, { GRID_SIZE } from '@/store/useMapStore';

const SPEED = 5;
const ROTATION_SPEED = 5;

export default function Player() {
  const group = useRef();
  const { scene, animations } = useGLTF('/models/charactor.glb');
  const { actions } = useAnimations(animations, group);
  const { camera } = useThree();
  const heights = useMapStore((state) => state.heights);

  const [keys, setKeys] = useState({ w: false, a: false, s: false, d: false });

  useEffect(() => {
    const handleKeyDown = (e) => {
      const key = e.key.toLowerCase();
      if (keys.hasOwnProperty(key)) setKeys(k => ({ ...k, [key]: true }));
    };
    const handleKeyUp = (e) => {
      const key = e.key.toLowerCase();
      if (keys.hasOwnProperty(key)) setKeys(k => ({ ...k, [key]: false }));
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [keys]);

  // Handle Animation state
  useEffect(() => {
    // If model has animations, try to play 'Walk' or 'Run' or the first animation
    const hasMovement = keys.w || keys.a || keys.s || keys.d;
    
    if (actions) {
      const actionNames = Object.keys(actions);
      if (actionNames.length > 0) {
        const walkActionName = actionNames.find(n => n.toLowerCase().includes('walk') || n.toLowerCase().includes('run')) || actionNames[0];
        const idleActionName = actionNames.find(n => n.toLowerCase().includes('idle')) || (walkActionName !== actionNames[0] ? actionNames[0] : null);

        if (hasMovement) {
          if (idleActionName && actions[idleActionName]) actions[idleActionName].fadeOut(0.2);
          if (actions[walkActionName]) actions[walkActionName].reset().fadeIn(0.2).play();
        } else {
          if (actions[walkActionName]) actions[walkActionName].fadeOut(0.2);
          if (idleActionName && actions[idleActionName]) actions[idleActionName].reset().fadeIn(0.2).play();
        }
      }
    }
  }, [keys, actions]);

  // Get terrain height at (x, z)
  const getTerrainHeight = (x, z) => {
    const halfSize = 25;
    const segSize = 50 / GRID_SIZE;
    
    // Clamp to bounds
    const clampedX = Math.max(-halfSize, Math.min(halfSize, x));
    const clampedZ = Math.max(-halfSize, Math.min(halfSize, z));

    // Map to grid coordinates
    const gridX = (clampedX + halfSize) / segSize;
    const gridZ = (clampedZ + halfSize) / segSize;

    const x0 = Math.floor(gridX);
    const x1 = Math.min(GRID_SIZE, x0 + 1);
    const z0 = Math.floor(gridZ);
    const z1 = Math.min(GRID_SIZE, z0 + 1);

    const tx = gridX - x0;
    const tz = gridZ - z0;

    const h00 = heights[z0 * (GRID_SIZE + 1) + x0] || 0;
    const h10 = heights[z0 * (GRID_SIZE + 1) + x1] || 0;
    const h01 = heights[z1 * (GRID_SIZE + 1) + x0] || 0;
    const h11 = heights[z1 * (GRID_SIZE + 1) + x1] || 0;

    // Bilinear interpolation
    const h0 = h00 * (1 - tx) + h10 * tx;
    const h1 = h01 * (1 - tx) + h11 * tx;
    return h0 * (1 - tz) + h1 * tz;
  };

  const currentVelocity = useRef(new THREE.Vector3());
  const cameraOffset = new THREE.Vector3(0, 3, 5); // 3rd person offset

  useFrame((state, delta) => {
    if (!group.current) return;

    // Movement Logic
    const moveDir = new THREE.Vector3(0, 0, 0);
    if (keys.w) moveDir.z -= 1;
    if (keys.s) moveDir.z += 1;
    if (keys.a) moveDir.x -= 1;
    if (keys.d) moveDir.x += 1;

    moveDir.normalize();

    if (moveDir.lengthSq() > 0) {
      // Calculate target angle based on movement direction
      const targetAngle = Math.atan2(moveDir.x, moveDir.z);
      
      // Smoothly rotate character towards target angle
      const currentRotation = group.current.rotation.y;
      
      // Handle angle wrapping (shortest path)
      let diff = targetAngle - currentRotation;
      while (diff < -Math.PI) diff += Math.PI * 2;
      while (diff > Math.PI) diff -= Math.PI * 2;
      
      group.current.rotation.y += diff * ROTATION_SPEED * delta;
      
      // Move forward in the direction it's facing
      currentVelocity.current.set(
        Math.sin(group.current.rotation.y) * SPEED,
        0,
        Math.cos(group.current.rotation.y) * SPEED
      );
    } else {
      // Decelerate quickly
      currentVelocity.current.lerp(new THREE.Vector3(0, 0, 0), 0.2);
    }

    // Apply movement
    group.current.position.x += currentVelocity.current.x * delta;
    group.current.position.z += currentVelocity.current.z * delta;

    // Clamp to map boundary circle (radius 25)
    const distFromCenter = Math.sqrt(group.current.position.x ** 2 + group.current.position.z ** 2);
    if (distFromCenter > 24) {
      const angle = Math.atan2(group.current.position.x, group.current.position.z);
      group.current.position.x = Math.sin(angle) * 24;
      group.current.position.z = Math.cos(angle) * 24;
    }

    // Apply Terrain Height
    const groundHeight = getTerrainHeight(group.current.position.x, group.current.position.z);
    
    // Smoothly interpolate Y position to prevent snapping
    group.current.position.y += (groundHeight - group.current.position.y) * 15 * delta;

    // Update Camera
    // Position camera behind and above the player
    const idealOffset = cameraOffset.clone();
    idealOffset.applyAxisAngle(new THREE.Vector3(0, 1, 0), group.current.rotation.y);
    idealOffset.add(group.current.position);
    
    // Smooth camera follow
    camera.position.lerp(idealOffset, 5 * delta);
    
    // Look at player slightly above feet
    const targetLookAt = group.current.position.clone().add(new THREE.Vector3(0, 1.5, 0));
    camera.lookAt(targetLookAt);
  });

  return (
    <group ref={group} dispose={null}>
      <primitive object={scene} scale={0.5} />
    </group>
  );
}

// Preload the model
useGLTF.preload('/models/charactor.glb');
