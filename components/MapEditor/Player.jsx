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

  const [keys, setKeys] = useState({ w: false, a: false, s: false, d: false, shift: false, space: false, control: false });
  const currentAction = useRef('');
  
  const yaw = useRef(0);
  const pitch = useRef(0);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.code === 'Space') setKeys(k => ({ ...k, space: true }));
      if (e.key === 'Control') setKeys(k => ({ ...k, control: true }));
      const key = e.key.toLowerCase();
      if (keys.hasOwnProperty(key)) setKeys(k => ({ ...k, [key]: true }));
    };
    const handleKeyUp = (e) => {
      if (e.code === 'Space') setKeys(k => ({ ...k, space: false }));
      if (e.key === 'Control') setKeys(k => ({ ...k, control: false }));
      const key = e.key.toLowerCase();
      if (keys.hasOwnProperty(key)) setKeys(k => ({ ...k, [key]: false }));
    };

    const canvas = document.querySelector('canvas');
    const onCanvasClick = () => {
      if (document.pointerLockElement !== canvas) {
        canvas.requestPointerLock();
      }
    };
    
    const onMouseMove = (e) => {
      if (document.pointerLockElement === canvas) {
        yaw.current -= e.movementX * 0.003;
        pitch.current -= e.movementY * 0.003;
        // Clamp pitch to prevent flipping and going underground
        pitch.current = Math.max(-0.1, Math.min(Math.PI/2 - 0.1, pitch.current));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    if (canvas) canvas.addEventListener('click', onCanvasClick);
    document.addEventListener('mousemove', onMouseMove);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      if (canvas) canvas.removeEventListener('click', onCanvasClick);
      document.removeEventListener('mousemove', onMouseMove);
    };
  }, [keys]);

  // Handle Animation state
  useEffect(() => {
    if (!actions) return;
    const actionNames = Object.keys(actions);
    if (actionNames.length === 0) return;

    const walkActionName = actionNames.find(n => n.toLowerCase().includes('walk'));
    const runActionName = actionNames.find(n => n.toLowerCase().includes('run')) || walkActionName;
    const idleActionName = actionNames.find(n => n.toLowerCase().includes('idle')); // If no explicit idle, don't fallback to random animation

    const isMoving = keys.w || keys.a || keys.s || keys.d;
    const isRunning = isMoving && keys.shift;

    let targetAction = null;
    if (isRunning && runActionName) {
      targetAction = runActionName;
    } else if (isMoving && walkActionName) {
      targetAction = walkActionName;
    } else if (idleActionName) {
      targetAction = idleActionName;
    }

    if (currentAction.current !== targetAction) {
      if (currentAction.current && actions[currentAction.current]) {
        actions[currentAction.current].fadeOut(0.2);
      }
      if (targetAction && actions[targetAction]) {
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

    // Movement Logic relative to camera yaw
    const moveDir = new THREE.Vector3(0, 0, 0);
    const forward = new THREE.Vector3(0, 0, 1).applyEuler(new THREE.Euler(0, yaw.current, 0));
    const right = new THREE.Vector3(1, 0, 0).applyEuler(new THREE.Euler(0, yaw.current, 0));

    if (keys.w) moveDir.add(forward);
    if (keys.s) moveDir.sub(forward);
    if (keys.a) moveDir.sub(right); // left
    if (keys.d) moveDir.add(right); // right

    if (moveDir.lengthSq() > 0) {
      moveDir.normalize();
      
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

    // Lock character's visual rotation directly to camera's yaw (fixed behind head)
    group.current.rotation.y = yaw.current;

    const currentTerrainHeight = getTerrainHeight(group.current.position.x, group.current.position.z);
    
    // Apply movement with slope restriction on XZ
    const nextX = group.current.position.x + currentVelocity.current.x * delta;
    const nextZ = group.current.position.z + currentVelocity.current.z * delta;
    
    const dist = Math.sqrt((nextX - group.current.position.x)**2 + (nextZ - group.current.position.z)**2);
    let canMoveXZ = true;
    
    if (dist > 0.0001) {
      const nextTerrainHeight = getTerrainHeight(nextX, nextZ);
      const slope = (nextTerrainHeight - currentTerrainHeight) / dist;
      
      // Block if slope > 1.2 AND we are grounded (not jumping over it)
      if (slope > 1.2 && group.current.position.y <= currentTerrainHeight + 0.5) {
        canMoveXZ = false;
        currentVelocity.current.x = 0;
        currentVelocity.current.z = 0;
      }
    }

    if (canMoveXZ) {
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

    // Y-Axis Physics (Gravity, Jumping, Swimming)
    const isUnderwater = group.current.position.y < 0; // WATER_LEVEL is 0
    
    if (isUnderwater) {
      // Water Physics
      currentVelocity.current.y -= 2 * delta; // gentle sinking
      currentVelocity.current.y *= 0.95; // drag
      
      if (keys.space) currentVelocity.current.y += 15 * delta; // swim up
      if (keys.control) currentVelocity.current.y -= 15 * delta; // swim down
    } else {
      // Air Physics
      currentVelocity.current.y -= 20 * delta; // gravity
    }
    
    // Apply Y velocity
    group.current.position.y += currentVelocity.current.y * delta;
    
    // Ground Collision
    const currentGroundHeight = getTerrainHeight(group.current.position.x, group.current.position.z);
    
    if (group.current.position.y <= currentGroundHeight) {
      if (!keys.space || isUnderwater) {
        // Smooth snap to ground if not trying to jump out
        group.current.position.y += (currentGroundHeight - group.current.position.y) * 15 * delta;
      } else {
        group.current.position.y = currentGroundHeight;
      }
      
      if (keys.space && !isUnderwater) {
        currentVelocity.current.y = 8; // Jump force
      } else if (currentVelocity.current.y < 0) {
        currentVelocity.current.y = 0; // Stop falling
      }
    }

    // Update Camera
    // Position camera behind and above the player based on pitch and yaw
    const offset = new THREE.Vector3(0, 0, -5); // 5 units away
    const euler = new THREE.Euler(pitch.current, yaw.current, 0, 'YXZ');
    offset.applyEuler(euler);
    
    const targetLookAt = group.current.position.clone().add(new THREE.Vector3(0, 1.5, 0));
    const idealCameraPos = targetLookAt.clone().add(offset);
    
    // Prevent camera from clipping through the terrain
    const camGroundHeight = getTerrainHeight(idealCameraPos.x, idealCameraPos.z);
    if (idealCameraPos.y < camGroundHeight + 0.5) {
      idealCameraPos.y = camGroundHeight + 0.5;
    }
    
    // Snap camera position
    camera.position.copy(idealCameraPos);
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
