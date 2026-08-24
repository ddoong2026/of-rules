'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import styles from './login.module.css';

export default function Login() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const router = useRouter();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    let finalEmail = identifier.trim();
    // 이메일 형식이 아닌 경우 (학번만 입력한 경우) 자동 변환
    if (!finalEmail.includes('@')) {
      if (/^\d+$/.test(finalEmail)) {
        finalEmail = `s${finalEmail}@class.com`;
      } else {
        finalEmail = `${finalEmail}@class.com`;
      }
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: finalEmail,
      password,
    });

    if (error) {
      setError(error.message);
    } else {
      router.push('/');
      router.refresh(); // Refresh AuthProvider
    }
    setLoading(false);
  };

  return (
    <div className={styles.container}>
      <div className={`glass-panel ${styles.loginCard}`}>
        <h1 className={styles.title}>규칙의나라 로그인</h1>
        <p className={styles.subtitle}>선생님이 발급해주신 계정으로 로그인하세요.</p>
        
        <form onSubmit={handleLogin} className={styles.form}>
          {error && <div className={styles.error}>{error}</div>}
          
          <div className={styles.inputGroup}>
            <label htmlFor="identifier">학번 (또는 이메일)</label>
            <input 
              id="identifier"
              type="text" 
              className="glass-input" 
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="예: 10203"
              required
            />
          </div>
          
          <div className={styles.inputGroup}>
            <label htmlFor="password">비밀번호</label>
            <input 
              id="password"
              type="password" 
              className="glass-input" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>
          
          <button 
            type="submit" 
            className={`glass-button ${styles.submitBtn}`} 
            disabled={loading}
          >
            {loading ? '로그인 중...' : '로그인'}
          </button>
        </form>
      </div>
    </div>
  );
}
