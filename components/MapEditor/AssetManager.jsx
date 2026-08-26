'use client';

import useMapStore from '@/store/useMapStore';
import { Decal, useTexture } from '@react-three/drei';
import * as THREE from 'three';

function Tree({ id, position, onErase }) {
  return (
    <group position={position} onClick={(e) => onErase(e, id)}>
      {/* Trunk */}
      <mesh position={[0, 0.5, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.2, 0.2, 1, 8]} />
        <meshStandardMaterial color="#8b4513" />
      </mesh>
      {/* Leaves */}
      <mesh position={[0, 1.5, 0]} castShadow receiveShadow>
        <coneGeometry args={[1, 2, 8]} />
        <meshStandardMaterial color="#2e8b57" />
      </mesh>
    </group>
  );
}

function Rock({ id, position, onErase }) {
  return (
    <mesh position={[position[0], position[1] + 0.5, position[2]]} castShadow receiveShadow rotation={[Math.random(), Math.random(), 0]} onClick={(e) => onErase(e, id)}>
      <dodecahedronGeometry args={[0.8, 0]} />
      <meshStandardMaterial color="#696969" roughness={0.9} />
    </mesh>
  );
}

function House({ id, position, onErase }) {
  return (
    <group position={[position[0], position[1] + 1, position[2]]} onClick={(e) => onErase(e, id)}>
      {/* Base */}
      <mesh castShadow receiveShadow>
        <boxGeometry args={[2, 2, 2]} />
        <meshStandardMaterial color="#dcdcdc" />
      </mesh>
      {/* Roof */}
      <mesh position={[0, 1.5, 0]} rotation={[0, Math.PI / 4, 0]} castShadow receiveShadow>
        <coneGeometry args={[1.8, 1.5, 4]} />
        <meshStandardMaterial color="#b22222" />
      </mesh>
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
  const { mode, assets, decals, removeAsset, removeDecal } = useMapStore();

  const handleEraseAsset = (e, id) => {
    if (mode === 'erase') {
      e.stopPropagation();
      removeAsset(id);
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
        if (asset.type === 'tree') return <Tree key={asset.id} id={asset.id} position={asset.position} onErase={handleEraseAsset} />;
        if (asset.type === 'rock') return <Rock key={asset.id} id={asset.id} position={asset.position} onErase={handleEraseAsset} />;
        if (asset.type === 'house') return <House key={asset.id} id={asset.id} position={asset.position} onErase={handleEraseAsset} />;
        return null;
      })}

      {decals.map(decal => (
        <DecalItem key={decal.id} decal={decal} onErase={handleEraseDecal} />
      ))}
    </>
  );
}
