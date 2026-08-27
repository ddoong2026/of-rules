'use client';

import { useRef, useState, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useGLTF, useAnimations } from '@react-three/drei';
import * as THREE from 'three';
import useMapStore, { GRID_SIZE } from '@/store/useMapStore';

const WALK_SPEED = 1.2;
const RUN_SPEED = 3.5;
const ROTATION_SPEED = 5;

export default function Player() {
  const group = useRef();
  const { scene, animations } = useGLTF('/models/charactor2.glb');
  const { actions } = useAnimations(animations, group);
  const { camera } = useThree();
  const heights = useMapStore((state) => state.heights);
  const assets = useMapStore((state) => state.assets);

  const [keys, setKeys] = useState({ w: false, a: false, s: false, d: false, shift: false, space: false, control: false });
  const currentAction = useRef('');
  const isJumping = useRef(false);
  
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
        pitch.current += e.movementY * 0.003; // Inverted Y-axis
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

  // Cache animation action names
  const actionNames = actions ? Object.keys(actions) : [];
  const walkActionName = actionNames.find(n => n.toLowerCase().includes('walk'));
  const runActionName = actionNames.find(n => n.toLowerCase().includes('run')) || walkActionName;

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

  const hasSpawned = useRef(false);
  useEffect(() => {
    if (group.current && !hasSpawned.current) {
      let spawnX = 0;
      let spawnZ = 0;
      let found = false;

      // Spiral search outwards from center to find a dry spot
      for (let r = 0; r < 24; r += 2) {
        for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 4) {
          const x = Math.cos(angle) * r;
          const z = Math.sin(angle) * r;
          const h = getTerrainHeight(x, z);
          
          if (h > -0.1) { // Not in water
            spawnX = x;
            spawnZ = z;
            found = true;
            break;
          }
        }
        if (found) break;
      }

      const terrainH = getTerrainHeight(spawnX, spawnZ);
      // Spawn slightly above the ground (at least height 2) so they fall naturally
      group.current.position.set(spawnX, Math.max(2, terrainH + 2), spawnZ);
      hasSpawned.current = true;
    }
  }, [heights]);

  const currentVelocity = useRef(new THREE.Vector3());
  const smoothedPlayerPos = useRef(new THREE.Vector3());
  const wasGrounded = useRef(true);
  const cameraOffset = new THREE.Vector3(0, 3, -5); // 3rd person offset (behind the character)

  useFrame((state, delta) => {
    if (!group.current) return;

    // Movement Logic relative to camera yaw
    const moveDir = new THREE.Vector3(0, 0, 0);
    const forward = new THREE.Vector3(0, 0, 1).applyEuler(new THREE.Euler(0, yaw.current, 0));
    const right = new THREE.Vector3(1, 0, 0).applyEuler(new THREE.Euler(0, yaw.current, 0));

    if (keys.w) moveDir.add(forward);
    if (keys.s) moveDir.sub(forward);
    if (keys.a) moveDir.add(right); // left (이제 오른쪽으로 이동)
    if (keys.d) moveDir.sub(right); // right (이제 왼쪽으로 이동)

    if (moveDir.lengthSq() > 0) {
      moveDir.normalize();
      
      const speed = keys.shift ? RUN_SPEED : WALK_SPEED;
      // Move in the intended direction (Y 축은 건드리지 않음)
      currentVelocity.current.x = moveDir.x * speed;
      currentVelocity.current.z = moveDir.z * speed;
    } else {
      // Decelerate quickly (Y 축은 건드리지 않음)
      currentVelocity.current.x = THREE.MathUtils.lerp(currentVelocity.current.x, 0, 0.2);
      currentVelocity.current.z = THREE.MathUtils.lerp(currentVelocity.current.z, 0, 0.2);
    }

    // Lock character's visual rotation directly to camera's yaw (fixed behind head)
    group.current.rotation.y = yaw.current;

    const currentTerrainHeight = getTerrainHeight(group.current.position.x, group.current.position.z);
    
    // Apply movement with slope restriction on XZ
    const nextX = group.current.position.x + currentVelocity.current.x * delta;
    const nextZ = group.current.position.z + currentVelocity.current.z * delta;
    
    const dist = Math.sqrt((nextX - group.current.position.x)**2 + (nextZ - group.current.position.z)**2);
    let canMoveXZ = true;
    const nextTerrainHeight = getTerrainHeight(nextX, nextZ);
    
    if (dist > 0.0001) {
      const slope = (nextTerrainHeight - currentTerrainHeight) / dist;
      
      // Block if slope > 1.2 AND we are grounded (not jumping over it)
      if (slope > 1.2 && group.current.position.y <= currentTerrainHeight + 0.5) {
        canMoveXZ = false;
        currentVelocity.current.x = 0;
        currentVelocity.current.z = 0;
      }
    }

    // Block water entry (Invisible Wall at water's edge)
    if (nextTerrainHeight < -0.3) {
      canMoveXZ = false;
      currentVelocity.current.x = 0;
      currentVelocity.current.z = 0;
    }

    // Asset Collision Check
    const PLAYER_RADIUS = 0.2;
    const ASSET_RADII = {
      tree: 0.3,
      rock: 0.5,
      house: 0.8,
      cave: 1.0,
      lake: 0.0 // 호수는 평면이므로 충돌 무시
    };

    if (canMoveXZ) {
      for (const asset of assets) {
        const radius = ASSET_RADII[asset.type] || 0.5;
        if (radius === 0) continue;
        
        const dx = nextX - asset.position[0];
        const dz = nextZ - asset.position[2];
        const distSq = dx*dx + dz*dz;
        
        const minDist = PLAYER_RADIUS + radius;
        // Y축 검사 (에셋 위로 점프해서 넘어갈 수 있는지). 대부분 에셋 높이가 높으므로 단순 원기둥 충돌 처리
        // 만약 캐릭터 높이가 에셋보다 충분히 높다면 통과(점프), 아니면 충돌
        const yDist = group.current.position.y - asset.position[1];
        if (distSq < minDist * minDist && yDist < 1.5) {
          canMoveXZ = false;
          currentVelocity.current.x = 0;
          currentVelocity.current.z = 0;
          break;
        }
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

    // Air Physics
    currentVelocity.current.y -= 10 * delta; // gravity (점프 시간에 맞춰 부드럽게 조정, 띠용 방지)
    
    // Apply Y velocity
    group.current.position.y += currentVelocity.current.y * delta;

    // Ground Collision & Jumping
    const currentGroundHeight = getTerrainHeight(group.current.position.x, group.current.position.z);
    const distToGround = group.current.position.y - currentGroundHeight;
    
    // Character is grounded if exactly on/below ground, OR very close while falling/running (prevents flying off slopes)
    // 0.2였던 스냅 거리를 0.05로 줄여 착지 시 순간이동(통통 튀는/끊기는) 현상 방지
    const isGrounded = distToGround <= 0 || (distToGround < 0.05 && currentVelocity.current.y <= 0);
    
    if (isGrounded) {
      if (!wasGrounded.current) {
        // 착지 시 스케일 변화(띠용 효과) 제거
      }

      if (currentVelocity.current.y <= 0) {
        group.current.position.y = currentGroundHeight; // Snap to ground
        currentVelocity.current.y = 0;
      }
      
      if (keys.space && !isJumping.current) {
        currentVelocity.current.y = 3.0; // JUMP_FORCE (요청하신 3.0으로 설정)
        group.current.position.y += 0.01; // 아주 미세한 값만 올려 바닥 판정을 피함 (0.25 순간이동 제거)
        
        isJumping.current = true;
        
        // 0.5초(500ms) 뒤에 쿨다운 초기화
        setTimeout(() => {
          isJumping.current = false;
        }, 500);
      }
    }
    wasGrounded.current = isGrounded;

    // 서서히 원래 크기로 부드럽게 되돌아옵니다.
    group.current.scale.lerp(new THREE.Vector3(1, 1, 1), 10 * delta);

    // Update Camera
    // Position camera behind and above the player based on pitch and yaw
    // 카메라가 덜덜거리는 현상을 막기 위해 캐릭터 위치를 부드럽게 따라가는 smoothedPlayerPos 사용
    if (smoothedPlayerPos.current.distanceToSquared(group.current.position) > 100) {
      smoothedPlayerPos.current.copy(group.current.position); // 최초 스폰 등 멀리 떨어졌을 때 즉시 이동
    }
    smoothedPlayerPos.current.lerp(group.current.position, 15 * delta);

    const offset = new THREE.Vector3(0, 0.1, -1.0); // 캐릭터의 뒷모습 전체가 보이도록 줌 아웃
    const euler = new THREE.Euler(pitch.current, yaw.current, 0, 'YXZ');
    offset.applyEuler(euler);
    
    // 타겟을 부드럽게 쫓아가는 캐릭터 위치로 설정
    const targetLookAt = smoothedPlayerPos.current.clone().add(new THREE.Vector3(0, 0.4, 0)); 
    const idealCameraPos = targetLookAt.clone().add(offset);
    
    // Prevent camera from clipping through the terrain
    const camGroundHeight = getTerrainHeight(idealCameraPos.x, idealCameraPos.z);
    if (idealCameraPos.y < camGroundHeight + 0.5) {
      idealCameraPos.y = camGroundHeight + 0.5;
    }
    
    // Snap camera position to the smoothed target position
    camera.position.copy(idealCameraPos);
    camera.lookAt(targetLookAt);

    // Handle Animation state based on movement and grounding
    if (actions) {
      const isMoving = keys.w || keys.a || keys.s || keys.d;
      const isRunning = isMoving && keys.shift;

      let targetAction = null;
      if (isRunning && runActionName) {
        targetAction = runActionName;
      } else if (isMoving && walkActionName) {
        targetAction = walkActionName;
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
    }
  });

  return (
    <group ref={group} dispose={null}>
      <primitive object={scene} scale={0.1} />
    </group>
  );
}

// Preload the model
useGLTF.preload('/models/charactor2.glb');
