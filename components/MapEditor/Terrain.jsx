'use client';

import { useRef, useEffect, useState, useMemo } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import useMapStore, { GRID_SIZE, VERTEX_COUNT } from '@/store/useMapStore';

function generate3LayerMesh(heightsBase, heightsBottom, heightsTop, colorsArr, gridSize, cellSize) {
  const width = gridSize + 1;
  const depth = gridSize + 1;
  const halfSize = (gridSize * cellSize) / 2;

  const positions = [];
  const indices = [];
  const uvs = [];
  const colors = [];
  
  const vertexIndexMap = new Map();
  let indexCounter = 0;

  const getVertexIndex = (x, y, z, u, v, r, g, b, layer) => {
    const key = `${layer},${x.toFixed(3)},${y.toFixed(3)},${z.toFixed(3)}`;
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

  for (let x = 0; x < width - 1; x++) {
    for (let z = 0; z < depth - 1; z++) {
      const posX = x * cellSize - halfSize;
      const posZ = z * cellSize - halfSize;
      const nextX = (x + 1) * cellSize - halfSize;
      const nextZ = (z + 1) * cellSize - halfSize;

      const i00 = z * width + x;
      const i10 = z * width + (x + 1);
      const i01 = (z + 1) * width + x;
      const i11 = (z + 1) * width + (x + 1);

      // Top Vertices (Layer 0)
      const t00 = getVertexIndex(posX, heightsTop[i00], posZ, x / width, z / depth, colorsArr[i00*3], colorsArr[i00*3+1], colorsArr[i00*3+2], 0);
      const t10 = getVertexIndex(nextX, heightsTop[i10], posZ, (x + 1) / width, z / depth, colorsArr[i10*3], colorsArr[i10*3+1], colorsArr[i10*3+2], 0);
      const t01 = getVertexIndex(posX, heightsTop[i01], nextZ, x / width, (z + 1) / depth, colorsArr[i01*3], colorsArr[i01*3+1], colorsArr[i01*3+2], 0);
      const t11 = getVertexIndex(nextX, heightsTop[i11], nextZ, (x + 1) / width, (z + 1) / depth, colorsArr[i11*3], colorsArr[i11*3+1], colorsArr[i11*3+2], 0);

      // Top Face (+Y)
      addQuad(t00, t01, t11, t10);

      const hasCave = (heightsBottom[i00] - heightsBase[i00] > 0.01) ||
                      (heightsBottom[i10] - heightsBase[i10] > 0.01) ||
                      (heightsBottom[i01] - heightsBase[i01] > 0.01) ||
                      (heightsBottom[i11] - heightsBase[i11] > 0.01);

      if (hasCave) {
        // Ceiling Vertices (Layer 1)
        const b00 = getVertexIndex(posX, heightsBottom[i00], posZ, x / width, z / depth, colorsArr[i00*3], colorsArr[i00*3+1], colorsArr[i00*3+2], 1);
        const b10 = getVertexIndex(nextX, heightsBottom[i10], posZ, (x + 1) / width, z / depth, colorsArr[i10*3], colorsArr[i10*3+1], colorsArr[i10*3+2], 1);
        const b01 = getVertexIndex(posX, heightsBottom[i01], nextZ, x / width, (z + 1) / depth, colorsArr[i01*3], colorsArr[i01*3+1], colorsArr[i01*3+2], 1);
        const b11 = getVertexIndex(nextX, heightsBottom[i11], nextZ, (x + 1) / width, (z + 1) / depth, colorsArr[i11*3], colorsArr[i11*3+1], colorsArr[i11*3+2], 1);

        // Ground Vertices (Layer 2)
        const g00 = getVertexIndex(posX, heightsBase[i00], posZ, x / width, z / depth, colorsArr[i00*3], colorsArr[i00*3+1], colorsArr[i00*3+2], 2);
        const g10 = getVertexIndex(nextX, heightsBase[i10], posZ, (x + 1) / width, z / depth, colorsArr[i10*3], colorsArr[i10*3+1], colorsArr[i10*3+2], 2);
        const g01 = getVertexIndex(posX, heightsBase[i01], nextZ, x / width, (z + 1) / depth, colorsArr[i01*3], colorsArr[i01*3+1], colorsArr[i01*3+2], 2);
        const g11 = getVertexIndex(nextX, heightsBase[i11], nextZ, (x + 1) / width, (z + 1) / depth, colorsArr[i11*3], colorsArr[i11*3+1], colorsArr[i11*3+2], 2);

        // Ceiling Face (-Y, CCW)
        addQuad(b00, b10, b11, b01);
        // Ground Face (+Y)
        addQuad(g00, g01, g11, g10);
      }
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
    heightsBase, heightsTop, heightsBottom, colors, 
    updateHeightsBase, updateHeightsTop, updateHeightsBottom, updateColors, 
    addAsset, addDecal, addWaterSource,
    isCameraMode, saveHistory, isPlaying
  } = useMapStore();
  
  const { camera, gl, raycaster: r3fRaycaster } = useThree();
  const [isPointerDown, setIsPointerDown] = useState(false);
  const [pointerPos, setPointerPos] = useState(null);
  const [pointerNormal, setPointerNormal] = useState(new THREE.Vector3(0, 1, 0));
  const brushMeshRef = useRef();
  
  // Mesh Geometry Generation
  const geometry = useMemo(() => {
    const data = generate3LayerMesh(heightsBase, heightsBottom, heightsTop, colors, GRID_SIZE, 50 / GRID_SIZE);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(data.positions, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(data.uvs, 2));
    geo.setAttribute('color', new THREE.BufferAttribute(data.colors, 3));
    geo.setIndex(new THREE.BufferAttribute(data.indices, 1));
    geo.computeVertexNormals();
    return geo;
  }, [heightsBase, heightsTop, heightsBottom, colors]);

  const isBrushMode = ['sculptBase', 'sculptTop', 'dig', 'carve', 'flatten', 'paint'].includes(mode);

  useFrame(() => {
    if (isPlaying && document.pointerLockElement === gl.domElement) {
      r3fRaycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
      const intersects = r3fRaycaster.intersectObject(meshRef.current);
      
      if (intersects.length > 0 && brushMeshRef.current) {
        brushMeshRef.current.visible = isBrushMode;
        const pt = intersects[0].point;
        const norm = intersects[0].face.normal.clone().transformDirection(meshRef.current.matrixWorld).normalize();
        brushMeshRef.current.position.set(pt.x + norm.x * 0.1, pt.y + norm.y * 0.1, pt.z + norm.z * 0.1);
        brushMeshRef.current.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), norm);
      } else if (brushMeshRef.current) {
        brushMeshRef.current.visible = false;
      }
    } else {
       if (brushMeshRef.current) {
         brushMeshRef.current.visible = !!pointerPos && !isCameraMode && isBrushMode;
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

    let modifiedBase = false;
    let modifiedTop = false;
    let modifiedBottom = false;
    let modifiedColors = false;

    const newHeightsBase = new Float32Array(heightsBase);
    const newHeightsTop = new Float32Array(heightsTop);
    const newHeightsBottom = new Float32Array(heightsBottom);
    const newColors = new Float32Array(colors);
    
    const targetColor = new THREE.Color(selectedColor);
    const centerIdx = yIdx * (GRID_SIZE + 1) + xIdx;
    
    const centerHeightTop = heightsTop[centerIdx];

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
        
        const isDigging = isShift; // Shift reverses operation

        if (mode === 'sculptBase') {
          const delta = brushIntensity * falloff * (isDigging ? -1 : 1);
          newHeightsBase[idx] += delta;
          if (newHeightsBase[idx] > newHeightsBottom[idx]) newHeightsBottom[idx] = newHeightsBase[idx];
          if (newHeightsBottom[idx] > newHeightsTop[idx]) newHeightsTop[idx] = newHeightsBottom[idx];
          modifiedBase = true;
          modifiedBottom = true;
          modifiedTop = true;
        } else if (mode === 'sculptTop') {
          const delta = brushIntensity * falloff * (isDigging ? -1 : 1);
          newHeightsTop[idx] += delta;
          if (newHeightsTop[idx] < newHeightsBottom[idx]) newHeightsBottom[idx] = newHeightsTop[idx];
          if (newHeightsBottom[idx] < newHeightsBase[idx]) newHeightsBase[idx] = newHeightsBottom[idx];
          modifiedTop = true;
          modifiedBottom = true;
          modifiedBase = true;
        } else if (mode === 'dig') {
          // Dig lowers all 3 layers simultaneously
          const delta = brushIntensity * falloff * (isDigging ? -1 : 1); // Shift raises them
          newHeightsTop[idx] -= delta;
          newHeightsBottom[idx] -= delta;
          newHeightsBase[idx] -= delta;
          
          // Enforce constraints
          if (newHeightsBottom[idx] > newHeightsTop[idx]) newHeightsBottom[idx] = newHeightsTop[idx];
          if (newHeightsBase[idx] > newHeightsBottom[idx]) newHeightsBase[idx] = newHeightsBottom[idx];
          
          modifiedTop = true;
          modifiedBottom = true;
          modifiedBase = true;
        } else if (mode === 'carve') {
          const delta = brushIntensity * falloff * (isDigging ? -1 : 1);
          newHeightsBottom[idx] += delta;
          if (newHeightsBottom[idx] > newHeightsTop[idx]) newHeightsBottom[idx] = newHeightsTop[idx];
          if (newHeightsBottom[idx] < newHeightsBase[idx]) newHeightsBottom[idx] = newHeightsBase[idx];
          modifiedBottom = true;
        } else if (mode === 'flatten') {
          const heightDiff = centerHeightTop - targetHeightTop;
          newHeightsTop[idx] += heightDiff * falloff * (brushIntensity * 0.1);
          if (newHeightsTop[idx] < newHeightsBottom[idx]) newHeightsBottom[idx] = newHeightsTop[idx];
          if (newHeightsBottom[idx] < newHeightsBase[idx]) newHeightsBase[idx] = newHeightsBottom[idx];
          modifiedTop = true;
          modifiedBottom = true;
          modifiedBase = true;
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

    if (modifiedBase) updateHeightsBase(newHeightsBase);
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

    if (isBrushMode) {
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
      if (isBrushMode) {
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

    if (isBrushMode) {
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
        name="terrainMesh"
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
