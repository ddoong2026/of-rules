'use client';

import { useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import PetitionsTab from '@/components/Assembly/PetitionsTab';
import LawsTab from '@/components/Assembly/LawsTab';
import RulebookTab from '@/components/Assembly/RulebookTab';
import styles from './assembly.module.css';

export default function AssemblyPage() {
  const { user, role, loading } = useAuth();
  const [activeTab, setActiveTab] = useState('petitions');

  if (loading) {
    return <div className={styles.loading}>로딩중...</div>;
  }

  if (!user) {
    return (
      <div className={styles.unauthorized}>
        <h2>로그인이 필요합니다.</h2>
        <p>국회 기능에 접근하려면 로그인이 필요합니다.</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>국회의사당</h1>
        <p className={styles.subtitle}>
          국민의 목소리를 듣고 새로운 규칙을 제정하는 곳입니다.
        </p>
      </header>

      <div className={styles.tabs}>
        <button 
          className={`${styles.tabBtn} ${activeTab === 'petitions' ? styles.active : ''}`}
          onClick={() => setActiveTab('petitions')}
        >
          국민 청원
        </button>
        <button 
          className={`${styles.tabBtn} ${activeTab === 'laws' ? styles.active : ''}`}
          onClick={() => setActiveTab('laws')}
        >
          입법 현황
        </button>
        <button 
          className={`${styles.tabBtn} ${activeTab === 'rulebook' ? styles.active : ''}`}
          onClick={() => setActiveTab('rulebook')}
        >
          학급 법전
        </button>
      </div>

      <div className={styles.content}>
        {activeTab === 'petitions' && <PetitionsTab />}
        {activeTab === 'laws' && <LawsTab />}
        {activeTab === 'rulebook' && <RulebookTab />}
      </div>
    </div>
  );
}
