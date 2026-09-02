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
  { id: 'caveman1', name: '원시인 1 (NPC)' },
  { id: 'caveman2', name: '원시인 2 (NPC)' },
  { id: 'caveman3', name: '원시인 3 (NPC)' },
  { id: 'caveman4', name: '원시인 4 (NPC)' },
  { id: 'timemachin', name: '타임머신' },
  { id: 'arch', name: '아치 바위' },
  { id: 'tunnel', name: '터널 (동굴)' },
];

export default function EditorUI({ onSave, isSaving }) {
  const { 
    mode, setMode, 
    brushSize, setBrushSize, 
    brushIntensity, setBrushIntensity,
    selectedColor, setSelectedColor,
    selectedAsset, setSelectedAsset,
    selectedAssetId, setSelectedAssetId,
    selectedDecalImage, setSelectedDecalImage,
    currentMapId, mapName,
    undo, history,
    sunTime, setSunTime,
    isPlaying, setIsPlaying,
    selectedBoundaryId
  } = useMapStore();

  const fileInputRef = useRef(null);
  const [availableModels, setAvailableModels] = useState([]);

  useEffect(() => {
    fetch('/api/models')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setAvailableModels(data);
      })
      .catch(err => console.error('Failed to fetch models:', err));
  }, []);

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
          <ModeButton current={mode} id="dig" label="⛏️ 파내기 (세로)" onClick={() => setMode('dig')} />
          <ModeButton current={mode} id="carve" label="🕳️ 동굴 뚫기 (가로)" onClick={() => setMode('carve')} />
          <ModeButton current={mode} id="flatten" label="🚜 평지 만들기" onClick={() => setMode('flatten')} />
          <ModeButton current={mode} id="paint" label="🖌️ 색칠하기" onClick={() => setMode('paint')} />
          <ModeButton current={mode} id="water" label="💧 수원 배치" onClick={() => setMode('water')} />
          <ModeButton current={mode} id="asset" label="🌲 에셋 배치" onClick={() => setMode('asset')} />
          <ModeButton current={mode} id="decal" label="🛣️ 도로/타일" onClick={() => setMode('decal')} />
          <ModeButton current={mode} id="boundary" label="🚧 경계선" onClick={() => setMode('boundary')} />
          <ModeButton current={mode} id="zone" label="🌟 이벤트 구역" onClick={() => setMode('zone')} />
          <ModeButton current={mode} id="spawn" label="🚩 스폰 위치" onClick={() => setMode('spawn')} />
          <ModeButton current={mode} id="erase" label="🗑️ 지우개" onClick={() => setMode('erase')} />
          <ModeButton current={mode === 'selectTarget' || mode === 'drawPath' ? 'select' : mode} id="select" label="🖱️ 선택/편집" onClick={() => setMode('select')} />
          <ModeButton current={mode} id="itemManager" label="🎒 아이템 관리" onClick={() => setMode('itemManager')} />
        </div>
      </div>

      {/* Brush Settings (Sculpt, Dig, Carve, Flatten & Paint) */}
      {(mode === 'sculpt' || mode === 'dig' || mode === 'carve' || mode === 'flatten' || mode === 'paint') && (
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
            배치된 에셋(나무, 바위 등)이나 바닥 타일, 경계선을 클릭하면 삭제됩니다.
          </p>
        </div>
      )}

      {/* Item Manager */}
      {mode === 'itemManager' && (
        <ItemManagerUI availableModels={availableModels} />
      )}

      {/* Select / Edit Mode */}
      {(mode === 'select' || mode === 'selectTarget' || mode === 'drawPath') && (
        <div style={{ background: '#e0e7ff', padding: '1rem', borderRadius: '6px' }}>
          <h4 style={{ margin: '0 0 0.5rem 0', color: '#3730a3' }}>
            {mode === 'selectTarget' ? '🎯 카메라 이동 대상 에셋 선택 중...' : mode === 'drawPath' ? '🖌️ 경로 선 그리는 중...' : '선택/편집 모드'}
          </h4>
          {(!selectedAssetId && !selectedBoundaryId) ? (
            <p style={{ fontSize: '0.8rem', color: '#4338ca', margin: 0 }}>
              맵에 배치된 에셋, NPC, 또는 경계선을 클릭하여 속성을 편집하세요.
            </p>
          ) : (
            <PropertyEditor />
          )}
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

function PropertyEditor() {
  const { selectedAssetId, assets, updateAsset, setSelectedAssetId, selectedBoundaryId, boundaries, updateBoundary, removeBoundary, setSelectedBoundaryId, mode, setMode, transformMode, setTransformMode } = useMapStore();
  
  if (selectedBoundaryId) {
    const boundary = boundaries.find(b => b.id === selectedBoundaryId);
    if (!boundary) return <div style={{ fontSize: '0.8rem', color: '#ef4444' }}>찾을 수 없습니다.</div>;
    
    if (boundary.isZone) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', marginTop: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h5 style={{ margin: 0, color: '#047857' }}>🌟 이벤트 구역</h5>
            <button 
              onClick={() => setSelectedBoundaryId(null)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}
            >
              ✖
            </button>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>이벤트 종류</label>
            <select 
              className="glass-input"
              value={boundary.condition?.eventType || 'bubble'}
              onChange={(e) => updateBoundary(boundary.id, { condition: { ...boundary.condition, eventType: e.target.value } })}
              style={{ padding: '0.4rem' }}
            >
              <option value="bubble">말풍선 (캐릭터 위)</option>
              <option value="message">안내 문구 (화면 중앙)</option>
              <option value="dialogue">대화창 (하단 UI)</option>
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>표시할 내용</label>
            <textarea 
              className="glass-input" 
              placeholder="표시할 문구를 입력하세요"
              value={boundary.condition?.message || ''} 
              onChange={(e) => updateBoundary(boundary.id, { condition: { ...boundary.condition, message: e.target.value } })}
              rows={3}
              style={{ padding: '0.4rem', resize: 'vertical' }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input 
              type="checkbox" 
              id="triggerOnce"
              checked={boundary.condition?.triggerOnce !== false} 
              onChange={(e) => updateBoundary(boundary.id, { condition: { ...boundary.condition, triggerOnce: e.target.checked } })}
            />
            <label htmlFor="triggerOnce" style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>한 번만 실행하기 (재진입 시 무시)</label>
          </div>

          <button 
            onClick={() => removeBoundary(boundary.id)}
            style={{ padding: '0.5rem', background: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', marginTop: '0.5rem' }}
          >
            🗑️ 구역 삭제하기
          </button>
        </div>
      );
    } else {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', marginTop: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h5 style={{ margin: 0, color: '#1e3a8a' }}>🚧 경계선 (조건부 게이트)</h5>
            <button 
              onClick={() => setSelectedBoundaryId(null)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}
            >
              ✖
            </button>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>요구 아이템 (Item Type)</label>
            <select 
              className="glass-input"
              value={boundary.condition?.itemType || 'rock'}
              onChange={(e) => updateBoundary(boundary.id, { condition: { ...boundary.condition, itemType: e.target.value } })}
              style={{ padding: '0.4rem' }}
            >
              <option value="rock">돌멩이 (rock)</option>
              <option value="tree">도토리/나뭇가지류 (tree)</option>
              <option value="caveman1">원시인 관련 (caveman)</option>
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>필요 개수 (Amount)</label>
            <input 
              type="number" 
              className="glass-input" 
              value={boundary.condition?.amount || 1} 
              onChange={(e) => updateBoundary(boundary.id, { condition: { ...boundary.condition, amount: parseInt(e.target.value) || 1 } })}
              min="1"
              style={{ padding: '0.4rem' }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>접근 차단 메시지</label>
            <input 
              type="text" 
              className="glass-input" 
              placeholder="예: 돌멩이를 더 모아오세요!"
              value={boundary.condition?.message || ''} 
              onChange={(e) => updateBoundary(boundary.id, { condition: { ...boundary.condition, message: e.target.value } })}
              style={{ padding: '0.4rem' }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>카메라 이동 대상 에셋 (선택)</label>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <button
                onClick={() => setMode(mode === 'selectTarget' ? 'select' : 'selectTarget')}
                style={{ padding: '0.4rem', flex: 1, background: mode === 'selectTarget' ? '#ef4444' : '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
              >
                {mode === 'selectTarget' ? '취소하기' : '🎯 맵에서 클릭하여 지정'}
              </button>
              {boundary.condition?.targetAssetId && (
                <button
                  onClick={() => updateBoundary(boundary.id, { condition: { ...boundary.condition, targetAssetId: null } })}
                  style={{ padding: '0.4rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '4px', cursor: 'pointer' }}
                  title="대상 지우기"
                >
                  ❌
                </button>
              )}
            </div>
            {boundary.condition?.targetAssetId && (
              <div style={{ fontSize: '0.85rem', color: '#059669', marginTop: '0.2rem', fontWeight: 'bold' }}>
                 ✓ 선택됨: {assets.find(a => a.id === boundary.condition.targetAssetId)?.npcName || '에셋'}
              </div>
            )}
          </div>

          {boundary.condition?.targetAssetId && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>추가 안내 문구</label>
              <input 
                type="text" 
                className="glass-input" 
                placeholder="예: 저기 있는 촌장님께 가보세요!"
                value={boundary.condition?.additionalMessage || ''} 
                onChange={(e) => updateBoundary(boundary.id, { condition: { ...boundary.condition, additionalMessage: e.target.value } })}
                style={{ padding: '0.4rem' }}
              />
            </div>
          )}
          
          <button 
            onClick={() => removeBoundary(boundary.id)}
            style={{ padding: '0.5rem', background: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', marginTop: '0.5rem' }}
          >
            🗑️ 이 경계선 삭제하기
          </button>
        </div>
      );
    }
  }

  const asset = assets.find(a => a.id === selectedAssetId);
  if (!asset) return <div style={{ fontSize: '0.8rem', color: '#ef4444' }}>에셋을 찾을 수 없습니다.</div>;

  const isNPC = asset.type.startsWith('caveman');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', marginTop: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h5 style={{ margin: 0 }}>타입: {asset.type}</h5>
        <button 
          onClick={() => setSelectedAssetId(null)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}
        >
          ✖
        </button>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
        <button
          onClick={() => setTransformMode('translate')}
          style={{ flex: 1, padding: '0.4rem', background: transformMode === 'translate' ? '#3b82f6' : '#f3f4f6', color: transformMode === 'translate' ? 'white' : 'black', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          이동
        </button>
        <button
          onClick={() => setTransformMode('rotate')}
          style={{ flex: 1, padding: '0.4rem', background: transformMode === 'rotate' ? '#3b82f6' : '#f3f4f6', color: transformMode === 'rotate' ? 'white' : 'black', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          회전
        </button>
        <button
          onClick={() => setTransformMode('scale')}
          style={{ flex: 1, padding: '0.4rem', background: transformMode === 'scale' ? '#3b82f6' : '#f3f4f6', color: transformMode === 'scale' ? 'white' : 'black', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          크기
        </button>
      </div>

      <button
        onClick={() => setMode(mode === 'moveAsset' ? 'select' : 'moveAsset')}
        style={{ padding: '0.5rem', background: mode === 'moveAsset' ? '#ef4444' : '#10b981', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', width: '100%', marginBottom: '0.5rem' }}
      >
        {mode === 'moveAsset' ? '취소하기' : '👇 바닥 클릭해서 멀리 옮기기'}
      </button>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
        <label style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>이름 (NPC/에셋)</label>
        <input 
          type="text" 
          className="glass-input" 
          value={asset.npcName || ''} 
          onChange={(e) => updateAsset(asset.id, { npcName: e.target.value })}
          placeholder="예: 촌장님, 말하는 나무"
          style={{ padding: '0.4rem' }}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
        <label style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>말풍선 대사 (Bubble Dialogue)</label>
        <span style={{ fontSize: '0.7rem', color: '#6b7280' }}>엔터로 구분하면 무작위로 하나씩 뜹니다.</span>
        <textarea 
          className="glass-input" 
          value={asset.bubbleDialogue || ''} 
          onChange={(e) => updateAsset(asset.id, { bubbleDialogue: e.target.value })}
          placeholder="머리 위에 무작위로 뜰 대사들"
          rows={2}
          style={{ padding: '0.4rem', resize: 'vertical' }}
        />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem', marginBottom: '0.5rem' }}>
        <input 
          type="checkbox" 
          id="hasDialogue"
          checked={asset.hasDialogue === true || (asset.type.startsWith('caveman') && asset.hasDialogue !== false)} 
          onChange={(e) => updateAsset(asset.id, { hasDialogue: e.target.checked })}
        />
        <label htmlFor="hasDialogue" style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>클릭 상호작용(대화창) 활성화</label>
      </div>
      
      {(asset.hasDialogue === true || (asset.type.startsWith('caveman') && asset.hasDialogue !== false)) && (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>스크립트 대화 (Sequential Dialogue)</label>
            <span style={{ fontSize: '0.7rem', color: '#6b7280' }}>엔터로 구분하면 순서대로 진행됩니다.</span>
            <textarea 
              className="glass-input" 
              value={asset.dialogue || ''} 
              onChange={(e) => updateAsset(asset.id, { dialogue: e.target.value })}
              placeholder="클릭 시 나타날 순차적 대화 스크립트"
              rows={3}
              style={{ padding: '0.4rem', resize: 'vertical' }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', marginTop: '0.5rem', borderTop: '1px solid #d1d5db', paddingTop: '0.5rem' }}>
            <label style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>퀘스트 목록 (순차 진행)</label>
            
            {(() => {
              const quests = asset.quests || (asset.quest ? [{
                title: asset.quest,
                requireItem: asset.questRequireItem,
                requireAmount: asset.questRequireAmount || 1,
                rewardItem: asset.questRewardItem,
                rewardAmount: asset.questRewardAmount || 1,
                consumeItem: asset.questConsumeItem !== false
              }] : []);

              const updateQuests = (newQuests) => {
                updateAsset(asset.id, { 
                  quests: newQuests, 
                  quest: null, questRequireItem: null, questRequireAmount: null, questRewardItem: null, questRewardAmount: null, questConsumeItem: null 
                });
              };

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {quests.map((q, i) => (
                    <div key={i} style={{ background: 'rgba(255,255,255,0.5)', padding: '0.5rem', borderRadius: '4px', border: '1px solid #cbd5e1' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#475569' }}>퀘스트 {i + 1}</span>
                        <button onClick={() => {
                          const newQ = [...quests]; newQ.splice(i, 1); updateQuests(newQ);
                        }} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.8rem' }}>✖ 삭제</button>
                      </div>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                        <select
                          className="glass-input"
                          value={q.type || 'COLLECT'}
                          onChange={(e) => { const newQ = [...quests]; newQ[i].type = e.target.value; updateQuests(newQ); }}
                          style={{ padding: '0.4rem' }}
                        >
                          <option value="COLLECT">수집 퀘스트 (아이템 모으기)</option>
                          <option value="MATH">수학 퀘스트 (어림하기 문제 직접 설정)</option>
                          <option value="RANDOM_MATH">수학 퀘스트 (랜덤 어림하기 문제)</option>
                        </select>

                        {q.type === 'MATH' && (
                          <div style={{ padding: '0.5rem', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '4px', border: '1px solid #93c5fd', marginTop: '0.3rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                              <label style={{ fontSize: '0.75rem', fontWeight: 'bold', width: '60px' }}>문제 상황</label>
                              <select 
                                className="glass-input"
                                value={q.mathContext || 'BUY_BOX'}
                                onChange={(e) => { const newQ = [...quests]; newQ[i].mathContext = e.target.value; updateQuests(newQ); }}
                                style={{ flex: 1, padding: '0.3rem', fontSize: '0.8rem' }}
                              >
                                <option value="BUY_BOX">묶음 포장/구매 (올림)</option>
                                <option value="USE_BUNDLE">묶음 판매/사용 (버림)</option>
                                <option value="RECORD">통계 기록 (반올림)</option>
                                <option value="MEASURE">측정값 (소수점 어림)</option>
                              </select>
                            </div>
                            
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                              <label style={{ fontSize: '0.75rem', fontWeight: 'bold', width: '60px' }}>연산 방식</label>
                              <select 
                                className="glass-input"
                                value={q.mathType || 'CEIL'}
                                onChange={(e) => { const newQ = [...quests]; newQ[i].mathType = e.target.value; updateQuests(newQ); }}
                                style={{ flex: 1, padding: '0.3rem', fontSize: '0.8rem' }}
                              >
                                <option value="CEIL">올림</option>
                                <option value="FLOOR">버림</option>
                                <option value="ROUND">반올림</option>
                              </select>
                            </div>

                            {(q.mathType === 'CEIL' || q.mathType === 'FLOOR' || !q.mathType) && (
                              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                <label style={{ fontSize: '0.75rem', fontWeight: 'bold', width: '60px' }}>정답 기준</label>
                                <select 
                                  className="glass-input"
                                  value={q.mathIsCountQuestion ? 'true' : 'false'}
                                  onChange={(e) => { const newQ = [...quests]; newQ[i].mathIsCountQuestion = e.target.value === 'true'; updateQuests(newQ); }}
                                  style={{ flex: 1, padding: '0.3rem', fontSize: '0.8rem' }}
                                >
                                  <option value="false">어림한 총 개수 묻기 (예: 2400개)</option>
                                  <option value="true">상자/묶음의 수 묻기 (예: 24개)</option>
                                </select>
                              </div>
                            )}

                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                              <label style={{ fontSize: '0.75rem', fontWeight: 'bold', width: '60px' }}>대상 숫자</label>
                              <input 
                                type="number"
                                step="any"
                                className="glass-input"
                                placeholder="예: 345, 12.3"
                                value={q.mathTargetNumber || ''}
                                onChange={(e) => { const newQ = [...quests]; newQ[i].mathTargetNumber = Number(e.target.value); updateQuests(newQ); }}
                                style={{ flex: 1, padding: '0.3rem', fontSize: '0.8rem' }}
                              />
                            </div>

                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                              <label style={{ fontSize: '0.75rem', fontWeight: 'bold', width: '60px' }}>어림 단위</label>
                              <select 
                                className="glass-input"
                                value={q.mathUnit || 10}
                                onChange={(e) => { const newQ = [...quests]; newQ[i].mathUnit = Number(e.target.value); updateQuests(newQ); }}
                                style={{ flex: 1, padding: '0.3rem', fontSize: '0.8rem' }}
                              >
                                <option value="1000">천의 자리까지 (백의 자리에서 어림)</option>
                                <option value="100">백의 자리까지 (십의 자리에서 어림)</option>
                                <option value="10">십의 자리까지 (일의 자리에서 어림)</option>
                                <option value="1">일의 자리까지 (소수 첫째 자리에서 어림)</option>
                                <option value="0.1">소수 첫째 자리까지 (소수 둘째 자리에서 어림)</option>
                                <option value="0.01">소수 둘째 자리까지 (소수 셋째 자리에서 어림)</option>
                              </select>
                            </div>
                            
                            <button
                              onClick={() => {
                                const num = q.mathTargetNumber || 0;
                                const unit = q.mathUnit || 10;
                                const context = q.mathContext || 'BUY_BOX';
                                let text = '';
                                if (context === 'BUY_BOX') text = `제가 물건을 ${num}개 모았어요. 이 물건을 ${unit}개씩 들어가는 상자에 모두 담으려고 합니다. 상자를 낱개로는 안 팔고 ${unit}개 들이 상자로만 파는데, 물건을 전부 담으려면 상자 공간이 총 몇 개 분량이 필요할까요? (올림하여 ${unit}의 자리까지 나타내기)`;
                                else if (context === 'USE_BUNDLE') text = `제가 물건을 ${num}개 모았어요. 이 물건을 ${unit}개씩 묶어서 팔려고 합니다. 묶음에 들어가지 못하는 낱개는 팔 수 없어요. 최대 몇 개까지 묶음으로 묶어서 팔 수 있을까요? (버림하여 ${unit}의 자리까지 나타내기)`;
                                else if (context === 'RECORD') text = `기록장에 수확량을 ${unit}의 자리까지 적어야 해요. 현재 정확한 수확량은 ${num}입니다. 반올림하여 ${unit}의 자리까지 나타낸 수를 알려주세요!`;
                                else if (context === 'MEASURE') text = `이번에 측정한 무게(또는 길이)가 ${num}입니다. 이 값을 ${unit} 단위까지 어림해서 알려주세요! (어떤 어림 방식을 쓸지 문제에 맞게 수정해주세요)`;
                                
                                const newQ = [...quests]; 
                                newQ[i].mathProblemText = text; 
                                updateQuests(newQ);
                              }}
                              style={{ padding: '0.4rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', marginTop: '0.2rem' }}
                            >
                              ✨ 문제 텍스트 자동 생성 (아래 입력창에 채워집니다)
                            </button>
                            <textarea
                              className="glass-input"
                              value={q.mathProblemText || ''}
                              onChange={(e) => { const newQ = [...quests]; newQ[i].mathProblemText = e.target.value; updateQuests(newQ); }}
                              placeholder="수학 미니게임에서 띄울 문제를 입력하세요"
                              rows={2}
                              style={{ flex: 1, padding: '0.4rem', fontSize: '0.8rem', marginTop: '0.3rem', resize: 'vertical' }}
                            />
                          </div>
                        )}

                        {q.type === 'RANDOM_MATH' && (
                          <div style={{ padding: '0.5rem', background: 'rgba(168, 85, 247, 0.1)', borderRadius: '4px', border: '1px solid #d8b4fe', marginTop: '0.3rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                            <div style={{ fontSize: '0.75rem', color: '#6b21a8', marginBottom: '0.2rem' }}>
                              💡 올림/버림/반올림 중 하나가 랜덤하게 출제되며, 숫자와 단위도 무작위로 생성됩니다.
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                              <label style={{ fontSize: '0.75rem', fontWeight: 'bold', width: '60px' }}>구체물</label>
                              <input 
                                type="text"
                                className="glass-input"
                                placeholder="예: 사과, 도토리, 밧줄"
                                value={q.mathObject || ''}
                                onChange={(e) => { const newQ = [...quests]; newQ[i].mathObject = e.target.value; updateQuests(newQ); }}
                                style={{ flex: 1, padding: '0.3rem', fontSize: '0.8rem' }}
                              />
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                              <label style={{ fontSize: '0.75rem', fontWeight: 'bold', width: '60px' }}>출제 문제 수</label>
                              <input 
                                type="number"
                                className="glass-input"
                                value={q.mathProblemCount || 1}
                                onChange={(e) => { const newQ = [...quests]; newQ[i].mathProblemCount = Number(e.target.value); updateQuests(newQ); }}
                                style={{ flex: 1, padding: '0.3rem', fontSize: '0.8rem' }}
                                min="1"
                                max="10"
                              />
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                              <label style={{ fontSize: '0.75rem', fontWeight: 'bold', width: '60px' }}>보상 지급 방식</label>
                              <select 
                                className="glass-input"
                                value={q.mathRewardMode || 'ALL_AT_ONCE'}
                                onChange={(e) => { const newQ = [...quests]; newQ[i].mathRewardMode = e.target.value; updateQuests(newQ); }}
                                style={{ flex: 1, padding: '0.3rem', fontSize: '0.8rem' }}
                              >
                                <option value="ALL_AT_ONCE">모든 문제를 다 풀면 한 번에 보상</option>
                                <option value="PER_PROBLEM">1문제 맞힐 때마다 즉시 보상 (반복 지급)</option>
                              </select>
                            </div>
                          </div>
                        )}

                        <textarea 
                          className="glass-input" 
                          value={q.title || ''} 
                          onChange={(e) => { const newQ = [...quests]; newQ[i].title = e.target.value; updateQuests(newQ); }}
                          placeholder={q.type === 'MATH' ? "문제 지문을 여기에 적어주세요." : q.type === 'RANDOM_MATH' ? "(문제 지문은 구체물을 바탕으로 게임 플레이 중 랜덤 생성됩니다)" : "예: 촌장님을 위해 사과 3개를 가져다주세요!"}
                          rows={2}
                          style={{ padding: '0.4rem', resize: 'vertical' }}
                          disabled={q.type === 'RANDOM_MATH'}
                        />
                        
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                          <select 
                            className="glass-input"
                            value={q.requireItem || ''}
                            onChange={(e) => { const newQ = [...quests]; newQ[i].requireItem = e.target.value; updateQuests(newQ); }}
                            style={{ padding: '0.4rem', flex: 1 }}
                          >
                            <option value="">(요구 아이템 없음)</option>
                            <optgroup label="기본 채집 아이템">
                              <option value="도토리">🌰 도토리</option>
                              <option value="나뭇가지">🌿 나뭇가지</option>
                              <option value="나무껍질">📜 나무껍질</option>
                              <option value="나무뿌리">🌱 나무뿌리</option>
                              <option value="rock">🪨 바위(돌)</option>
                            </optgroup>
                            <optgroup label="생성된 커스텀 아이템">
                              {useMapStore.getState().customItems?.map(item => (
                                <option key={item.id} value={item.id}>{item.icon} {item.name}</option>
                              ))}
                            </optgroup>
                          </select>
                          <input 
                            type="number"
                            className="glass-input"
                            placeholder="수량"
                            value={q.requireAmount || 1}
                            onChange={(e) => { const newQ = [...quests]; newQ[i].requireAmount = Number(e.target.value); updateQuests(newQ); }}
                            style={{ width: '60px', padding: '0.4rem' }}
                            min="1"
                          />
                        </div>

                        {q.requireItem && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <input 
                              type="checkbox" 
                              id={`consumeItem_${asset.id}_${i}`}
                              checked={q.consumeItem !== false} 
                              onChange={(e) => { const newQ = [...quests]; newQ[i].consumeItem = e.target.checked; updateQuests(newQ); }}
                            />
                            <label htmlFor={`consumeItem_${asset.id}_${i}`} style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>완료 시 아이템 가져가기 (소모)</label>
                          </div>
                        )}

                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                          <select 
                            className="glass-input"
                            value={q.rewardItem || ''}
                            onChange={(e) => { const newQ = [...quests]; newQ[i].rewardItem = e.target.value; updateQuests(newQ); }}
                            style={{ padding: '0.4rem', flex: 1 }}
                          >
                            <option value="">(보상 없음)</option>
                            <option value="money">💰 돈 (기본 화폐)</option>
                            <optgroup label="기본 채집 아이템">
                              <option value="도토리">🌰 도토리</option>
                              <option value="나뭇가지">🌿 나뭇가지</option>
                              <option value="나무껍질">📜 나무껍질</option>
                              <option value="나무뿌리">🌱 나무뿌리</option>
                              <option value="rock">🪨 바위(돌)</option>
                            </optgroup>
                            <optgroup label="생성된 커스텀 아이템">
                              {useMapStore.getState().customItems?.map(item => (
                                <option key={item.id} value={item.id}>{item.icon} {item.name}</option>
                              ))}
                            </optgroup>
                          </select>
                          <input 
                            type="number"
                            className="glass-input"
                            placeholder="수량"
                            value={q.rewardAmount || 1}
                            onChange={(e) => { const newQ = [...quests]; newQ[i].rewardAmount = Number(e.target.value); updateQuests(newQ); }}
                            style={{ width: '60px', padding: '0.4rem' }}
                            min="1"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  <button 
                    onClick={() => {
                      updateQuests([...quests, { title: '', requireAmount: 1, rewardAmount: 1, consumeItem: true }]);
                    }}
                    style={{ padding: '0.5rem', background: '#e2e8f0', color: '#334155', border: '1px dashed #94a3b8', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                  >
                    + 퀘스트 추가
                  </button>
                </div>
              );
            })()}
          </div>
        </>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', marginTop: '0.5rem' }}>
        <label style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>배회 구역 반경 (Roam Radius)</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <input 
            type="number" 
            min="0" max="20" step="0.1"
            value={asset.roamRadius || 0} 
            onChange={(e) => updateAsset(asset.id, { roamRadius: Number(e.target.value) })}
            className="glass-input"
            style={{ width: '60px', padding: '0.2rem' }}
          />
          <input 
            type="range" 
            min="0" max="20" step="0.1"
            value={asset.roamRadius || 0} 
            onChange={(e) => updateAsset(asset.id, { roamRadius: Number(e.target.value) })}
            style={{ flex: 1 }}
          />
        </div>
        <span style={{ fontSize: '0.7rem', color: '#6b7280' }}>0이면 제자리에 멈춰 있습니다. (1 이하는 0.1 단위 조절)</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', marginTop: '0.5rem' }}>
        <label style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>이동 경로 (Path)</label>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <select 
            className="glass-input"
            value={asset.pathMode || 'roam'}
            onChange={(e) => updateAsset(asset.id, { pathMode: e.target.value })}
            style={{ padding: '0.4rem', flex: 1 }}
          >
            <option value="roam">배회 (반경 내 무작위)</option>
            <option value="one-way">경로 따라 이동 (편도)</option>
            <option value="round-trip">경로 따라 이동 (왕복)</option>
            <option value="repeat">경로 따라 이동 (반복)</option>
          </select>
        </div>
        
        {(asset.pathMode === 'one-way' || asset.pathMode === 'round-trip' || asset.pathMode === 'repeat') && (
          <div style={{ display: 'flex', gap: '0.5rem', flexDirection: 'column' }}>
            <button
              onClick={() => setMode(mode === 'drawPath' ? 'select' : 'drawPath')}
              style={{ padding: '0.4rem', background: mode === 'drawPath' ? '#ef4444' : '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
            >
              {mode === 'drawPath' ? '그리기 종료' : '🖌️ 맵에 드래그하여 선 그리기'}
            </button>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={() => updateAsset(asset.id, { pathPoints: [] })}
                style={{ padding: '0.4rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '4px', cursor: 'pointer', flex: 1 }}
              >
                경로 초기화
              </button>
            </div>
            <span style={{ fontSize: '0.7rem', color: '#6b7280' }}>
              점이 {asset.pathPoints?.length || 0}개 찍혀있습니다.
            </span>
          </div>
        )}
      </div>
      
      {!isNPC && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', marginTop: '0.5rem' }}>
          <label style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>채집 시 드롭 아이템 (Drop Item)</label>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <select 
              className="glass-input"
              value={asset.dropItemId || ''}
              onChange={(e) => updateAsset(asset.id, { dropItemId: e.target.value })}
              style={{ padding: '0.4rem', flex: 1 }}
            >
              <option value="">(없음)</option>
              <option value="money">돈 (기본 화폐)</option>
              {useMapStore.getState().customItems?.map(item => (
                <option key={item.id} value={item.id}>{item.icon} {item.name}</option>
              ))}
            </select>
            <input 
              type="number"
              className="glass-input"
              placeholder="수량"
              value={asset.dropItemAmount || 1}
              onChange={(e) => updateAsset(asset.id, { dropItemAmount: Number(e.target.value) })}
              style={{ width: '60px', padding: '0.4rem' }}
              min="1"
            />
          </div>
        </div>
      )}
    </div>
  );
}

function ItemManagerUI({ availableModels = [] }) {
  const { customItems, addCustomItem, removeCustomItem, updateCustomItem } = useMapStore();
  const [newItemName, setNewItemName] = useState('');
  const [newItemIcon, setNewItemIcon] = useState('📦');
  const [newLinkedAsset, setNewLinkedAsset] = useState('');

  const handleAdd = () => {
    if (!newItemName.trim()) return;
    addCustomItem({
      id: 'item_' + Date.now(),
      name: newItemName.trim(),
      icon: newItemIcon,
      linkedAsset: newLinkedAsset || null
    });
    setNewItemName('');
    setNewLinkedAsset('');
  };

  return (
    <div style={{ background: '#fdf4ff', padding: '1rem', borderRadius: '6px' }}>
      <h4 style={{ margin: '0 0 0.5rem 0', color: '#86198f' }}>🎒 커스텀 아이템 관리</h4>
      <p style={{ fontSize: '0.8rem', color: '#701a75', marginBottom: '1rem' }}>
        맵에서 사용할 수집 아이템이나 퀘스트 목표 아이템을 만드세요. 3D 에셋을 연동하면 마인크래프트처럼 바닥에 설치할 수 있습니다.
      </p>
      
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        <input 
          type="text" 
          className="glass-input" 
          placeholder="아이콘 (예: 🍎)" 
          value={newItemIcon}
          onChange={(e) => setNewItemIcon(e.target.value)}
          style={{ width: '50px', padding: '0.4rem', textAlign: 'center' }}
        />
        <input 
          type="text" 
          className="glass-input" 
          placeholder="새 아이템 이름" 
          value={newItemName}
          onChange={(e) => setNewItemName(e.target.value)}
          style={{ flex: 1, padding: '0.4rem' }}
        />
        <select
          value={newLinkedAsset}
          onChange={(e) => setNewLinkedAsset(e.target.value)}
          style={{ padding: '0.4rem', borderRadius: '4px', border: '1px solid #d1d5db' }}
        >
          <option value="">(연동 안함)</option>
          {ASSETS.map(a => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
          {availableModels.map(m => (
            <option key={m} value={`models/${m}`}>{m}</option>
          ))}
        </select>
        <button 
          onClick={handleAdd}
          style={{ padding: '0.4rem 1rem', background: '#d946ef', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', flexShrink: 0 }}
        >
          등록
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {customItems?.map(item => (
          <div key={item.id} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', background: 'white', padding: '0.5rem', borderRadius: '4px', border: '1px solid #f0abfc' }}>
            <span style={{ fontSize: '1.2rem' }}>{item.icon}</span>
            <input 
              type="text" 
              className="glass-input"
              value={item.name}
              onChange={(e) => updateCustomItem(item.id, { name: e.target.value })}
              style={{ flex: 1, padding: '0.2rem', border: 'none', borderBottom: '1px solid #e5e7eb', borderRadius: 0, background: 'transparent' }}
            />
            <select
              value={item.linkedAsset || ''}
              onChange={(e) => updateCustomItem(item.id, { linkedAsset: e.target.value || null })}
              style={{ padding: '0.2rem', borderRadius: '4px', border: '1px solid #d1d5db', fontSize: '0.8rem' }}
            >
              <option value="">(연동 안함)</option>
              {ASSETS.map(a => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
            <button 
              onClick={() => removeCustomItem(item.id)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: '1.2rem' }}
            >
              ×
            </button>
          </div>
        ))}
        {(!customItems || customItems.length === 0) && (
          <div style={{ textAlign: 'center', color: '#9ca3af', fontSize: '0.9rem', padding: '1rem 0' }}>
            등록된 커스텀 아이템이 없습니다.
          </div>
        )}
      </div>
    </div>
  );
}
