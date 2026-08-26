'use client';

import { useRef, useState, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useGLTF, useAnimations } from '@react-three/drei';
import * as THREE from 'three';
import useMapStore, { GRID_SIZE } from '@/store/useMapStore';

const WALK_SPEED = 3;
const RUN_SPEED = 8;
const ROTATION_SPEED = 5;

export default function Player() {
  const group = useRef();
  const { scene, animations } = useGLTF('/models/charactor.glb');
  const { actions } = useAnimations(animations, group);
  const { camera } = useThree();
  const heights = useMapStore((state) => state.heights);

  const [keys, setKeys] = useState({ w: false, a: false, s: false, d: false, shift: false });
  const currentAction = useRef('');

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
    if (!actions) return;
    const actionNames = Object.keys(actions);
    if (actionNames.length === 0) return;

    const walkActionName = actionNames.find(n => n.toLowerCase().includes('walk')) || actionNames[0];
    const runActionName = actionNames.find(n => n.toLowerCase().includes('run')) || walkActionName;
    const idleActionName = actionNames.find(n => n.toLowerCase().includes('idle')) || actionNames[0];

    const isMoving = keys.w || keys.a || keys.s || keys.d;
    const isRunning = isMoving && keys.shift;

    const targetAction = isRunning ? runActionName : (isMoving ? walkActionName : idleActionName);

    if (currentAction.current !== targetAction) {
      if (currentAction.current && actions[currentAction.current]) {
        actions[currentAction.current].fadeOut(0.2);
      }
      if (actions[targetAction]) {
        actions[targetAction].reset().fadeIn(0.2).play();
      }
      currentAction.current = targetAction;
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
  const cameraOffset = new THREE.Vector3(0, 3, -5); // 3rd person offset (behind the character)

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
      
      const speed = keys.shift ? RUN_SPEED : WALK_SPEED;
      // Move in the intended direction
      currentVelocity.current.set(
        moveDir.x * speed,
        0,
        moveDir.z * speed
      );
    } else {
      // Decelerate quickly
      currentVelocity.current.lerp(new THREE.Vector3(0, 0, 0), 0.2);
    }

    // Apply movement with slope restriction
    const nextX = group.current.position.x + currentVelocity.current.x * delta;
    const nextZ = group.current.position.z + currentVelocity.current.z * delta;
    
    const dist = Math.sqrt((nextX - group.current.position.x)**2 + (nextZ - group.current.position.z)**2);
    let canMove = true;
    
    if (dist > 0.0001) {
      const currentTerrainHeight = getTerrainHeight(group.current.position.x, group.current.position.z);
      const nextTerrainHeight = getTerrainHeight(nextX, nextZ);
      const slope = (nextTerrainHeight - currentTerrainHeight) / dist;
      
      if (slope > 1.2) { // 1.2 is roughly 50 degrees slope
        canMove = false;
        currentVelocity.current.set(0, 0, 0);
      }
    }

    if (canMove) {
      group.current.position.x = nextX;
      group.current.position.z = nextZ;
    }

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
