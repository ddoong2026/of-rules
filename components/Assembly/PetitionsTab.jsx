'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/AuthProvider';
import PetitionForm from './PetitionForm';
import styles from './AssemblyTabs.module.css';
import { MessageSquare, ThumbsUp } from 'lucide-react';

export default function PetitionsTab() {
  const [petitions, setPetitions] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const { user } = useAuth();

  const fetchPetitions = async () => {
    const { data, error } = await supabase
      .from('petitions')
      .select(`
        id, title, content, status, agree_count, created_at,
        users:author_id (name)
      `)
      .order('created_at', { ascending: false });
    
    if (data) setPetitions(data);
  };

  useEffect(() => {
    fetchPetitions();

    // Subscribe to real-time changes
    const channel = supabase.channel('public:petitions')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'petitions' }, () => {
        fetchPetitions();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleAgree = async (petitionId) => {
    if (!user) return alert('로그인이 필요합니다.');
    
    // Check if already voted (this logic should ideally check DB or be handled by constraint)
    const { error } = await supabase
      .from('petition_agreements')
      .insert([{ petition_id: petitionId, user_id: user.id }]);
      
    if (error) {
      if (error.code === '23505') {
        alert('이미 동의한 청원입니다.');
      } else {
        alert('오류가 발생했습니다: ' + error.message);
      }
    }
  };

  const getStatusBadge = (status) => {
    switch(status) {
      case 'PENDING': return <span className={`${styles.badge} ${styles.badgeGray}`}>동의 진행중</span>;
      case 'IN_ASSEMBLY': return <span className={`${styles.badge} ${styles.badgePrimary}`}>국회 계류</span>;
      case 'RESOLVED': return <span className={`${styles.badge} ${styles.badgeSuccess}`}>처리 완료</span>;
      default: return null;
    }
  };

  return (
    <div>
      <div className={styles.tabHeader}>
        <h2>국민 청원 목록</h2>
        <button className="glass-button" onClick={() => setShowForm(!showForm)}>
          {showForm ? '목록으로' : '청원하기'}
        </button>
      </div>

      {showForm ? (
        <PetitionForm onSuccess={() => setShowForm(false)} />
      ) : (
        <div className={styles.list}>
          {petitions.length === 0 ? (
            <p className={styles.empty}>등록된 청원이 없습니다.</p>
          ) : (
            petitions.map(petition => (
              <div key={petition.id} className={styles.card}>
                <div className={styles.cardHeader}>
                  <h3 className={styles.cardTitle}>{petition.title}</h3>
                  {getStatusBadge(petition.status)}
                </div>
                <p className={styles.cardContent}>{petition.content}</p>
                <div className={styles.cardFooter}>
                  <div className={styles.meta}>
                    <span className={styles.author}><MessageSquare size={16} /> {petition.users?.name || '익명'}</span>
                    <span className={styles.date}>{new Date(petition.created_at).toLocaleDateString()}</span>
                  </div>
                  <button 
                    className={`${styles.actionBtn} ${petition.status !== 'PENDING' ? styles.disabled : ''}`} 
                    onClick={() => handleAgree(petition.id)}
                    disabled={petition.status !== 'PENDING'}
                  >
                    <ThumbsUp size={16} /> 동의 ({petition.agree_count})
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
