'use client';

import useMapStore from '@/store/useMapStore';
import useInventoryStore from '@/store/useInventoryStore';
import { Decal, useTexture } from '@react-three/drei';
import * as THREE from 'three';

function Tree({ id, position, onErase }) {
  return (
    <group position={position} onClick={(e) => onErase(e, id)} scale={0.5}>
      {/* Trunk */}
      <mesh position={[0, 0.5, 0]}>
        <cylinderGeometry args={[0.2, 0.2, 1, 8]} />
        <meshStandardMaterial color="#8b4513" />
      </mesh>
      {/* Leaves */}
      <mesh position={[0, 1.5, 0]}>
        <coneGeometry args={[1, 2, 8]} />
        <meshStandardMaterial color="#2e8b57" />
      </mesh>
    </group>
  );
}

function Rock({ id, position, onErase }) {
  return (
    <group position={position} onClick={(e) => onErase(e, id)} scale={0.5}>
      <mesh position={[0, 0.4, 0]} rotation={[Math.random(), Math.random(), 0]}>
        <dodecahedronGeometry args={[0.8, 0]} />
        <meshStandardMaterial color="#696969" roughness={0.9} />
      </mesh>
    </group>
  );
}

function House({ id, position, onErase }) {
  return (
    <group position={position} onClick={(e) => onErase(e, id)} scale={0.5}>
      <group position={[0, 1, 0]}>
        {/* Base */}
        <mesh>
          <boxGeometry args={[2, 2, 2]} />
          <meshStandardMaterial color="#dcdcdc" />
        </mesh>
        {/* Roof */}
        <mesh position={[0, 1.5, 0]} rotation={[0, Math.PI / 4, 0]}>
          <coneGeometry args={[1.8, 1.5, 4]} />
          <meshStandardMaterial color="#b22222" />
        </mesh>
      </group>
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

function Cave({ id, position, onErase }) {
  return (
    <group position={position} onClick={(e) => onErase(e, id)} scale={0.5}>
      {/* Outer Rock */}
      <mesh position={[0, 0, 0]}>
        <sphereGeometry args={[2, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#555555" roughness={0.9} />
      </mesh>
      {/* Dark Entrance (Hole) */}
      <mesh position={[0, 0.1, 1.2]} rotation={[0, 0, 0]}>
        <sphereGeometry args={[1.5, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshBasicMaterial color="#000000" />
      </mesh>
    </group>
  );
}

function Lake({ id, position, onErase }) {
  return (
    <group position={position} onClick={(e) => onErase(e, id)} scale={0.5}>
      <mesh position={[0, 0.1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[2, 32]} />
        <meshStandardMaterial color="#3b82f6" transparent opacity={0.8} roughness={0.1} metalness={0.5} />
      </mesh>
    </group>
  );
}

export default function AssetManager() {
  const { mode, assets, decals, removeAsset, removeDecal, isPlaying } = useMapStore();
  const { addItem } = useInventoryStore();

  const handleInteractAsset = (e, id) => {
    if (mode === 'erase') {
      e.stopPropagation();
      removeAsset(id);
    } else if (isPlaying) {
      e.stopPropagation();
      const asset = assets.find(a => a.id === id);
      if (asset) {
        // 카메라(캐릭터)와 에셋의 거리 계산 (X, Z 기준)
        const camPos = e.camera.position;
        const distSq = Math.pow(camPos.x - asset.position[0], 2) + Math.pow(camPos.z - asset.position[2], 2);
        if (distSq < 25) { // 거리 5 이하일 때 채집 가능 (5*5=25)
          removeAsset(id);
          addItem(asset.type, 1);
        }
      }
    }
  };

  const handleEraseDecal = (e, id) => {
    if (mode === 'erase') {
      e.stopPropagation();
      removeDecal(id);
    }
  };

  return (
    <>
      {assets.map(asset => {
        if (asset.type === 'tree') return <Tree key={asset.id} id={asset.id} position={asset.position} onErase={handleInteractAsset} />;
        if (asset.type === 'rock') return <Rock key={asset.id} id={asset.id} position={asset.position} onErase={handleInteractAsset} />;
        if (asset.type === 'house') return <House key={asset.id} id={asset.id} position={asset.position} onErase={handleInteractAsset} />;
        if (asset.type === 'cave') return <Cave key={asset.id} id={asset.id} position={asset.position} onErase={handleInteractAsset} />;
        if (asset.type === 'lake') return <Lake key={asset.id} id={asset.id} position={asset.position} onErase={handleInteractAsset} />;
        return null;
      })}

      {decals.map(decal => (
        <DecalItem key={decal.id} decal={decal} onErase={handleEraseDecal} />
      ))}
    </>
  );
}
