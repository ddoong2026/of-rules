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
  
  // Reference state
  const [laws, setLaws] = useState([]);
  const [decrees, setDecrees] = useState([]);
  const [selectedReference, setSelectedReference] = useState('');
  
  // Options for Teacher
  const [sourceType, setSourceType] = useState('TREASURY'); // 'PERSONAL', 'TREASURY', 'NONE'
  const [isProcessing, setIsProcessing] = useState(false);

  // Authorizations
  const isTeacherOrPres = role?.role === 'TEACHER' || role?.role === 'PRESIDENT';
  const isEconomyAdmin = role?.economy_admin === true;
  const hasAuth = isTeacherOrPres || isEconomyAdmin;

  useEffect(() => {
    if (hasAuth) {
      fetchStudents();
      fetchReferences();
    }
  }, [hasAuth]);

  const fetchReferences = async () => {
    const { data: lawsData } = await supabase.from('laws').select('id, title').eq('status', 'PASSED');
    if (lawsData) setLaws(lawsData);
    
    const { data: decreesData } = await supabase.from('decrees').select('id, title').neq('status', 'DRAFT');
    if (decreesData) setDecrees(decreesData);
  };

  const fetchStudents = async () => {
    const { data } = await supabase
      .from('users')
      .select('id, name, student_number, role, department, job, balance')
      .neq('role', 'TEACHER')
      .order('student_number', { ascending: true });
    
    if (data) {
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
    
    if (type === 'RECEIVE') setReason('');
    else setReason('');
    
    setSelectedReference('');
    
    setSourceType('TREASURY'); // Default to treasury
    setIsModalOpen(true);
  };

  const handleSubmit = async () => {
    if (!amount || isNaN(amount) || amount <= 0) return alert('올바른 금액을 입력하세요.');
    
    if (role?.role !== 'TEACHER') {
      if (!selectedReference) {
        return alert(actionType === 'SEND' ? '관련 법률 또는 명령을 선택하세요.' : '관련 명령을 선택하세요.');
      }
      if (!reason.trim()) {
        return alert('사유를 입력하세요.');
      }
    }
    
    const parsedAmount = parseInt(amount, 10);
    const finalReason = selectedReference 
      ? `[${selectedReference}] ${reason}`.trim() 
      : (reason || (actionType === 'SEND' ? '지급' : '징수'));
      
    setIsProcessing(true);

    try {
      const totalCost = parsedAmount * selectedIds.size;
      let treasuryChange = 0;

      // 1. Process SEND (지급)
      if (actionType === 'SEND') {
        if (isTeacherOrPres && sourceType === 'PERSONAL') {
          if ((role?.balance || 0) < totalCost) {
            setIsProcessing(false);
            return alert(`내 잔액이 부족합니다. (총 필요 금액: ${totalCost.toLocaleString()}${currency})`);
          }
          // Deduct from teacher's personal balance
          await supabase.rpc('process_transaction', {
            p_user_id: user.id, p_amount: -totalCost, p_description: `다중 송금: ${finalReason} (${selectedIds.size}명)`, p_type: 'ETC', p_actor_id: user.id
          });
        } else if (sourceType === 'TREASURY' || (!isTeacherOrPres && isEconomyAdmin)) {
          // Both admin student and teacher selecting TREASURY will deduct from treasury
          treasuryChange = -totalCost;
        }
        // If NONE (무한발행), treasuryChange remains 0
      } 
      
      // 2. Process RECEIVE (징수)
      else if (actionType === 'RECEIVE') {
        if (isTeacherOrPres && sourceType === 'PERSONAL') {
          // Add to teacher's personal balance
          await supabase.rpc('process_transaction', {
            p_user_id: user.id, p_amount: totalCost, p_description: `다중 징수: ${finalReason} (${selectedIds.size}명)`, p_type: 'ETC', p_actor_id: user.id
          });
        } else if (sourceType === 'TREASURY' || (!isTeacherOrPres && isEconomyAdmin)) {
          // Both admin student and teacher selecting TREASURY will add to treasury
          treasuryChange = totalCost;
        }
        // If NONE (소각), treasuryChange remains 0
      }

      // 3. Process each student via process_treasury_transaction
      for (const studentId of Array.from(selectedIds)) {
        const txAmount = actionType === 'SEND' ? parsedAmount : -parsedAmount;
        const txType = actionType === 'RECEIVE' ? 'FINE' : (finalReason.includes('월급') ? 'SALARY' : 'ETC');
        
        // We only change treasury once per batch, or divide it per student.
        // It's safer to pass the treasuryChange / selectedIds.size per student so it adds up correctly
        const perStudentTreasuryChange = actionType === 'SEND' ? 
                                          (treasuryChange < 0 ? -parsedAmount : 0) : 
                                          (treasuryChange > 0 ? parsedAmount : 0);
        
        await supabase.rpc('process_treasury_transaction', {
          p_user_id: studentId,
          p_amount: txAmount,
          p_treasury_change: perStudentTreasuryChange,
          p_description: finalReason,
          p_type: txType,
          p_actor_id: user.id
        });
      }

      alert('처리가 완료되었습니다.');
      setIsModalOpen(false);
      setSelectedIds(new Set());
      setAmount('');
      fetchStudents();
      window.dispatchEvent(new CustomEvent('show-pet'));

    } catch (err) {
      console.error(err);
      alert('처리 중 오류가 발생했습니다. 국고 초기화 SQL을 실행했는지 확인하세요.');
    } finally {
      setIsProcessing(false);
    }
  };

  if (!hasAuth) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>권한이 없습니다. (교사가 경제 관리 권한을 부여해야 합니다)</div>;
  }

  return (
    <div style={{ padding: '1rem' }} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h2 style={{ color: 'var(--primary)', marginBottom: '0.5rem' }}>👥 학생 징수 및 지급 관리</h2>
          <p>마우스 드래그로 다수의 학생을 선택한 후 버튼을 클릭하세요.</p>
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

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '1rem', userSelect: 'none' }}>
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
              <div style={{ width: '60px', height: '60px', borderRadius: '16px', background: student.color, margin: '0 auto 0.5rem auto', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '1.2rem', fontWeight: 'bold' }}>
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
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="glass-panel" style={{ padding: '2rem', width: '400px', maxWidth: '90%' }}>
            <h3 style={{ marginBottom: '1rem', color: actionType === 'SEND' ? '#3b82f6' : '#ef4444' }}>
              {selectedIds.size}명의 학생에게 {actionType === 'SEND' ? '돈을 보냅니다' : '돈을 받습니다(징수)'}
            </h3>
            
            {role?.role !== 'TEACHER' && (
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                  {actionType === 'SEND' ? '관련 법률 또는 명령' : '관련 명령'} <span style={{ color: 'red' }}>*</span>
                </label>
                <select 
                  className="glass-input" 
                  value={selectedReference} 
                  onChange={(e) => setSelectedReference(e.target.value)} 
                  style={{ width: '100%' }}
                >
                  <option value="">선택하세요</option>
                  {actionType === 'SEND' && laws.map(l => <option key={`law-${l.id}`} value={l.title}>[법률] {l.title}</option>)}
                  {decrees.map(d => <option key={`decree-${d.id}`} value={d.title}>[명령] {d.title}</option>)}
                </select>
              </div>
            )}
            
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                사유 {role?.role !== 'TEACHER' && <span style={{ color: 'red' }}>*</span>}
              </label>
              <input type="text" className="glass-input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder={role?.role === 'TEACHER' ? '선택 사항' : '예: 벌금, 월급 등'} style={{ width: '100%' }} />
            </div>
            
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>금액 (인당)</label>
              <input type="number" className="glass-input" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="금액" style={{ width: '100%' }} />
            </div>

            {/* 옵션 선택 (교사/대통령만 보임, 학생은 항상 국세청 고정) */}
            {isTeacherOrPres ? (
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>처리 방식 (교사 전용)</label>
                <select className="glass-input" value={sourceType} onChange={(e) => setSourceType(e.target.value)} style={{ width: '100%' }}>
                  <option value="TREASURY">{actionType === 'SEND' ? '국고(국세청)에서 출금하여 지급' : '국고(국세청)로 징수'}</option>
                  <option value="NONE">{actionType === 'SEND' ? '국가 예산으로 무한 발행 (국고 미차감)' : '허공으로 소각 (없애기)'}</option>
                  <option value="PERSONAL">{actionType === 'SEND' ? '내 개인 잔액에서 지급' : '내 개인 잔액으로 받기'}</option>
                </select>
              </div>
            ) : (
              <div style={{ marginBottom: '1.5rem', padding: '1rem', background: '#f3f4f6', borderRadius: '8px', fontSize: '0.9rem', color: '#4b5563' }}>
                <strong>학생(관리자) 모드: </strong> 
                이 작업은 무조건 <strong>국고(국세청) 계좌</strong>를 통해 이루어집니다.
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.5rem' }}>
              <button className="glass-button" style={{ flex: 1, background: '#e5e7eb', color: '#4b5563' }} onClick={() => setIsModalOpen(false)} disabled={isProcessing}>취소</button>
              <button className="glass-button" style={{ flex: 1, background: actionType === 'SEND' ? '#3b82f6' : '#ef4444', color: 'white' }} onClick={handleSubmit} disabled={isProcessing}>
                {isProcessing ? '처리중...' : '확인'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
