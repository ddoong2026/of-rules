'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import styles from './AssemblyTabs.module.css';
import { BookOpen, Search } from 'lucide-react';

export default function RulebookTab() {
  const [laws, setLaws] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const fetchPromulgatedLaws = async () => {
      const { data } = await supabase
        .from('laws')
        .select('*')
        .eq('status', 'PROMULGATED')
        .order('created_at', { ascending: true });
      
      if (data) setLaws(data);
    };

    fetchPromulgatedLaws();
  }, []);

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
              
              <div className={styles.cardFooter}>
                <div className={styles.meta}>
                  <span>소관 부처: {law.target_department}</span>
                  <span>공포일: {new Date(law.updated_at).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
