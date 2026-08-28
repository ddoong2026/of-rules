'use client';

import * as THREE from 'three';
import useMapStore from '@/store/useMapStore';
import useInventoryStore from '@/store/useInventoryStore';

export default function BoundaryManager() {
  const { boundaries, selectedBoundaryId, setSelectedBoundaryId, mode, boundaryDrawing, isPlaying } = useMapStore();
  const { items } = useInventoryStore();

  const handleBoundaryClick = (e, id) => {
    if (mode === 'select' && !isPlaying) {
      e.stopPropagation();
      setSelectedBoundaryId(id);
    }
  };

  return (
    <group>
      {/* Render existing boundaries */}
      {boundaries.map(b => {
        const dx = b.end[0] - b.start[0];
        const dz = b.end[1] - b.start[1];
        const length = Math.sqrt(dx*dx + dz*dz);
        const angle = Math.atan2(dx, dz); // Rotation around Y axis
        const cx = (b.start[0] + b.end[0]) / 2;
        const cz = (b.start[1] + b.end[1]) / 2;
        
        // Check condition if playing
        let isActive = true; // Active means it BLOCKS the player
        if (isPlaying && b.condition) {
          let currentAmount = 0;
          for (let i = 0; i < items.length; i++) {
            if (items[i] && items[i].type === b.condition.itemType) {
              currentAmount += items[i].count;
            }
          }
          if (currentAmount >= (b.condition.amount || 1)) {
            isActive = false; // Condition met, gate is open!
          }
        }

        if (!isActive && isPlaying) return null; // Hide if passed condition in play mode

        const isSelected = selectedBoundaryId === b.id;
        
        return (
          <group key={b.id} position={[cx, 2.5, cz]} rotation={[0, angle, 0]}>
            <mesh 
              onClick={(e) => handleBoundaryClick(e, b.id)}
            >
              <boxGeometry args={[0.2, 5, length]} />
              <meshBasicMaterial 
                color={isActive && isPlaying ? "#ef4444" : "#3b82f6"} 
                transparent 
                opacity={isPlaying ? 0.3 : (isSelected ? 0.8 : 0.4)} 
                side={THREE.DoubleSide} 
                depthWrite={false}
              />
            </mesh>
            {/* Draw border if selected */}
            {isSelected && !isPlaying && (
              <mesh>
                <boxGeometry args={[0.3, 5.1, length + 0.1]} />
                <meshBasicMaterial color="#f59e0b" wireframe />
              </mesh>
            )}
          </group>
        );
      })}

      {/* Render currently drawing boundary */}
      {boundaryDrawing && boundaryDrawing.start && boundaryDrawing.current && (
        (() => {
          const dx = boundaryDrawing.current[0] - boundaryDrawing.start[0];
          const dz = boundaryDrawing.current[1] - boundaryDrawing.start[1];
          const length = Math.sqrt(dx*dx + dz*dz);
          const angle = Math.atan2(dx, dz);
          const cx = (boundaryDrawing.start[0] + boundaryDrawing.current[0]) / 2;
          const cz = (boundaryDrawing.start[1] + boundaryDrawing.current[1]) / 2;
          
          if (length < 0.1) return null;

          return (
            <mesh position={[cx, 2.5, cz]} rotation={[0, angle, 0]}>
              <boxGeometry args={[0.2, 5, length]} />
              <meshBasicMaterial color="#10b981" transparent opacity={0.5} />
            </mesh>
          );
        })()
      )}
    </group>
  );
}
