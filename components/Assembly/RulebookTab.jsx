'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/AuthProvider';
import LawForm from './LawForm';
import styles from './AssemblyTabs.module.css';
import { BookOpen, Search, Trash2 } from 'lucide-react';

export default function RulebookTab() {
  const [laws, setLaws] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingLaw, setEditingLaw] = useState(null);
  const { user, role } = useAuth();

  useEffect(() => {
  const fetchPromulgatedLaws = async () => {
    const { data } = await supabase
      .from('laws')
      .select('*, users:proposer_id(name)')
      .eq('status', 'PROMULGATED')
      .order('created_at', { ascending: true });
    
    if (data) setLaws(data);
  };

  useEffect(() => {
    fetchPromulgatedLaws();

    const channel = supabase.channel('public:laws_rulebook')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'laws' }, () => {
        fetchPromulgatedLaws();
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  const handleDeleteLaw = async (lawId) => {
    if (!confirm('정말로 이 법률을 삭제하시겠습니까? (법전에서 영구 삭제됩니다)')) return;
    const { error } = await supabase.from('laws').delete().eq('id', lawId);
    if (error) {
      alert('오류가 발생했습니다: ' + error.message);
    } else {
      fetchPromulgatedLaws();
    }
  };

  const filteredLaws = laws.filter(law => 
    law.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
    law.content.toLowerCase().includes(searchTerm.toLowerCase()) || 
    law.reason.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div>
      <div className={styles.tabHeader} style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--primary)', margin: 0 }}>
          <BookOpen /> 규칙의나라 학급 법전
        </h2>
        
        <div style={{ position: 'relative' }}>
          <Search size={18} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            className="glass-input"
            placeholder="키워드 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ paddingLeft: '2.5rem', width: '250px' }}
          />
        </div>
      </div>

      {editingLaw ? (
        <div style={{ marginTop: '2rem' }}>
          <LawForm 
            onSuccess={() => {
              setEditingLaw(null);
              fetchPromulgatedLaws();
            }} 
            onCancel={() => setEditingLaw(null)}
            initialData={editingLaw}
            editLawId={editingLaw.id}
          />
        </div>
      ) : (
        <div className={styles.list}>
        {filteredLaws.length === 0 ? (
          <p className={styles.empty}>
            {searchTerm ? '검색 결과가 없습니다.' : '아직 제정된 법률이 없습니다.'}
          </p>
        ) : (
          filteredLaws.map((law, index) => (
            <div key={law.id} className={styles.card} style={{ borderLeft: '4px solid var(--primary)' }}>
              <div className={styles.cardHeader}>
                <h3 className={styles.cardTitle}>제 {laws.findIndex(l => l.id === law.id) + 1} 호: {law.title}</h3>
              </div>
              
              <div className={styles.cardContent} style={{ WebkitLineClamp: 'unset' }}>
                <p><strong>[제정 취지]</strong><br/>{law.reason}</p>
                <p style={{ marginTop: '1rem' }}><strong>[주요 내용]</strong><br/>{law.content}</p>
              </div>
              
              <div className={styles.cardFooter} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div className={styles.meta}>
                  <span>소관 부처: {law.target_department}</span>
                  <span>공포일: {new Date(law.updated_at).toLocaleDateString()}</span>
                </div>
                
                {(role?.role === 'TEACHER' || law.proposer_id === user?.id) && (
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button 
                      className={styles.actionBtn} 
                      onClick={() => setEditingLaw(law)}
                      style={{ color: 'var(--primary)', padding: '0.2rem 0.5rem', border: '1px solid #93c5fd', borderRadius: '4px', background: '#eff6ff', fontSize: '0.85rem' }}
                    >
                      수정
                    </button>
                    <button 
                      className={styles.actionBtn} 
                      onClick={() => handleDeleteLaw(law.id)}
                      style={{ color: 'var(--danger)', padding: '0.5rem' }}
                      title="법률 완전 삭제"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
      )}
    </div>
  );
}
