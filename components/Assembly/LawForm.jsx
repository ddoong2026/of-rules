'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/AuthProvider';
import styles from './AssemblyTabs.module.css';

const DEPARTMENTS = [
  '국방부', '교육부', '재정경제부/기획예산처', '국세청/은행', 
  '법무부', '보건복지부', '기후에너지환경부', '칠판용사', '감사원', '국회', '일반 국민'
];

export default function LawForm({ onSuccess }) {
  const [title, setTitle] = useState('');
  const [reason, setReason] = useState('');
  const [content, setContent] = useState('');
  const [department, setDepartment] = useState(DEPARTMENTS[0]);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    const { error } = await supabase
      .from('laws')
      .insert([
        { 
          proposer_id: user.id, 
          title, 
          reason, 
          content,
          target_department: department 
        }
      ]);
      
    setLoading(false);
    
    if (error) {
      alert('오류가 발생했습니다: ' + error.message);
    } else {
      onSuccess();
    }
  };

  return (
    <div className={styles.formContainer}>
      <h3>법률안 발의</h3>
      
      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.inputGroup}>
          <label>법률명</label>
          <input 
            type="text" 
            className="glass-input" 
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </div>
        
        <div className={styles.inputGroup}>
          <label>관련 부처</label>
          <select 
            className="glass-input"
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
          >
            {DEPARTMENTS.map(dep => (
              <option key={dep} value={dep}>{dep}</option>
            ))}
          </select>
        </div>

        <div className={styles.inputGroup}>
          <label>제안 이유</label>
          <textarea 
            className={`glass-input`} 
            style={{minHeight: '80px'}}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            required
          />
        </div>
        
        <div className={styles.inputGroup}>
          <label>주요 내용</label>
          <textarea 
            className={`glass-input ${styles.textarea}`} 
            value={content}
            onChange={(e) => setContent(e.target.value)}
            required
          />
        </div>
        
        <button 
          type="submit" 
          className="glass-button" 
          style={{ background: 'var(--primary)', color: 'white' }}
          disabled={loading}
        >
          {loading ? '발의 중...' : '법률안 발의하기'}
        </button>
      </form>
    </div>
  );
}
