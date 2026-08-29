'use client';

import { useRef, useState, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useGLTF, useAnimations, Html } from '@react-three/drei';
import * as THREE from 'three';
import useMapStore, { GRID_SIZE } from '@/store/useMapStore';
import useInventoryStore from '@/store/useInventoryStore';

const WALK_SPEED = 1.2;
const RUN_SPEED = 2.8;
const ROTATION_SPEED = 5;

function PlayerGauge({ progressRef }) {
  const barRef = useRef();
  const containerRef = useRef();
  
  useFrame(() => {
    if (barRef.current && containerRef.current) {
      const p = progressRef.current;
      barRef.current.style.width = `${(p / 5) * 100}%`;
      containerRef.current.style.display = p > 0 ? 'block' : 'none';
    }
  });

  return (
    <Html position={[0, 2.5, 0]} center sprite zIndexRange={[100, 0]}>
      <div ref={containerRef} style={{ display: 'none', width: '60px', height: '10px', background: 'rgba(0,0,0,0.6)', border: '2px solid white', borderRadius: '5px', overflow: 'hidden' }}>
        <div ref={barRef} style={{ width: '0%', height: '100%', background: '#4ade80', transition: 'width 0.05s linear' }} />
      </div>
    </Html>
  );
}

export default function Player() {
  const group = useRef();
  const { scene, animations } = useGLTF('/models/charactor2.glb');
  const { actions } = useAnimations(animations, group);
  const { camera, scene: glScene } = useThree();
  const heights = useMapStore((state) => state.heights);
  const assets = useMapStore((state) => state.assets);

  const [keys, setKeys] = useState({ w: false, a: false, s: false, d: false, shift: false, space: false, control: false });
  const currentAction = useRef('');
  const isJumping = useRef(false);
  
  const yaw = useRef(0);
  const pitch = useRef(0);
  
  const mineProgressRef = useRef(0);
  const mineTargetIdRef = useRef(null);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (useMapStore.getState().mineMiniGame.active) return;
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
      if (useMapStore.getState().mineMiniGame.active) return;
      if (canvas && document.pointerLockElement !== canvas) {
        try {
          const p = canvas.requestPointerLock();
          if (p && typeof p.catch === 'function') p.catch(() => {});
        } catch (err) {}
      }
    };
    
    const onMouseMove = (e) => {
      if (useMapStore.getState().mineMiniGame.active) return;
      if (document.pointerLockElement === canvas) {
        yaw.current -= e.movementX * 0.003;
        pitch.current += e.movementY * 0.003; // Inverted Y-axis
        // Clamp pitch to prevent flipping and going underground
        pitch.current = Math.max(-0.1, Math.min(Math.PI/2 - 0.1, pitch.current));
      }
    };

    const handleMouseDown = (e) => {
      // 좌클릭이고 마우스 잠금 상태일 때 순수 거리/방향 수학으로 채집 판정
      if (e.button === 0 && document.pointerLockElement === canvas) {
        if (useMapStore.getState().mineMiniGame.active) return;
        if (!group.current) return;
        
        const playerPos = group.current.position;
        // 캐릭터의 정면 벡터 (X, Z 평면)
        const forward = new THREE.Vector3(0, 0, 1).applyEuler(new THREE.Euler(0, yaw.current, 0));
        
        let closestAssetId = null;
        let minDistance = 2.5; // 최대 채집 거리
        
        for (const asset of assets) {
          if (asset.minedAt) continue;
          
          const assetX = asset.position[0];
          const assetZ = asset.position[2];
          
          const dx = assetX - playerPos.x;
          const dz = assetZ - playerPos.z;
          const distance = Math.sqrt(dx*dx + dz*dz);
          
          if (distance < minDistance) {
            const dir = new THREE.Vector3(dx, 0, dz).normalize();
            const dot = forward.dot(dir);
            
            if (dot > 0.3 || distance < 1.0) {
              minDistance = distance;
              closestAssetId = asset.id;
            }
          }
        }
        
        if (closestAssetId) {
          const targetAsset = assets.find(a => a.id === closestAssetId);
          const isTree = targetAsset?.type === 'tree';
          const isNPC = targetAsset?.type?.startsWith('caveman');
          
          if (isNPC) {
            if (targetAsset.hasDialogue !== false) {
              window.dispatchEvent(new CustomEvent('npc-interact', { detail: { asset: targetAsset } }));
              if (document.pointerLockElement === canvas) {
                document.exitPointerLock();
              }
            }
            return;
          }

          // 시작! (수학 채집 미니게임)
          useMapStore.getState().setMineMiniGame(true, closestAssetId, targetAsset?.type);
          if (document.pointerLockElement === canvas) {
            document.exitPointerLock();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousedown', handleMouseDown);
    if (canvas) canvas.addEventListener('click', onCanvasClick);
    document.addEventListener('mousemove', onMouseMove);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousedown', handleMouseDown);
      if (canvas) canvas.removeEventListener('click', onCanvasClick);
      document.removeEventListener('mousemove', onMouseMove);
    };
  }, [keys, camera, glScene]);

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
  const cameraOverride = useRef({
    active: false,
    state: 'none', // 'traveling_to', 'waiting', 'traveling_back'
    startTime: 0,
    returnStartTime: 0,
    targetPos: new THREE.Vector3()
  });
  
  useEffect(() => {
    if (group.current && !hasSpawned.current) {
      const spawnPoint = useMapStore.getState().spawnPoint;
      let spawnX = 0;
      let spawnZ = 0;
      let found = false;

      if (spawnPoint) {
        if (Array.isArray(spawnPoint)) {
          spawnX = spawnPoint[0] || 0;
          spawnZ = spawnPoint[2] || 0;
        } else {
          spawnX = spawnPoint.x || 0;
          spawnZ = spawnPoint.z || 0;
        }
        found = true;
      } else {
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
  const lastBoundaryMessageTime = useRef(0);
  const cameraOffset = new THREE.Vector3(0, 3, -5); // 3rd person offset (behind the character)

  useEffect(() => {
    const handleClose = () => {
      if (cameraOverride.current.active && cameraOverride.current.state === 'waiting') {
        cameraOverride.current.state = 'traveling_back';
        cameraOverride.current.returnStartTime = performance.now();
      }
    };
    window.addEventListener('boundary-message-close', handleClose);
    return () => window.removeEventListener('boundary-message-close', handleClose);
  }, []);

  useFrame((state, delta) => {
    if (!group.current) return;
    
    // 채집 게이지 서서히 감소
    if (mineProgressRef.current > 0) {
      mineProgressRef.current = Math.max(0, mineProgressRef.current - delta * 1.5);
      if (mineProgressRef.current === 0) {
        mineTargetIdRef.current = null;
      }
    }

    // Movement Logic relative to camera yaw
    const moveDir = new THREE.Vector3(0, 0, 0);
    const forward = new THREE.Vector3(0, 0, 1).applyEuler(new THREE.Euler(0, yaw.current, 0));
    const right = new THREE.Vector3(1, 0, 0).applyEuler(new THREE.Euler(0, yaw.current, 0));

    if (!cameraOverride.current.active) {
      if (keys.w) moveDir.add(forward);
      if (keys.s) moveDir.sub(forward);
      if (keys.a) moveDir.add(right); // left (이제 오른쪽으로 이동)
      if (keys.d) moveDir.sub(right); // right (이제 왼쪽으로 이동)
    }

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
    const PLAYER_RADIUS = 0.06;
    const ASSET_RADII = {
      tree: 0.15,
      rock: 0.25,
      house: 0.55,
      cave: 0.6,
      lake: 0.0,
      caveman1: 0.05,
      caveman2: 0.05,
      caveman3: 0.05,
      caveman4: 0.05
    };

    if (canMoveXZ) {
      for (const asset of assets) {
        if (asset.minedAt) continue;

        const radius = ASSET_RADII[asset.type] || 0.2;
        if (radius === 0) continue;
        
        const assetX = asset.position[0];
        const assetY = asset.position[1];
        const assetZ = asset.position[2];

        const dx = nextX - assetX;
        const dz = nextZ - assetZ;
        const distSq = dx*dx + dz*dz;
        
        const minDist = PLAYER_RADIUS + radius;
        // Y축 검사 (에셋 위로 점프해서 넘어갈 수 있는지).
        const yDist = group.current.position.y - assetY;
        const isNPC = asset.type.startsWith('caveman');
        const heightThreshold = isNPC ? 0.3 : 1.2;
        
        if (distSq < minDist * minDist && yDist < heightThreshold) {
          canMoveXZ = false;
          currentVelocity.current.x = 0;
          currentVelocity.current.z = 0;
          break;
        }
      }
    }
    
    // Boundary Collision Check
    if (canMoveXZ) {
      const p1 = { x: group.current.position.x, z: group.current.position.z };
      const p2 = { x: nextX, z: nextZ };
      const { boundaries } = useMapStore.getState();
      const { items } = useInventoryStore.getState();
      
      for (const b of boundaries) {
        let isActive = true;
        if (b.condition) {
          let currentAmount = 0;
          for (let i = 0; i < items.length; i++) {
            if (items[i] && items[i].type === b.condition.itemType) currentAmount += items[i].count;
          }
          if (currentAmount >= (b.condition.amount || 1)) isActive = false;
        }
        
        if (isActive) {
          const points = b.points || (b.start && b.end ? [b.start, b.end] : []);
          
          for (let i = 0; i < points.length - 1; i++) {
            const b1 = { x: points[i][0], z: points[i][1] };
            const b2 = { x: points[i+1][0], z: points[i+1][1] };
            
            // Line segment intersection math
            const denom = (p2.z - p1.z) * (b2.x - b1.x) - (p2.x - p1.x) * (b2.z - b1.z);
            if (denom !== 0) {
              const ua = ((p2.x - p1.x) * (b1.z - p1.z) - (p2.z - p1.z) * (b1.x - p1.x)) / denom;
              const ub = ((b2.x - b1.x) * (b1.z - p1.z) - (b2.z - b1.z) * (b1.x - p1.x)) / denom;
              
              if (ua >= -0.1 && ua <= 1.1 && ub >= 0 && ub <= 1) {
                canMoveXZ = false;
                currentVelocity.current.x = 0;
                currentVelocity.current.z = 0;
                
                const now = performance.now();
                if (now - lastBoundaryMessageTime.current > 3500) { // 3.5s cooldown
                  lastBoundaryMessageTime.current = now;
                  const message = b.condition.message || "조건을 달성해야 통과할 수 있습니다.";
                  const additionalMessage = b.condition.additionalMessage;
                  const targetAssetId = b.condition.targetAssetId;
                  
                  if (targetAssetId) {
                    const targetAsset = useMapStore.getState().assets.find(a => a.id === targetAssetId);
                    if (targetAsset) {
                      cameraOverride.current.active = true;
                      cameraOverride.current.state = 'traveling_to';
                      cameraOverride.current.startTime = now;
                      cameraOverride.current.targetPos.set(targetAsset.position[0], targetAsset.position[1], targetAsset.position[2]);
                    }
                  }
                  
                  window.dispatchEvent(new CustomEvent('boundary-collide', { detail: { message, additionalMessage, boundaryId: b.id } }));
                }
                break;
              }
            }
          }
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
      
      if (!cameraOverride.current.active && keys.space && !isJumping.current) {
        currentVelocity.current.y = 2.5; // JUMP_FORCE
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
    
    let finalIdealCameraPos = idealCameraPos.clone();
    let finalTargetLookAt = targetLookAt.clone();

    if (cameraOverride.current.active) {
      const now = performance.now();
      const tAsset = cameraOverride.current.targetPos;
      const EYE_LEVEL = 0.2; // Player capsule height is ~0.27
      
      // Calculate destination in front of asset
      const dirToPlayer = group.current.position.clone().sub(tAsset);
      dirToPlayer.y = 0;
      if (dirToPlayer.lengthSq() < 0.1) dirToPlayer.set(0, 0, 1);
      dirToPlayer.normalize();
      
      const endCamPos = tAsset.clone().add(dirToPlayer.multiplyScalar(2.0));
      const endTerrainY = getTerrainHeight(endCamPos.x, endCamPos.z);
      endCamPos.y = endTerrainY + EYE_LEVEL;
      
      let alpha = 1;

      if (cameraOverride.current.state === 'traveling_to') {
        const elapsed = now - cameraOverride.current.startTime;
        alpha = elapsed / 800; // 0.8s to travel there
        if (alpha >= 1) {
          alpha = 1;
          cameraOverride.current.state = 'waiting';
        }
      } else if (cameraOverride.current.state === 'waiting') {
        alpha = 1;
      } else if (cameraOverride.current.state === 'traveling_back') {
        const elapsed = now - cameraOverride.current.returnStartTime;
        alpha = 1 - (elapsed / 800); // 0.8s to travel back
        if (alpha <= 0) {
          alpha = 0;
          cameraOverride.current.active = false;
          cameraOverride.current.state = 'none';
          
          // Turn character to face the target asset when camera returns
          const dx = tAsset.x - group.current.position.x;
          const dz = tAsset.z - group.current.position.z;
          yaw.current = Math.atan2(dx, dz);
        }
      }

      if (cameraOverride.current.active) {
        alpha = alpha * alpha * (3 - 2 * alpha); // Smooth step

        // Interpolate XZ
        finalIdealCameraPos.x = THREE.MathUtils.lerp(idealCameraPos.x, endCamPos.x, alpha);
        finalIdealCameraPos.z = THREE.MathUtils.lerp(idealCameraPos.z, endCamPos.z, alpha);
        
        // Interpolate Y from 3rd person to destination eye level
        const interpolatedY = THREE.MathUtils.lerp(idealCameraPos.y, endCamPos.y, alpha);
        
        // Ensure camera follows terrain if terrain + EYE_LEVEL is higher
        const pathTerrainY = getTerrainHeight(finalIdealCameraPos.x, finalIdealCameraPos.z);
        finalIdealCameraPos.y = Math.max(interpolatedY, pathTerrainY + EYE_LEVEL);
        
        // Setup start camera orientation
        const dummyCam = new THREE.Object3D();
        dummyCam.position.copy(idealCameraPos);
        dummyCam.lookAt(targetLookAt);
        const startQuat = dummyCam.quaternion.clone();

        // Setup end camera orientation
        dummyCam.position.copy(endCamPos);
        const lookAtAsset = tAsset.clone();
        lookAtAsset.y = endCamPos.y; // perfectly horizontal
        dummyCam.lookAt(lookAtAsset);
        const endQuat = dummyCam.quaternion.clone();

        // Spherical linear interpolation of rotation
        startQuat.slerp(endQuat, alpha);

        // Calculate a new lookAt target exactly 1 unit in front of the camera
        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(startQuat);
        finalTargetLookAt.copy(finalIdealCameraPos).add(forward);
      }
    }
    
    // Snap camera position to the smoothed target position
    camera.position.copy(finalIdealCameraPos);
    camera.lookAt(finalTargetLookAt);

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
    <group ref={group} dispose={null} userData={{ isPlayer: true }}>
      <PlayerGauge progressRef={mineProgressRef} />
      <primitive object={scene} scale={0.1} />
    </group>
  );
}

// Preload the model
useGLTF.preload('/models/charactor2.glb');
