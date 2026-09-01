'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/AuthProvider';
import styles from './AssemblyTabs.module.css';

const DEPARTMENTS = [
  '국방부', '교육부', '재정경제부/기획예산처', '국세청/은행', 
  '법무부', '보건복지부', '기후에너지환경부', '칠판용사', '감사원', '국회', '일반 국민'
];

const PENALTY_TYPES = ['봉사', '벌금', '방과후 지도', '상담', '기타 (직접입력)'];

export default function LawForm({ onSuccess, onCancel, initialData }) {
  const [title, setTitle] = useState(initialData?.title || '');
  const [studentDuty, setStudentDuty] = useState('');
  const [reason, setReason] = useState(initialData?.reason || '');
  const [content, setContent] = useState('');
  const [department, setDepartment] = useState(DEPARTMENTS[0]);
  
  // New states for Penalty/Reward
  const [lawType, setLawType] = useState('none'); // 'none', 'penalty', 'reward'
  const [penaltyType, setPenaltyType] = useState(PENALTY_TYPES[0]);
  const [customPenaltyType, setCustomPenaltyType] = useState('');
  const [actionValue, setActionValue] = useState('');
  
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  const generateTemplate = () => {
    let template = '';
    const dutyText = studentDuty ? studentDuty : '[학생들이 해야할 일(예: 학생들은 줄을 서거나 이동할 때 장난을 치면 안된다)]';
    
    if (lawType === 'penalty') {
      const actualPenalty = penaltyType === '기타 (직접입력)' ? customPenaltyType : penaltyType;
      template = `${dutyText}. 이를 어길 시 ${actualPenalty} ${actionValue || '[수치]'}이며, 관련 부처는 ${department}로 한다.`;
    } else if (lawType === 'reward') {
      template = `${dutyText}. 이를 지킬 시 ${actionValue || '[보상]'}을(를) 보상으로 지급하며, 관련 부처는 ${department}로 한다.`;
    } else {
      template = `${dutyText}. 관련 부처는 ${department}로 한다.`;
    }
    
    setContent(template);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const cleanDuty = studentDuty.trim().replace(/\.$/, '');
    if (
      !cleanDuty.endsWith('수 있다') &&
      !cleanDuty.endsWith('야 한다') &&
      !cleanDuty.endsWith('야한다') &&
      !cleanDuty.endsWith('면 안된다') &&
      !cleanDuty.endsWith('면 안 된다')
    ) {
      alert("학생들이 해야 할 일은 '~수 있다.', '~야 한다.', '~면 안된다.' 중 하나로 끝나야 합니다.");
      return;
    }
    
    setLoading(true);
    
    let finalContent = content;
    if (lawType === 'penalty') {
      const actualPenalty = penaltyType === '기타 (직접입력)' ? customPenaltyType : penaltyType;
      finalContent = `[처벌 규정]\n종류: ${actualPenalty}\n수치/횟수: ${actionValue}\n\n${content}`;
    } else if (lawType === 'reward') {
      finalContent = `[보상 규정]\n내용 및 수치: ${actionValue}\n\n${content}`;
    }
    
    const { error } = await supabase
      .from('laws')
      .insert([
        { 
          proposer_id: user.id, 
          title, 
          reason, 
          content: finalContent,
          target_department: department 
        }
      ]);
      
    setLoading(false);
    
    if (error) {
      alert('오류가 발생했습니다: ' + error.message);
    } else {
      // Fetch dynamic reward setting
      const { data: setting } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'reward_law_propose')
        .single();
        
      const rewardAmount = parseInt(setting?.value || '0', 10);
      
      if (rewardAmount > 0) {
        await supabase.rpc('process_transaction', {
          p_user_id: user.id,
          p_amount: rewardAmount,
          p_description: '법률안 발의 보상',
          p_type: 'INCOME'
        });
      }
      
      window.dispatchEvent(new CustomEvent('show-pet'));
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
          <label>학생들이 해야할 일 (규칙 내용)</label>
          <input 
            type="text" 
            className="glass-input" 
            value={studentDuty}
            onChange={(e) => setStudentDuty(e.target.value)}
            placeholder="예: 학생들은 줄을 서거나 이동할 때 장난을 치면 안된다"
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
          <label>규정 유형 (선택)</label>
          <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem', marginBottom: '0.5rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontWeight: 'normal' }}>
              <input type="radio" name="lawType" value="none" checked={lawType === 'none'} onChange={() => setLawType('none')} />
              일반(없음)
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontWeight: 'normal' }}>
              <input type="radio" name="lawType" value="penalty" checked={lawType === 'penalty'} onChange={() => setLawType('penalty')} />
              처벌
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontWeight: 'normal' }}>
              <input type="radio" name="lawType" value="reward" checked={lawType === 'reward'} onChange={() => setLawType('reward')} />
              보상
            </label>
          </div>
        </div>

        {lawType === 'penalty' && (
          <div className={styles.inputGroup} style={{ background: 'rgba(239, 68, 68, 0.05)', padding: '1rem', borderRadius: '8px' }}>
            <label style={{ color: 'var(--danger)' }}>처벌 종류</label>
            <select 
              className="glass-input"
              value={penaltyType}
              onChange={(e) => setPenaltyType(e.target.value)}
              style={{ marginBottom: '1rem' }}
            >
              {PENALTY_TYPES.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
            
            {penaltyType === '기타 (직접입력)' && (
              <input 
                type="text" 
                className="glass-input" 
                value={customPenaltyType}
                onChange={(e) => setCustomPenaltyType(e.target.value)}
                placeholder="처벌 종류를 직접 입력하세요"
                style={{ marginBottom: '1rem' }}
                required
              />
            )}
            
            <label style={{ color: 'var(--danger)' }}>횟수 또는 수치 (예: 1회, 1000돈)</label>
            <input 
              type="text" 
              className="glass-input" 
              value={actionValue}
              onChange={(e) => setActionValue(e.target.value)}
              placeholder="구체적인 수치를 입력하세요"
              required
            />
          </div>
        )}

        {lawType === 'reward' && (
          <div className={styles.inputGroup} style={{ background: 'rgba(34, 197, 94, 0.05)', padding: '1rem', borderRadius: '8px' }}>
            <label style={{ color: 'var(--success)' }}>보상 내용 및 수치 (예: 자유시간 10분, 500돈)</label>
            <input 
              type="text" 
              className="glass-input" 
              value={actionValue}
              onChange={(e) => setActionValue(e.target.value)}
              placeholder="구체적인 보상 내용과 수치를 입력하세요"
              required
            />
          </div>
        )}

        <div className={styles.inputGroup}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <label style={{ marginBottom: 0 }}>주요 내용</label>
            <button 
              type="button" 
              onClick={generateTemplate}
              style={{ fontSize: '0.8rem', padding: '0.2rem 0.5rem', borderRadius: '4px', background: 'var(--primary)', color: 'white', border: 'none', cursor: 'pointer' }}
            >
              내용 자동 완성
            </button>
          </div>
          <textarea 
            className={`glass-input ${styles.textarea}`} 
            value={content}
            onChange={(e) => setContent(e.target.value)}
            required
          />
        </div>
        
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button 
            type="submit" 
            className="glass-button" 
            style={{ background: 'var(--primary)', color: 'white', flex: 1 }}
            disabled={loading}
          >
            {loading ? '발의 중...' : '법률안 발의하기'}
          </button>
          
          <button 
            type="button" 
            className="glass-button" 
            style={{ flex: 1 }}
            onClick={onCancel}
          >
            취소
          </button>
        </div>
      </form>
    </div>
  );
}
