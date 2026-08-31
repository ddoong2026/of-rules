import React, { useMemo, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';

/**
 * [목표]
 * 2개의 높이맵(Dual Heightmap: Bottom/Top)을 이용해 Y축 특정 구간에만 지형 메시가 존재하고
 * 밑은 비어있는(동굴/터널/공중지형) 지형 시스템 로직입니다.
 */

// 1. Data Structure 및 Sculpting 로직 클래스
export class DualHeightmapSystem {
  constructor(width, depth, minThickness = 1.0) {
    this.width = width;
    this.depth = depth;
    this.minThickness = minThickness;

    // heightMapBottom: 동굴 바닥/아랫면 높이
    // heightMapTop: 동굴 천장/윗면 높이
    this.heightMapBottom = Array(width).fill(0).map(() => Array(depth).fill(0));
    this.heightMapTop = Array(width).fill(0).map(() => Array(depth).fill(10)); // 기본 높이 10
  }

  // 지형이 존재하는지 여부 확인 (두께가 minThickness 이상일 때)
  isActive(x, z) {
    if (x < 0 || x >= this.width || z < 0 || z >= this.depth) return false;
    return (this.heightMapTop[x][z] - this.heightMapBottom[x][z]) >= this.minThickness;
  }

  // 융기 연산 (지형 높이기)
  // topMode = true: 윗면 높이(heightMapTop) 증가 (지형 융기)
  // topMode = false: 아랫면 높이(heightMapBottom) 감소 (동굴 바닥 파기)
  addTerrain(centerX, centerZ, radius, amount, topMode = true) {
    for (let x = Math.max(0, centerX - radius); x <= Math.min(this.width - 1, centerX + radius); x++) {
      for (let z = Math.max(0, centerZ - radius); z <= Math.min(this.depth - 1, centerZ + radius); z++) {
        const dist = Math.sqrt((x - centerX) ** 2 + (z - centerZ) ** 2);
        if (dist <= radius) {
          // 브러시 감쇠 (중심에서 가장 강하고 외곽으로 갈수록 0)
          const falloff = 1 - (dist / radius);
          const delta = amount * falloff;

          if (topMode) {
            this.heightMapTop[x][z] += delta;
          } else {
            this.heightMapBottom[x][z] -= delta;
            // 아랫면은 0 이하로 내려갈 수 있지만, 필요시 0으로 Clamp 가능
            // this.heightMapBottom[x][z] = Math.max(0, this.heightMapBottom[x][z]);
          }
        }
      }
    }
  }

  // 빼기 연산 (공간 만들기 / 동굴 뚫기)
  // topMode = true: 윗면 높이(heightMapTop) 감소 (지형 파기)
  // topMode = false: 아랫면 높이(heightMapBottom) 증가 (동굴 천장과 공간 만들기)
  subtractTerrain(centerX, centerZ, radius, amount, topMode = false) {
    for (let x = Math.max(0, centerX - radius); x <= Math.min(this.width - 1, centerX + radius); x++) {
      for (let z = Math.max(0, centerZ - radius); z <= Math.min(this.depth - 1, centerZ + radius); z++) {
        const dist = Math.sqrt((x - centerX) ** 2 + (z - centerZ) ** 2);
        if (dist <= radius) {
          const falloff = 1 - (dist / radius);
          const delta = amount * falloff;

          if (topMode) {
            this.heightMapTop[x][z] -= delta;
            // Top이 Bottom + minThickness 보다 낮아지지 않도록 Clamp
            this.heightMapTop[x][z] = Math.max(this.heightMapTop[x][z], this.heightMapBottom[x][z] + this.minThickness);
          } else {
            this.heightMapBottom[x][z] += delta;
            // Bottom이 Top - minThickness 보다 높아지지 않도록 Clamp
            this.heightMapBottom[x][z] = Math.min(this.heightMapBottom[x][z], this.heightMapTop[x][z] - this.minThickness);
          }
        }
      }
    }
  }

  // 2. 메시 생성 로직 (Mesh Generation)
  generateMeshData(cellSize = 1) {
    const positions = [];
    const indices = [];
    const uvs = [];
    
    const vertexIndexMap = new Map();
    let indexCounter = 0;

    const getVertexIndex = (x, y, z, u, v) => {
      const key = `${x},${y},${z}`;
      if (vertexIndexMap.has(key)) {
        return vertexIndexMap.get(key);
      }
      positions.push(x, y, z);
      uvs.push(u, v);
      vertexIndexMap.set(key, indexCounter);
      return indexCounter++;
    };

    const addQuad = (v0, v1, v2, v3) => {
      indices.push(v0, v1, v2);
      indices.push(v0, v2, v3);
    };

    // Quad 순회
    for (let x = 0; x < this.width - 1; x++) {
      for (let z = 0; z < this.depth - 1; z++) {
        // 현재 Quad가 활성화된 상태인지 검사 (네 꼭지점 중 하나라도 활성화되어 있으면 생성)
        const active = this.isActive(x, z) || this.isActive(x + 1, z) || this.isActive(x, z + 1) || this.isActive(x + 1, z + 1);
        if (!active) continue;

        const posX = x * cellSize;
        const posZ = z * cellSize;
        const nextX = (x + 1) * cellSize;
        const nextZ = (z + 1) * cellSize;

        // Top Vertices
        const t00 = getVertexIndex(posX, this.heightMapTop[x][z], posZ, x / this.width, z / this.depth);
        const t10 = getVertexIndex(nextX, this.heightMapTop[x + 1][z], posZ, (x + 1) / this.width, z / this.depth);
        const t01 = getVertexIndex(posX, this.heightMapTop[x][z + 1], nextZ, x / this.width, (z + 1) / this.depth);
        const t11 = getVertexIndex(nextX, this.heightMapTop[x + 1][z + 1], nextZ, (x + 1) / this.width, (z + 1) / this.depth);

        // Bottom Vertices
        const b00 = getVertexIndex(posX, this.heightMapBottom[x][z], posZ, x / this.width, z / this.depth);
        const b10 = getVertexIndex(nextX, this.heightMapBottom[x + 1][z], posZ, (x + 1) / this.width, z / this.depth);
        const b01 = getVertexIndex(posX, this.heightMapBottom[x][z + 1], nextZ, x / this.width, (z + 1) / this.depth);
        const b11 = getVertexIndex(nextX, this.heightMapBottom[x + 1][z + 1], nextZ, (x + 1) / this.width, (z + 1) / this.depth);

        // 윗면 (Top Surface) - 법선 위쪽 (+Y)
        addQuad(t00, t01, t11, t10);

        // 아랫면 (Bottom Surface / Ceiling) - 법선 아래쪽 (-Y), 반시계(CCW)
        addQuad(b00, b10, b11, b01);

        // 측면 (Side Walls) 생성 로직
        // 인접한 Quad가 비활성화 상태이거나 경계면일 경우 막아줍니다.

        // Left (-X)
        if (x === 0 || !this.isActive(x - 1, z)) {
          addQuad(b00, b01, t01, t00);
        }
        // Right (+X)
        if (x === this.width - 2 || !this.isActive(x + 1, z)) {
          addQuad(b10, t10, t11, b11);
        }
        // Back (-Z)
        if (z === 0 || !this.isActive(x, z - 1)) {
          addQuad(b00, t00, t10, b10);
        }
        // Front (+Z)
        if (z === this.depth - 2 || !this.isActive(x, z + 1)) {
          addQuad(b01, b11, t11, t01);
        }
      }
    }

    return {
      positions: new Float32Array(positions),
      normals: new Float32Array([]), // ComputeVertexNormals로 자동 계산
      indices: new Uint16Array(indices),
      uvs: new Float32Array(uvs),
    };
  }
}

// 3. React Three Fiber 컴포넌트
export default function DualHeightmapTerrain({ width = 50, depth = 50, cellSize = 1 }) {
  const meshRef = useRef();
  
  // 시스템 초기화
  const terrainSystem = useMemo(() => {
    const system = new DualHeightmapSystem(width, depth, 0.1);
    
    // 테스트용 기본 지형 생성 (언덕 및 동굴)
    for (let x = 0; x < width; x++) {
      for (let z = 0; z < depth; z++) {
        // 기본 윗면은 노이즈/곡선 형태
        system.heightMapTop[x][z] = 10 + Math.sin(x * 0.2) * 5 + Math.cos(z * 0.2) * 5;
        // 기본 아랫면은 0
        system.heightMapBottom[x][z] = 0;
      }
    }
    
    // 중앙에 동굴(터널) 파기 
    system.subtractTerrain(width / 2, depth / 2, 8, 8, false); // Bottom을 높여서 빈 공간 생성
    
    return system;
  }, [width, depth]);

  const [meshData, setMeshData] = useState(() => terrainSystem.generateMeshData(cellSize));

  // 스컬프팅 상호작용 예시 핸들러
  const handlePointerDown = useCallback((e) => {
    e.stopPropagation();
    if (!e.point) return;
    
    // 교차점의 x, z 인덱스 계산
    const cx = Math.floor(e.point.x / cellSize);
    const cz = Math.floor(e.point.z / cellSize);

    // 마우스 버튼에 따라 다른 연산 적용 (예: 좌클릭 빼기(Bottom 올리기), 우클릭 융기)
    if (e.button === 0) {
      // Left Click: 동굴 파기 (Bottom 높임)
      terrainSystem.subtractTerrain(cx, cz, 4, 2, false);
    } else if (e.button === 2) {
      // Right Click: 지형 융기 (Top 높임)
      terrainSystem.addTerrain(cx, cz, 4, 2, true);
    }

    // 메시 데이터 갱신
    setMeshData(terrainSystem.generateMeshData(cellSize));
  }, [terrainSystem, cellSize]);

  // Geometry 생성 및 업데이트
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(meshData.positions, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(meshData.uvs, 2));
    geo.setIndex(new THREE.BufferAttribute(meshData.indices, 1));
    geo.computeVertexNormals();
    return geo;
  }, [meshData]);

  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      onPointerDown={handlePointerDown}
      // 양면 렌더링(Double-Sided) 설정: 동굴 내부(아랫면)에서도 지형이 보이도록 설정
      material={new THREE.MeshStandardMaterial({ 
        color: '#8b5a2b',
        roughness: 0.8,
        side: THREE.DoubleSide, 
        wireframe: false 
      })}
    />
  );
}
