'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/AuthProvider';
import styles from './GovernmentTabs.module.css';
import { CheckCircle, XCircle, Trash2 } from 'lucide-react';

export default function DecreesTab() {
  const [decrees, setDecrees] = useState([]);
  const [expandedDecreeId, setExpandedDecreeId] = useState(null);
  const { user, role } = useAuth();

  const fetchDecrees = async () => {
    const { data, error } = await supabase
      .from('decrees')
      .select(`
        id, law_id, department, title, content, status, created_at,
        laws (title),
        users:minister_id (name)
      `)
      .order('created_at', { ascending: false });
    
    if (data) setDecrees(data);
  };

  useEffect(() => {
    fetchDecrees();

    const channel = supabase.channel('public:decrees')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'decrees' }, () => {
        fetchDecrees();
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  const handleApprove = async (decreeId) => {
    if (role?.role !== 'TEACHER') return alert('선생님만 승인할 수 있습니다.');
    
    const { error } = await supabase
      .from('decrees')
      .update({ status: 'PRESIDENT_APPROVED' }) // Teacher acts as President here
      .eq('id', decreeId);
      
    if (error) alert('오류가 발생했습니다: ' + error.message);
  };
  
  const handleDelete = async (decreeId) => {
    if (!confirm('이 명령안을 정말로 삭제/반려하시겠습니까?')) return;
    
    const { error } = await supabase
      .from('decrees')
      .delete()
      .eq('id', decreeId);
      
    if (error) alert('오류가 발생했습니다: ' + error.message);
  };

  const getStatusBadge = (status) => {
    switch(status) {
      case 'DRAFT': return <span className={`${styles.badge} ${styles.badgePrimary}`}>결재 대기중</span>;
      case 'MINISTER_APPROVED': return <span className={`${styles.badge} ${styles.badgePrimary}`}>장관 승인</span>;
      case 'PRESIDENT_APPROVED': return <span className={`${styles.badge} ${styles.badgeSuccess}`}>시행중</span>;
      default: return null;
    }
  };

  return (
    <div>
      <div className={styles.tabHeader}>
        <h2>명령 현황</h2>
      </div>

      <div className={styles.list}>
        {decrees.length === 0 ? (
          <p className={styles.empty}>제정된 명령이 없습니다.</p>
        ) : (
          decrees.map(decree => (
            <div 
              key={decree.id} 
              className={styles.card} 
              style={{ borderLeft: decree.status === 'PRESIDENT_APPROVED' ? '4px solid var(--success)' : '4px solid var(--primary)', cursor: 'pointer' }}
              onClick={() => setExpandedDecreeId(expandedDecreeId === decree.id ? null : decree.id)}
            >
              <div className={styles.cardHeader}>
                <h3 className={styles.cardTitle}>{decree.title}</h3>
                {getStatusBadge(decree.status)}
              </div>
              
              <div 
                className={styles.cardContent} 
                style={{ WebkitLineClamp: expandedDecreeId === decree.id ? 'unset' : 3 }}
              >
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                  근거 법률: {decree.laws?.title}
                </div>
                {decree.content}
              </div>
              
              <div className={styles.cardFooter} onClick={(e) => e.stopPropagation()}>
                <div className={styles.meta}>
                  <span>소관 부처: {decree.department}</span>
                  <span>상신: {decree.users?.name} 장관</span>
                </div>
                
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  {decree.status === 'DRAFT' && role?.role === 'TEACHER' && (
                    <button 
                      className={styles.actionBtn} 
                      onClick={() => handleApprove(decree.id)} 
                      style={{color: '#15803d', border: '1px solid #bbf7d0', background: '#f0fdf4'}}
                    >
                      <CheckCircle size={16} /> 승인(시행)
                    </button>
                  )}
                  
                  {(role?.role === 'TEACHER' || (role?.role === 'MINISTER' && role?.department === decree.department && decree.status === 'DRAFT')) && (
                    <button 
                      className={styles.actionBtn} 
                      onClick={() => handleDelete(decree.id)} 
                      style={{color: '#b91c1c', border: 'none', padding: '0.5rem'}}
                      title="삭제/반려"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
