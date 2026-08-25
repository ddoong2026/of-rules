'use client';
import { useState, useEffect } from 'react';

import Link from 'next/link';
import { useAuth } from './AuthProvider';
import { supabase } from '@/lib/supabase';
import { LogOut, User, ToggleLeft, ToggleRight } from 'lucide-react';
import Inbox from './Inbox';
import styles from './Navbar.module.css';

export default function Navbar() {
  const { user, role, currency, treasury, loading } = useAuth();
  const [petOn, setPetOn] = useState(false);
  
  // Navbar visibility state
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    let lastScrollY = window.scrollY;

    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      if (currentScrollY > 50 && currentScrollY > lastScrollY) {
        // Scrolling down
        setIsVisible(false);
      } else if (currentScrollY === 0) {
        // At top
        setIsVisible(true);
      }
      lastScrollY = currentScrollY;
    };

    const handleMouseMove = (e) => {
      if (e.clientY <= 60) {
        setIsVisible(true);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('mousemove', handleMouseMove);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const togglePet = () => {
    const newState = !petOn;
    setPetOn(newState);
    window.dispatchEvent(new CustomEvent('toggle-pet-override', { detail: newState }));
  };

  const getRoleLabel = (r) => {
    if (!r) return '';
    switch(r.role) {
      case 'CITIZEN': return '일반 국민';
      case 'ASSEMBLY': return r.department ? `국회의원 (${r.department} 장관 겸임)` : '국회의원';
      case 'MINISTER': return r.department ? `${r.department} 장관` : '장관';
      case 'PRESIDENT': return '대통령';
      case 'TEACHER': return '교사';
      default: return r.role;
    }
  };

  return (
    <nav className={`${styles.navbar} ${isVisible ? '' : styles.hidden}`}>
      <div className={styles.logo}>
        <Link href="/">
          <span className={styles.brand}>규칙의나라</span>
        </Link>
      </div>
      <div className={styles.navLinks}>
        <Link href="/" className={styles.link}>3D 지도</Link>
        <Link href="/assembly" className={styles.link}>국회</Link>
        <Link href="/government" className={styles.link}>정부</Link>
        <Link href="/court" className={styles.link}>법원</Link>
        <Link href="/economy" className={styles.link}>은행/상점</Link>
        {role?.role === 'TEACHER' && (
          <Link href="/teacher" className={styles.link} style={{color: 'var(--primary)', fontWeight: 'bold'}}>교사 대시보드</Link>
        )}
      </div>
      <div className={styles.auth}>
        {loading ? (
          <div className={styles.loading}>로딩중...</div>
        ) : user ? (
          <div style={{ display: 'flex', alignItems: 'center' }}>
            {role?.role === 'TEACHER' && (
              <button 
                onClick={togglePet} 
                title="펫 켜기/끄기" 
                style={{ 
                  background: 'none', border: 'none', cursor: 'pointer', 
                  marginRight: '1rem', display: 'flex', alignItems: 'center', gap: '0.2rem',
                  color: petOn ? 'var(--primary)' : '#9ca3af' 
                }}
              >
                {petOn ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
                <span style={{ fontSize: '0.8rem' }}>펫</span>
              </button>
            )}
            <Inbox />
            <div className={styles.userProfile}>
              {(treasury !== undefined && treasury !== null) && (
                <div style={{ marginRight: '1rem', fontWeight: 'bold', color: '#3b82f6', background: '#dbeafe', padding: '0.3rem 0.8rem', borderRadius: '20px', fontSize: '0.8rem' }} title="국고(국세청) 잔액">
                  국고: {treasury.toLocaleString()} {currency}
                </div>
              )}
              {role?.balance !== undefined && (
                <div style={{ marginRight: '1rem', fontWeight: 'bold', color: 'var(--primary)', background: '#f3f4f6', padding: '0.3rem 0.8rem', borderRadius: '20px' }} title="내 잔액">
                  내 잔액: {role.balance.toLocaleString()} {currency}
                </div>
              )}
              <div className={styles.userInfo}>
                <span className={styles.userName}>{role?.name || user.email}</span>
                <span className={styles.userRole}>{getRoleLabel(role)}</span>
              </div>
            <button onClick={handleLogout} className={styles.logoutBtn} title="로그아웃">
              <LogOut size={18} />
            </button>
          </div>
          </div>
        ) : (
          <Link href="/login" className="glass-button">
            로그인
          </Link>
        )}
      </div>
    </nav>
  );
}
