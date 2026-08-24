'use client';

import { useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import ReceivedLawsTab from '@/components/Government/ReceivedLawsTab';
import DecreesTab from '@/components/Government/DecreesTab';
import styles from './government.module.css';

export default function GovernmentPage() {
  const { user, role, loading } = useAuth();
  const [activeTab, setActiveTab] = useState('laws');

  if (loading) {
    return <div className={styles.loading}>로딩중...</div>;
  }

  if (!user) {
    return (
      <div className={styles.unauthorized}>
        <h2>로그인이 필요합니다.</h2>
        <p>정부 기능에 접근하려면 로그인이 필요합니다.</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>정부 종합 청사</h1>
        <p className={styles.subtitle}>
          국회에서 공포된 법률을 확인하고, 세부 명령을 제정하는 곳입니다.
        </p>
      </header>

      <div className={styles.tabs}>
        <button 
          className={`${styles.tabBtn} ${activeTab === 'laws' ? styles.active : ''}`}
          onClick={() => setActiveTab('laws')}
        >
          전송받은 법률
        </button>
        <button 
          className={`${styles.tabBtn} ${activeTab === 'decrees' ? styles.active : ''}`}
          onClick={() => setActiveTab('decrees')}
        >
          명령(Decree) 현황
        </button>
      </div>

      <div className={styles.content}>
        {activeTab === 'laws' && <ReceivedLawsTab />}
        {activeTab === 'decrees' && <DecreesTab />}
      </div>
    </div>
  );
}
