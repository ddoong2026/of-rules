'use client';

import { useEffect, useState, use } from 'react';
import { supabase } from '@/lib/supabase';
import useMapStore from '@/store/useMapStore';
import dynamic from 'next/dynamic';
const EditorCanvas = dynamic(() => import('@/components/MapEditor/EditorCanvas'), { ssr: false });
import { useRouter } from 'next/navigation';

export default function PlayMapPage({ params }) {
  const [loading, setLoading] = useState(true);
  const { loadMap, setIsPlaying, setCameraMode, setMode } = useMapStore();
  const router = useRouter();
  const unwrappedParams = use(params);

  useEffect(() => {
    const fetchMap = async () => {
      const { data, error } = await supabase
        .from('maps')
        .select('*')
        .eq('id', unwrappedParams.id)
        .single();
      
      if (data) {
        loadMap(data);
        setIsPlaying(true);
        setCameraMode(false);
        setMode('none');
      } else {
        alert('맵을 찾을 수 없습니다.');
        router.push('/fieldtrip');
      }
      setLoading(false);
    };
    
    fetchMap();
    
    return () => {
      setIsPlaying(false);
    };
  }, [unwrappedParams.id, loadMap, setIsPlaying, setCameraMode, setMode, router]);

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>맵 로딩중...</div>;

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'fixed', top: 0, left: 0, zIndex: 9999, backgroundColor: 'black' }}>
      <button 
        onClick={() => router.push('/fieldtrip')}
        style={{ position: 'absolute', top: '20px', left: '20px', zIndex: 10000, padding: '0.6rem 1.2rem', background: 'rgba(0,0,0,0.6)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px', cursor: 'pointer', fontSize: '1rem', backdropFilter: 'blur(4px)' }}
      >
        ← 수학이란 무엇인가로 돌아가기
      </button>
      <div style={{ position: 'absolute', top: '20px', right: '20px', zIndex: 10000, padding: '0.8rem 1.2rem', background: 'rgba(0,0,0,0.6)', color: 'white', borderRadius: '8px', pointerEvents: 'none', fontSize: '0.9rem', border: '1px solid rgba(255,255,255,0.2)', backdropFilter: 'blur(4px)' }}>
        <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1rem', color: '#fbbf24' }}>조작 방법</h3>
        <ul style={{ margin: 0, paddingLeft: '1.2rem', lineHeight: '1.5' }}>
          <li><strong>W, A, S, D</strong> : 이동</li>
          <li><strong>Space</strong> : 점프</li>
          <li><strong>Shift</strong> : 달리기</li>
          <li><strong>마우스 조작</strong> : 시점 회전</li>
        </ul>
      </div>
      <EditorCanvas />
    </div>
  );
}
