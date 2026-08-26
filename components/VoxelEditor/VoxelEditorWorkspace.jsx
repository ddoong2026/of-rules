'use client';

import VoxelUI from './VoxelUI';
import VoxelCanvas from './VoxelCanvas';

export default function VoxelEditorWorkspace() {
  return (
    <div style={{ display: 'flex', width: '100%', height: 'calc(100vh - 100px)', overflow: 'hidden' }}>
      {/* 3D Canvas Area (Left 75%) */}
      <div style={{ flex: '3', position: 'relative', borderRight: '1px solid #e5e7eb' }}>
        <VoxelCanvas />
      </div>

      {/* UI Area (Right 25%) */}
      <div style={{ flex: '1', minWidth: '300px', maxWidth: '400px', backgroundColor: '#ffffff', overflowY: 'auto' }}>
        <VoxelUI />
      </div>
    </div>
  );
}
