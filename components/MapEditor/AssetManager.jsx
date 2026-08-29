'use client';

import { useRef, useEffect, useMemo, useState } from 'react';
import useMapStore, { GRID_SIZE } from '@/store/useMapStore';
import useInventoryStore from '@/store/useInventoryStore';
import { useTexture, Html, useGLTF, useAnimations, TransformControls } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { SkeletonUtils } from 'three-stdlib';

function Tree() {
  return (
    <>
      <mesh position={[0, 0.5, 0]}>
        <cylinderGeometry args={[0.2, 0.2, 1, 8]} />
        <meshStandardMaterial color="#8b4513" />
      </mesh>
      <mesh position={[0, 1.5, 0]}>
        <coneGeometry args={[1, 2, 8]} />
        <meshStandardMaterial color="#2e8b57" />
      </mesh>
    </>
  );
}

function Rock() {
  const rotation = useMemo(() => [Math.random() * Math.PI, Math.random() * Math.PI, 0], []);
  return (
    <mesh position={[0, 0.4, 0]} rotation={rotation}>
      <dodecahedronGeometry args={[0.8, 0]} />
      <meshStandardMaterial color="#696969" roughness={0.9} />
    </mesh>
  );
}

function House() {
  return (
    <group position={[0, 1, 0]}>
      <mesh>
        <boxGeometry args={[2, 2, 2]} />
        <meshStandardMaterial color="#dcdcdc" />
      </mesh>
      <mesh position={[0, 1.5, 0]} rotation={[0, Math.PI / 4, 0]}>
        <coneGeometry args={[1.8, 1.5, 4]} />
        <meshStandardMaterial color="#b22222" />
      </mesh>
    </group>
  );
}

function Cave() {
  return (
    <>
      <mesh position={[0, 0, 0]}>
        <sphereGeometry args={[2, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#555555" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.1, 1.2]} rotation={[0, 0, 0]}>
        <sphereGeometry args={[1.5, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshBasicMaterial color="#000000" />
      </mesh>
    </>
  );
}

function ArchAsset() {
  return (
    <group position={[0, 0, 0]}>
      <mesh position={[-1.5, 1.5, 0]}>
        <boxGeometry args={[0.8, 3, 1]} />
        <meshStandardMaterial color="#696969" roughness={0.8} />
      </mesh>
      <mesh position={[1.5, 1.5, 0]}>
        <boxGeometry args={[0.8, 3, 1]} />
        <meshStandardMaterial color="#696969" roughness={0.8} />
      </mesh>
      <mesh position={[0, 3.4, 0]}>
        <boxGeometry args={[3.8, 0.8, 1]} />
        <meshStandardMaterial color="#696969" roughness={0.8} />
      </mesh>
    </group>
  );
}

function TunnelAsset() {
  return (
    <group position={[0, 0, 0]}>
      <mesh position={[-2, 2, 0]}>
        <boxGeometry args={[1, 4, 6]} />
        <meshStandardMaterial color="#555555" roughness={0.9} />
      </mesh>
      <mesh position={[2, 2, 0]}>
        <boxGeometry args={[1, 4, 6]} />
        <meshStandardMaterial color="#555555" roughness={0.9} />
      </mesh>
      <mesh position={[0, 4.5, 0]}>
        <boxGeometry args={[5, 1, 6]} />
        <meshStandardMaterial color="#555555" roughness={0.9} />
      </mesh>
    </group>
  );
}

function TimeMachineAsset() {
  const { scene } = useGLTF('/models/timemachin.glb');
  const clone = useMemo(() => scene.clone(), [scene]);
  return <primitive object={clone} scale={4} position={[0, 2, 0]} />;
}

function Lake({ isPlaying }) {
  const fishGroupRef = useRef();
  
  useFrame((state, delta) => {
    if (isPlaying && fishGroupRef.current) {
      fishGroupRef.current.rotation.z += delta * 0.8;
    }
  });

  return (
    <group position={[0, 0.1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <mesh>
        <circleGeometry args={[2, 32]} />
        <meshStandardMaterial color="#3b82f6" transparent opacity={0.8} roughness={0.1} metalness={0.5} />
      </mesh>
      {/* 초저사양 최적화용 물고기 (단순 원뿔 3개) */}
      <group ref={fishGroupRef} position={[0, 0, 0.05]}>
        <mesh position={[1.2, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.06, 0.2, 4]} />
          <meshBasicMaterial color="#ff7b00" />
        </mesh>
        <mesh position={[-0.8, 0.8, 0]} rotation={[Math.PI / 2, 0, Math.PI / 2 + 0.5]}>
          <coneGeometry args={[0.05, 0.15, 4]} />
          <meshBasicMaterial color="#ff5555" />
        </mesh>
        <mesh position={[0.2, -1.3, 0]} rotation={[Math.PI / 2, 0, -Math.PI / 4]}>
          <coneGeometry args={[0.04, 0.12, 4]} />
          <meshBasicMaterial color="#ff9900" />
        </mesh>
      </group>
    </group>
  );
}

function getTerrainHeightAt(x, z, heights) {
  if (!heights) return 0;
  const halfSize = 25;
  const segSize = 50 / GRID_SIZE;
  const clampedX = Math.max(-halfSize, Math.min(halfSize, x));
  const clampedZ = Math.max(-halfSize, Math.min(halfSize, z));
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
  const h0 = h00 * (1 - tx) + h10 * tx;
  const h1 = h01 * (1 - tx) + h11 * tx;
  return h0 * (1 - tz) + h1 * tz;
}

function NPC({ asset, isPlaying, roaming, mode, onSelect }) {
  const [showBubble, setShowBubble] = useState(false);
  const [currentBubbleText, setCurrentBubbleText] = useState('');
  const { scene, animations } = useGLTF(`/models/${asset.type}.glb`);
  const clone = useMemo(() => SkeletonUtils.clone(scene), [scene]);
  const { actions } = useAnimations(animations, clone);
  const npcGroupRef = useRef();
  const [isNear, setIsNear] = useState(false);
  const walkActionRef = useRef(null);

  // Check player distance
  useFrame(({ camera }) => {
    if (!isPlaying || !npcGroupRef.current) return;
    const worldPos = new THREE.Vector3();
    npcGroupRef.current.getWorldPosition(worldPos);
    const distance = camera.position.distanceTo(worldPos);
    
    // NPC 활동 영역(roamRadius) 기반으로 근접 여부 판단 (최소 5)
    const activityRadius = Math.max(asset.roamRadius || 5, 5);
    const currentlyNear = distance <= activityRadius;
    
    if (currentlyNear !== isNear) {
      setIsNear(currentlyNear);
    }
    
    // 거리가 멀어지면 애니메이션 일시정지 (최적화)
    const isVisible = distance < 45;
    const globalState = useMapStore.getState();
    const isPausedByUI = globalState.mineMiniGame.active || globalState.activeDialogue;

    if (walkActionRef.current && walkActionRef.current.isRunning()) {
      walkActionRef.current.paused = !isVisible || isPausedByUI;
    }
  });

  // Animation handling
  useEffect(() => {
    if (!actions || Object.keys(actions).length === 0) return;
    
    const actionNames = Object.keys(actions);
    const walkName = actionNames.find(n => n.toLowerCase().includes('walk')) || actionNames.find(n => n.toLowerCase().includes('run'));
    const walkAction = walkName ? actions[walkName] : null;
    walkActionRef.current = walkAction;

    if (roaming && walkAction) {
      walkAction.timeScale = 0.8; // 자연스러운 보폭 재생 속도
      walkAction.reset().fadeIn(0.2).play();
    } else {
      if (walkAction && walkAction.isRunning()) {
        walkAction.fadeOut(0.2);
      }
    }

    return () => {
      Object.values(actions).forEach(a => a?.stop());
    };
  }, [actions, roaming, isPlaying]);

  useEffect(() => {
    const dialogueSource = asset.bubbleDialogue || asset.dialogue;
    if (!isPlaying || !dialogueSource) return;
    
    const lines = dialogueSource.split('\n').map(l => l.trim()).filter(l => l);
    if (lines.length === 0) return;

    // 간헐적으로 말풍선 띄우기 (3~8초 간격으로 2초간 표시)
    const interval = setInterval(() => {
      if (isNear) {
        const randomLine = lines[Math.floor(Math.random() * lines.length)];
        setCurrentBubbleText(randomLine);
        setShowBubble(true);
        setTimeout(() => setShowBubble(false), 2000);
      }
    }, Math.random() * 5000 + 3000);
    
    return () => clearInterval(interval);
  }, [isPlaying, asset.bubbleDialogue, asset.dialogue, isNear]);

  const defaultNames = {
    caveman1: '원시인 1',
    caveman2: '원시인 2',
    caveman3: '원시인 3',
    caveman4: '원시인 4',
  };
  const displayName = asset.npcName || defaultNames[asset.type] || 'NPC';

  const DEFAULT_ROTATION = [0, 0, 0];
  const DEFAULT_SCALE = [0.5, 0.5, 0.5];

  return (
    <group position={[0, 0, 0]} ref={npcGroupRef}>
      <primitive object={clone} scale={0.2} />
      
      {isPlaying && showBubble && isNear && currentBubbleText && (
        <Html position={[0, 0.75, 0]} center sprite zIndexRange={[100, 0]} distanceFactor={1.5}>
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
              {currentBubbleText.substring(0, 20)}{currentBubbleText.length > 20 ? '...' : ''}
            </div>
          </div>
        </Html>
      )}
      {!isPlaying && (
        <Html position={[0, 0.75, 0]} center sprite zIndexRange={[100, 0]} distanceFactor={1.5}>
          <div 
            onClick={(e) => {
              if (onSelect && (mode === 'select' || mode === 'erase')) {
                e.stopPropagation();
                onSelect(e);
              }
            }}
            style={{
              background: 'rgba(0,0,0,0.75)', color: 'white', padding: '2px 6px', 
              borderRadius: '4px', fontSize: '0.7rem', fontWeight: 'bold',
              whiteSpace: 'nowrap', pointerEvents: 'auto', cursor: (mode === 'select' || mode === 'erase') ? 'pointer' : 'default', border: '1px solid rgba(255,255,255,0.4)',
              boxShadow: '0 2px 4px rgba(0,0,0,0.4)'
            }}>
            👤 {displayName}
          </div>
        </Html>
      )}
    </group>
  );
}

function MineableAsset({ asset, onInteract, mode, isPlaying, children }) {
  const { id, type, position } = asset;
  const groupRef = useRef();
  const jiggleTimeRef = useRef(0);
  
  const { selectedAssetId, heights } = useMapStore();
  const isSelected = mode === 'select' && selectedAssetId === id;
  
  const roamRadius = (type.startsWith('caveman') && asset.roamRadius) ? asset.roamRadius : 0;
  const targetLocalPos = useRef(new THREE.Vector3(0, 0, 0));
  const currentLocalPos = useRef(new THREE.Vector3(0, 0, 0));
  const [roaming, setRoaming] = useState(false);

  useEffect(() => {
    if (!isPlaying || roamRadius <= 0) return;
    
    const interval = setInterval(() => {
      if (Math.random() > 0.35) {
        const angle = Math.random() * Math.PI * 2;
        const r = Math.random() * roamRadius;
        targetLocalPos.current.set(Math.cos(angle) * r, 0, Math.sin(angle) * r);
        setRoaming(true);
      } else {
        setRoaming(false);
      }
    }, Math.random() * 4000 + 3000);
    
    return () => clearInterval(interval);
  }, [isPlaying, roamRadius]);

  useFrame((state, delta) => {
    if (groupRef.current) {
      if (isPlaying) {
        let jiggle = 0;
        if (jiggleTimeRef.current > 0) {
          jiggleTimeRef.current = Math.max(0, jiggleTimeRef.current - delta);
          jiggle = Math.sin(state.clock.elapsedTime * 40) * 0.05 * jiggleTimeRef.current;
        }
        const baseScale = asset.scale || [0.5, 0.5, 0.5];
        groupRef.current.scale.set(baseScale[0] + jiggle, baseScale[1] - jiggle, baseScale[2] + jiggle);
        
        if (roamRadius > 0) {
          const globalState = useMapStore.getState();
          if (globalState.mineMiniGame.active || globalState.activeDialogue) return;
          
          const distanceToPlayer = state.camera.position.distanceTo(groupRef.current.position);
          const isVisible = distanceToPlayer < 45; // 시야 범위 내일 때만 이동 연산

        if (roaming && isVisible) {
          const speed = 0.22; // 자연스럽고 느긋한 이동 속도 (기존 0.8에서 대폭 감소)
          const dir = targetLocalPos.current.clone().sub(currentLocalPos.current);
          const dist = dir.length();
          
          if (dist > 0.04) {
            dir.normalize();
            const stepX = dir.x * speed * delta;
            const stepZ = dir.z * speed * delta;
            const nextLocalX = currentLocalPos.current.x + stepX;
            const nextLocalZ = currentLocalPos.current.z + stepZ;
            
            let canMove = true;
            if (heights) {
              const nextWorldX = position[0] + nextLocalX;
              const nextWorldZ = position[2] + nextLocalZ;
              const nextY = getTerrainHeightAt(nextWorldX, nextWorldZ, heights);
              const currentY = getTerrainHeightAt(position[0] + currentLocalPos.current.x, position[2] + currentLocalPos.current.z, heights);
              
              // 물속(-0.1 미만) 진입 불가 및 급격한 경사(0.5 이상 차이) 진입 불가
              if (nextY < -0.1 || Math.abs(nextY - currentY) > 0.5) {
                canMove = false;
              }
            }
            
            if (canMove) {
              currentLocalPos.current.x = nextLocalX;
              currentLocalPos.current.z = nextLocalZ;
              const angle = Math.atan2(dir.x, dir.z);
              
              // Normalize current rotation to match target angle closely
              let currentRot = groupRef.current.rotation.y;
              while (currentRot - angle > Math.PI) currentRot -= Math.PI * 2;
              while (currentRot - angle < -Math.PI) currentRot += Math.PI * 2;
              groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, angle, 4 * delta);
            } else {
              setRoaming(false); // 경로가 막히면 이동 취소
            }
          } else {
            setRoaming(false);
          }
        }
        
        const worldX = position[0] + currentLocalPos.current.x;
        const worldZ = position[2] + currentLocalPos.current.z;
        const groundY = heights ? getTerrainHeightAt(worldX, worldZ, heights) : position[1];
        groupRef.current.position.set(worldX, groundY, worldZ);
        }
      } else if (!isPlaying && roamRadius > 0) {
        currentLocalPos.current.set(0, 0, 0);
        const globalState = useMapStore.getState();
        if (globalState.mode !== 'select' || globalState.selectedAssetId !== asset.id) {
          groupRef.current.position.set(position[0], position[1], position[2]);
          if (asset.rotation) {
            groupRef.current.rotation.set(asset.rotation[0], asset.rotation[1], asset.rotation[2]);
          } else {
            groupRef.current.rotation.set(0, 0, 0);
          }
        }
      }
    }
  });

  const { setSelectedAssetId, transformMode, updateAsset } = useMapStore();

  const handleClick = (e) => {
    if (mode === 'erase') {
      e.stopPropagation();
      onInteract(id, type, true);
    } else if (mode === 'select') {
      e.stopPropagation();
      setSelectedAssetId(id);
    } else if (mode === 'selectTarget') {
      e.stopPropagation();
      const { selectedBoundaryId, updateBoundary, boundaries, setMode } = useMapStore.getState();
      if (selectedBoundaryId) {
        const boundary = boundaries.find(b => b.id === selectedBoundaryId);
        if (boundary) {
          updateBoundary(selectedBoundaryId, { condition: { ...boundary.condition, targetAssetId: id } });
        }
      }
      setMode('select'); // Return to select mode after clicking
    }
  };

  useEffect(() => {
    const handleMineComplete = (e) => {
      if (e.detail.id === id && isPlaying) {
        onInteract(id, type, false);
      }
    };
    
    const handleMineJiggle = (e) => {
      if (e.detail.id === id && isPlaying) {
        jiggleTimeRef.current = 1.0; // 1초간 움찔거림
      }
    };

    window.addEventListener('mine-complete', handleMineComplete);
    window.addEventListener('mine-jiggle', handleMineJiggle);
    return () => {
      window.removeEventListener('mine-complete', handleMineComplete);
      window.removeEventListener('mine-jiggle', handleMineJiggle);
    };
  }, [id, type, isPlaying, onInteract]);

  const canInteract = mode === 'erase' || mode === 'select' || mode === 'selectTarget';

  return (
    <>
      <group 
        ref={groupRef} 
        position={position}
        rotation={asset.rotation || [0, 0, 0]}
        scale={asset.scale || [0.5, 0.5, 0.5]}
        onClick={canInteract ? handleClick : undefined} 
        userData={{ isAsset: true, assetId: id }} 
      >
        {typeof children === 'function' ? children(roaming, canInteract ? handleClick : undefined) : children}
        {isSelected && roamRadius > 0 && (
          <mesh position={[0, 0.1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[roamRadius * 2 - 0.1, roamRadius * 2 + 0.1, 32]} />
            <meshBasicMaterial color="#eab308" transparent opacity={0.6} side={THREE.DoubleSide} />
          </mesh>
        )}
      </group>
      
      {isSelected && mode === 'select' && (
        <TransformControls 
          object={groupRef} 
          mode={transformMode}
          onMouseUp={() => {
            if (groupRef.current) {
              const pos = groupRef.current.position;
              const rot = groupRef.current.rotation;
              const scl = groupRef.current.scale;
              updateAsset(asset.id, {
                position: [pos.x, pos.y, pos.z],
                rotation: [rot.x, rot.y, rot.z],
                scale: [scl.x, scl.y, scl.z]
              });
            }
          }}
        />
      )}
    </>
  );
}

function DecalItem({ decal, onErase }) {
  const texture = useTexture(decal.url);
  return (
    <mesh position={[decal.position[0], decal.position[1] + 0.05, decal.position[2]]} rotation={[-Math.PI / 2, 0, 0]} onClick={(e) => onErase(e, decal.id)}>
      <planeGeometry args={[decal.scale[0], decal.scale[2]]} />
      <meshStandardMaterial map={texture} transparent alphaTest={0.1} />
    </mesh>
  );
}

export default function AssetManager() {
  const { mode, assets, decals, removeAsset, updateAsset, removeDecal, isPlaying } = useMapStore();
  const { addItem } = useInventoryStore();

  const handleInteract = (id, type, isEraseMode) => {
    if (isEraseMode) {
      removeAsset(id);
    } else {
      if (type === 'tree' || type === 'rock') {
        updateAsset(id, { minedAt: Date.now() });
      } else {
        removeAsset(id);
      }
      if (type !== 'tree') {
        addItem(type, 1);
      }
    }
  };

  // Respawn interval
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      const now = Date.now();
      const state = useMapStore.getState();
      state.assets.forEach(asset => {
        if (asset.minedAt && now - asset.minedAt >= 10 * 60 * 1000) { // 10 minutes
          state.updateAsset(asset.id, { minedAt: null });
        }
      });
    }, 10000); // Check every 10 seconds
    return () => clearInterval(interval);
  }, [isPlaying]);

  useEffect(() => {
    const handleGlobalJiggle = (e) => {
      if (!isPlaying) return;
      const { type } = e.detail;
      if (type === 'tree') {
        const items = ['도토리', '나뭇가지', '나무껍질', '나무뿌리'];
        const randomItem = items[Math.floor(Math.random() * items.length)];
        addItem(randomItem, 1);
      }
    };
    
    window.addEventListener('mine-jiggle', handleGlobalJiggle);
    return () => window.removeEventListener('mine-jiggle', handleGlobalJiggle);
  }, [isPlaying, addItem]);

  const handleEraseDecal = (e, id) => {
    if (mode === 'erase') {
      e.stopPropagation();
      removeDecal(id);
    }
  };

  const renderAssetInner = (asset, roaming, handleClick) => {
    if (asset.type.startsWith('caveman')) {
      return <NPC asset={asset} isPlaying={isPlaying} roaming={roaming} mode={mode} onSelect={handleClick} />;
    }
    switch(asset.type) {
      case 'tree': return <Tree />;
      case 'rock': return <Rock />;
      case 'house': return <House />;
      case 'cave': return <Cave />;
      case 'arch': return <ArchAsset />;
      case 'tunnel': return <TunnelAsset />;
      case 'lake': return <Lake isPlaying={isPlaying} />;
      case 'timemachin': return <TimeMachineAsset />;
      default: return null;
    }
  };

  return (
    <>
      {assets.map(asset => {
        if (asset.minedAt && isPlaying) return null; // 캤을 경우 10분 동안 렌더링 안 함
        return (
          <MineableAsset 
            key={asset.id} 
            asset={asset}
            mode={mode} 
            isPlaying={isPlaying} 
            onInteract={handleInteract}
          >
            {(roaming, handleClick) => renderAssetInner(asset, roaming, handleClick)}
          </MineableAsset>
        );
      })}

      {decals.map(decal => (
        <DecalItem key={decal.id} decal={decal} onErase={handleEraseDecal} />
      ))}
    </>
  );
}

useGLTF.preload('/models/caveman1.glb');
useGLTF.preload('/models/caveman2.glb');
useGLTF.preload('/models/caveman3.glb');
useGLTF.preload('/models/caveman4.glb');
useGLTF.preload('/models/timemachin.glb');
