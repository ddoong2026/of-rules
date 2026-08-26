'use client';

import { useEffect } from 'react';
import useVoxelStore from '@/store/useVoxelStore';

const PALETTE = [
  { name: '풀', color: '#3d8c40' },
  { name: '흙', color: '#8b5a2b' },
  { name: '돌', color: '#696969' },
  { name: '나무', color: '#8b4513' },
  { name: '물', color: '#3b82f6' },
  { name: '모래', color: '#c2b280' },
];

export default function VoxelUI() {
  const { mode, setMode, selectedColor, setSelectedColor, undo, history } = useVoxelStore();

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        undo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo]);

  return (
    <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Save / Undo Area */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#111827' }}>
          복셀 에디터 모드
        </div>
        <button 
          onClick={undo}
          disabled={history.length === 0}
          style={{ padding: '0.4rem 1rem', background: history.length === 0 ? '#d1d5db' : '#f59e0b', color: 'white', borderRadius: '4px', border: 'none', cursor: history.length === 0 ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}
          title="단축키: Ctrl+Z"
        >
          ↩️ 되돌리기
        </button>
      </div>

      {/* Mode Selection */}
      <div>
        <h4 style={{ margin: '0 0 0.5rem 0', color: '#4b5563' }}>도구 선택</h4>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          <ModeButton current={mode} id="build" label="🧱 쌓기" onClick={() => setMode('build')} />
          <ModeButton current={mode} id="dig" label="⛏️ 부수기 (파내기)" onClick={() => setMode('dig')} />
          <ModeButton current={mode} id="paint" label="🖌️ 색칠하기" onClick={() => setMode('paint')} />
        </div>
      </div>

      {/* Paint Palette */}
      {(mode === 'build' || mode === 'paint') && (
        <div style={{ background: '#f3f4f6', padding: '1rem', borderRadius: '6px' }}>
          <h4 style={{ margin: '0 0 0.5rem 0', color: '#4b5563' }}>색상 선택</h4>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
            <input 
              type="color" 
              value={selectedColor} 
              onChange={(e) => setSelectedColor(e.target.value)} 
              style={{ width: '50px', height: '50px', padding: '0', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
            />
            <div style={{ fontSize: '0.9rem', color: '#374151' }}>
              현재 색상: <span style={{ fontWeight: 'bold' }}>{selectedColor}</span>
            </div>
          </div>
          
          <div style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: '0.5rem' }}>추천 색상:</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {PALETTE.map(p => (
              <button
                key={p.name}
                onClick={() => setSelectedColor(p.color)}
                style={{
                  width: '30px', height: '30px', borderRadius: '50%', background: p.color,
                  border: selectedColor === p.color ? '3px solid #3b82f6' : '1px solid #d1d5db',
                  cursor: 'pointer'
                }}
                title={p.name}
              />
            ))}
          </div>
        </div>
      )}

      {/* Help Info */}
      <div style={{ background: '#eef2ff', padding: '1rem', borderRadius: '6px' }}>
        <h4 style={{ margin: '0 0 0.5rem 0', color: '#3730a3' }}>조작 방법</h4>
        <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.85rem', color: '#312e81', lineHeight: '1.5' }}>
          <li><b>카메라 조작:</b> Space 바를 누른 채 마우스 드래그 (회전/이동)</li>
          <li><b>블록 쌓기/부수기:</b> 지형 클릭</li>
          <li>우클릭 시 현재 모드와 반대로 작동합니다 (예: 쌓기 모드에서 우클릭 시 부수기).</li>
        </ul>
      </div>

    </div>
  );
}

function ModeButton({ id, label, current, onClick }) {
  const active = current === id;
  return (
    <button
      onClick={onClick}
      style={{
        padding: '0.5rem',
        borderRadius: '6px',
        border: active ? 'none' : '1px solid #d1d5db',
        background: active ? '#3b82f6' : 'white',
        color: active ? 'white' : '#374151',
        cursor: 'pointer',
        fontSize: '0.85rem',
        flex: '1 1 calc(50% - 0.5rem)',
        fontWeight: active ? 'bold' : 'normal'
      }}
    >
      {label}
    </button>
  );
}
