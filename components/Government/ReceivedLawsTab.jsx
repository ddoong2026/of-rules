'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/AuthProvider';
import DecreeForm from './DecreeForm';
import styles from './GovernmentTabs.module.css';
import { ScrollText, FileSignature } from 'lucide-react';

export default function ReceivedLawsTab() {
  const [laws, setLaws] = useState([]);
  const [selectedLaw, setSelectedLaw] = useState(null); // The law selected for creating a decree
  const [expandedLawId, setExpandedLawId] = useState(null);
  const { user, role } = useAuth();

  const fetchLaws = async () => {
    const { data, error } = await supabase
      .from('laws')
      .select('*')
      .eq('status', 'PROMULGATED') // Only show promulgated laws
      .order('updated_at', { ascending: false });
    
    if (data) setLaws(data);
  };

  useEffect(() => {
    fetchLaws();

    const channel = supabase.channel('public:laws_gov')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'laws' }, () => {
        fetchLaws();
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  const handleCreateDecree = (law) => {
    // Only the Minister of the target department or the Teacher can create decrees
    if (role?.role === 'TEACHER' || (['MINISTER', 'ASSEMBLY'].includes(role?.role) && role?.department === law.target_department)) {
      setSelectedLaw(law);
    } else {
      alert(`명령 제정 권한이 없습니다. 해당 법률은 ${law.target_department} 소관입니다.`);
    }
  };

  if (selectedLaw) {
    return (
      <DecreeForm 
        law={selectedLaw} 
        onSuccess={() => setSelectedLaw(null)} 
        onCancel={() => setSelectedLaw(null)} 
      />
    );
  }

  return (
    <div>
      <div className={styles.tabHeader}>
        <h2>전송받은 법률 (공포됨)</h2>
        <p style={{ color: 'var(--text-muted)' }}>국회에서 공포된 법률 목록입니다. 관련 부처 장관은 명령을 제정할 수 있습니다.</p>
      </div>

      <div className={styles.list}>
        {laws.length === 0 ? (
          <p className={styles.empty}>전송받은 법률이 없습니다.</p>
        ) : (
          laws.map(law => (
            <div 
              key={law.id} 
              className={styles.card}
              onClick={() => setExpandedLawId(expandedLawId === law.id ? null : law.id)}
              style={{ cursor: 'pointer' }}
            >
              <div className={styles.cardHeader}>
                <h3 className={styles.cardTitle}>{law.title}</h3>
                <span className={`${styles.badge} ${styles.badgeSuccess}`} style={{background:'#fef08a', color:'#854d0e'}}>공포됨</span>
              </div>
              
              <div 
                className={styles.cardContent}
                style={{ WebkitLineClamp: expandedLawId === law.id ? 'unset' : 3 }}
              >
                <strong>제안 이유:</strong> {law.reason}
                <br /><br />
                <strong>주요 내용:</strong> {law.content}
              </div>
              
              <div className={styles.cardFooter} onClick={(e) => e.stopPropagation()}>
                <div className={styles.meta}>
                  <span>관련부처: <strong style={{ color: law.target_department === role?.department ? 'var(--primary)' : 'inherit' }}>{law.target_department}</strong></span>
                </div>
                
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  {(role?.role === 'TEACHER' || (['MINISTER', 'ASSEMBLY'].includes(role?.role) && role?.department === law.target_department)) ? (
                    <button 
                      className={styles.actionBtn} 
                      onClick={() => handleCreateDecree(law)} 
                      style={{color: '#2563eb', border: '1px solid #bfdbfe', background: '#eff6ff'}}
                    >
                      <FileSignature size={16} /> 명령 제정
                    </button>
                  ) : (
                     <span style={{ fontSize: '0.8rem', color: '#9ca3af' }}>권한 없음</span>
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
