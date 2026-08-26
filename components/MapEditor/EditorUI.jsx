'use client';

import { useState, useRef } from 'react';
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
];

export default function EditorUI({ onSave, isSaving }) {
  const { 
    mode, setMode, 
    brushSize, setBrushSize, 
    brushIntensity, setBrushIntensity,
    selectedColor, setSelectedColor,
    selectedAsset, setSelectedAsset,
    selectedDecalImage, setSelectedDecalImage,
    currentMapId, mapName
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

  return (
    <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Save Area */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#111827' }}>
          {currentMapId ? mapName : '저장되지 않은 맵'}
        </div>
        <button 
          onClick={onSave}
          disabled={isSaving}
          style={{ padding: '0.4rem 1rem', background: '#10b981', color: 'white', borderRadius: '4px', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}
        >
          {isSaving ? '저장 중...' : '저장하기'}
        </button>
      </div>

      {/* Mode Selection */}
      <div>
        <h4 style={{ margin: '0 0 0.5rem 0', color: '#4b5563' }}>도구 선택</h4>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          <ModeButton current={mode} id="sculpt" label="⛰️ 지형 조형" onClick={() => setMode('sculpt')} />
          <ModeButton current={mode} id="paint" label="🖌️ 색칠하기" onClick={() => setMode('paint')} />
          <ModeButton current={mode} id="water" label="💧 수원 배치" onClick={() => setMode('water')} />
          <ModeButton current={mode} id="asset" label="🌲 에셋 배치" onClick={() => setMode('asset')} />
          <ModeButton current={mode} id="decal" label="🛣️ 도로/타일" onClick={() => setMode('decal')} />
        </div>
      </div>

      {/* Brush Settings (Sculpt & Paint) */}
      {(mode === 'sculpt' || mode === 'paint') && (
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
          <h4 style={{ margin: '0 0 0.5rem 0', color: '#4b5563' }}>팔레트</h4>
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
