'use client';

import { useAuth } from '@/components/AuthProvider';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function FieldTripPage() {
  const { user, loading } = useAuth();
  const [maps, setMaps] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const fetchMaps = async () => {
      const { data, error } = await supabase
        .from('maps')
        .select('id, name, created_at, updated_at')
        .order('updated_at', { ascending: false });
      
      if (data) setMaps(data);
      setIsLoading(false);
    };
    
    fetchMaps();
  }, []);

  if (loading || isLoading) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>로딩중...</div>;
  }

  if (!user) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <h2>로그인이 필요합니다.</h2>
        <Link href="/login" className="glass-button" style={{ display: 'inline-block', marginTop: '1rem' }}>로그인</Link>
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <h1 style={{ color: 'var(--primary)', marginBottom: '1rem', fontSize: '2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        🚀 수학이란 무엇인가
      </h1>
      
      <div className="glass-panel" style={{ padding: '2rem', minHeight: '60vh' }}>
        <h2 style={{ fontSize: '1.5rem', color: '#4b5563', marginBottom: '1.5rem' }}>
          친구들이 만든 지형 체험하기
        </h2>
        <p style={{ color: '#6b7280', marginBottom: '2rem' }}>
          아래 목록에서 체험하고 싶은 지형을 선택하세요.
        </p>

        {maps.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af' }}>
            저장된 맵이 없습니다.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '1rem' }}>
            {maps.map(map => (
              <div 
                key={map.id} 
                className="glass-panel" 
                style={{ padding: '1.5rem', cursor: 'pointer', transition: 'transform 0.2s' }}
                onClick={() => router.push(`/fieldtrip/${map.id}`)}
                onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-5px)'}
                onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
              >
                <h3 style={{ fontSize: '1.2rem', color: '#1f2937', marginBottom: '0.5rem' }}>{map.name}</h3>
                <p style={{ fontSize: '0.8rem', color: '#6b7280' }}>
                  마지막 수정: {new Date(map.updated_at).toLocaleDateString()}
                </p>
                <button 
                  className="glass-button" 
                  style={{ width: '100%', marginTop: '1rem', background: 'var(--primary)', color: 'white' }}
                >
                  입장하기
                </button>
              </div>
            ))}
          </div>
        )}
        
        <div style={{ textAlign: 'center', marginTop: '3rem' }}>
          <Link href="/" className="glass-button">
            3D 지도로 돌아가기
          </Link>
        </div>
      </div>
    </div>
  );
}
