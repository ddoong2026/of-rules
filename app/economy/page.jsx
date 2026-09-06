'use client';

import { useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import ShopTab from '@/components/Economy/ShopTab';
import BankTab from '@/components/Economy/BankTab';
import StockTab from '@/components/Economy/StockTab';
import styles from './economy.module.css';

export default function EconomyPage() {
  const { user, role, loading } = useAuth();
  const [activeTab, setActiveTab] = useState('shop');

  if (loading) {
    return <div className={styles.loading}>로딩중...</div>;
  }

  if (!user) {
    return (
      <div className={styles.unauthorized}>
        <h2>로그인이 필요합니다.</h2>
        <p>경제활동에 접근하려면 로그인이 필요합니다.</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>🏦 경제 활동</h1>
        <p className={styles.subtitle}>
          상점, 예금, 주식 투자를 통해 자산을 관리하세요.
        </p>
      </header>

      <div className={styles.tabs}>
        <button 
          className={`${styles.tabBtn} ${activeTab === 'shop' ? styles.active : ''}`}
          onClick={() => setActiveTab('shop')}
        >
          🛒 상점
        </button>
        <button 
          className={`${styles.tabBtn} ${activeTab === 'bank' ? styles.active : ''}`}
          onClick={() => setActiveTab('bank')}
        >
          🏦 은행 (예금)
        </button>
        <button 
          className={`${styles.tabBtn} ${activeTab === 'stock' ? styles.active : ''}`}
          onClick={() => setActiveTab('stock')}
        >
          📈 주식 거래소
        </button>
      </div>

      <div className={styles.content}>
        {activeTab === 'shop' && <ShopTab />}
        {activeTab === 'bank' && <BankTab />}
        {activeTab === 'stock' && <StockTab />}
      </div>
    </div>
  );
}
