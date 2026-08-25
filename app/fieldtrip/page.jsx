'use client';

import { useAuth } from '@/components/AuthProvider';
import Link from 'next/link';

export default function FieldTripPage() {
  const { user, role, loading } = useAuth();

  if (loading) {
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
        🚀 수학여행
      </h1>
      
      <div className="glass-panel" style={{ padding: '2rem', minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <h2 style={{ fontSize: '1.5rem', color: '#4b5563', marginBottom: '1rem' }}>수학여행 페이지 준비중입니다!</h2>
        <p style={{ color: '#6b7280', textAlign: 'center' }}>
          이곳에서 특별한 수학여행 콘텐츠를 즐길 수 있도록 업데이트될 예정입니다.
        </p>
        
        <Link href="/" className="glass-button" style={{ marginTop: '2rem' }}>
          3D 지도로 돌아가기
        </Link>
      </div>
    </div>
  );
}
