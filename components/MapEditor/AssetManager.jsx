'use client';



import { useRef, useEffect, useMemo } from 'react';
import useMapStore from '@/store/useMapStore';
import useInventoryStore from '@/store/useInventoryStore';
import { useTexture } from '@react-three/drei';
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

function MineableAsset({ id, type, position, onInteract, mode, isPlaying, children }) {
  const groupRef = useRef();
  const jiggleTimeRef = useRef(0);

  useFrame((state, delta) => {
    if (jiggleTimeRef.current > 0) {
      jiggleTimeRef.current = Math.max(0, jiggleTimeRef.current - delta);
      if (groupRef.current) {
        // jiggleTimeRef.current 값이 클수록 움찔거림이 강해짐
        const jiggle = Math.sin(state.clock.elapsedTime * 40) * 0.05 * jiggleTimeRef.current;
        groupRef.current.scale.set(0.5 + jiggle, 0.5 - jiggle, 0.5 + jiggle);
      }
    } else {
      if (groupRef.current) {
        groupRef.current.scale.set(0.5, 0.5, 0.5);
      }
    }
  });

  const handleClick = (e) => {
    if (mode === 'erase') {
      e.stopPropagation();
      onInteract(id, type, true);
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

  return (
    <group 
      ref={groupRef} 
      position={position} 
      onClick={handleClick} 
      scale={0.5}
      userData={{ isAsset: true, assetId: id }} 
    >
      {children}
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
