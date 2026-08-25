'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/AuthProvider';
import LawForm from './LawForm';
import styles from './AssemblyTabs.module.css';
import { CheckCircle, XCircle, ScrollText, Trash2 } from 'lucide-react';

export default function LawsTab() {
  const [laws, setLaws] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [expandedLawId, setExpandedLawId] = useState(null);
  const { user, role } = useAuth();

  const fetchLaws = async () => {
    const { data, error } = await supabase
      .from('laws')
      .select(`
        id, title, reason, content, target_department, status, votes_for, votes_against, created_at,
        users:proposer_id (name)
      `)
      .order('created_at', { ascending: false });
    
    if (data) setLaws(data);
  };

  useEffect(() => {
    fetchLaws();

    const channel = supabase.channel('public:laws')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'laws' }, () => {
        fetchLaws();
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  const handleVote = async (lawId, isFor) => {
    if (!user || !['ASSEMBLY', 'TEACHER'].includes(role?.role)) return alert('국회의원과 교사만 투표할 수 있습니다.');
    
    if (role?.role === 'TEACHER') {
      const law = laws.find(l => l.id === lawId);
      const { error } = await supabase
        .from('laws')
        .update({ 
          votes_for: isFor ? law.votes_for + 1 : law.votes_for,
          votes_against: !isFor ? law.votes_against + 1 : law.votes_against
        })
        .eq('id', lawId);
      if (error) alert('오류: ' + error.message);
      else fetchLaws();
      return;
    }

    const { error } = await supabase
      .from('law_votes')
      .insert([{ law_id: lawId, assembly_member_id: user.id, vote: isFor }]);
      
    if (error) {
      if (error.code === '23505') alert('이미 투표하셨습니다.');
      else alert('오류: ' + error.message);
    } else {
      const law = laws.find(l => l.id === lawId);
      const { error: updateError } = await supabase
        .from('laws')
        .update({ 
          votes_for: isFor ? law.votes_for + 1 : law.votes_for,
          votes_against: !isFor ? law.votes_against + 1 : law.votes_against
        })
        .eq('id', lawId);
      if (updateError) alert('오류: ' + updateError.message);
      else fetchLaws();
    }
  };

  const handleDeleteLaw = async (lawId) => {
    if (!confirm('정말로 이 법률안을 삭제하시겠습니까?')) return;
    const { error } = await supabase.from('laws').delete().eq('id', lawId);
    if (error) {
      alert('오류가 발생했습니다: ' + error.message);
    } else {
      fetchLaws();
    }
  };

  const handlePromulgate = async (lawId) => {
    if (role?.role !== 'TEACHER') return alert('선생님만 법률을 공포할 수 있습니다.');
    if (!confirm('이 법률을 공포하여 시행하시겠습니까?')) return;
    
    const { error } = await supabase
      .from('laws')
      .update({ status: 'PROMULGATED' })
      .eq('id', lawId);
      
    if (error) {
      alert('오류가 발생했습니다: ' + error.message);
    } else {
      fetchLaws();
    }
  };

  const getStatusBadge = (status) => {
    switch(status) {
      case 'PROPOSED': return <span className={`${styles.badge} ${styles.badgePrimary}`}>발의됨</span>;
      case 'ASSEMBLY_PASSED': return <span className={`${styles.badge} ${styles.badgeSuccess}`}>국회 통과</span>;
      case 'REJECTED': return <span className={`${styles.badge} ${styles.badgeDanger}`}>부결됨</span>;
      case 'PROMULGATED': return <span className={`${styles.badge} ${styles.badgeSuccess}`} style={{background:'#fef08a', color:'#854d0e'}}>공포됨(법전)</span>;
      default: return null;
    }
  };

  return (
    <div>
      <div className={styles.tabHeader}>
        <h2>입법 현황</h2>
        {['ASSEMBLY', 'TEACHER'].includes(role?.role) && (
          <button className="glass-button" onClick={() => setShowForm(!showForm)}>
            {showForm ? '목록으로' : '법률안 발의'}
          </button>
        )}
      </div>

      {showForm ? (
        <LawForm onSuccess={() => setShowForm(false)} />
      ) : (
        <div className={styles.list}>
          {laws.length === 0 ? (
            <p className={styles.empty}>발의된 법률안이 없습니다.</p>
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
                  {getStatusBadge(law.status)}
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
                    <span className={styles.author}><ScrollText size={16} /> 발의: {law.users?.name}</span>
                    <span>관련부처: {law.target_department}</span>
                  </div>
                  
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    {role?.role === 'TEACHER' && (
                      <button 
                        className={styles.actionBtn} 
                        onClick={() => handleDeleteLaw(law.id)}
                        style={{ color: 'var(--danger)', padding: '0.5rem', marginRight: '0.5rem' }}
                        title="법률안 삭제"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                    
                    {law.status === 'PROPOSED' && ['ASSEMBLY', 'TEACHER'].includes(role?.role) ? (
                      <div style={{display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end'}}>
                        <button className={styles.actionBtn} onClick={() => handleVote(law.id, true)} style={{color: '#15803d', padding: '0.2rem 0.5rem'}}>
                          <CheckCircle size={16} /> 찬성 ({law.votes_for})
                        </button>
                        <button className={styles.actionBtn} onClick={() => handleVote(law.id, false)} style={{color: '#b91c1c', padding: '0.2rem 0.5rem'}}>
                          <XCircle size={16} /> 반대 ({law.votes_against})
                        </button>
                        {role?.role === 'TEACHER' && (
                          <button 
                            className={styles.actionBtn} 
                            onClick={() => handlePromulgate(law.id)} 
                            style={{color: '#854d0e', background: '#fef08a', padding: '0.2rem 0.5rem', borderRadius: '4px', border: '1px solid #eab308'}}
                          >
                            법률 공포
                          </button>
                        )}
                      </div>
                    ) : (
                      <div style={{fontSize: '0.9rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '1rem'}}>
                        <div>
                          <span style={{color: '#15803d', marginRight: '1rem'}}>찬성 {law.votes_for}</span>
                          <span style={{color: '#b91c1c'}}>반대 {law.votes_against}</span>
                        </div>
                        {law.status === 'PROPOSED' && role?.role === 'TEACHER' && (
                          <button 
                            className={styles.actionBtn} 
                            onClick={() => handlePromulgate(law.id)} 
                            style={{color: '#854d0e', background: '#fef08a', padding: '0.2rem 0.5rem', borderRadius: '4px', border: '1px solid #eab308'}}
                          >
                            법률 공포
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
