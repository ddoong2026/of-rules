'use client';

import * as THREE from 'three';
import { useState, useEffect } from 'react';
import useMapStore from '@/store/useMapStore';
import useInventoryStore from '@/store/useInventoryStore';

export default function BoundaryManager() {
  const { boundaries, selectedBoundaryId, setSelectedBoundaryId, mode, boundaryDrawing, isPlaying, removeBoundary } = useMapStore();
  const { items } = useInventoryStore();
  const [collidedBoundaryId, setCollidedBoundaryId] = useState(null);

  useEffect(() => {
    let timeoutId;
    
    const hideBoundary = () => {
      setCollidedBoundaryId(null);
      if (timeoutId) clearTimeout(timeoutId);
    };

    const handleCollide = (e) => {
      setCollidedBoundaryId(e.detail.boundaryId);
      if (timeoutId) clearTimeout(timeoutId);
      
      if (!e.detail.targetAssetId) {
        timeoutId = setTimeout(() => {
          setCollidedBoundaryId(null);
        }, 3500);
      }
    };

    window.addEventListener('boundary-collide', handleCollide);
    window.addEventListener('boundary-message-close', hideBoundary);
    
    return () => {
      window.removeEventListener('boundary-collide', handleCollide);
      window.removeEventListener('boundary-message-close', hideBoundary);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []);

  const handleBoundaryClick = (e, id) => {
    if (mode === 'select' && !isPlaying) {
      e.stopPropagation();
      setSelectedBoundaryId(id);
    } else if (mode === 'erase' && !isPlaying) {
      e.stopPropagation();
      removeBoundary(id);
    }
  };

  return (
    <group>
      {/* Render existing boundaries */}
      {boundaries.map(b => {
        const points = b.points || (b.start && b.end ? [b.start, b.end] : []);
        if (points.length < 2) return null;

        if (isPlaying && !b.isZone && b.id !== collidedBoundaryId) return null; // Hide boundaries in play mode unless recently collided
        if (isPlaying && b.isZone) return null; // Always hide zones in play mode

        const isSelected = selectedBoundaryId === b.id;
        const color = b.isZone ? '#3b82f6' : '#ef4444';
        const opacity = isSelected || (isPlaying && !b.isZone && b.id === collidedBoundaryId) ? 0.8 : 0.4;
        
        return (
          <group key={b.id} onClick={(e) => handleBoundaryClick(e, b.id)}>
            {points.map((p, i) => {
              if (i === points.length - 1) return null;
              const nextP = points[i+1];
              const dx = nextP[0] - p[0];
              const dz = nextP[1] - p[1];
              const length = Math.sqrt(dx*dx + dz*dz);
              const angle = Math.atan2(dx, dz); // Rotation around Y axis
              const cx = (p[0] + nextP[0]) / 2;
              const cz = (p[1] + nextP[1]) / 2;
              
              return (
                <group key={i} position={[cx, 2.5, cz]} rotation={[0, angle, 0]}>
                  <mesh>
                    <boxGeometry args={[0.2, 5, length + 0.1]} /> {/* +0.1 to bridge gaps */}
                    <meshBasicMaterial 
                      color={color} 
                      transparent 
                      opacity={opacity} 
                      side={THREE.DoubleSide} 
                      depthWrite={false}
                    />
                  </mesh>
                  {/* Draw border if selected */}
                  {isSelected && (
                    <mesh>
                      <boxGeometry args={[0.3, 5.1, length + 0.2]} />
                      <meshBasicMaterial color="#f59e0b" wireframe />
                    </mesh>
                  )}
                </group>
              );
            })}
          </group>
        );
      })}

      {/* Render currently drawing boundary */}
      {boundaryDrawing && boundaryDrawing.points && boundaryDrawing.points.length > 1 && (
        <group>
          {boundaryDrawing.points.map((p, i) => {
            if (i === boundaryDrawing.points.length - 1) return null;
            const nextP = boundaryDrawing.points[i+1];
            const dx = nextP[0] - p[0];
            const dz = nextP[1] - p[1];
            const length = Math.sqrt(dx*dx + dz*dz);
            const angle = Math.atan2(dx, dz);
            const cx = (p[0] + nextP[0]) / 2;
            const cz = (p[1] + nextP[1]) / 2;
            
            return (
              <mesh key={i} position={[cx, 2.5, cz]} rotation={[0, angle, 0]}>
                <boxGeometry args={[0.2, 5, length + 0.1]} />
                <meshBasicMaterial color={boundaryDrawing.isZone ? "#3b82f6" : "#ef4444"} transparent opacity={0.5} />
              </mesh>
            );
          })}
        </group>
      )}
    </group>
  );
}
