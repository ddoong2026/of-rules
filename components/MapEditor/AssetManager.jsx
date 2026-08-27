'use client';

import useMapStore from '@/store/useMapStore';
import useInventoryStore from '@/store/useInventoryStore';
import { Decal, useTexture } from '@react-three/drei';
import * as THREE from 'three';

import { useRef, useState, useEffect } from 'react';
import useMapStore from '@/store/useMapStore';
import useInventoryStore from '@/store/useInventoryStore';
import { Decal, useTexture, Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

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
  return (
    <mesh position={[0, 0.4, 0]} rotation={[Math.random(), Math.random(), 0]}>
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

function MineableAsset({ id, type, position, onInteract, mode, isPlaying, children }) {
  const [progress, setProgress] = useState(0);
  const groupRef = useRef();

  useFrame((state, delta) => {
    if (progress > 0) {
      // 시간에 따라 서서히 게이지 감소 (클릭을 멈추면 줄어듦)
      setProgress((p) => Math.max(0, p - delta * 1.5));
      
      if (groupRef.current) {
        // 게이지가 있을 때 젤리처럼 움찔움찔 애니메이션 (기본 스케일 0.5 기준)
        const jiggle = Math.sin(state.clock.elapsedTime * 40) * 0.05 * (progress / 5);
        const s = 0.5 + jiggle;
        // Y축으로 더 길쭉해지거나 찌그러지게 스케일링
        const sy = 0.5 - jiggle;
        groupRef.current.scale.set(s, sy, s);
      }
    } else {
      if (groupRef.current) {
        groupRef.current.scale.set(0.5, 0.5, 0.5);
      }
    }
  });

  // 직접 클릭 시 (지우기 모드 등 마우스 커서가 있을 때)
  const handleClick = (e) => {
    if (mode === 'erase') {
      e.stopPropagation();
      onInteract(id, type, true);
    }
  };

  // 체험 모드에서 Player의 강제 조준점 레이캐스트 이벤트를 수신
  useEffect(() => {
    const handleCustomMine = (e) => {
      if (e.detail.id === id && isPlaying) {
        const newProgress = progress + 1;
        if (newProgress >= 5) {
          onInteract(id, type, false);
        } else {
          setProgress(newProgress);
        }
      }
    };
    window.addEventListener('mine-asset', handleCustomMine);
    return () => window.removeEventListener('mine-asset', handleCustomMine);
  }, [id, type, progress, isPlaying, onInteract]);

  return (
    <group 
      ref={groupRef} 
      position={position} 
      onClick={handleClick} 
      scale={0.5}
      userData={{ isAsset: true, assetId: id }} // 레이캐스터 식별용
    >
      {children}
      {/* 채집 중일 때만 상단에 게이지(ProgressBar) 표시 */}
      {progress > 0 && isPlaying && (
        <Html position={[0, 3.5, 0]} center sprite zIndexRange={[100, 0]}>
          <div style={{
            width: '60px',
            height: '10px',
            background: 'rgba(0,0,0,0.6)',
            border: '2px solid white',
            borderRadius: '5px',
            overflow: 'hidden'
          }}>
            <div style={{
              width: `${(progress / 5) * 100}%`,
              height: '100%',
              background: '#4ade80',
              transition: 'width 0.1s ease-out'
            }} />
          </div>
        </Html>
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
      addItem(type, 1);
    }
  };

  const handleEraseDecal = (e, id) => {
    if (mode === 'erase') {
      e.stopPropagation();
      removeDecal(id);
    }
  };

  const renderAssetInner = (type) => {
    switch(type) {
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
          id={asset.id} 
          type={asset.type} 
          position={asset.position} 
          mode={mode} 
          isPlaying={isPlaying} 
          onInteract={handleInteract}
        >
          {renderAssetInner(asset.type)}
        </MineableAsset>
      ))}

      {decals.map(decal => (
        <DecalItem key={decal.id} decal={decal} onErase={handleEraseDecal} />
      ))}
    </>
  );
}
