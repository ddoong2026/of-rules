'use client';

import useMapStore from '@/store/useMapStore';
import { Decal, useTexture } from '@react-three/drei';
import * as THREE from 'three';

function Tree({ position }) {
  return (
    <group position={position}>
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

function Rock({ position }) {
  return (
    <mesh position={[position[0], position[1] + 0.5, position[2]]} castShadow receiveShadow rotation={[Math.random(), Math.random(), 0]}>
      <dodecahedronGeometry args={[0.8, 0]} />
      <meshStandardMaterial color="#696969" roughness={0.9} />
    </mesh>
  );
}

function House({ position }) {
  return (
    <group position={[position[0], position[1] + 1, position[2]]}>
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

function DecalItem({ decal }) {
  const texture = useTexture(decal.url);
  return (
    <mesh position={[decal.position[0], decal.position[1] + 0.05, decal.position[2]]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[decal.scale[0], decal.scale[2]]} />
      <meshStandardMaterial map={texture} transparent alphaTest={0.1} />
    </mesh>
  );
}

export default function AssetManager() {
  const { assets, decals } = useMapStore();

  return (
    <>
      {assets.map(asset => {
        if (asset.type === 'tree') return <Tree key={asset.id} position={asset.position} />;
        if (asset.type === 'rock') return <Rock key={asset.id} position={asset.position} />;
        if (asset.type === 'house') return <House key={asset.id} position={asset.position} />;
        return null;
      })}

      {decals.map(decal => (
        <DecalItem key={decal.id} decal={decal} />
      ))}
    </>
  );
}
