'use client';

import { useRef, useEffect, useMemo, useState } from 'react';
import useMapStore, { GRID_SIZE } from '@/store/useMapStore';
import useInventoryStore from '@/store/useInventoryStore';
import { useTexture, Html, useGLTF, useAnimations } from '@react-three/drei';
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

function Lake() {
  return (
    <mesh position={[0, 0.1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <circleGeometry args={[2, 32]} />
      <meshStandardMaterial color="#3b82f6" transparent opacity={0.8} roughness={0.1} metalness={0.5} />
    </mesh>
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

function NPC({ asset, isPlaying, roaming }) {
  const [showBubble, setShowBubble] = useState(false);
  const { scene, animations } = useGLTF(`/models/${asset.type}.glb`);
  const clone = useMemo(() => SkeletonUtils.clone(scene), [scene]);
  const { actions } = useAnimations(animations, clone);

  // Animation handling
  useEffect(() => {
    if (!actions || Object.keys(actions).length === 0) return;
    
    const actionNames = Object.keys(actions);
    const walkName = actionNames.find(n => n.toLowerCase().includes('walk')) || actionNames.find(n => n.toLowerCase().includes('run'));
    const walkAction = walkName ? actions[walkName] : null;

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
    if (!isPlaying || !asset.dialogue) return;
    
    // 간헐적으로 말풍선 띄우기 (3~8초 간격으로 2초간 표시)
    const interval = setInterval(() => {
      setShowBubble(true);
      setTimeout(() => setShowBubble(false), 2000);
    }, Math.random() * 5000 + 3000);
    
    return () => clearInterval(interval);
  }, [isPlaying, asset.dialogue]);

  const defaultNames = {
    caveman1: '원시인 1',
    caveman2: '원시인 2',
    caveman3: '원시인 3',
    caveman4: '원시인 4',
  };
  const displayName = asset.npcName || defaultNames[asset.type] || 'NPC';

  return (
    <group position={[0, 0, 0]}>
      <primitive object={clone} scale={0.2} />
      
      {isPlaying && showBubble && asset.dialogue && (
        <Html position={[0, 0.45, 0]} center sprite zIndexRange={[100, 0]}>
          <div style={{
            background: 'white',
            padding: '4px 8px',
            borderRadius: '12px',
            border: '2px solid black',
            fontSize: '0.75rem',
            fontWeight: 'bold',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
            color: '#111827'
          }}>
            💬 {asset.dialogue.substring(0, 15)}{asset.dialogue.length > 15 ? '...' : ''}
          </div>
        </Html>
      )}
      {!isPlaying && (
        <Html position={[0, 0.45, 0]} center sprite zIndexRange={[100, 0]}>
          <div style={{
            background: 'rgba(0,0,0,0.75)', color: 'white', padding: '2px 6px', 
            borderRadius: '4px', fontSize: '0.7rem', fontWeight: 'bold',
            whiteSpace: 'nowrap', pointerEvents: 'none', border: '1px solid rgba(255,255,255,0.4)',
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
    let jiggle = 0;
    if (jiggleTimeRef.current > 0) {
      jiggleTimeRef.current = Math.max(0, jiggleTimeRef.current - delta);
      jiggle = Math.sin(state.clock.elapsedTime * 40) * 0.05 * jiggleTimeRef.current;
    }
    
    if (groupRef.current) {
      groupRef.current.scale.set(0.5 + jiggle, 0.5 - jiggle, 0.5 + jiggle);
      
      if (isPlaying && roamRadius > 0) {
        if (roaming) {
          const speed = 0.22; // 자연스럽고 느긋한 이동 속도 (기존 0.8에서 대폭 감소)
          const dir = targetLocalPos.current.clone().sub(currentLocalPos.current);
          const dist = dir.length();
          
          if (dist > 0.04) {
            dir.normalize();
            currentLocalPos.current.add(dir.multiplyScalar(speed * delta));
            const angle = Math.atan2(dir.x, dir.z);
            
            // Normalize current rotation to match target angle closely
            let currentRot = groupRef.current.rotation.y;
            while (currentRot - angle > Math.PI) currentRot -= Math.PI * 2;
            while (currentRot - angle < -Math.PI) currentRot += Math.PI * 2;
            groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, angle, 4 * delta);
          } else {
            setRoaming(false);
          }
        }
        
        const worldX = position[0] + currentLocalPos.current.x;
        const worldZ = position[2] + currentLocalPos.current.z;
        const groundY = heights ? getTerrainHeightAt(worldX, worldZ, heights) : position[1];
        
        groupRef.current.position.set(worldX, groundY, worldZ);
      } else if (!isPlaying && roamRadius > 0) {
        currentLocalPos.current.set(0, 0, 0);
        groupRef.current.position.set(position[0], position[1], position[2]);
        groupRef.current.rotation.y = 0;
      }
    }
  });

  const { setSelectedAssetId } = useMapStore();

  const handleClick = (e) => {
    if (mode === 'erase') {
      e.stopPropagation();
      onInteract(id, type, true);
    } else if (mode === 'select') {
      e.stopPropagation();
      setSelectedAssetId(id);
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

  const canInteract = mode === 'erase' || mode === 'select';

  return (
    <group 
      ref={groupRef} 
      position={position} 
      onClick={canInteract ? handleClick : undefined} 
      scale={0.5}
      userData={{ isAsset: true, assetId: id }} 
    >
      {typeof children === 'function' ? children(roaming) : children}
      {isSelected && roamRadius > 0 && (
        <mesh position={[0, 0.1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[roamRadius * 2 - 0.1, roamRadius * 2 + 0.1, 32]} />
          <meshBasicMaterial color="#eab308" transparent opacity={0.6} side={THREE.DoubleSide} />
        </mesh>
      )}
    </group>
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
  const { mode, assets, decals, removeAsset, removeDecal, isPlaying } = useMapStore();
  const { addItem } = useInventoryStore();

  const handleInteract = (id, type, isEraseMode) => {
    if (isEraseMode) {
      removeAsset(id);
    } else {
      removeAsset(id);
      if (type !== 'tree') {
        addItem(type, 1);
      }
    }
  };

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

  const renderAssetInner = (asset, roaming) => {
    if (asset.type.startsWith('caveman')) {
      return <NPC asset={asset} isPlaying={isPlaying} roaming={roaming} />;
    }
    switch(asset.type) {
      case 'tree': return <Tree />;
      case 'rock': return <Rock />;
      case 'house': return <House />;
      case 'cave': return <Cave />;
      case 'lake': return <Lake />;
      default: return null;
    }
  };

  return (
    <>
      {assets.map(asset => (
        <MineableAsset 
          key={asset.id} 
          asset={asset}
          mode={mode} 
          isPlaying={isPlaying} 
          onInteract={handleInteract}
        >
          {(roaming) => renderAssetInner(asset, roaming)}
        </MineableAsset>
      ))}

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
