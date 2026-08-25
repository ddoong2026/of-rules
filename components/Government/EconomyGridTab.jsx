'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/AuthProvider';

export default function EconomyGridTab() {
  const { user, role, currency } = useAuth();
  const [students, setStudents] = useState([]);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [isDragging, setIsDragging] = useState(false);
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [actionType, setActionType] = useState('RECEIVE'); // 'SEND' or 'RECEIVE'
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [deductFromMe, setDeductFromMe] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Authorizations
  const isTeacherOrPres = role?.role === 'TEACHER' || role?.role === 'PRESIDENT';
  const isFinance = role?.department === '재정경제부/기획예산처';
  const isJustice = role?.department === '법무부';
  const isMinister = role?.role === 'MINISTER' || role?.role === 'ASSEMBLY'; // Assembly might be minister
  
  // Determine if user has any authority to be here
  const hasAuth = isTeacherOrPres || isFinance || isJustice || isMinister;

  useEffect(() => {
    if (hasAuth) fetchStudents();
  }, [hasAuth]);

  const fetchStudents = async () => {
    const { data } = await supabase
      .from('users')
      .select('id, name, student_number, role, department, job, balance')
      .neq('role', 'TEACHER')
      .order('student_number', { ascending: true });
    
    if (data) {
      // Add random color and face for each student based on ID
      const withAvatars = data.map(s => {
        const hash = s.id.split('-')[0];
        const hue = parseInt(hash, 16) % 360;
        const faces = ['(๑•ᴗ•๑)', '(´• ω •`)', '(✧ω✧)', '(T_T)', '(>_<)', '(^_^)', '(-_-)'];
        const faceIndex = parseInt(hash.slice(-2), 16) % faces.length;
        
        return {
          ...s,
          color: `hsl(${hue}, 70%, 60%)`,
          face: faces[faceIndex]
        };
      });
      setStudents(withAvatars);
    }
  };

  const handleMouseDown = (id) => {
    setIsDragging(true);
    toggleSelection(id);
  };

  const handleMouseEnter = (id) => {
    if (isDragging) {
      toggleSelection(id);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const toggleSelection = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const openModal = (type) => {
    if (selectedIds.size === 0) return alert('학생을 먼저 선택해주세요.');
    setActionType(type);
    
    // Set default reasons based on role
    if (type === 'RECEIVE') {
      if (isJustice) setReason('벌금');
      else if (isMinister || isTeacherOrPres) setReason('과태료');
    } else {
      if (isFinance) setReason('월급');
      else setReason('지원금');
    }
    
    setIsModalOpen(true);
  };

  const handleSubmit = async () => {
    if (!amount || isNaN(amount) || amount <= 0) return alert('올바른 금액을 입력하세요.');
    if (!reason) return alert('사유를 입력하세요.');
    
    const parsedAmount = parseInt(amount, 10);
    setIsProcessing(true);

    try {
      // If SEND and deductFromMe is checked
      if (actionType === 'SEND' && deductFromMe) {
        const totalCost = parsedAmount * selectedIds.size;
        if ((role?.balance || 0) < totalCost) {
          setIsProcessing(false);
          return alert(`내 잔액이 부족합니다. (총 필요 금액: ${totalCost.toLocaleString()}${currency})`);
        }
        
        // Deduct from me
        await supabase.rpc('process_transaction', {
          p_user_id: user.id,
          p_amount: -totalCost,
          p_description: `다중 송금: ${reason} (${selectedIds.size}명)`,
          p_type: 'ETC',
          p_actor_id: user.id
        });
      }

      // Process for each selected student
      for (const studentId of Array.from(selectedIds)) {
        const txAmount = actionType === 'SEND' ? parsedAmount : -parsedAmount;
        const txType = actionType === 'RECEIVE' ? 'FINE' : (reason === '월급' ? 'SALARY' : 'ETC');
        
        await supabase.rpc('process_transaction', {
          p_user_id: studentId,
          p_amount: txAmount,
          p_description: reason,
          p_type: txType,
          p_actor_id: user.id // Log the actor
        });
      }

      alert('처리가 완료되었습니다.');
      setIsModalOpen(false);
      setSelectedIds(new Set());
      setAmount('');
      setDeductFromMe(false);
      fetchStudents();
      window.dispatchEvent(new CustomEvent('show-pet'));

    } catch (err) {
      console.error(err);
      alert('처리 중 오류가 발생했습니다.');
    } finally {
      setIsProcessing(false);
    }
  };

  if (!hasAuth) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>권한이 없습니다.</div>;
  }

  return (
    <div style={{ padding: '1rem' }} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h2 style={{ color: 'var(--primary)', marginBottom: '0.5rem' }}>👥 학생 관리 및 징수/송금</h2>
          <p>마우스 드래그로 학생을 다중 선택한 후 버튼을 클릭하세요.</p>
        </div>
        
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button 
            className="glass-button" 
            style={{ background: '#3b82f6', color: 'white', padding: '0.5rem 1.5rem' }}
            onClick={() => openModal('SEND')}
          >
            보내기 (지급)
          </button>
          <button 
            className="glass-button" 
            style={{ background: '#ef4444', color: 'white', padding: '0.5rem 1.5rem' }}
            onClick={() => openModal('RECEIVE')}
          >
            받기 (징수)
          </button>
        </div>
      </div>

      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', 
        gap: '1rem',
        userSelect: 'none'
      }}>
        {students.map(student => {
          const isSelected = selectedIds.has(student.id);
          return (
            <div 
              key={student.id}
              onMouseDown={() => handleMouseDown(student.id)}
              onMouseEnter={() => handleMouseEnter(student.id)}
              style={{
                background: 'white',
                borderRadius: '12px',
                padding: '1rem',
                textAlign: 'center',
                cursor: 'pointer',
                boxShadow: isSelected ? '0 0 0 4px var(--primary)' : '0 2px 4px rgba(0,0,0,0.1)',
                transform: isSelected ? 'scale(0.95)' : 'scale(1)',
                transition: 'all 0.1s'
              }}
            >
              <div style={{
                width: '60px',
                height: '60px',
                borderRadius: '16px',
                background: student.color,
                margin: '0 auto 0.5rem auto',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: '1.2rem',
                fontWeight: 'bold'
              }}>
                {student.face}
              </div>
              <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>{student.name}</div>
              <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '0.2rem' }}>
                {(student.balance || 0).toLocaleString()} {currency}
              </div>
            </div>
          );
        })}
      </div>

      {isModalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', zIndex: 100,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div className="glass-panel" style={{ padding: '2rem', width: '400px', maxWidth: '90%' }}>
            <h3 style={{ marginBottom: '1rem', color: actionType === 'SEND' ? '#3b82f6' : '#ef4444' }}>
              {selectedIds.size}명의 학생에게 {actionType === 'SEND' ? '돈을 보냅니다' : '돈을 받습니다(징수)'}
            </h3>
            
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>사유</label>
              <input 
                type="text" 
                className="glass-input" 
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="예: 지각 벌금, 숙제 미흡, 월급 등"
                style={{ width: '100%' }}
              />
            </div>
            
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>금액 (인당)</label>
              <input 
                type="number" 
                className="glass-input" 
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="금액을 입력하세요"
                style={{ width: '100%' }}
              />
            </div>

            {actionType === 'SEND' && (
              <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input 
                  type="checkbox" 
                  id="deductCheck"
                  checked={deductFromMe}
                  onChange={(e) => setDeductFromMe(e.target.checked)}
                />
                <label htmlFor="deductCheck">내 잔액에서 차감하기 (체크 해제 시 국가 예산으로 발행)</label>
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.5rem' }}>
              <button 
                className="glass-button" 
                style={{ flex: 1, background: '#e5e7eb', color: '#4b5563' }}
                onClick={() => setIsModalOpen(false)}
                disabled={isProcessing}
              >
                취소
              </button>
              <button 
                className="glass-button" 
                style={{ flex: 1, background: actionType === 'SEND' ? '#3b82f6' : '#ef4444', color: 'white' }}
                onClick={handleSubmit}
                disabled={isProcessing}
              >
                {isProcessing ? '처리중...' : '확인'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
