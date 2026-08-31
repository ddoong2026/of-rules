'use client';

import { useRef, useEffect, useState, useMemo } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import useMapStore, { GRID_SIZE, VERTEX_COUNT } from '@/store/useMapStore';

function generateDualMesh(heightsTop, heightsBottom, colorsArr, gridSize, cellSize, minThickness = 0.1) {
  const width = gridSize + 1;
  const depth = gridSize + 1;
  const halfSize = (gridSize * cellSize) / 2;

  const positions = [];
  const indices = [];
  const uvs = [];
  const colors = [];
  
  const vertexIndexMap = new Map();
  let indexCounter = 0;

  const getVertexIndex = (x, y, z, u, v, r, g, b) => {
    const key = `${x.toFixed(3)},${y.toFixed(3)},${z.toFixed(3)}`;
    if (vertexIndexMap.has(key)) {
      return vertexIndexMap.get(key);
    }
    positions.push(x, y, z);
    uvs.push(u, v);
    colors.push(r, g, b);
    vertexIndexMap.set(key, indexCounter);
    return indexCounter++;
  };

  const addQuad = (v0, v1, v2, v3) => {
    indices.push(v0, v1, v2);
    indices.push(v0, v2, v3);
  };

  const isActive = (xIdx, zIdx) => {
    if (xIdx < 0 || xIdx >= width || zIdx < 0 || zIdx >= depth) return false;
    const idx = zIdx * width + xIdx;
    return (heightsTop[idx] - heightsBottom[idx]) >= minThickness;
  };

  for (let x = 0; x < width - 1; x++) {
    for (let z = 0; z < depth - 1; z++) {
      const active = isActive(x, z) || isActive(x + 1, z) || isActive(x, z + 1) || isActive(x + 1, z + 1);
      if (!active) continue;

      const posX = x * cellSize - halfSize;
      const posZ = z * cellSize - halfSize;
      const nextX = (x + 1) * cellSize - halfSize;
      const nextZ = (z + 1) * cellSize - halfSize;

      // Calculate indices for 1D arrays
      const i00 = z * width + x;
      const i10 = z * width + (x + 1);
      const i01 = (z + 1) * width + x;
      const i11 = (z + 1) * width + (x + 1);

      // Top Vertices
      const t00 = getVertexIndex(posX, heightsTop[i00], posZ, x / width, z / depth, colorsArr[i00 * 3], colorsArr[i00 * 3 + 1], colorsArr[i00 * 3 + 2]);
      const t10 = getVertexIndex(nextX, heightsTop[i10], posZ, (x + 1) / width, z / depth, colorsArr[i10 * 3], colorsArr[i10 * 3 + 1], colorsArr[i10 * 3 + 2]);
      const t01 = getVertexIndex(posX, heightsTop[i01], nextZ, x / width, (z + 1) / depth, colorsArr[i01 * 3], colorsArr[i01 * 3 + 1], colorsArr[i01 * 3 + 2]);
      const t11 = getVertexIndex(nextX, heightsTop[i11], nextZ, (x + 1) / width, (z + 1) / depth, colorsArr[i11 * 3], colorsArr[i11 * 3 + 1], colorsArr[i11 * 3 + 2]);

      // Bottom Vertices (Ceiling)
      // We can use the same colors as top, or dim them. Let's use the same.
      const b00 = getVertexIndex(posX, heightsBottom[i00], posZ, x / width, z / depth, colorsArr[i00 * 3], colorsArr[i00 * 3 + 1], colorsArr[i00 * 3 + 2]);
      const b10 = getVertexIndex(nextX, heightsBottom[i10], posZ, (x + 1) / width, z / depth, colorsArr[i10 * 3], colorsArr[i10 * 3 + 1], colorsArr[i10 * 3 + 2]);
      const b01 = getVertexIndex(posX, heightsBottom[i01], nextZ, x / width, (z + 1) / depth, colorsArr[i01 * 3], colorsArr[i01 * 3 + 1], colorsArr[i01 * 3 + 2]);
      const b11 = getVertexIndex(nextX, heightsBottom[i11], nextZ, (x + 1) / width, (z + 1) / depth, colorsArr[i11 * 3], colorsArr[i11 * 3 + 1], colorsArr[i11 * 3 + 2]);

      // Top Face (+Y normal)
      addQuad(t00, t01, t11, t10);

      // Bottom Face (-Y normal, CCW)
      addQuad(b00, b10, b11, b01);

      // Side Walls
      if (x === 0 || !isActive(x - 1, z)) addQuad(b00, b01, t01, t00); // Left (-X)
      if (x === width - 2 || !isActive(x + 1, z)) addQuad(b10, t10, t11, b11); // Right (+X)
      if (z === 0 || !isActive(x, z - 1)) addQuad(b00, t00, t10, b10); // Back (-Z)
      if (z === depth - 2 || !isActive(x, z + 1)) addQuad(b01, b11, t11, t01); // Front (+Z)
    }
  }

  return {
    positions: new Float32Array(positions),
    indices: new Uint16Array(indices),
    uvs: new Float32Array(uvs),
    colors: new Float32Array(colors),
  };
}

export default function Terrain() {
  const meshRef = useRef();
  const { 
    mode, brushSize, brushIntensity, selectedColor, selectedAsset, selectedDecalImage,
    heightsTop, heightsBottom, colors, updateHeightsTop, updateHeightsBottom, updateColors, addAsset, addDecal, addWaterSource,
    isCameraMode, saveHistory, isPlaying
  } = useMapStore();
  
  const { camera, gl, raycaster: r3fRaycaster } = useThree();
  const [isPointerDown, setIsPointerDown] = useState(false);
  const [pointerPos, setPointerPos] = useState(null);
  const [pointerNormal, setPointerNormal] = useState(new THREE.Vector3(0, 1, 0));
  const brushMeshRef = useRef();
  
  // Mesh Geometry Generation
  const geometry = useMemo(() => {
    const data = generateDualMesh(heightsTop, heightsBottom, colors, GRID_SIZE, 50 / GRID_SIZE);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(data.positions, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(data.uvs, 2));
    geo.setAttribute('color', new THREE.BufferAttribute(data.colors, 3));
    geo.setIndex(new THREE.BufferAttribute(data.indices, 1));
    geo.computeVertexNormals();
    return geo;
  }, [heightsTop, heightsBottom, colors]);

  useFrame(() => {
    if (isPlaying && document.pointerLockElement === gl.domElement) {
      r3fRaycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
      const intersects = r3fRaycaster.intersectObject(meshRef.current);
      
      if (intersects.length > 0 && brushMeshRef.current) {
        brushMeshRef.current.visible = (mode === 'sculpt' || mode === 'dig' || mode === 'carve' || mode === 'flatten' || mode === 'paint');
        
        const pt = intersects[0].point;
        const norm = intersects[0].face.normal.clone().transformDirection(meshRef.current.matrixWorld).normalize();
        
        brushMeshRef.current.position.set(pt.x + norm.x * 0.1, pt.y + norm.y * 0.1, pt.z + norm.z * 0.1);
        brushMeshRef.current.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), norm);
      } else if (brushMeshRef.current) {
        brushMeshRef.current.visible = false;
      }
    } else {
       if (brushMeshRef.current) {
         brushMeshRef.current.visible = !!pointerPos && !isCameraMode && (mode === 'sculpt' || mode === 'dig' || mode === 'carve' || mode === 'flatten' || mode === 'paint');
         if (pointerPos) {
           brushMeshRef.current.position.set(pointerPos.x + pointerNormal.x * 0.1, pointerPos.y + pointerNormal.y * 0.1, pointerPos.z + pointerNormal.z * 0.1);
           brushMeshRef.current.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), pointerNormal);
         }
       }
    }
  });

  const applyBrush = (point, isShift) => {
    const halfSize = 25;
    const segSize = 50 / GRID_SIZE;
    
    // Ignore clicks outside the circle (radius 25)
    if (point.x * point.x + point.z * point.z > halfSize * halfSize) return;
    
    const xIdx = Math.round((point.x + halfSize) / segSize);
    const yIdx = Math.round((point.z + halfSize) / segSize);

    if (xIdx < 0 || xIdx > GRID_SIZE || yIdx < 0 || yIdx > GRID_SIZE) return;

    let modifiedTop = false;
    let modifiedBottom = false;
    let modifiedColors = false;

    const newHeightsTop = new Float32Array(heightsTop);
    const newHeightsBottom = new Float32Array(heightsBottom);
    const newColors = new Float32Array(colors);
    
    const targetColor = new THREE.Color(selectedColor);
    const centerIdx = yIdx * (GRID_SIZE + 1) + xIdx;
    
    const centerHeightTop = heightsTop[centerIdx];
    const minThickness = 0.1;

    for (let i = -brushSize; i <= brushSize; i++) {
      for (let j = -brushSize; j <= brushSize; j++) {
        if (i*i + j*j > brushSize*brushSize) continue;
        
        const cx = xIdx + i;
        const cy = yIdx + j;
        if (cx < 0 || cx > GRID_SIZE || cy < 0 || cy > GRID_SIZE) continue;
        
        const worldX = cx * segSize - halfSize;
        const worldZ = cy * segSize - halfSize;
        if (worldX * worldX + worldZ * worldZ > halfSize * halfSize) continue;
        
        const idx = cy * (GRID_SIZE + 1) + cx;
        const targetHeightTop = heightsTop[idx];
        
        const dx = i;
        const dz = j;
        const dy = (targetHeightTop - centerHeightTop) / segSize;
        const dist3D = Math.sqrt(dx*dx + dy*dy + dz*dz);
        const dist = mode === 'paint' ? dist3D : Math.sqrt(dx*dx + dz*dz);
        
        const normalizedDist = dist / (brushSize + 1);
        if (normalizedDist > 1) continue; 
        
        const falloff = Math.pow(Math.cos(normalizedDist * Math.PI / 2), 2);
        
        if (mode === 'sculpt' || mode === 'dig') {
          const isDigging = mode === 'dig' || isShift;
          const delta = brushIntensity * falloff * (isDigging ? -1 : 1);
          newHeightsTop[idx] += delta;
          // Clamp to not go below bottom
          newHeightsTop[idx] = Math.max(newHeightsTop[idx], newHeightsBottom[idx] + minThickness);
          modifiedTop = true;
        } else if (mode === 'carve') {
          const isDigging = isShift; // Carve normally raises bottom, shift lowers bottom
          const delta = brushIntensity * falloff * (isDigging ? -1 : 1);
          newHeightsBottom[idx] += delta;
          // Clamp to not go above top
          newHeightsBottom[idx] = Math.min(newHeightsBottom[idx], newHeightsTop[idx] - minThickness);
          modifiedBottom = true;
        } else if (mode === 'flatten') {
          const heightDiff = centerHeightTop - targetHeightTop;
          newHeightsTop[idx] += heightDiff * falloff * (brushIntensity * 0.1);
          newHeightsTop[idx] = Math.max(newHeightsTop[idx], newHeightsBottom[idx] + minThickness);
          modifiedTop = true;
        } else if (mode === 'paint') {
          const r = idx * 3;
          const g = idx * 3 + 1;
          const b = idx * 3 + 2;
          
          const currentColor = new THREE.Color(newColors[r], newColors[g], newColors[b]);
          currentColor.lerp(targetColor, falloff * brushIntensity * 0.2);
          
          newColors[r] = currentColor.r;
          newColors[g] = currentColor.g;
          newColors[b] = currentColor.b;
          modifiedColors = true;
        }
      }
    }

    if (modifiedTop) updateHeightsTop(newHeightsTop);
    if (modifiedBottom) updateHeightsBottom(newHeightsBottom);
    if (modifiedColors) updateColors(newColors);
  };

  const handlePointerDown = (e) => {
    if (isCameraMode || (e.button !== 0 && e.button !== 2)) return;
    setIsPointerDown(true);
    e.stopPropagation();

    let targetPoint = e.point;
    
    if (isPlaying && document.pointerLockElement === gl.domElement) {
       r3fRaycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
       const intersects = r3fRaycaster.intersectObject(meshRef.current);
       if (intersects.length > 0) {
         targetPoint = intersects[0].point;
       } else {
         return;
       }
    }

    if (mode === 'sculpt' || mode === 'dig' || mode === 'carve' || mode === 'flatten' || mode === 'paint') {
      saveHistory(); 
      applyBrush(targetPoint, e.button === 2 || e.shiftKey); 
    } else if (mode === 'water') {
      addWaterSource(targetPoint.x, targetPoint.z);
    } else if (mode === 'asset') {
      const isNPC = selectedAsset.startsWith('caveman');
      const defaultNPCNames = {
        caveman1: '원시인 1',
        caveman2: '원시인 2',
        caveman3: '원시인 3',
        caveman4: '원시인 4'
      };
      addAsset({
        id: crypto.randomUUID(),
        type: selectedAsset,
        position: [targetPoint.x, targetPoint.y, targetPoint.z],
        ...(isNPC ? {
          npcName: defaultNPCNames[selectedAsset] || '주민',
          dialogue: '안녕하세요!\n규칙의 나라에 오신 것을 환영합니다.\n즐거운 시간 보내세요!',
          bubbleDialogue: '반갑습니다!\n날씨가 참 좋네요.\n뭐 도와드릴 일 있나요?',
          quest: '',
          roamRadius: 3
        } : {})
      });
    } else if (mode === 'decal' && selectedDecalImage) {
      addDecal({
        id: crypto.randomUUID(),
        url: selectedDecalImage,
        position: [targetPoint.x, targetPoint.y, targetPoint.z],
        scale: [brushSize * 2, brushSize * 2, brushSize * 2] 
      });
    } else if (mode === 'boundary' || mode === 'zone') {
      const { setBoundaryDrawing } = useMapStore.getState();
      setBoundaryDrawing({ points: [[targetPoint.x, targetPoint.z]], isZone: mode === 'zone' });
    } else if (mode === 'spawn') {
      const { setSpawnPoint } = useMapStore.getState();
      setSpawnPoint({ x: targetPoint.x, z: targetPoint.z });
    } else if (mode === 'moveAsset') {
      const { selectedAssetId, updateAsset, setMode } = useMapStore.getState();
      if (selectedAssetId) {
        updateAsset(selectedAssetId, { position: [targetPoint.x, targetPoint.y, targetPoint.z] });
        setMode('select');
      }
    } else if (mode === 'drawPath') {
      const { selectedAssetId, assets, updateAsset } = useMapStore.getState();
      if (selectedAssetId) {
        const asset = assets.find(a => a.id === selectedAssetId);
        if (asset) {
          const pts = asset.pathPoints || [];
          updateAsset(selectedAssetId, { pathPoints: [...pts, { x: targetPoint.x, y: targetPoint.y, z: targetPoint.z }] });
        }
      }
    }
  };

  const handlePointerMove = (e) => {
    if (!isPlaying || document.pointerLockElement !== gl.domElement) {
      if (mode === 'sculpt' || mode === 'dig' || mode === 'carve' || mode === 'flatten' || mode === 'paint') {
        setPointerPos(e.point);
        if (e.face && e.object) {
          const worldNormal = e.face.normal.clone().transformDirection(e.object.matrixWorld).normalize();
          setPointerNormal(worldNormal);
        }
      } else {
        setPointerPos(null);
      }
    }

    if (!isPointerDown || isCameraMode) return;

    let targetPoint = e.point;
    if (isPlaying && document.pointerLockElement === gl.domElement) {
       r3fRaycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
       const intersects = r3fRaycaster.intersectObject(meshRef.current);
       if (intersects.length > 0) {
         targetPoint = intersects[0].point;
       } else {
         return;
       }
    }

    if (mode === 'sculpt' || mode === 'dig' || mode === 'carve' || mode === 'flatten' || mode === 'paint') {
      e.stopPropagation();
      applyBrush(targetPoint, e.buttons === 2 || e.shiftKey);
    }
  };

  const handlePointerUp = () => {
    setIsPointerDown(false);
  };

  return (
    <group>
      <mesh
        ref={meshRef}
        geometry={geometry}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        <meshStandardMaterial 
          vertexColors 
          roughness={0.8}
          side={THREE.DoubleSide}
        />
      </mesh>
      
      {/* Brush cursor */}
      <mesh ref={brushMeshRef} visible={false}>
        <ringGeometry args={[brushSize * 0.8, brushSize, 32]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.5} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}
