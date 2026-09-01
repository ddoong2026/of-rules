'use client';

import dynamic from 'next/dynamic';
import { useAuth } from '@/components/AuthProvider';

// Dynamically import the 3D Map component to prevent SSR issues with Three.js
const Map3D = dynamic(() => import('@/components/Map3D'), { 
  ssr: false,
  loading: () => (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 'calc(100vh - 70px)' }}>
      <p style={{ color: 'var(--text-muted)' }}>3D 월드를 불러오는 중...</p>
    </div>
  )
});

export default function Home() {
  const { role, loading } = useAuth();

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <Map3D />
    </div>
  );
}
