'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import useMapStore from '@/store/useMapStore';
import EditorCanvas from './EditorCanvas';
import EditorUI from './EditorUI';

export default function MapEditorWorkspace() {
  const { currentMapId, mapName, setMapName, heights, colors, assets, decals, boundaries, spawnPoint, customItems, loadMap, resetMap } = useMapStore();
  const [mapList, setMapList] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const setCameraMode = useMapStore(state => state.setCameraMode);
  const isCameraMode = useMapStore(state => state.isCameraMode);

  const fetchMaps = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('maps')
      .select('id, name, created_at, updated_at')
      .order('updated_at', { ascending: false });

    if (data) setMapList(data);
    setIsLoading(false);
  };

  useEffect(() => {
    const initialFetchTimer = setTimeout(fetchMaps, 0);
    
    // Global keyboard listener for Space bar (Camera Mode)
    const handleKeyDown = (e) => {
      if (e.code === 'Space') {
        const isCurrentlyPlaying = useMapStore.getState().isPlaying;
        if (isCurrentlyPlaying) return; // Space is for jumping in play mode
        
        // Prevent default spacebar scrolling if not in an input
        if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
          e.preventDefault(); 
          setCameraMode(true);
        }
      }
    };
    const handleKeyUp = (e) => {
      if (e.code === 'Space') {
        const isCurrentlyPlaying = useMapStore.getState().isPlaying;
        if (isCurrentlyPlaying) return;
        
        if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
          e.preventDefault();
          setCameraMode(false);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      clearTimeout(initialFetchTimer);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      setCameraMode(false); // Cleanup
    };
  }, [setCameraMode]);

  const handleCreateNewMap = () => {
    if(confirm('새 맵을 만드시겠습니까? 작업 중인 내용은 저장되지 않습니다.')) {
      resetMap();
    }
  };

  const handleLoadMap = async (id) => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('maps')
      .select('*')
      .eq('id', id)
      .single();
    
    if (data) {
      loadMap(data);
    } else {
      alert('맵을 불러오는 중 오류가 발생했습니다.');
    }
    setIsLoading(false);
  };

  const handleSaveMap = async () => {
    setIsSaving(true);
    
    // Convert Float32Array to standard Arrays for JSONB storage
    const heightsArray = Array.from(heights);
    const colorsArray = Array.from(colors);

    const mapData = {
      name: mapName,
      heights: heightsArray,
      colors: colorsArray,
      assets: [
        { id: '__customItems__', type: 'system', data: customItems || [] },
        ...assets
      ],
      decals: decals,
      boundaries: boundaries || [],
      spawnPoint: spawnPoint || null,
      updated_at: new Date().toISOString()
    };

    if (currentMapId) {
      // Update
      const { error } = await supabase
        .from('maps')
        .update(mapData)
        .eq('id', currentMapId);
        
      if (!error) {
        alert('맵이 저장되었습니다.');
        fetchMaps();
      } else {
        alert('저장 중 오류가 발생했습니다.');
      }
    } else {
      // Insert
      let newName = prompt('저장할 맵의 이름을 입력하세요.', '새 맵');
      if (!newName) {
        setIsSaving(false);
        return;
      }
      mapData.name = newName;
      
      const { data, error } = await supabase
        .from('maps')
        .insert([mapData])
        .select()
        .single();
        
      if (data && !error) {
        alert('새 맵이 저장되었습니다.');
        useMapStore.setState({ currentMapId: data.id, mapName: data.name });
        fetchMaps();
      } else {
        alert('저장 중 오류가 발생했습니다.');
      }
    }
    setIsSaving(false);
  };

  const handleDeleteMap = async (id, e) => {
    e.stopPropagation();
    if(confirm('정말로 이 맵을 삭제하시겠습니까?')) {
      const { error } = await supabase.from('maps').delete().eq('id', id);
      if (!error) {
        if(currentMapId === id) resetMap();
        fetchMaps();
      }
    }
  };

  const containerStyle = isFullscreen 
    ? { position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 9999, backgroundColor: 'white', display: 'flex', overflow: 'hidden' }
    : { display: 'flex', height: '70vh', border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' };

  return (
    <div style={containerStyle}>
      
      {/* Left Sidebar - Map List & Tools */}
      <div style={{ width: '300px', backgroundColor: '#f9fafb', display: 'flex', flexDirection: 'column', borderRight: '1px solid #e5e7eb' }}>
        
        {/* Map List Area */}
        <div style={{ padding: '1rem', borderBottom: '1px solid #e5e7eb', flex: '0 0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#374151' }}>저장된 맵 목록</h3>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button 
                onClick={() => setIsFullscreen(!isFullscreen)}
                style={{ padding: '0.25rem 0.5rem', background: '#6b7280', color: 'white', borderRadius: '4px', border: 'none', cursor: 'pointer', fontSize: '0.8rem' }}
                title={isFullscreen ? "원래 크기로" : "전체 화면으로"}
              >
                {isFullscreen ? "↙️ 축소" : "↗️ 전체화면"}
              </button>
              <button 
                onClick={handleCreateNewMap}
                style={{ padding: '0.25rem 0.5rem', background: '#3b82f6', color: 'white', borderRadius: '4px', border: 'none', cursor: 'pointer', fontSize: '0.8rem' }}
              >
                + 새 맵
              </button>
            </div>
          </div>
          
          <div style={{ maxHeight: '150px', overflowY: 'auto', background: 'white', border: '1px solid #e5e7eb', borderRadius: '4px' }}>
            {isLoading && <div style={{ padding: '0.5rem', textAlign: 'center', fontSize: '0.9rem' }}>불러오는 중...</div>}
            {!isLoading && mapList.length === 0 && <div style={{ padding: '0.5rem', textAlign: 'center', fontSize: '0.9rem', color: '#6b7280' }}>저장된 맵이 없습니다.</div>}
            
            {mapList.map(map => (
              <div 
                key={map.id}
                onClick={() => handleLoadMap(map.id)}
                style={{ 
                  padding: '0.5rem', 
                  borderBottom: '1px solid #f3f4f6', 
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  backgroundColor: currentMapId === map.id ? '#eff6ff' : 'transparent',
                  alignItems: 'center'
                }}
              >
                <div style={{ fontSize: '0.9rem', fontWeight: currentMapId === map.id ? 'bold' : 'normal', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {map.name}
                </div>
                <button 
                  onClick={(e) => handleDeleteMap(map.id, e)}
                  style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.8rem' }}
                  title="삭제"
                >
                  X
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Tools UI */}
        <div style={{ flex: '1 1 auto', overflowY: 'auto' }}>
          {currentMapId && (
            <div style={{ padding: '1rem', borderBottom: '1px solid #e5e7eb', backgroundColor: '#eff6ff' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.3rem', color: '#1e3a8a', fontWeight: 'bold' }}>맵 이름 수정 및 덮어쓰기</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input 
                  type="text" 
                  value={mapName}
                  onChange={(e) => setMapName(e.target.value)}
                  style={{ flex: 1, padding: '0.4rem', border: '1px solid #bfdbfe', borderRadius: '4px', fontSize: '0.9rem' }}
                  placeholder="맵 이름"
                />
              </div>
              <p style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.4rem', margin: 0 }}>이름이나 지형을 수정한 뒤 아래 저장 버튼을 누르면 덮어쓰기 됩니다.</p>
            </div>
          )}
          <EditorUI onSave={handleSaveMap} isSaving={isSaving} />
        </div>
      </div>

      {/* Right Canvas Area */}
      <div style={{ flex: 1, position: 'relative' }}>
        <EditorCanvas />
        {isCameraMode && (
          <div style={{ position: 'absolute', top: '10px', left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.7)', color: 'white', padding: '0.5rem 1rem', borderRadius: '20px', zIndex: 10, pointerEvents: 'none', fontWeight: 'bold' }}>
            📸 카메라 이동 모드 (마우스로 시점 조작)
          </div>
        )}
        {!isCameraMode && (
          <div style={{ position: 'absolute', top: '10px', left: '50%', transform: 'translateX(-50%)', background: 'rgba(255,255,255,0.7)', color: '#374151', padding: '0.3rem 0.8rem', borderRadius: '20px', zIndex: 10, pointerEvents: 'none', fontSize: '0.8rem', border: '1px solid #d1d5db' }}>
            Space 키를 누른 채 드래그하면 시점을 이동할 수 있습니다.
          </div>
        )}
      </div>

    </div>
  );
}
