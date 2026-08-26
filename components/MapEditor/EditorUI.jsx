'use client';

import { useState, useRef, useEffect } from 'react';
import useMapStore from '@/store/useMapStore';
import { supabase } from '@/lib/supabase';

const PALETTE = [
  { name: '풀', color: '#3d8c40' },
  { name: '흙', color: '#8b5a2b' },
  { name: '바위', color: '#696969' },
  { name: '눈', color: '#ffffff' },
  { name: '모래', color: '#c2b280' },
];

const ASSETS = [
  { id: 'tree', name: '나무 (원뿔)' },
  { id: 'rock', name: '바위 (다면체)' },
  { id: 'house', name: '집 (사각형)' },
  { id: 'cave', name: '동굴 입구 (반구)' },
  { id: 'lake', name: '고인 물/호수 (원형)' },
];

export default function EditorUI({ onSave, isSaving }) {
  const { 
    mode, setMode, 
    brushSize, setBrushSize, 
    brushIntensity, setBrushIntensity,
    selectedColor, setSelectedColor,
    selectedAsset, setSelectedAsset,
    selectedDecalImage, setSelectedDecalImage,
    currentMapId, mapName,
    undo, history,
    sunTime, setSunTime,
    isPlaying, setIsPlaying
  } = useMapStore();

  const fileInputRef = useRef(null);

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 500 * 1024) {
      alert('이미지 크기는 500KB 이하여야 합니다.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setSelectedDecalImage(event.target.result);
      setMode('decal');
    };
    reader.readAsDataURL(file);
  };

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
      
      {/* Save Area / Play Toggle */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#111827' }}>
          {currentMapId ? mapName : '저장되지 않은 맵'}
        </div>
        
        <button 
          onClick={() => setIsPlaying(!isPlaying)}
          style={{ padding: '0.4rem 1rem', background: isPlaying ? '#ef4444' : '#8b5cf6', color: 'white', borderRadius: '4px', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}
        >
          {isPlaying ? '⏹️ 편집으로 돌아가기' : '🏃‍♂️ 캐릭터 체험하기'}
        </button>
      </div>
      
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
        <button 
          onClick={undo}
          disabled={history.length === 0 || isPlaying}
          style={{ padding: '0.4rem 1rem', background: history.length === 0 ? '#d1d5db' : '#f59e0b', color: 'white', borderRadius: '4px', border: 'none', cursor: history.length === 0 ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}
          title="단축키: Ctrl+Z"
        >
          ↩️ 되돌리기
        </button>
        <button 
          onClick={onSave}
          disabled={isSaving || isPlaying}
          style={{ padding: '0.4rem 1rem', background: '#10b981', color: 'white', borderRadius: '4px', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}
        >
          {isSaving ? '저장 중...' : '저장하기'}
        </button>
      </div>

      {/* Mode Selection */}
      <div>
        <h4 style={{ margin: '0 0 0.5rem 0', color: '#4b5563' }}>도구 선택</h4>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          <ModeButton current={mode} id="none" label="👆 선택 해제" onClick={() => setMode('none')} />
          <ModeButton current={mode} id="sculpt" label="⛰️ 지형 융기" onClick={() => setMode('sculpt')} />
          <ModeButton current={mode} id="dig" label="⛏️ 파내기" onClick={() => setMode('dig')} />
          <ModeButton current={mode} id="flatten" label="🚜 평지 만들기" onClick={() => setMode('flatten')} />
          <ModeButton current={mode} id="paint" label="🖌️ 색칠하기" onClick={() => setMode('paint')} />
          <ModeButton current={mode} id="water" label="💧 수원 배치" onClick={() => setMode('water')} />
          <ModeButton current={mode} id="asset" label="🌲 에셋 배치" onClick={() => setMode('asset')} />
          <ModeButton current={mode} id="decal" label="🛣️ 도로/타일" onClick={() => setMode('decal')} />
          <ModeButton current={mode} id="erase" label="🗑️ 지우개" onClick={() => setMode('erase')} />
        </div>
      </div>

      {/* Brush Settings (Sculpt, Dig, Flatten & Paint) */}
      {(mode === 'sculpt' || mode === 'dig' || mode === 'flatten' || mode === 'paint') && (
        <div style={{ background: '#f3f4f6', padding: '1rem', borderRadius: '6px' }}>
          <h4 style={{ margin: '0 0 0.5rem 0', color: '#4b5563' }}>브러시 설정</h4>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '0.2rem' }}>크기: {brushSize}</label>
            <input type="range" min="1" max="10" value={brushSize} onChange={(e) => setBrushSize(parseInt(e.target.value))} style={{ width: '100%' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '0.2rem' }}>강도: {brushIntensity}</label>
            <input type="range" min="0.1" max="5" step="0.1" value={brushIntensity} onChange={(e) => setBrushIntensity(parseFloat(e.target.value))} style={{ width: '100%' }} />
          </div>
        </div>
      )}

      {/* Paint Palette */}
      {mode === 'paint' && (
        <div style={{ background: '#f3f4f6', padding: '1rem', borderRadius: '6px' }}>
          <h4 style={{ margin: '0 0 0.5rem 0', color: '#4b5563' }}>팔레트 (색상 선택)</h4>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
            <input 
              type="color" 
              value={selectedColor} 
              onChange={(e) => setSelectedColor(e.target.value)} 
              style={{ width: '50px', height: '50px', padding: '0', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
              title="원하는 색상을 자유롭게 선택하세요"
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

      {/* Asset Selection */}
      {mode === 'asset' && (
        <div style={{ background: '#f3f4f6', padding: '1rem', borderRadius: '6px' }}>
          <h4 style={{ margin: '0 0 0.5rem 0', color: '#4b5563' }}>에셋 선택</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {ASSETS.map(a => (
              <button
                key={a.id}
                onClick={() => setSelectedAsset(a.id)}
                style={{
                  padding: '0.5rem', textAlign: 'left', borderRadius: '4px', cursor: 'pointer',
                  background: selectedAsset === a.id ? '#3b82f6' : 'white',
                  color: selectedAsset === a.id ? 'white' : 'black',
                  border: '1px solid #d1d5db'
                }}
              >
                {a.name}
              </button>
            ))}
          </div>
          <p style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '0.5rem' }}>
            맵을 클릭하면 선택한 에셋이 배치됩니다.
          </p>
        </div>
      )}

      {/* Decal Selection */}
      {mode === 'decal' && (
        <div style={{ background: '#f3f4f6', padding: '1rem', borderRadius: '6px' }}>
          <h4 style={{ margin: '0 0 0.5rem 0', color: '#4b5563' }}>도로/타일 이미지 업로드</h4>
          
          <input 
            type="file" 
            accept="image/*"
            ref={fileInputRef}
            onChange={handleImageUpload}
            style={{ display: 'none' }}
          />
          <button 
            onClick={() => fileInputRef.current.click()}
            style={{ width: '100%', padding: '0.5rem', background: 'white', border: '1px solid #d1d5db', borderRadius: '4px', cursor: 'pointer', marginBottom: '1rem' }}
          >
            이미지 선택 (500KB 이하)
          </button>

          {selectedDecalImage && (
            <div>
              <p style={{ fontSize: '0.8rem', marginBottom: '0.5rem' }}>현재 선택된 타일:</p>
              <img src={selectedDecalImage} alt="Selected Decal" style={{ width: '100%', maxHeight: '100px', objectFit: 'contain', border: '1px solid #d1d5db', borderRadius: '4px', background: 'white' }} />
              <p style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '0.5rem' }}>
                맵을 클릭하면 타일이 바닥에 입혀집니다.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Erase Info */}
      {mode === 'erase' && (
        <div style={{ background: '#fee2e2', padding: '1rem', borderRadius: '6px' }}>
          <h4 style={{ margin: '0 0 0.5rem 0', color: '#b91c1c' }}>지우개 모드</h4>
          <p style={{ fontSize: '0.8rem', color: '#7f1d1d', margin: 0 }}>
            배치된 에셋(나무, 바위 등)이나 바닥 타일을 클릭하면 삭제됩니다.
          </p>
        </div>
      )}

      {/* Lighting Control */}
      <div style={{ background: '#f3f4f6', padding: '1rem', borderRadius: '6px' }}>
        <h4 style={{ margin: '0 0 0.5rem 0', color: '#4b5563' }}>태양 위치 (시간대)</h4>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '1.2rem' }}>🌅</span>
          <input 
            type="range" min="0" max="24" step="0.5" 
            value={sunTime} 
            onChange={(e) => setSunTime(parseFloat(e.target.value))} 
            style={{ flex: 1 }} 
          />
          <span style={{ fontSize: '1.2rem' }}>🌃</span>
        </div>
        <div style={{ textAlign: 'center', fontSize: '0.8rem', marginTop: '0.2rem', color: '#6b7280' }}>
          {Math.floor(sunTime)}:{sunTime % 1 === 0 ? '00' : '30'}
        </div>
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
