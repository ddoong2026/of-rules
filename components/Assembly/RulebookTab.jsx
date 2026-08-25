'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import styles from './AssemblyTabs.module.css';
import { BookOpen } from 'lucide-react';

export default function RulebookTab() {
  const [laws, setLaws] = useState([]);

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

  return (
    <div>
      <div className={styles.tabHeader} style={{ justifyContent: 'center' }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--primary)' }}>
          <BookOpen /> 규칙의나라 학급 법전
        </h2>
      </div>

      <div className={styles.list}>
        {laws.length === 0 ? (
          <p className={styles.empty}>아직 제정된 법률이 없습니다.</p>
        ) : (
          laws.map((law, index) => (
            <div key={law.id} className={styles.card} style={{ borderLeft: '4px solid var(--primary)' }}>
              <div className={styles.cardHeader}>
                <h3 className={styles.cardTitle}>제 {index + 1} 호: {law.title}</h3>
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
