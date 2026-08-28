'use client';

import { useRef, useEffect, useState } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import useMapStore, { GRID_SIZE, VERTEX_COUNT } from '@/store/useMapStore';

export default function Terrain() {
  const meshRef = useRef();
  const geomRef = useRef();
  const { 
    mode, brushSize, brushIntensity, selectedColor, selectedAsset, selectedDecalImage,
    heights, colors, updateHeights, updateColors, addAsset, addDecal, addWaterSource,
    isCameraMode, saveHistory, isPlaying 
  } = useMapStore();
  
  const { camera, gl, raycaster: r3fRaycaster } = useThree();
  const [isPointerDown, setIsPointerDown] = useState(false);
  const [pointerPos, setPointerPos] = useState(null);
  const [pointerNormal, setPointerNormal] = useState(new THREE.Vector3(0, 1, 0));
  const brushMeshRef = useRef();

  // Initialize Geometry
  useEffect(() => {
    if (geomRef.current) {
      geomRef.current.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      
      const pos = geomRef.current.attributes.position;
      for (let i = 0; i < VERTEX_COUNT; i++) {
        pos.setZ(i, heights[i]);
      }
      geomRef.current.computeVertexNormals();
      pos.needsUpdate = true;
    }
  }, []);

  // Update Geometry on state change
  useEffect(() => {
    if (!geomRef.current) return;
    
    const pos = geomRef.current.attributes.position;
    let posChanged = false;
    for (let i = 0; i < VERTEX_COUNT; i++) {
      if (pos.getZ(i) !== heights[i]) {
        pos.setZ(i, heights[i]);
        posChanged = true;
      }
    }
    if (posChanged) {
      geomRef.current.computeVertexNormals();
      pos.needsUpdate = true;
    }

    const col = geomRef.current.attributes.color;
    let colChanged = false;
    for (let i = 0; i < colors.length; i++) {
      if (col.array[i] !== colors[i]) {
        col.array[i] = colors[i];
        colChanged = true;
      }
    }
    if (colChanged) {
      col.needsUpdate = true;
    }
  }, [heights, colors]);

  useFrame(() => {
    if (isPlaying && document.pointerLockElement === gl.domElement) {
      r3fRaycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
      const intersects = r3fRaycaster.intersectObject(meshRef.current);
      
      if (intersects.length > 0 && brushMeshRef.current) {
        brushMeshRef.current.visible = (mode === 'sculpt' || mode === 'dig' || mode === 'flatten' || mode === 'paint');
        
        const pt = intersects[0].point;
        const norm = intersects[0].face.normal.clone().transformDirection(meshRef.current.matrixWorld).normalize();
        
        brushMeshRef.current.position.set(pt.x + norm.x * 0.1, pt.y + norm.y * 0.1, pt.z + norm.z * 0.1);
        brushMeshRef.current.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), norm);
      } else if (brushMeshRef.current) {
        brushMeshRef.current.visible = false;
      }
    } else {
       if (brushMeshRef.current) {
         brushMeshRef.current.visible = !!pointerPos && !isCameraMode && (mode === 'sculpt' || mode === 'dig' || mode === 'flatten' || mode === 'paint');
         if (pointerPos) {
           brushMeshRef.current.position.set(pointerPos.x + pointerNormal.x * 0.1, pointerPos.y + pointerNormal.y * 0.1, pointerPos.z + pointerNormal.z * 0.1);
           brushMeshRef.current.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), pointerNormal);
         }
       }
    }
  });

  const applyBrush = (point, isShift) => {
    if (!geomRef.current) return;
    const pos = geomRef.current.attributes.position;
    
    // Find closest vertex
    // Plane is size 50x50 centered at 0,0. Range -25 to 25.
    const halfSize = 25;
    const segSize = 50 / GRID_SIZE;
    
    // Ignore clicks outside the circle (radius 25)
    if (point.x * point.x + point.z * point.z > halfSize * halfSize) return;
    
    const xIdx = Math.round((point.x + halfSize) / segSize);
    const yIdx = Math.round((point.z + halfSize) / segSize);

    if (xIdx < 0 || xIdx > GRID_SIZE || yIdx < 0 || yIdx > GRID_SIZE) return;

    let modified = false;
    const newHeights = new Float32Array(heights);
    const newColors = new Float32Array(colors);
    const targetColor = new THREE.Color(selectedColor);
    const centerIdx = yIdx * (GRID_SIZE + 1) + xIdx;
    const centerHeight = heights[centerIdx];

    // Apply brush in radius
    for (let i = -brushSize; i <= brushSize; i++) {
      for (let j = -brushSize; j <= brushSize; j++) {
        if (i*i + j*j > brushSize*brushSize) continue;
        
        const cx = xIdx + i;
        const cy = yIdx + j;
        if (cx < 0 || cx > GRID_SIZE || cy < 0 || cy > GRID_SIZE) continue;
        
        // Also ensure affected vertex is within circular map bounds
        const worldX = cx * segSize - halfSize;
        const worldZ = cy * segSize - halfSize;
        if (worldX * worldX + worldZ * worldZ > halfSize * halfSize) continue;
        
        const idx = cy * (GRID_SIZE + 1) + cx;
        const targetHeight = heights[idx];
        
        // Use 3D distance for paint to prevent coloring steep cliffs unintentionally
        const dx = i;
        const dz = j;
        const dy = (targetHeight - centerHeight) / segSize;
        const dist3D = Math.sqrt(dx*dx + dy*dy + dz*dz);
        const dist = mode === 'paint' ? dist3D : Math.sqrt(dx*dx + dz*dz);
        
        // Smooth falloff (Cosine squared)
        const normalizedDist = dist / (brushSize + 1);
        if (normalizedDist > 1) continue; // Skip if outside 3D radius
        
        const falloff = Math.pow(Math.cos(normalizedDist * Math.PI / 2), 2);
        
        if (mode === 'sculpt' || mode === 'dig') {
          const isDigging = mode === 'dig' || isShift;
          const delta = brushIntensity * falloff * (isDigging ? -1 : 1);
          newHeights[idx] += delta;
          modified = true;
        } else if (mode === 'flatten') {
          const heightDiff = centerHeight - targetHeight;
          newHeights[idx] += heightDiff * falloff * (brushIntensity * 0.1);
          modified = true;
        } else if (mode === 'paint') {
          const r = idx * 3;
          const g = idx * 3 + 1;
          const b = idx * 3 + 2;
          
          const currentColor = new THREE.Color(newColors[r], newColors[g], newColors[b]);
          currentColor.lerp(targetColor, falloff * brushIntensity * 0.2);
          
          newColors[r] = currentColor.r;
          newColors[g] = currentColor.g;
          newColors[b] = currentColor.b;
          modified = true;
        }
      }
    }

    if (modified) {
      if (mode === 'sculpt' || mode === 'dig' || mode === 'flatten') updateHeights(newHeights);
      if (mode === 'paint') updateColors(newColors);
    }
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
         return; // clicked sky
       }
    }

    if (mode === 'sculpt' || mode === 'dig' || mode === 'flatten' || mode === 'paint') {
      saveHistory(); // Save state before stroke
      applyBrush(targetPoint, e.button === 2 || e.shiftKey); // right click or shift for inverted sculpt
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
        scale: [brushSize * 2, brushSize * 2, brushSize * 2] // Arbitrary scaling based on brush
      });
    } else if (mode === 'boundary') {
      const { setBoundaryDrawing } = useMapStore.getState();
      setBoundaryDrawing({ points: [[targetPoint.x, targetPoint.z]] });
    }
  };

  const handlePointerMove = (e) => {
    if (!isPlaying || document.pointerLockElement !== gl.domElement) {
      // Update pointer position for brush cursor in normal mode
      if (mode === 'sculpt' || mode === 'dig' || mode === 'flatten' || mode === 'paint') {
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

    if (mode === 'sculpt' || mode === 'dig' || mode === 'flatten' || mode === 'paint') {
      e.stopPropagation();
      applyBrush(targetPoint, e.buttons === 2 || e.shiftKey);
    } else if (mode === 'boundary') {
      const { boundaryDrawing, setBoundaryDrawing } = useMapStore.getState();
      if (boundaryDrawing) {
        const lastPoint = boundaryDrawing.points[boundaryDrawing.points.length - 1];
        const dx = targetPoint.x - lastPoint[0];
        const dz = targetPoint.z - lastPoint[1];
        if (Math.sqrt(dx*dx + dz*dz) > 0.5) { // Add point every 0.5 units
          setBoundaryDrawing({ points: [...boundaryDrawing.points, [targetPoint.x, targetPoint.z]] });
        }
      }
    }
  };

  const handlePointerUp = (e) => {
    setIsPointerDown(false);
    
    if (mode === 'boundary') {
      const { boundaryDrawing, setBoundaryDrawing, addBoundary } = useMapStore.getState();
      if (boundaryDrawing) {
        if (boundaryDrawing.points.length > 1) {
          addBoundary({
            id: crypto.randomUUID(),
            points: boundaryDrawing.points,
            condition: { itemType: 'rock', amount: 3 }
          });
        }
        setBoundaryDrawing(null);
      }
    }
  };

  const handlePointerOut = (e) => {
    if (mode === 'boundary' && useMapStore.getState().boundaryDrawing) {
      handlePointerUp(e);
    }
    setIsPointerDown(false);
    setPointerPos(null);
  };

  // Create circular alpha map
  const alphaMap = useState(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    
    // Fill black (transparent)
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, 512, 512);
    
    // Draw white circle (opaque)
    ctx.beginPath();
    ctx.arc(256, 256, 256, 0, Math.PI * 2);
    ctx.fillStyle = 'white';
    ctx.fill();
    
    return new THREE.CanvasTexture(canvas);
  })[0];

  return (
    <group>
      <mesh 
        ref={meshRef} 
        rotation={[-Math.PI / 2, 0, 0]} 
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerOut={handlePointerOut}
        onContextMenu={(e) => e.preventDefault()}
      >
        <planeGeometry ref={geomRef} args={[50, 50, GRID_SIZE, GRID_SIZE]} />
        <meshStandardMaterial 
          vertexColors 
          side={THREE.DoubleSide} 
          roughness={0.8}
          alphaMap={alphaMap}
          transparent={true}
          alphaTest={0.5}
        />
      </mesh>
      
      {/* Brush Cursor Indicator */}
      <mesh 
        ref={brushMeshRef}
        pointerEvents="none"
        visible={false}
      >
        <ringGeometry args={[brushSize - 0.2, brushSize, 32]} />
        <meshBasicMaterial color={mode === 'paint' ? selectedColor : (mode === 'flatten' ? '#f59e0b' : (mode === 'dig' ? '#ef4444' : '#ffffff'))} transparent opacity={0.5} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}
