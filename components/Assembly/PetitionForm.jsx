'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/AuthProvider';
import styles from './AssemblyTabs.module.css';

export default function PetitionForm({ onSuccess }) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) return alert('로그인이 필요합니다.');
    
    setLoading(true);
    const { error } = await supabase
      .from('petitions')
      .insert([
        { author_id: user.id, title, content }
      ]);
      
    setLoading(false);
    
    if (error) {
      alert('오류가 발생했습니다: ' + error.message);
    } else {
      await supabase.rpc('process_transaction', {
        p_user_id: user.id,
        p_amount: 1000,
        p_description: '청원 작성 보상',
        p_type: 'INCOME'
      });
      window.dispatchEvent(new CustomEvent('show-pet'));
      onSuccess();
    }
  };

  return (
    <div className={styles.formContainer}>
      <h3>새 청원 작성</h3>
      <p className={styles.formDesc}>학급에 필요한 새로운 규칙이나 건의사항을 작성해주세요.</p>
      
      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.inputGroup}>
          <label>청원 제목</label>
          <input 
            type="text" 
            className="glass-input" 
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="청원 제목을 입력하세요"
            required
            maxLength={100}
          />
        </div>
        
        <div className={styles.inputGroup}>
          <label>청원 내용</label>
          <textarea 
            className={`glass-input ${styles.textarea}`} 
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="건의할 내용을 구체적으로 적어주세요..."
            required
            rows={6}
          />
        </div>
        
        <button 
          type="submit" 
          className="glass-button" 
          style={{ background: 'var(--primary)', color: 'white' }}
          disabled={loading}
        >
          {loading ? '등록 중...' : '청원 등록하기'}
        </button>
      </form>
    </div>
  );
}
