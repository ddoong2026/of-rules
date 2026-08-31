'use client';

import { useRef, useEffect, useState, useMemo } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import useMapStore, { GRID_SIZE, VERTEX_COUNT } from '@/store/useMapStore';

function generate4LayerMesh(heightsBase, heightsBottom, heightsTop, heightsWater, colorsArr, gridSize, cellSize) {
  const width = gridSize + 1;
  const depth = gridSize + 1;
  const halfSize = (gridSize * cellSize) / 2;

  const createLayerData = () => ({
    positions: [], indices: [], uvs: [], colors: [], vertexIndexMap: new Map(), indexCounter: 0
  });

  const baseData = createLayerData();
  const bottomData = createLayerData();
  const topData = createLayerData();
  const waterData = createLayerData();

  const getVertexIndex = (data, x, y, z, u, v, r, g, b) => {
    const key = `${x.toFixed(3)},${y.toFixed(3)},${z.toFixed(3)}`;
    if (data.vertexIndexMap.has(key)) {
      return data.vertexIndexMap.get(key);
    }
    data.positions.push(x, y, z);
    data.uvs.push(u, v);
    data.colors.push(r, g, b);
    data.vertexIndexMap.set(key, data.indexCounter);
    return data.indexCounter++;
  };

  const addQuad = (data, v0, v1, v2, v3) => {
    data.indices.push(v0, v1, v2);
    data.indices.push(v0, v2, v3);
  };

  for (let x = 0; x < width - 1; x++) {
    for (let z = 0; z < depth - 1; z++) {
      const posX = x * cellSize - halfSize;
      const posZ = z * cellSize - halfSize;
      const nextX = (x + 1) * cellSize - halfSize;
      const nextZ = (z + 1) * cellSize - halfSize;

      const centerX = posX + cellSize / 2;
      const centerZ = posZ + cellSize / 2;
      
      // Circular Culling (Radius 25)
      if (centerX * centerX + centerZ * centerZ > 25 * 25) {
        continue;
      }

      const i00 = z * width + x;
      const i10 = z * width + (x + 1);
      const i01 = (z + 1) * width + x;
      const i11 = (z + 1) * width + (x + 1);

      // 1. Top Vertices (Layer 0)
      const t00 = getVertexIndex(topData, posX, heightsTop[i00], posZ, x / width, z / depth, colorsArr[i00*3], colorsArr[i00*3+1], colorsArr[i00*3+2]);
      const t10 = getVertexIndex(topData, nextX, heightsTop[i10], posZ, (x + 1) / width, z / depth, colorsArr[i10*3], colorsArr[i10*3+1], colorsArr[i10*3+2]);
      const t01 = getVertexIndex(topData, posX, heightsTop[i01], nextZ, x / width, (z + 1) / depth, colorsArr[i01*3], colorsArr[i01*3+1], colorsArr[i01*3+2]);
      const t11 = getVertexIndex(topData, nextX, heightsTop[i11], nextZ, (x + 1) / width, (z + 1) / depth, colorsArr[i11*3], colorsArr[i11*3+1], colorsArr[i11*3+2]);
      addQuad(topData, t00, t01, t11, t10); // +Y Face

      // 2. Ceiling Vertices (Layer 1)
      const b00 = getVertexIndex(bottomData, posX, heightsBottom[i00], posZ, x / width, z / depth, colorsArr[i00*3], colorsArr[i00*3+1], colorsArr[i00*3+2]);
      const b10 = getVertexIndex(bottomData, nextX, heightsBottom[i10], posZ, (x + 1) / width, z / depth, colorsArr[i10*3], colorsArr[i10*3+1], colorsArr[i10*3+2]);
      const b01 = getVertexIndex(bottomData, posX, heightsBottom[i01], nextZ, x / width, (z + 1) / depth, colorsArr[i01*3], colorsArr[i01*3+1], colorsArr[i01*3+2]);
      const b11 = getVertexIndex(bottomData, nextX, heightsBottom[i11], nextZ, (x + 1) / width, (z + 1) / depth, colorsArr[i11*3], colorsArr[i11*3+1], colorsArr[i11*3+2]);
      addQuad(bottomData, b00, b10, b11, b01); // -Y Face (CCW)

      // 3. Ground Vertices (Layer 2)
      const g00 = getVertexIndex(baseData, posX, heightsBase[i00], posZ, x / width, z / depth, colorsArr[i00*3], colorsArr[i00*3+1], colorsArr[i00*3+2]);
      const g10 = getVertexIndex(baseData, nextX, heightsBase[i10], posZ, (x + 1) / width, z / depth, colorsArr[i10*3], colorsArr[i10*3+1], colorsArr[i10*3+2]);
      const g01 = getVertexIndex(baseData, posX, heightsBase[i01], nextZ, x / width, (z + 1) / depth, colorsArr[i01*3], colorsArr[i01*3+1], colorsArr[i01*3+2]);
      const g11 = getVertexIndex(baseData, nextX, heightsBase[i11], nextZ, (x + 1) / width, (z + 1) / depth, colorsArr[i11*3], colorsArr[i11*3+1], colorsArr[i11*3+2]);
      addQuad(baseData, g00, g01, g11, g10); // +Y Face

      // 4. Water Vertices (Layer 3)
      const w00 = getVertexIndex(waterData, posX, heightsWater[i00], posZ, x / width, z / depth, 1, 1, 1);
      const w10 = getVertexIndex(waterData, nextX, heightsWater[i10], posZ, (x + 1) / width, z / depth, 1, 1, 1);
      const w01 = getVertexIndex(waterData, posX, heightsWater[i01], nextZ, x / width, (z + 1) / depth, 1, 1, 1);
      const w11 = getVertexIndex(waterData, nextX, heightsWater[i11], nextZ, (x + 1) / width, (z + 1) / depth, 1, 1, 1);
      addQuad(waterData, w00, w01, w11, w10); // +Y Face
    }
  }

  const formatData = (d) => {
    const geo = new THREE.BufferGeometry();
    if (d.positions.length > 0) {
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(d.positions), 3));
      geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(d.uvs), 2));
      geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(d.colors), 3));
      geo.setIndex(new THREE.BufferAttribute(new Uint16Array(d.indices), 1));
      geo.computeVertexNormals();
    }
    return geo;
  };

  return {
    baseGeo: formatData(baseData),
    bottomGeo: formatData(bottomData),
    topGeo: formatData(topData),
    waterGeo: formatData(waterData),
  };
}

export default function Terrain() {
  const groupRef = useRef();
  const meshTopRef = useRef();
  const meshBottomRef = useRef();
  const meshBaseRef = useRef();
  const meshWaterRef = useRef();
  
  const { 
    mode, brushSize, brushIntensity, selectedColor, selectedAsset, selectedDecalImage,
    heightsBase, heightsTop, heightsBottom, heightsWater, colors, 
    updateHeightsBase, updateHeightsTop, updateHeightsBottom, updateHeightsWater, updateColors, 
    addAsset, addDecal, addWaterSource,
    isCameraMode, saveHistory, isPlaying
  } = useMapStore();
  
  const { camera, gl, raycaster: r3fRaycaster } = useThree();
  const [isPointerDown, setIsPointerDown] = useState(false);
  const [pointerPos, setPointerPos] = useState(null);
  const [pointerNormal, setPointerNormal] = useState(new THREE.Vector3(0, 1, 0));
  const brushMeshRef = useRef();
  
  // Mesh Geometry Generation
  const geometries = useMemo(() => {
    return generate4LayerMesh(heightsBase, heightsBottom, heightsTop, heightsWater, colors, GRID_SIZE, 50 / GRID_SIZE);
  }, [heightsBase, heightsTop, heightsBottom, heightsWater, colors]);

  const isBrushMode = ['sculptBase', 'sculptTop', 'sculptBottom', 'sculptWater', 'resetWater', 'flatten', 'paint'].includes(mode);
  
  const getOpacities = () => {
    if (mode === 'sculptBase') return { base: 1, bottom: 0.2, top: 0.2, water: 0.2 };
    if (mode === 'sculptTop') return { base: 0.2, bottom: 0.2, top: 1, water: 0.2 };
    if (mode === 'sculptWater') return { base: 0.2, bottom: 0.2, top: 0.2, water: 1 };
    if (mode === 'resetWater') return { base: 0.5, bottom: 0.5, top: 0.8, water: 1 }; // See terrain and water clearly
    if (mode === 'sculptBottom') return { base: 0.2, bottom: 1, top: 0.2, water: 0.2 };
    return { base: 1, bottom: 1, top: 1, water: 0.6 };
  };

  const { base: oBase, bottom: oBottom, top: oTop, water: oWater } = getOpacities();

  const getActiveMeshes = () => {
    let active = [];
    if (mode === 'sculptBase' && meshBaseRef.current) active = [meshBaseRef.current];
    else if (mode === 'sculptTop' && meshTopRef.current) active = [meshTopRef.current];
    else if (mode === 'sculptWater' && meshWaterRef.current) active = [meshWaterRef.current];
    else if (mode === 'resetWater' && meshWaterRef.current) active = [meshWaterRef.current];
    else if (mode === 'sculptBottom' && meshBottomRef.current && meshTopRef.current) active = [meshBottomRef.current, meshTopRef.current];
    else if (groupRef.current) active = groupRef.current.children;
    return active.length > 0 ? active : (groupRef.current ? groupRef.current.children : []);
  };

  useFrame(() => {
    if (isPlaying && document.pointerLockElement === gl.domElement) {
      r3fRaycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
      const intersects = r3fRaycaster.intersectObjects(groupRef.current ? groupRef.current.children : []);
      
      if (intersects.length > 0 && brushMeshRef.current) {
        brushMeshRef.current.visible = isBrushMode;
        const pt = intersects[0].point;
        const norm = intersects[0].face.normal.clone().transformDirection(intersects[0].object.matrixWorld).normalize();
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

  const applyBrush = (point, isShift, isAlt) => {
    const halfSize = 25;
    const segSize = 50 / GRID_SIZE;
    
    if (point.x * point.x + point.z * point.z > halfSize * halfSize) return;
    
    const xIdx = Math.round((point.x + halfSize) / segSize);
    const yIdx = Math.round((point.z + halfSize) / segSize);

    if (xIdx < 0 || xIdx > GRID_SIZE || yIdx < 0 || yIdx > GRID_SIZE) return;

    let modifiedBase = false;
    let modifiedTop = false;
    let modifiedBottom = false;
    let modifiedWater = false;
    let modifiedColors = false;

    const newHeightsBase = new Float32Array(heightsBase);
    const newHeightsTop = new Float32Array(heightsTop);
    const newHeightsBottom = new Float32Array(heightsBottom);
    const newHeightsWater = new Float32Array(heightsWater);
    const newColors = new Float32Array(colors);
    
    const targetColor = new THREE.Color(selectedColor);
    const centerIdx = yIdx * (GRID_SIZE + 1) + xIdx;
    
    const centerHeightTop = heightsTop[centerIdx];
    const centerHeightBase = heightsBase[centerIdx];
    const centerHeightBottom = heightsBottom[centerIdx];

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
        
        const isDigging = isShift; // Passed from e.ctrlKey
        const isFlattening = isAlt; // Passed from e.altKey

        if (mode === 'sculptBase') {
          if (isFlattening) {
            const heightDiff = centerHeightBase - newHeightsBase[idx];
            newHeightsBase[idx] += heightDiff * falloff * (brushIntensity * 0.1);
            if (newHeightsBase[idx] > newHeightsBottom[idx]) newHeightsBase[idx] = newHeightsBottom[idx];
          } else {
            const delta = brushIntensity * falloff * (isDigging ? -1 : 1);
            newHeightsBase[idx] += delta;
            if (!isDigging && newHeightsBase[idx] > newHeightsBottom[idx]) newHeightsBase[idx] = newHeightsBottom[idx];
          }
          modifiedBase = true;
        } else if (mode === 'sculptTop') {
          if (isFlattening) {
            const heightDiff = centerHeightTop - newHeightsTop[idx];
            newHeightsTop[idx] += heightDiff * falloff * (brushIntensity * 0.1);
            if (newHeightsTop[idx] < newHeightsBottom[idx]) newHeightsTop[idx] = newHeightsBottom[idx];
          } else {
            const delta = brushIntensity * falloff * (isDigging ? -1 : 1);
            newHeightsTop[idx] += delta;
            if (isDigging && newHeightsTop[idx] < newHeightsBottom[idx]) newHeightsTop[idx] = newHeightsBottom[idx];
          }
          modifiedTop = true;
        } else if (mode === 'sculptBottom') {
          if (isFlattening) {
            const heightDiff = centerHeightBottom - newHeightsBottom[idx];
            newHeightsBottom[idx] += heightDiff * falloff * (brushIntensity * 0.1);
            if (newHeightsBottom[idx] > newHeightsTop[idx]) newHeightsBottom[idx] = newHeightsTop[idx];
            if (newHeightsBottom[idx] < newHeightsBase[idx]) newHeightsBottom[idx] = newHeightsBase[idx];
          } else {
            const delta = brushIntensity * falloff * (isDigging ? -1 : 1);
            newHeightsBottom[idx] += delta;
            if (!isDigging && newHeightsBottom[idx] > newHeightsTop[idx]) newHeightsBottom[idx] = newHeightsTop[idx];
            if (isDigging && newHeightsBottom[idx] < newHeightsBase[idx]) newHeightsBottom[idx] = newHeightsBase[idx];
          }
          modifiedBottom = true;
        } else if (mode === 'sculptWater') {
          const delta = brushIntensity * falloff * (isDigging ? -1 : 1);
          newHeightsWater[idx] += delta;
          modifiedWater = true;
        } else if (mode === 'resetWater') {
          const targetWaterHeight = 0; // Set strictly to 0
          const heightDiff = newHeightsWater[idx] - targetWaterHeight;
          newHeightsWater[idx] -= heightDiff * falloff * (brushIntensity * 0.5); // Faster reset to 0
          modifiedWater = true;
        } else if (mode === 'flatten') {
          const heightDiff = centerHeightTop - newHeightsTop[idx];
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
    if (modifiedWater) updateHeightsWater(newHeightsWater);
    if (modifiedColors) updateColors(newColors);
  };

  const handlePointerDown = (e) => {
    if (isCameraMode || (e.button !== 0 && e.button !== 2)) return;
    setIsPointerDown(true);
    e.stopPropagation();

    let targetPoint = e.point;
    
    if (isPlaying && document.pointerLockElement === gl.domElement) {
       r3fRaycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
       const intersects = r3fRaycaster.intersectObjects(groupRef.current ? groupRef.current.children : []);
       if (intersects.length > 0) {
         targetPoint = intersects[0].point;
       } else {
         return;
       }
    }

    if (isBrushMode) {
      saveHistory(); 
      applyBrush(targetPoint, e.button === 2 || e.ctrlKey, e.altKey); 
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
      const safeId = (window.crypto && window.crypto.randomUUID) ? window.crypto.randomUUID() : Math.random().toString(36).substring(2);
      addAsset({
        id: safeId,
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
      const safeId = (window.crypto && window.crypto.randomUUID) ? window.crypto.randomUUID() : Math.random().toString(36).substring(2);
      addDecal({
        id: safeId,
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
    let currentTarget = null;
    let currentNormal = null;

    if (!isPlaying || document.pointerLockElement !== gl.domElement) {
      if (mode !== 'none') {
        const intersects = r3fRaycaster.intersectObjects(getActiveMeshes());
        if (intersects.length > 0) {
           currentTarget = intersects[0].point;
           currentNormal = intersects[0].face.normal.clone().transformDirection(intersects[0].object.matrixWorld).normalize();
           setPointerPos(currentTarget);
           setPointerNormal(currentNormal);
        } else {
           setPointerPos(null);
        }
      } else {
        setPointerPos(null);
      }
    }

    // (Removed preview logic since we're using drag-to-draw curves now)

    if (!isPointerDown || isCameraMode) return;

    let targetPoint = e.point;
    if (isPlaying && document.pointerLockElement === gl.domElement) {
       r3fRaycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
       const intersects = r3fRaycaster.intersectObjects(groupRef.current ? groupRef.current.children : []);
       if (intersects.length > 0) {
         targetPoint = intersects[0].point;
       } else {
         return;
       }
    } else {
       targetPoint = currentTarget || e.point;
    }

    if (isBrushMode && targetPoint) {
      e.stopPropagation();
      applyBrush(targetPoint, e.buttons === 2 || e.ctrlKey, e.altKey);
    } else if ((mode === 'boundary' || mode === 'zone') && targetPoint) {
      const { boundaryDrawing, setBoundaryDrawing } = useMapStore.getState();
      if (boundaryDrawing && boundaryDrawing.points && boundaryDrawing.points.length > 0) {
        const lastPt = boundaryDrawing.points[boundaryDrawing.points.length - 1];
        const dx = targetPoint.x - lastPt[0];
        const dz = targetPoint.z - lastPt[1];
        // Add point if moved enough to form a nice curve
        if (dx*dx + dz*dz > 1.0) {
          setBoundaryDrawing({ 
            points: [...boundaryDrawing.points, [targetPoint.x, targetPoint.z]], 
            isZone: boundaryDrawing.isZone 
          });
        }
      }
    }
  };

  const handlePointerUp = () => {
    setIsPointerDown(false);
    const { mode, boundaryDrawing, addBoundary, setBoundaryDrawing } = useMapStore.getState();
    if ((mode === 'boundary' || mode === 'zone') && boundaryDrawing && boundaryDrawing.points.length > 1) {
      const safeId = (window.crypto && window.crypto.randomUUID) ? window.crypto.randomUUID() : Math.random().toString(36).substring(2);
      addBoundary({
        id: safeId,
        points: boundaryDrawing.points,
        isZone: mode === 'zone',
        label: mode === 'zone' ? '이벤트 구역' : '새 경계선'
      });
      setBoundaryDrawing(null);
    }
  };

  return (
    <group>
      <group name="terrainGroup" ref={groupRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        <mesh ref={meshTopRef} geometry={geometries.topGeo}>
          <meshStandardMaterial 
            vertexColors 
            roughness={0.8}
            side={THREE.DoubleSide}
            transparent={oTop < 1}
            opacity={oTop}
            depthWrite={oTop === 1}
            polygonOffset={true} polygonOffsetFactor={-1} polygonOffsetUnits={-1}
          />
        </mesh>
        <mesh ref={meshBottomRef} geometry={geometries.bottomGeo}>
          <meshStandardMaterial 
            vertexColors 
            roughness={0.8}
            side={THREE.DoubleSide}
            transparent={oBottom < 1}
            opacity={oBottom}
            depthWrite={oBottom === 1}
            polygonOffset={true} polygonOffsetFactor={0} polygonOffsetUnits={0}
          />
        </mesh>
        <mesh ref={meshBaseRef} geometry={geometries.baseGeo}>
          <meshStandardMaterial 
            vertexColors 
            roughness={0.8}
            side={THREE.DoubleSide}
            transparent={oBase < 1}
            opacity={oBase}
            depthWrite={oBase === 1}
            polygonOffset={true} polygonOffsetFactor={1} polygonOffsetUnits={1}
          />
        </mesh>
        <mesh ref={meshWaterRef} geometry={geometries.waterGeo}>
          <meshStandardMaterial 
            color="#3b82f6"
            roughness={1}
            metalness={0}
            side={THREE.DoubleSide}
            transparent={true}
            opacity={oWater}
            depthWrite={oWater === 1}
            polygonOffset={true} polygonOffsetFactor={2} polygonOffsetUnits={2}
          />
        </mesh>
      </group>
      
      {/* Brush cursor */}
      <mesh ref={brushMeshRef} visible={false}>
        <ringGeometry args={[brushSize * 0.8, brushSize, 32]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.5} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}
