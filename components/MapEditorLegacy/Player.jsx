'use client';

import { useRef, useState, useEffect, useMemo } from 'react';
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
  
  const [playerBubble, setPlayerBubble] = useState(null);
  const triggeredZones = useRef(new Set());
  const lastZoneTriggerTime = useRef(0);
  const zoomLevel = useRef(1.0);

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
        
        let bestScore = -Infinity;
        let closestAssetId = null;
        
        for (const asset of assets) {
          if (asset.minedAt) continue;
          
          const assetX = asset.position[0];
          const assetZ = asset.position[2];
          
          const dx = assetX - playerPos.x;
          const dz = assetZ - playerPos.z;
          const distance = Math.sqrt(dx*dx + dz*dz);
          
          if (distance < 2.5) {
            const dir = distance > 0.001 ? new THREE.Vector3(dx, 0, dz).normalize() : new THREE.Vector3(0,0,1);
            const dot = forward.dot(dir);
            
            if (dot > 0.3 || distance < 1.0) {
              // 바라보는 방향(dot)을 우선시하고, 그 다음 거리를 고려
              const score = (dot > 0.3 ? dot : 0) - (distance / 2.5);
              if (score > bestScore) {
                bestScore = score;
                closestAssetId = asset.id;
              }
            }
          }
        }
        
        if (closestAssetId) {
          const targetAsset = assets.find(a => a.id === closestAssetId);
          const isTree = targetAsset?.type === 'tree';
          const isNPC = targetAsset?.type?.startsWith('caveman');
          
          const hasDialogueEnabled = targetAsset.hasDialogue === true || (isNPC && targetAsset.hasDialogue !== false);

          if (hasDialogueEnabled) {
            window.dispatchEvent(new CustomEvent('npc-interact', { detail: { asset: targetAsset } }));
            if (document.pointerLockElement === canvas) {
              document.exitPointerLock();
            }
            return;
          }

          // 시작! (수학 채집 미니게임)
          // 나무와 돌만 캘 수 있도록 제한
          if (isTree || targetAsset?.type === 'rock') {
            useMapStore.getState().setMineMiniGame(true, closestAssetId, targetAsset?.type);
            if (document.pointerLockElement === canvas) {
              document.exitPointerLock();
            }
          }
        }
      }
    };

    const handleWheel = (e) => {
      if (document.pointerLockElement === canvas) {
        zoomLevel.current += Math.sign(e.deltaY) * 0.15;
        zoomLevel.current = Math.max(0.3, Math.min(5.0, zoomLevel.current));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('wheel', handleWheel);
    if (canvas) canvas.addEventListener('click', onCanvasClick);
    document.addEventListener('mousemove', onMouseMove);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('wheel', handleWheel);
      if (canvas) canvas.removeEventListener('click', onCanvasClick);
      document.removeEventListener('mousemove', onMouseMove);
    };
  }, [keys, camera, glScene]);

  // Cache animation action names
  const actionNames = actions ? Object.keys(actions) : [];
  const walkActionName = actionNames.find(n => n.toLowerCase().includes('walk'));
  const runActionName = actionNames.find(n => n.toLowerCase().includes('run')) || walkActionName;

  const physicsRaycaster = useMemo(() => new THREE.Raycaster(), []);

  // Get mathematical terrain height at (x, z)
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

  const terrainMeshRef = useRef(null);

  const getTerrainHeightRaycast = (x, y, z) => {
    // 1. Check if we are near any cave. If not, fallback to fast 2D lookup.
    const { csgOperations } = useMapStore.getState();
    let isNearCave = false;
    if (csgOperations.length > 0) {
      for (const op of csgOperations) {
        if (op.shape === 'sphere') {
          const dx = x - op.position[0];
          const dz = z - op.position[2];
          if (dx*dx + dz*dz < (op.radius + 3)**2) {
            isNearCave = true; break;
          }
        } else if (op.shape === 'capsule') {
          const minX = Math.min(op.start[0], op.end[0]) - op.radius - 3;
          const maxX = Math.max(op.start[0], op.end[0]) + op.radius + 3;
          const minZ = Math.min(op.start[2], op.end[2]) - op.radius - 3;
          const maxZ = Math.max(op.start[2], op.end[2]) + op.radius + 3;
          if (x >= minX && x <= maxX && z >= minZ && z <= maxZ) {
            isNearCave = true; break;
          }
        }
      }
    }

    if (!isNearCave) return getTerrainHeight(x, z);

    // 2. Cache terrain mesh to avoid slow glScene.traverse every frame
    if (!terrainMeshRef.current || !terrainMeshRef.current.visible) {
      let found = null;
      glScene.traverse((child) => {
        if (child.name === 'terrainMesh' && child.visible) {
          found = child;
        }
      });
      terrainMeshRef.current = found;
    }
    
    if (!terrainMeshRef.current) return getTerrainHeight(x, z);
    
    // Cast ray from slightly above the player's current y position
    physicsRaycaster.set(new THREE.Vector3(x, y + 1.5, z), new THREE.Vector3(0, -1, 0));
    const intersects = physicsRaycaster.intersectObject(terrainMeshRef.current);
    if (intersects.length > 0) {
      return intersects[0].point.y;
    }
    return getTerrainHeight(x, z);
  };

  const hasSpawned = useRef(false);
  const cameraOverride = useRef({
    active: false,
    state: 'none', // 'switch_to_1st_person', 'walking_to', 'waiting', 'walking_back', 'switch_to_3rd_person'
    startTime: 0,
    phaseStartTime: 0,
    returnStartTime: 0,
    targetPos: new THREE.Vector3(),
    startPos: new THREE.Vector3(),
    startYaw: 0,
    targetYaw: 0,
    messageData: null,
    overrideAction: null
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

      const terrainH = getTerrainHeightRaycast(spawnX, 100, spawnZ);
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
        cameraOverride.current.state = 'walking_back';
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

    const currentTerrainHeight = getTerrainHeightRaycast(group.current.position.x, group.current.position.y, group.current.position.z);
    
    // Apply movement with slope restriction on XZ
    let nextX = group.current.position.x + currentVelocity.current.x * delta;
    let nextZ = group.current.position.z + currentVelocity.current.z * delta;
    
    const dist = Math.sqrt((nextX - group.current.position.x)**2 + (nextZ - group.current.position.z)**2);
    let canMoveXZ = true;
    const nextTerrainHeight = getTerrainHeightRaycast(nextX, group.current.position.y, nextZ);
    
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

    if (canMoveXZ && !cameraOverride.current.active) {
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
    if (canMoveXZ && !cameraOverride.current.active) {
      const p1 = { x: group.current.position.x, z: group.current.position.z };
      const p2 = { x: nextX, z: nextZ };
      const { boundaries } = useMapStore.getState();
      const { items } = useInventoryStore.getState();
      
      for (const b of boundaries) {
        let isActive = true;
        if (b.condition && !b.isZone) {
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
                if (!b.isZone) {
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
                        cameraOverride.current.state = 'switch_to_1st_person';
                        cameraOverride.current.startTime = now;
                        cameraOverride.current.targetPos.set(targetAsset.position[0], targetAsset.position[1], targetAsset.position[2]);
                        cameraOverride.current.startPos.copy(group.current.position);
                        cameraOverride.current.startYaw = yaw.current;
                        cameraOverride.current.targetYaw = Math.atan2(targetAsset.position[0] - group.current.position.x, targetAsset.position[2] - group.current.position.z);
                        
                        let dyaw = cameraOverride.current.targetYaw - cameraOverride.current.startYaw;
                        while (dyaw > Math.PI) dyaw -= 2 * Math.PI;
                        while (dyaw < -Math.PI) dyaw += 2 * Math.PI;
                        cameraOverride.current.targetYaw = cameraOverride.current.startYaw + dyaw;
                        
                        cameraOverride.current.messageData = { message, additionalMessage, boundaryId: b.id };
                      } else {
                        window.dispatchEvent(new CustomEvent('boundary-collide', { detail: { message, additionalMessage, boundaryId: b.id } }));
                      }
                    } else {
                      window.dispatchEvent(new CustomEvent('boundary-collide', { detail: { message, additionalMessage, boundaryId: b.id } }));
                    }
                  }
                  break;
                } else {
                  // Zone Trigger Logic
                  const now = performance.now();
                  const zoneId = b.id;
                  
                  if (b.condition?.triggerOnce !== false && triggeredZones.current.has(zoneId)) {
                    continue; // Skip if already triggered and is triggerOnce
                  }

                  if (now - lastZoneTriggerTime.current > 1000) { // 1s global cooldown for zones
                    lastZoneTriggerTime.current = now;
                    triggeredZones.current.add(zoneId);

                    const eventType = b.condition?.eventType || 'bubble';
                    const msg = b.condition?.message || '';

                    if (eventType === 'bubble') {
                      setPlayerBubble(msg);
                      setTimeout(() => setPlayerBubble(null), 3000);
                    } else if (eventType === 'message') {
                      window.dispatchEvent(new CustomEvent('boundary-collide', { detail: { message: msg, additionalMessage: '', targetAssetId: null, boundaryId: b.id } }));
                    } else if (eventType === 'dialogue') {
                      window.dispatchEvent(new CustomEvent('npc-interact', { detail: { asset: { npcName: '알림', dialogue: msg } } }));
                      if (document.pointerLockElement) {
                        document.exitPointerLock();
                      }
                    }
                  }
                }
              }
          }
        }
      }
    }
    } // added closing bracket for if(canMoveXZ && !cameraOverride.current.active)

    if (canMoveXZ && !cameraOverride.current.active) {
      group.current.position.x = nextX;
      group.current.position.z = nextZ;
    }

    // Air Physics
    currentVelocity.current.y -= 10 * delta; // gravity (점프 시간에 맞춰 부드럽게 조정, 띠용 방지)
    
    // Apply Y velocity
    group.current.position.y += currentVelocity.current.y * delta;

    // Ground Collision & Jumping
    const currentGroundHeight = getTerrainHeightRaycast(group.current.position.x, group.current.position.y, group.current.position.z);
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
    
    let alphaOffset = 0;
    cameraOverride.current.overrideAction = null;

    if (cameraOverride.current.active) {
      const now = performance.now();
      const tAsset = cameraOverride.current.targetPos;
      
      if (cameraOverride.current.state === 'switch_to_1st_person') {
        const elapsed = now - cameraOverride.current.startTime;
        alphaOffset = elapsed / 800; // 0.8s
        if (alphaOffset >= 1) {
          alphaOffset = 1;
          cameraOverride.current.state = 'walking_to';
          cameraOverride.current.phaseStartTime = now;
        }
        yaw.current = THREE.MathUtils.lerp(cameraOverride.current.startYaw, cameraOverride.current.targetYaw, alphaOffset);
      } else if (cameraOverride.current.state === 'walking_to') {
        alphaOffset = 1;
        const elapsed = now - cameraOverride.current.phaseStartTime;
        const alphaMove = elapsed / 1500; // 1.5s walk
        
        cameraOverride.current.overrideAction = walkActionName;
        
        // Calculate destination in front of asset
        const dirToAsset = new THREE.Vector3(tAsset.x - cameraOverride.current.startPos.x, 0, tAsset.z - cameraOverride.current.startPos.z).normalize();
        const destPos = tAsset.clone().sub(dirToAsset.multiplyScalar(2.0)); // 2 units in front
        
        if (alphaMove >= 1) {
          group.current.position.x = destPos.x;
          group.current.position.z = destPos.z;
          cameraOverride.current.state = 'waiting';
          
          const md = cameraOverride.current.messageData;
          window.dispatchEvent(new CustomEvent('boundary-collide', { detail: { 
            message: md.message, 
            additionalMessage: md.additionalMessage, 
            boundaryId: md.boundaryId,
            targetAssetId: 'exists'
          }}));
        } else {
          group.current.position.x = THREE.MathUtils.lerp(cameraOverride.current.startPos.x, destPos.x, alphaMove);
          group.current.position.z = THREE.MathUtils.lerp(cameraOverride.current.startPos.z, destPos.z, alphaMove);
        }
      } else if (cameraOverride.current.state === 'waiting') {
        alphaOffset = 1;
      } else if (cameraOverride.current.state === 'walking_back') {
        alphaOffset = 1;
        const elapsed = now - cameraOverride.current.returnStartTime;
        const alphaMove = elapsed / 1500; // 1.5s walk back
        
        cameraOverride.current.overrideAction = walkActionName; // Walk backwards, keep animation walk
        
        const dirToAsset = new THREE.Vector3(tAsset.x - cameraOverride.current.startPos.x, 0, tAsset.z - cameraOverride.current.startPos.z).normalize();
        const destPos = tAsset.clone().sub(dirToAsset.multiplyScalar(2.0));
        
        if (alphaMove >= 1) {
          group.current.position.x = cameraOverride.current.startPos.x;
          group.current.position.z = cameraOverride.current.startPos.z;
          cameraOverride.current.state = 'switch_to_3rd_person';
          cameraOverride.current.phaseStartTime = now;
        } else {
          group.current.position.x = THREE.MathUtils.lerp(destPos.x, cameraOverride.current.startPos.x, alphaMove);
          group.current.position.z = THREE.MathUtils.lerp(destPos.z, cameraOverride.current.startPos.z, alphaMove);
        }
      } else if (cameraOverride.current.state === 'switch_to_3rd_person') {
        const elapsed = now - cameraOverride.current.phaseStartTime;
        alphaOffset = 1 - (elapsed / 800);
        if (alphaOffset <= 0) {
          alphaOffset = 0;
          cameraOverride.current.active = false;
          cameraOverride.current.state = 'none';
        }
      }

      // Smooth step for alphaOffset
      alphaOffset = alphaOffset * alphaOffset * (3 - 2 * alphaOffset);
    }
    
    // Clamp to map boundary circle (radius 25)
    const distFromCenter = Math.sqrt(group.current.position.x ** 2 + group.current.position.z ** 2);
    if (distFromCenter > 24) {
      const angle = Math.atan2(group.current.position.x, group.current.position.z);
      group.current.position.x = Math.sin(angle) * 24;
      group.current.position.z = Math.cos(angle) * 24;
    }

    const offset3rd = new THREE.Vector3(0, 0.1, -1.0).multiplyScalar(zoomLevel.current);
    const offset1st = new THREE.Vector3(0, 0.35, 0.15); // near head
    
    const currentOffset = new THREE.Vector3();
    currentOffset.lerpVectors(offset3rd, offset1st, alphaOffset);
    currentOffset.applyEuler(euler);
    
    // 타겟을 부드럽게 쫓아가는 캐릭터 위치로 설정
    const targetLookAt = smoothedPlayerPos.current.clone().add(new THREE.Vector3(0, 0.4, 0)); 
    const idealCameraPos = targetLookAt.clone().add(currentOffset);
    
    // Prevent camera from clipping through the terrain
    const camGroundHeight = getTerrainHeightRaycast(idealCameraPos.x, idealCameraPos.y, idealCameraPos.z);
    if (idealCameraPos.y < camGroundHeight + 0.5) {
      idealCameraPos.y = camGroundHeight + 0.5;
    }
    
    let finalIdealCameraPos = idealCameraPos.clone();
    let finalTargetLookAt = targetLookAt.clone();

    if (alphaOffset > 0) {
      // 1인칭일 때는 캐릭터를 바라보지 않고 앞을 바라봄
      const forward = new THREE.Vector3(0, 0, 1).applyEuler(euler);
      const lookFront = idealCameraPos.clone().add(forward);
      finalTargetLookAt.lerpVectors(targetLookAt, lookFront, alphaOffset);
      
      // 만약 1인칭 진행 중이라면 강제로 위치를 smoothed가 아닌 실시간으로 잡아야 떨림 최소화 가능
      finalIdealCameraPos = group.current.position.clone().add(new THREE.Vector3(0, 0.4, 0)).add(currentOffset);
      finalTargetLookAt = finalIdealCameraPos.clone().add(forward);
    }

    // Snap camera position to the smoothed target position
    camera.position.copy(finalIdealCameraPos);
    camera.lookAt(finalTargetLookAt);

    // Handle Animation state based on movement and grounding
    if (actions) {
      const isMoving = keys.w || keys.a || keys.s || keys.d;
      const isRunning = isMoving && keys.shift;

      let targetAction = null;
      
      if (cameraOverride.current.active && cameraOverride.current.overrideAction) {
        targetAction = cameraOverride.current.overrideAction;
      } else {
        if (isRunning && runActionName) {
          targetAction = runActionName;
        } else if (isMoving && walkActionName) {
          targetAction = walkActionName;
        }
      }

      if (currentAction.current !== targetAction) {
        if (currentAction.current && actions[currentAction.current]) {
          actions[currentAction.current].fadeOut(0.2);
        }
        if (targetAction && actions[targetAction]) {
          // 뒤로 걸을 때 재생 속도를 -1로 설정하여 애니메이션 역재생 처리
          if (cameraOverride.current.state === 'walking_back') {
            actions[targetAction].setEffectiveTimeScale(-1);
          } else {
            actions[targetAction].setEffectiveTimeScale(1);
          }
          actions[targetAction].reset().fadeIn(0.2).play();
        }
        currentAction.current = targetAction;
      } else if (targetAction && actions[targetAction]) {
         if (cameraOverride.current.state === 'walking_back') {
            actions[targetAction].setEffectiveTimeScale(-1);
         } else {
            actions[targetAction].setEffectiveTimeScale(1);
         }
      }
    }
  });

  return (
    <group ref={group} dispose={null} userData={{ isPlayer: true }}>
      <PlayerGauge progressRef={mineProgressRef} />
      {playerBubble && (
        <Html position={[0, 4, 0]} center sprite zIndexRange={[100, 0]} distanceFactor={2}>
          <div style={{ 
            position: 'relative', 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center',
            filter: 'drop-shadow(0px 4px 12px rgba(0,0,0,0.3))'
          }}>
            {/* 꼬리 테두리 (검은색) */}
            <div style={{
              position: 'absolute',
              bottom: '-12px',
              borderLeft: '12px solid transparent',
              borderRight: '12px solid transparent',
              borderTop: '16px solid black',
              zIndex: 1
            }} />
            
            {/* 꼬리 안쪽 (흰색) */}
            <div style={{
              position: 'absolute',
              bottom: '-8px',
              borderLeft: '8px solid transparent',
              borderRight: '8px solid transparent',
              borderTop: '14px solid white',
              zIndex: 3
            }} />
            
            {/* 말풍선 본체 */}
            <div style={{
              background: 'white',
              padding: '8px 16px',
              borderRadius: '24px',
              border: '4px solid black',
              fontSize: '1.5rem',
              fontWeight: 'bold',
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
              color: '#111827',
              position: 'relative',
              zIndex: 2
            }}>
              {playerBubble.substring(0, 30)}{playerBubble.length > 30 ? '...' : ''}
            </div>
          </div>
        </Html>
      )}
      <primitive object={scene} scale={0.1} />
    </group>
  );
}

// Preload the model
useGLTF.preload('/models/charactor2.glb');
