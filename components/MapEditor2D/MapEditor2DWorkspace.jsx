'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';

const MARKER_ID = '__map2d__';
const newLayer = (name = '바닥') => ({ id: crypto.randomUUID(), name, visible: true, tiles: {} });
const emptyMap = () => {
  const layer = newLayer();
  return { version: 1, width: 24, height: 18, tileSize: 32, sheets: [], layers: [layer], activeLayerId: layer.id, entities: [] };
};
const markerOf = (assets = []) => assets.find((asset) => asset.id === MARKER_ID);

function Sprite({ sheet, frame = 0, size = 32 }) {
  if (!sheet) return null;
  const columns = Math.max(1, sheet.columns || 1);
  const rows = Math.max(1, sheet.rows || 1);
  const column = frame % columns;
  const row = Math.floor(frame / columns);
  return <span aria-hidden="true" style={{ display: 'block', width: size, height: size, backgroundImage: `url(${sheet.dataUrl})`, backgroundRepeat: 'no-repeat', backgroundSize: `${columns * 100}% ${rows * 100}%`, backgroundPosition: `${columns === 1 ? 0 : column / (columns - 1) * 100}% ${rows === 1 ? 0 : row / (rows - 1) * 100}%`, imageRendering: 'pixelated' }} />;
}

function ToolButton({ active, onClick, children }) {
  return <button type="button" onClick={onClick} style={{ border: 0, borderRadius: 6, padding: '0.45rem 0.65rem', cursor: 'pointer', background: active ? '#2563eb' : '#e5e7eb', color: active ? 'white' : '#111827', fontWeight: 700 }}>{children}</button>;
}

function Field({ label, children }) {
  return <label style={{ display: 'grid', gap: 4, fontSize: 12, color: '#374151' }}><b>{label}</b>{children}</label>;
}

function QuestEditor({ entity, onUpdate }) {
  const quests = entity.quests || [];
  const updateQuest = (index, changes) => onUpdate({ quests: quests.map((quest, i) => i === index ? { ...quest, ...changes } : quest) });
  return <div style={{ display: 'grid', gap: 8 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between' }}><b>퀘스트</b><button type="button" onClick={() => onUpdate({ quests: [...quests, { title: '', description: '', requireItem: '', requireAmount: 1, rewardItem: '', rewardAmount: 1, consumeItem: true }] })}>+ 추가</button></div>
    {quests.map((quest, index) => <div key={`${entity.id}-${index}`} style={{ border: '1px solid #d1d5db', borderRadius: 6, padding: 8, display: 'grid', gap: 5 }}>
      <input value={quest.title || ''} placeholder="퀘스트 제목" onChange={(event) => updateQuest(index, { title: event.target.value })} />
      <textarea value={quest.description || ''} placeholder="퀘스트 설명" rows={2} onChange={(event) => updateQuest(index, { description: event.target.value })} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 64px', gap: 4 }}>
        <input value={quest.requireItem || ''} placeholder="필요 아이템 ID" onChange={(event) => updateQuest(index, { requireItem: event.target.value })} />
        <input type="number" min="1" value={quest.requireAmount || 1} onChange={(event) => updateQuest(index, { requireAmount: Number(event.target.value) || 1 })} />
        <input value={quest.rewardItem || ''} placeholder="보상 아이템 ID" onChange={(event) => updateQuest(index, { rewardItem: event.target.value })} />
        <input type="number" min="1" value={quest.rewardAmount || 1} onChange={(event) => updateQuest(index, { rewardAmount: Number(event.target.value) || 1 })} />
      </div>
      <label style={{ fontSize: 12 }}><input type="checkbox" checked={quest.consumeItem !== false} onChange={(event) => updateQuest(index, { consumeItem: event.target.checked })} /> 필요 아이템 소모</label>
      <button type="button" onClick={() => onUpdate({ quests: quests.filter((_, i) => i !== index) })} style={{ color: '#dc2626' }}>삭제</button>
    </div>)}
  </div>;
}

export default function MapEditor2DWorkspace() {
  const [mapList, setMapList] = useState([]);
  const [currentMapId, setCurrentMapId] = useState(null);
  const [mapName, setMapName] = useState('새 2D 맵');
  const [mapData, setMapData] = useState(emptyMap);
  const [boundaries, setBoundaries] = useState([]);
  const [spawnPoint, setSpawnPoint] = useState(null);
  const [mode, setMode] = useState('tile');
  const [selectedSheetId, setSelectedSheetId] = useState(null);
  const [selectedFrame, setSelectedFrame] = useState(0);
  const [selectedEntityId, setSelectedEntityId] = useState(null);
  const [selectedBoundaryId, setSelectedBoundaryId] = useState(null);
  const [boundaryDraft, setBoundaryDraft] = useState(null);
  const [isPainting, setIsPainting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const fileInputRef = useRef(null);

  const fetchMaps = async () => {
    const { data } = await supabase.from('maps').select('id, name, updated_at, assets').order('updated_at', { ascending: false });
    setMapList((data || []).filter((map) => Boolean(markerOf(map.assets))));
  };
  useEffect(() => { const timer = setTimeout(fetchMaps, 0); return () => clearTimeout(timer); }, []);

  const selectedSheet = mapData.sheets.find((sheet) => sheet.id === selectedSheetId) || null;
  const selectedEntity = mapData.entities.find((entity) => entity.id === selectedEntityId) || null;
  const selectedBoundary = boundaries.find((boundary) => boundary.id === selectedBoundaryId) || null;
  const activeLayer = mapData.layers.find((layer) => layer.id === mapData.activeLayerId) || mapData.layers[0];
  const sheetById = useMemo(() => Object.fromEntries(mapData.sheets.map((sheet) => [sheet.id, sheet])), [mapData.sheets]);
  const entityByCell = useMemo(() => Object.fromEntries(mapData.entities.map((entity) => [`${entity.x},${entity.y}`, entity])), [mapData.entities]);
  const updateMap = (changes) => setMapData((current) => ({ ...current, ...changes }));
  const updateEntity = (id, changes) => setMapData((current) => ({ ...current, entities: current.entities.map((entity) => entity.id === id ? { ...entity, ...changes } : entity) }));

  const uploadSheet = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) return alert('이미지 파일을 선택해 주세요.');
    if (file.size > 1024 * 1024) return alert('스프라이트 시트는 1MB 이하여야 합니다.');
    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        const suggested = Math.min(32, image.width, image.height);
        const frameWidth = Number(prompt('한 프레임의 가로 픽셀', String(suggested))) || suggested;
        const frameHeight = Number(prompt('한 프레임의 세로 픽셀', String(suggested))) || suggested;
        const sheet = { id: crypto.randomUUID(), name: file.name, dataUrl: reader.result, imageWidth: image.width, imageHeight: image.height, frameWidth, frameHeight, columns: Math.max(1, Math.floor(image.width / frameWidth)), rows: Math.max(1, Math.floor(image.height / frameHeight)) };
        setMapData((current) => ({ ...current, sheets: [...current.sheets, sheet] }));
        setSelectedSheetId(sheet.id);
        setSelectedFrame(0);
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  };

  const resizeFrames = (field, value) => {
    setMapData((current) => ({ ...current, sheets: current.sheets.map((sheet) => {
      if (sheet.id !== selectedSheetId) return sheet;
      const next = { ...sheet, [field]: Math.max(1, Number(value) || 1) };
      return { ...next, columns: Math.max(1, Math.floor(next.imageWidth / next.frameWidth)), rows: Math.max(1, Math.floor(next.imageHeight / next.frameHeight)) };
    }) }));
    setSelectedFrame(0);
  };

  const interact = (x, y) => {
    if (mode === 'spawn') return setSpawnPoint({ x, z: y });
    if (mode === 'boundary' || mode === 'zone') {
      setBoundaryDraft((draft) => draft ? { ...draft, points: [...draft.points, [x + 0.5, y + 0.5]] } : { id: crypto.randomUUID(), isZone: mode === 'zone', points: [[x + 0.5, y + 0.5]], condition: { eventType: 'bubble', message: '', triggerOnce: true } });
      return;
    }
    if (mode === 'character') {
      if (!selectedSheet) return;
      const entity = { id: crypto.randomUUID(), type: 'sprite2d', x, y, sheetId: selectedSheet.id, frame: selectedFrame, npcName: '새 캐릭터', dialogue: '', quests: [] };
      setMapData((current) => ({ ...current, entities: [...current.entities.filter((item) => item.x !== x || item.y !== y), entity] }));
      setSelectedEntityId(entity.id);
      setMode('select');
      return;
    }
    if (mode === 'select') return setSelectedEntityId(entityByCell[`${x},${y}`]?.id || null);
    if (!activeLayer) return;
    const key = `${x},${y}`;
    setMapData((current) => ({ ...current, layers: current.layers.map((layer) => {
      if (layer.id !== activeLayer.id) return layer;
      const tiles = { ...layer.tiles };
      if (mode === 'erase') delete tiles[key];
      else if (mode === 'tile' && selectedSheet) tiles[key] = { sheetId: selectedSheet.id, frame: selectedFrame };
      return { ...layer, tiles };
    }) }));
  };

  const finishBoundary = () => {
    if (!boundaryDraft || boundaryDraft.points.length < 2) return alert('경계선은 두 점 이상 필요합니다.');
    setBoundaries((current) => [...current, boundaryDraft]);
    setSelectedBoundaryId(boundaryDraft.id);
    setBoundaryDraft(null);
    setMode('select');
  };

  const resetEditor = () => {
    setCurrentMapId(null); setMapName('새 2D 맵'); setMapData(emptyMap()); setBoundaries([]); setSpawnPoint(null);
    setSelectedSheetId(null); setSelectedEntityId(null); setSelectedBoundaryId(null); setBoundaryDraft(null);
  };
  const createNew = () => { if (confirm('새 2D 맵을 만들까요? 저장하지 않은 내용은 사라집니다.')) resetEditor(); };

  const loadMap = async (id) => {
    const { data, error } = await supabase.from('maps').select('*').eq('id', id).single();
    const saved = markerOf(data?.assets)?.data;
    if (error || !saved) return alert('2D 맵을 불러오지 못했습니다.');
    setCurrentMapId(data.id); setMapName(data.name); setMapData({ ...emptyMap(), ...saved });
    setBoundaries(data.boundaries || []); setSpawnPoint(data.spawnPoint || null); setSelectedSheetId(saved.sheets?.[0]?.id || null);
    setSelectedEntityId(null); setSelectedBoundaryId(null); setBoundaryDraft(null);
  };

  const saveMap = async () => {
    setIsSaving(true);
    const assets = [{ id: MARKER_ID, type: 'system', data: mapData }, ...mapData.entities.map((entity) => ({ ...entity, position: [entity.x, 0, entity.y] }))];
    const payload = { name: mapName, heights: [], colors: [], decals: [], assets, boundaries, spawnPoint, updated_at: new Date().toISOString() };
    let result;
    if (currentMapId) result = await supabase.from('maps').update(payload).eq('id', currentMapId).select().single();
    else {
      const name = prompt('저장할 2D 맵 이름', mapName);
      if (!name) { setIsSaving(false); return; }
      result = await supabase.from('maps').insert([{ ...payload, name }]).select().single();
    }
    if (result.error) alert(`저장 오류: ${result.error.message}`);
    else { setCurrentMapId(result.data.id); setMapName(result.data.name); await fetchMaps(); alert('2D 맵이 저장되었습니다.'); }
    setIsSaving(false);
  };

  const deleteMap = async (id, event) => {
    event.stopPropagation();
    if (!confirm('이 2D 맵을 삭제할까요?')) return;
    const { error } = await supabase.from('maps').delete().eq('id', id);
    if (error) return alert(`삭제 오류: ${error.message}`);
    if (currentMapId === id) resetEditor();
    await fetchMaps();
  };

  const addLayer = () => {
    const layer = newLayer(`레이어 ${mapData.layers.length + 1}`);
    updateMap({ layers: [...mapData.layers, layer], activeLayerId: layer.id });
  };
  const setBoundaryCondition = (changes) => setBoundaries((current) => current.map((boundary) => boundary.id === selectedBoundaryId ? { ...boundary, condition: { ...boundary.condition, ...changes } } : boundary));
  const gridWidth = mapData.width * mapData.tileSize;
  const gridHeight = mapData.height * mapData.tileSize;
  const shownBoundaries = boundaryDraft ? [...boundaries, boundaryDraft] : boundaries;
  const containerStyle = isFullscreen ? { position: 'fixed', inset: 0, zIndex: 9999, background: '#111827', display: 'flex' } : { height: '76vh', minHeight: 620, display: 'flex', overflow: 'hidden', border: '1px solid #d1d5db', borderRadius: 8 };

  return <div style={containerStyle} onPointerUp={() => setIsPainting(false)} onPointerLeave={() => setIsPainting(false)}>
    <aside style={{ width: 330, flexShrink: 0, background: '#f9fafb', color: '#111827', borderRight: '1px solid #d1d5db', overflowY: 'auto', padding: 12, display: 'grid', alignContent: 'start', gap: 14 }}>
      <div style={{ display: 'flex', gap: 6 }}><button type="button" onClick={createNew}>+ 새 맵</button><button type="button" onClick={saveMap} disabled={isSaving}>{isSaving ? '저장 중…' : '저장'}</button><button type="button" onClick={() => setIsFullscreen((value) => !value)}>{isFullscreen ? '축소' : '전체 화면'}</button></div>
      <input value={mapName} onChange={(event) => setMapName(event.target.value)} aria-label="맵 이름" />
      <div style={{ maxHeight: 120, overflowY: 'auto', background: 'white', border: '1px solid #d1d5db' }}>{mapList.map((map) => <button type="button" key={map.id} onClick={() => loadMap(map.id)} style={{ width: '100%', display: 'flex', justifyContent: 'space-between', padding: 7, background: currentMapId === map.id ? '#dbeafe' : 'white', border: 0, borderBottom: '1px solid #eee' }}><span>{map.name}</span><span onClick={(event) => deleteMap(map.id, event)} style={{ color: '#dc2626' }}>×</span></button>)}</div>

      <section style={{ display: 'grid', gap: 7 }}><b>도구</b><div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
        <ToolButton active={mode === 'tile'} onClick={() => setMode('tile')}>타일</ToolButton><ToolButton active={mode === 'erase'} onClick={() => setMode('erase')}>지우개</ToolButton><ToolButton active={mode === 'character'} onClick={() => setMode('character')}>캐릭터</ToolButton><ToolButton active={mode === 'select'} onClick={() => setMode('select')}>선택</ToolButton><ToolButton active={mode === 'boundary'} onClick={() => { setMode('boundary'); setBoundaryDraft(null); }}>경계선</ToolButton><ToolButton active={mode === 'zone'} onClick={() => { setMode('zone'); setBoundaryDraft(null); }}>이벤트 구역</ToolButton><ToolButton active={mode === 'spawn'} onClick={() => setMode('spawn')}>스폰</ToolButton>
      </div>{boundaryDraft && <button type="button" onClick={finishBoundary}>경계선 완성</button>}</section>

      <section style={{ display: 'grid', gap: 7 }}><div style={{ display: 'flex', justifyContent: 'space-between' }}><b>스프라이트 시트</b><button type="button" onClick={() => fileInputRef.current?.click()}>이미지 추가</button></div>
        <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={uploadSheet} />
        <select value={selectedSheetId || ''} onChange={(event) => { setSelectedSheetId(event.target.value); setSelectedFrame(0); }}><option value="">시트를 선택하세요</option>{mapData.sheets.map((sheet) => <option key={sheet.id} value={sheet.id}>{sheet.name}</option>)}</select>
        {selectedSheet && <><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5 }}><Field label="프레임 너비"><input type="number" min="1" value={selectedSheet.frameWidth} onChange={(event) => resizeFrames('frameWidth', event.target.value)} /></Field><Field label="프레임 높이"><input type="number" min="1" value={selectedSheet.frameHeight} onChange={(event) => resizeFrames('frameHeight', event.target.value)} /></Field></div>
          <div style={{ maxHeight: 180, overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(7, 36px)', gap: 3, padding: 4, background: '#d1d5db' }}>{Array.from({ length: selectedSheet.columns * selectedSheet.rows }, (_, frame) => <button type="button" key={frame} title={`프레임 ${frame}`} onClick={() => setSelectedFrame(frame)} style={{ width: 36, height: 36, padding: 1, border: frame === selectedFrame ? '2px solid #2563eb' : '1px solid #9ca3af', background: 'white' }}><Sprite sheet={selectedSheet} frame={frame} size={30} /></button>)}</div></>}
      </section>

      <section style={{ display: 'grid', gap: 6 }}><div style={{ display: 'flex', justifyContent: 'space-between' }}><b>타일 레이어</b><button type="button" onClick={addLayer}>+ 추가</button></div>{[...mapData.layers].reverse().map((layer) => <div key={layer.id} style={{ display: 'flex', gap: 4 }}><button type="button" onClick={() => updateMap({ activeLayerId: layer.id })} style={{ flex: 1, background: layer.id === mapData.activeLayerId ? '#dbeafe' : 'white' }}>{layer.name}</button><button type="button" onClick={() => setMapData((current) => ({ ...current, layers: current.layers.map((item) => item.id === layer.id ? { ...item, visible: !item.visible } : item) }))}>{layer.visible ? '👁' : '—'}</button></div>)}</section>

      {selectedEntity && <section style={{ display: 'grid', gap: 7, borderTop: '1px solid #d1d5db', paddingTop: 10 }}><b>캐릭터/NPC 설정</b><Field label="이름"><input value={selectedEntity.npcName || ''} onChange={(event) => updateEntity(selectedEntity.id, { npcName: event.target.value })} /></Field><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5 }}><Field label="X 타일"><input type="number" min="0" max={mapData.width - 1} value={selectedEntity.x} onChange={(event) => updateEntity(selectedEntity.id, { x: Math.max(0, Math.min(mapData.width - 1, Number(event.target.value) || 0)) })} /></Field><Field label="Y 타일"><input type="number" min="0" max={mapData.height - 1} value={selectedEntity.y} onChange={(event) => updateEntity(selectedEntity.id, { y: Math.max(0, Math.min(mapData.height - 1, Number(event.target.value) || 0)) })} /></Field></div><button type="button" disabled={!selectedSheet} onClick={() => updateEntity(selectedEntity.id, { sheetId: selectedSheetId, frame: selectedFrame })}>현재 선택 스프라이트 적용</button><Field label="대화"><textarea rows={3} value={selectedEntity.dialogue || ''} onChange={(event) => updateEntity(selectedEntity.id, { dialogue: event.target.value })} /></Field><QuestEditor entity={selectedEntity} onUpdate={(changes) => updateEntity(selectedEntity.id, changes)} /><button type="button" onClick={() => { updateMap({ entities: mapData.entities.filter((entity) => entity.id !== selectedEntity.id) }); setSelectedEntityId(null); }} style={{ color: '#dc2626' }}>캐릭터 삭제</button></section>}

      {selectedBoundary && <section style={{ display: 'grid', gap: 7, borderTop: '1px solid #d1d5db', paddingTop: 10 }}><b>{selectedBoundary.isZone ? '이벤트 구역' : '경계선'} 설정</b><Field label="이벤트 종류"><select value={selectedBoundary.condition?.eventType || 'bubble'} onChange={(event) => setBoundaryCondition({ eventType: event.target.value })}><option value="bubble">말풍선</option><option value="message">메시지</option><option value="dialogue">대화</option></select></Field><Field label="메시지"><textarea rows={3} value={selectedBoundary.condition?.message || ''} onChange={(event) => setBoundaryCondition({ message: event.target.value })} /></Field><label style={{ fontSize: 12 }}><input type="checkbox" checked={selectedBoundary.condition?.triggerOnce !== false} onChange={(event) => setBoundaryCondition({ triggerOnce: event.target.checked })} /> 한 번만 실행</label><button type="button" onClick={() => { setBoundaries((current) => current.filter((boundary) => boundary.id !== selectedBoundary.id)); setSelectedBoundaryId(null); }} style={{ color: '#dc2626' }}>삭제</button></section>}
    </aside>

    <main style={{ flex: 1, overflow: 'auto', background: '#111827', padding: 24 }}>
      <div style={{ marginBottom: 10, color: 'white', display: 'flex', gap: 12, alignItems: 'center', fontSize: 13 }}><span>{mapData.width} × {mapData.height} 타일</span><label>가로 <input type="number" min="4" max="100" value={mapData.width} onChange={(event) => updateMap({ width: Math.max(4, Math.min(100, Number(event.target.value) || 4)) })} style={{ width: 60 }} /></label><label>세로 <input type="number" min="4" max="100" value={mapData.height} onChange={(event) => updateMap({ height: Math.max(4, Math.min(100, Number(event.target.value) || 4)) })} style={{ width: 60 }} /></label><span>드래그하여 연속으로 칠할 수 있습니다.</span></div>
      <div style={{ position: 'relative', width: gridWidth, height: gridHeight, display: 'grid', gridTemplateColumns: `repeat(${mapData.width}, ${mapData.tileSize}px)`, background: '#374151', userSelect: 'none' }}>
        {Array.from({ length: mapData.width * mapData.height }, (_, index) => { const x = index % mapData.width; const y = Math.floor(index / mapData.width); const key = `${x},${y}`; const entity = entityByCell[key]; return <button type="button" key={key} onPointerDown={(event) => { event.preventDefault(); setIsPainting(true); interact(x, y); }} onPointerEnter={() => { if (isPainting && (mode === 'tile' || mode === 'erase')) interact(x, y); }} style={{ width: mapData.tileSize, height: mapData.tileSize, padding: 0, position: 'relative', border: '1px solid rgba(255,255,255,0.08)', background: 'transparent', overflow: 'hidden' }}>
          {mapData.layers.filter((layer) => layer.visible).map((layer) => { const tile = layer.tiles[key]; return tile ? <span key={layer.id} style={{ position: 'absolute', inset: 0 }}><Sprite sheet={sheetById[tile.sheetId]} frame={tile.frame} size={mapData.tileSize} /></span> : null; })}
          {entity && <span style={{ position: 'absolute', inset: 0, outline: entity.id === selectedEntityId ? '3px solid #facc15' : 'none', zIndex: 3 }}><Sprite sheet={sheetById[entity.sheetId]} frame={entity.frame} size={mapData.tileSize} /></span>}
          {spawnPoint?.x === x && spawnPoint?.z === y && <span title="스폰 위치" style={{ position: 'absolute', inset: 0, zIndex: 5, color: '#22c55e', fontSize: 24, textShadow: '0 1px 2px black' }}>⚑</span>}
        </button>; })}
        <svg width={gridWidth} height={gridHeight} viewBox={`0 0 ${mapData.width} ${mapData.height}`} preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 6 }}>{shownBoundaries.map((boundary) => { const points = boundary.points.map((point) => point.join(',')).join(' '); const line = { stroke: boundary.id === selectedBoundaryId ? '#facc15' : boundary.isZone ? '#3b82f6' : '#ef4444', strokeWidth: 0.12, vectorEffect: 'non-scaling-stroke', pointerEvents: mode === 'select' ? 'visiblePainted' : 'none' }; return boundary.isZone ? <polygon key={boundary.id} points={points} fill="rgba(59,130,246,0.18)" {...line} onClick={() => setSelectedBoundaryId(boundary.id)} /> : <polyline key={boundary.id} points={points} fill="none" {...line} onClick={() => setSelectedBoundaryId(boundary.id)} />; })}</svg>
      </div>
    </main>
  </div>;
}
