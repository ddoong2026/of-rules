'use client';

import { useRef, useEffect, useState } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { CSG } from 'three-csg-ts';
import useMapStore, { GRID_SIZE, VERTEX_COUNT } from '@/store/useMapStore';

export default function Terrain() {
  const meshRef = useRef();
  const geomRef = useRef();
  const { 
    mode, brushSize, brushIntensity, selectedColor, selectedAsset, selectedDecalImage,
    heights, colors, updateHeights, updateColors, addAsset, addDecal, addWaterSource,
    csgOperations, addCsgOperation,
    isCameraMode, saveHistory, isPlaying, spawnPoint
  } = useMapStore();
  
  const { camera, gl, raycaster: r3fRaycaster } = useThree();
  const [isPointerDown, setIsPointerDown] = useState(false);
  const [pointerPos, setPointerPos] = useState(null);
  const [pointerNormal, setPointerNormal] = useState(new THREE.Vector3(0, 1, 0));
  const brushMeshRef = useRef();
  
  const [csgGeometry, setCsgGeometry] = useState(null);

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

  const bspCache = useRef({
    heightsRef: null,
    operationsLength: 0,
    bsp: null
  });

  // Compute CSG when operations or heights change
  useEffect(() => {
    if (!geomRef.current) return;
    
    if (csgOperations.length === 0) {
      if (csgGeometry) {
        csgGeometry.dispose();
        setCsgGeometry(null);
      }
      bspCache.current = { heightsRef: null, operationsLength: 0, bsp: null };
      return;
    }

    try {
      let bsp;
      let startIdx = 0;

      // Check if we can reuse the cached BSP
      if (
        bspCache.current.heightsRef === heights &&
        bspCache.current.bsp &&
        csgOperations.length >= bspCache.current.operationsLength
      ) {
        bsp = bspCache.current.bsp;
        startIdx = bspCache.current.operationsLength;
      } else {
        const baseMesh = new THREE.Mesh(geomRef.current, new THREE.MeshStandardMaterial());
        baseMesh.rotation.set(-Math.PI / 2, 0, 0);
        baseMesh.updateMatrixWorld();
        bsp = CSG.fromMesh(baseMesh);
      }

      // Only process new operations
      if (startIdx < csgOperations.length) {
        const sphereGeo = new THREE.SphereGeometry(1, 16, 16);
        const sphereColors = new Float32Array(sphereGeo.attributes.position.count * 3).fill(1);
        sphereGeo.setAttribute('color', new THREE.BufferAttribute(sphereColors, 3));
        const sphereMesh = new THREE.Mesh(sphereGeo, new THREE.MeshStandardMaterial());

        const cylGeo = new THREE.CylinderGeometry(1, 1, 1, 16);
        cylGeo.rotateX(Math.PI / 2);
        const cylColors = new Float32Array(cylGeo.attributes.position.count * 3).fill(1);
        cylGeo.setAttribute('color', new THREE.BufferAttribute(cylColors, 3));
        const cylMesh = new THREE.Mesh(cylGeo, new THREE.MeshStandardMaterial());

        for (let i = startIdx; i < csgOperations.length; i++) {
          const op = csgOperations[i];
          const opColor = op.color || [0.6, 0.6, 0.6];
          
          if (op.shape === 'sphere') {
            for(let j=0; j<sphereColors.length; j+=3) {
              sphereColors[j] = opColor[0]; sphereColors[j+1] = opColor[1]; sphereColors[j+2] = opColor[2];
            }
            sphereGeo.attributes.color.needsUpdate = true;

            sphereMesh.position.set(...op.position);
            sphereMesh.scale.set(op.radius, op.radius, op.radius);
            sphereMesh.updateMatrixWorld();
            const opBsp = CSG.fromMesh(sphereMesh);
            bsp = bsp.subtract(opBsp);
          } else if (op.shape === 'capsule') {
            const start = new THREE.Vector3(...op.start);
            const end = new THREE.Vector3(...op.end);
            const dist = start.distanceTo(end);

            for(let j=0; j<cylColors.length; j+=3) {
              cylColors[j] = opColor[0]; cylColors[j+1] = opColor[1]; cylColors[j+2] = opColor[2];
            }
            cylGeo.attributes.color.needsUpdate = true;

            cylMesh.position.copy(start).lerp(end, 0.5);
            cylMesh.scale.set(op.radius, op.radius, dist);
            cylMesh.lookAt(end);
            cylMesh.updateMatrixWorld();
            bsp = bsp.subtract(CSG.fromMesh(cylMesh));

            for(let j=0; j<sphereColors.length; j+=3) {
              sphereColors[j] = opColor[0]; sphereColors[j+1] = opColor[1]; sphereColors[j+2] = opColor[2];
            }
            sphereGeo.attributes.color.needsUpdate = true;

            sphereMesh.position.copy(end);
            sphereMesh.scale.set(op.radius, op.radius, op.radius);
            sphereMesh.updateMatrixWorld();
            bsp = bsp.subtract(CSG.fromMesh(sphereMesh));
          }
        }

        // Update cache
        bspCache.current = {
          heightsRef: heights,
          operationsLength: csgOperations.length,
          bsp: bsp
        };
      }

      const baseMeshDummy = new THREE.Mesh(geomRef.current, new THREE.MeshStandardMaterial());
      baseMeshDummy.rotation.set(-Math.PI / 2, 0, 0);
      baseMeshDummy.updateMatrixWorld();
      
      const finalMesh = CSG.toMesh(bsp, baseMeshDummy.matrixWorld, baseMeshDummy.material);
      
      // Fix UVs so alphaMap correctly maps over the whole terrain including new cave walls
      const posAttr = finalMesh.geometry.attributes.position;
      const uvAttr = finalMesh.geometry.attributes.uv;
      for (let i = 0; i < posAttr.count; i++) {
        // Local coordinates: plane is on XY from -25 to +25.
        const x = posAttr.getX(i);
        const y = posAttr.getY(i);
        uvAttr.setXY(i, (x + 25) / 50, (y + 25) / 50);
      }
      uvAttr.needsUpdate = true;
      
      // Ensure vertex colors are smooth
      finalMesh.geometry.computeVertexNormals();

      setCsgGeometry(finalMesh.geometry);
    } catch (e) {
      console.error('CSG Computation failed:', e);
    }
  }, [heights, csgOperations]); // Note: recomputes when heights change too, to keep holes in place

  useFrame(() => {
    const targetMesh = csgGeometry ? csgMeshRef.current : meshRef.current;
    
    if (isPlaying && document.pointerLockElement === gl.domElement) {
      r3fRaycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
      const intersects = r3fRaycaster.intersectObject(targetMesh);
      
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
       const targetMesh = csgGeometry ? csgMeshRef.current : meshRef.current;
       const intersects = r3fRaycaster.intersectObject(targetMesh);
       if (intersects.length > 0) {
         targetPoint = intersects[0].point;
       } else {
         return; // clicked sky
       }
    }

    if (mode === 'sculpt' || mode === 'dig' || mode === 'flatten' || mode === 'paint') {
      saveHistory(); // Save state before stroke
      applyBrush(targetPoint, e.button === 2 || e.shiftKey); // right click or shift for inverted sculpt
    } else if (mode === 'carve') {
      saveHistory();
      
      const cx = Math.max(0, Math.min(GRID_SIZE, Math.round((targetPoint.x + 25) / (50 / GRID_SIZE))));
      const cz = Math.max(0, Math.min(GRID_SIZE, Math.round((targetPoint.z + 25) / (50 / GRID_SIZE))));
      const idx = cz * (GRID_SIZE + 1) + cx;
      const r = colors[idx * 3] || 0.6;
      const g = colors[idx * 3 + 1] || 0.6;
      const b = colors[idx * 3 + 2] || 0.6;

      addCsgOperation({
        id: crypto.randomUUID(),
        type: 'subtract',
        shape: 'sphere',
        position: [targetPoint.x, targetPoint.y, targetPoint.z],
        radius: brushSize * 0.5,
        color: [r, g, b]
      });
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
    } else if (mode === 'spawn') {
      const { setSpawnPoint } = useMapStore.getState();
      setSpawnPoint({ x: targetPoint.x, z: targetPoint.z });
    } else if (mode === 'select') {
      const { selectedAssetId, updateAsset } = useMapStore.getState();
      if (selectedAssetId) {
        updateAsset(selectedAssetId, { position: [targetPoint.x, targetPoint.y, targetPoint.z] });
      }
    }
  };

  const handlePointerMove = (e) => {
    if (!isPlaying || document.pointerLockElement !== gl.domElement) {
      // Update pointer position for brush cursor in normal mode
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

    if (mode === 'sculpt' || mode === 'dig' || mode === 'flatten' || mode === 'paint') {
      e.stopPropagation();
      applyBrush(targetPoint, e.buttons === 2 || e.shiftKey);
    } else if (mode === 'carve') {
      e.stopPropagation();
      const { csgOperations, addCsgOperation } = useMapStore.getState();
      const lastOp = csgOperations[csgOperations.length - 1];
      let shouldAdd = true;
      if (lastOp) {
        const lastPos = lastOp.end || lastOp.position;
        const dx = targetPoint.x - lastPos[0];
        const dy = targetPoint.y - lastPos[1];
        const dz = targetPoint.z - lastPos[2];
        const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
        // Only add segment if moved more than a minimum distance
        if (dist < 0.25) {
          shouldAdd = false;
        }
      }
      if (shouldAdd) {
        const cx = Math.max(0, Math.min(GRID_SIZE, Math.round((targetPoint.x + 25) / (50 / GRID_SIZE))));
        const cz = Math.max(0, Math.min(GRID_SIZE, Math.round((targetPoint.z + 25) / (50 / GRID_SIZE))));
        const idx = cz * (GRID_SIZE + 1) + cx;
        const r = colors[idx * 3] || 0.6;
        const g = colors[idx * 3 + 1] || 0.6;
        const b = colors[idx * 3 + 2] || 0.6;

        addCsgOperation({
          id: crypto.randomUUID(),
          type: 'subtract',
          shape: 'capsule',
          start: lastOp ? (lastOp.end || lastOp.position) : [targetPoint.x, targetPoint.y, targetPoint.z],
          end: [targetPoint.x, targetPoint.y, targetPoint.z],
          radius: brushSize * 0.5,
          color: [r, g, b]
        });
      }
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

  const csgMeshRef = useRef();

  return (
    <group>
      {/* Base Terrain */}
      <mesh 
        ref={meshRef}
        name="terrainMesh"
        rotation={[-Math.PI / 2, 0, 0]} 
        receiveShadow 
        castShadow
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerOut={handlePointerOut}
        onContextMenu={(e) => {
          if (e.nativeEvent) e.nativeEvent.preventDefault();
        }}
        visible={!csgGeometry} // Hide base mesh if CSG is active
      >
        <planeGeometry 
          ref={geomRef}
          args={[50, 50, GRID_SIZE, GRID_SIZE]} 
        />
        <meshStandardMaterial 
          vertexColors 
          roughness={0.8}
          side={THREE.DoubleSide}
          alphaMap={alphaMap}
          transparent={true}
          alphaTest={0.5}
        />
      </mesh>

      {/* CSG Result Mesh */}
      {csgGeometry && (
        <mesh
          ref={csgMeshRef}
          name="terrainMesh"
          rotation={[-Math.PI / 2, 0, 0]}
          geometry={csgGeometry}
          receiveShadow
          castShadow
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerOut={handlePointerOut}
          onContextMenu={(e) => {
            if (e.nativeEvent) e.nativeEvent.preventDefault();
          }}
        >
          <meshStandardMaterial 
            vertexColors 
            roughness={0.8}
            side={THREE.DoubleSide}
            alphaMap={alphaMap}
            transparent={true}
            alphaTest={0.5}
          />
        </mesh>
      )}
      
      {/* Brush Cursor Indicator */}
      <mesh 
        ref={brushMeshRef}
        pointerEvents="none"
        visible={false}
      >
        <ringGeometry args={[brushSize - 0.2, brushSize, 32]} />
        <meshBasicMaterial color={mode === 'paint' ? selectedColor : (mode === 'flatten' ? '#f59e0b' : (mode === 'dig' ? '#ef4444' : '#ffffff'))} transparent opacity={0.5} side={THREE.DoubleSide} />
      </mesh>
      
      {/* Spawn Point Marker */}
      {!isPlaying && spawnPoint && (
        <group position={[spawnPoint.x, 0.1, spawnPoint.z]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0, 1.5, 32]} />
            <meshBasicMaterial color="#ef4444" transparent opacity={0.6} side={THREE.DoubleSide} />
          </mesh>
          <mesh position={[0, 1.5, 0]}>
            <cylinderGeometry args={[0.1, 0.1, 3]} />
            <meshBasicMaterial color="#ef4444" />
          </mesh>
          <mesh position={[0.5, 2.5, 0]}>
            <boxGeometry args={[1, 0.6, 0.1]} />
            <meshBasicMaterial color="#ef4444" />
          </mesh>
        </group>
      )}
    </group>
  );
}
