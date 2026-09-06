'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/AuthProvider';
import styles from './GovernmentTabs.module.css';

export default function DecreeForm({ law, onSuccess, onCancel, initialData, editDecreeId }) {
  const [title, setTitle] = useState(initialData?.title || `${law.title} 시행 명령`);
  const [content, setContent] = useState(initialData?.content || '');
  const [loading, setLoading] = useState(false);
  const { user, role } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    let error = null;

    if (editDecreeId) {
      const updateData = { title, content };
      // If a student (minister) edits, reset status to DRAFT so it needs approval again
      if (role?.role !== 'TEACHER') {
        updateData.status = 'DRAFT';
      }
      
      const { error: updateError } = await supabase
        .from('decrees')
        .update(updateData)
        .eq('id', editDecreeId);
      
      error = updateError;
    } else {
      // Decrees are saved with DRAFT status until approved by Teacher (President)
      const { error: insertError } = await supabase
        .from('decrees')
        .insert([
          { 
            law_id: law.id,
            department: law.target_department,
            minister_id: user.id, 
            title, 
            content,
            status: 'DRAFT'
          }
        ]);
      error = insertError;
    }
      
    setLoading(false);
    
    if (error) {
      alert('오류가 발생했습니다: ' + error.message);
    } else {
      if (!editDecreeId) {
        await supabase.rpc('process_transaction', {
          p_user_id: user.id,
          p_amount: 1000,
          p_description: '명령 제정 보상',
          p_type: 'ETC'
        });
        alert('명령 제정안이 상신되었습니다. 교사의 승인 후 시행되며 보상 1,000돈이 지급되었습니다.');
      } else {
        alert('명령이 성공적으로 수정되었습니다.');
      }
      window.dispatchEvent(new CustomEvent('show-pet'));
      onSuccess();
    }
  };

  return (
    <div className={styles.formContainer}>
      <h3>{editDecreeId ? '세부 명령 수정' : '세부 명령 제정'}</h3>
      <p className={styles.formDesc}>
        [ <strong>{law.title}</strong> ] 법률을 시행하기 위한 세부 명령을 제정합니다.
      </p>
      
      <div style={{ background: '#f3f4f6', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
        <strong>법률 원문:</strong><br/>
        {law.content}
      </div>

      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.inputGroup}>
          <label>명령명</label>
          <input 
            type="text" 
            className="glass-input" 
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </div>

        <div className={styles.inputGroup}>
          <label>세부 명령 내용</label>
          <textarea 
            className={`glass-input ${styles.textarea}`} 
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="법률의 범위 내에서 세부 규칙이나 처벌/보상 집행 기준을 명시하세요."
            required
          />
        </div>
        
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button 
            type="button" 
            className="glass-button" 
            onClick={onCancel}
            style={{ flex: 1, background: '#e5e7eb', color: '#4b5563' }}
            disabled={loading}
          >
            취소
          </button>
          <button 
            type="submit" 
            className="glass-button" 
            style={{ flex: 2, background: 'var(--primary)', color: 'white' }}
            disabled={loading}
          >
            {loading ? '처리 중...' : (editDecreeId ? '명령 수정 (저장)' : '명령 제정 (결재 올리기)')}
          </button>
        </div>
      </form>
    </div>
  );
}
