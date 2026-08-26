'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import useMapStore from '@/store/useMapStore';
import EditorCanvas from './EditorCanvas';
import EditorUI from './EditorUI';

export default function MapEditorWorkspace() {
  const { currentMapId, mapName, heights, colors, assets, decals, loadMap, resetMap } = useMapStore();
  const [mapList, setMapList] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchMaps();
  }, []);

  const fetchMaps = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('maps')
      .select('id, name, created_at, updated_at')
      .order('updated_at', { ascending: false });
    
    if (data) setMapList(data);
    setIsLoading(false);
  };

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
      assets: assets,
      decals: decals,
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

  return (
    <div style={{ display: 'flex', height: '70vh', border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' }}>
      
      {/* Left Sidebar - Map List & Tools */}
      <div style={{ width: '300px', backgroundColor: '#f9fafb', display: 'flex', flexDirection: 'column', borderRight: '1px solid #e5e7eb' }}>
        
        {/* Map List Area */}
        <div style={{ padding: '1rem', borderBottom: '1px solid #e5e7eb', flex: '0 0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#374151' }}>저장된 맵 목록</h3>
            <button 
              onClick={handleCreateNewMap}
              style={{ padding: '0.25rem 0.5rem', background: '#3b82f6', color: 'white', borderRadius: '4px', border: 'none', cursor: 'pointer', fontSize: '0.8rem' }}
            >
              + 새 맵
            </button>
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
          <EditorUI onSave={handleSaveMap} isSaving={isSaving} />
        </div>
      </div>

      {/* Right Canvas Area */}
      <div style={{ flex: 1, position: 'relative' }}>
        <EditorCanvas />
      </div>

    </div>
  );
}
