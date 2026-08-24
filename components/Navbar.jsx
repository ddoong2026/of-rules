'use client';

import Link from 'next/link';
import { useAuth } from './AuthProvider';
import { supabase } from '@/lib/supabase';
import { LogOut, User } from 'lucide-react';
import styles from './Navbar.module.css';

export default function Navbar() {
  const { user, role, loading } = useAuth();

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const getRoleLabel = (r) => {
    if (!r) return '';
    switch(r.role) {
      case 'CITIZEN': return '국민';
      case 'ASSEMBLY': return '국회의원';
      case 'PRESIDENT': return '대통령';
      case 'MINISTER': return `${r.department} 장관`;
      case 'TEACHER': return '교사';
      default: return r.role;
    }
  };

  return (
    <nav className={styles.navbar}>
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
        {role?.role === 'TEACHER' && (
          <Link href="/teacher" className={styles.link} style={{color: 'var(--primary)', fontWeight: 'bold'}}>교사 대시보드</Link>
        )}
      </div>
      <div className={styles.auth}>
        {loading ? (
          <div className={styles.loading}>로딩중...</div>
        ) : user ? (
          <div className={styles.userProfile}>
            <div className={styles.userInfo}>
              <span className={styles.userName}>{role?.name || user.email}</span>
              <span className={styles.userRole}>{getRoleLabel(role)}</span>
            </div>
            <button onClick={handleLogout} className={styles.logoutBtn} title="로그아웃">
              <LogOut size={18} />
            </button>
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
