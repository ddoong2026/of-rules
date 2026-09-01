'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function EconomyAdminTab() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [treasury, setTreasury] = useState(0);
  const [currencyName, setCurrencyName] = useState('돈');
  const [isEditingTreasury, setIsEditingTreasury] = useState(false);
  const [treasuryInput, setTreasuryInput] = useState('');

  // Reward Settings
  const [rewardPetitionCreate, setRewardPetitionCreate] = useState(0);
  const [rewardPetitionAgree, setRewardPetitionAgree] = useState(0);
  const [rewardLawPropose, setRewardLawPropose] = useState(0);
  const [isSavingRewards, setIsSavingRewards] = useState(false);

  useEffect(() => {
    fetchData();
    fetchEconomySettings();
  }, []);

  const fetchData = async () => {
    const { data } = await supabase
      .from('users')
      .select('id, name, student_number, role, economy_admin, balance')
      .neq('role', 'TEACHER')
      .order('student_number');
    if (data) setStudents(data);
    setLoading(false);
  };

  const fetchEconomySettings = async () => {
    const { data } = await supabase
      .from('settings')
      .select('key, value')
      .in('key', [
        'treasury_balance', 
        'currency_name',
        'reward_petition_create', 
        'reward_petition_agree', 
        'reward_law_propose'
      ]);
      
    if (data) {
      const settingsMap = data.reduce((acc, curr) => ({ ...acc, [curr.key]: curr.value }), {});
      setTreasury(parseInt(settingsMap.treasury_balance || '0', 10));
      setCurrencyName(settingsMap.currency_name || '돈');
      setRewardPetitionCreate(parseInt(settingsMap.reward_petition_create || '0', 10));
      setRewardPetitionAgree(parseInt(settingsMap.reward_petition_agree || '0', 10));
      setRewardLawPropose(parseInt(settingsMap.reward_law_propose || '0', 10));
    }
  };

  const handleToggleAdmin = async (userId, currentStatus) => {
    const { error } = await supabase
      .from('users')
      .update({ economy_admin: !currentStatus })
      .eq('id', userId);
    
    if (error) {
      alert('상태 변경에 실패했습니다.');
    } else {
      fetchData(); // Refresh list
    }
  };

  const handleUpdateTreasury = async () => {
    const val = parseInt(treasuryInput, 10);
    if (isNaN(val)) return alert('올바른 금액을 입력하세요.');
    const { error } = await supabase.from('settings').upsert({ key: 'treasury_balance', value: val.toString() });
    if (!error) {
      setTreasury(val);
      setIsEditingTreasury(false);
      alert('국고 잔액이 수정되었습니다.');
    } else {
      alert('수정 실패: ' + error.message);
    }
  };

  const handleUpdateStudentBalance = async (userId, currentBalance, name) => {
    const newVal = prompt(`${name} 학생의 새로운 잔액을 입력하세요:`, currentBalance || 0);
    if (newVal === null) return;
    const parsed = parseInt(newVal, 10);
    if (isNaN(parsed)) return alert('올바른 숫자를 입력하세요.');
    
    const diff = parsed - (currentBalance || 0);
    if (diff === 0) return;
    
    const { error } = await supabase.rpc('process_transaction', {
      p_user_id: userId,
      p_amount: diff,
      p_description: '교사 직권 잔액 수정',
      p_type: 'ETC'
    });
    
    if (error) {
      alert('수정 실패: ' + error.message);
    } else {
      fetchData();
      alert(`${name} 학생의 잔액이 ${parsed.toLocaleString()}으로 수정되었습니다.`);
    }
  };

  const handleSaveRewards = async (e) => {
    e.preventDefault();
    setIsSavingRewards(true);
    
    const updates = [
      { key: 'reward_petition_create', value: rewardPetitionCreate.toString() },
      { key: 'reward_petition_agree', value: rewardPetitionAgree.toString() },
      { key: 'reward_law_propose', value: rewardLawPropose.toString() }
    ];

    const { error } = await supabase.from('settings').upsert(updates);
    
    setIsSavingRewards(false);
    if (error) {
      alert('설정 저장 중 오류가 발생했습니다.');
    } else {
      alert('활동 보상 설정이 저장되었습니다.');
    }
  };

  if (loading) return <div>로딩중...</div>;

  return (
    <div style={{ marginTop: '2rem' }}>
      <h3 style={{ color: 'var(--primary)', marginBottom: '1rem' }}>국고(국세청) 및 학생 권한 관리</h3>
      
      <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: '0.9rem', color: '#6b7280' }}>현재 국고(국세청) 잔액</div>
          
          {isEditingTreasury ? (
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
              <input 
                type="number" 
                className="glass-input" 
                value={treasuryInput}
                onChange={(e) => setTreasuryInput(e.target.value)}
                style={{ width: '150px' }}
              />
              <button 
                className="glass-button" 
                style={{ background: 'var(--primary)', color: 'white' }}
                onClick={handleUpdateTreasury}
              >
                저장
              </button>
              <button 
                className="glass-button" 
                onClick={() => setIsEditingTreasury(false)}
              >
                취소
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#3b82f6' }}>
                {treasury.toLocaleString()} {currencyName}
              </div>
              <button 
                className="glass-button" 
                style={{ padding: '0.3rem 0.8rem', fontSize: '0.8rem' }}
                onClick={() => {
                  setTreasuryInput(treasury.toString());
                  setIsEditingTreasury(true);
                }}
              >
                수정
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 활동 보상 설정 섹션 */}
      <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
        <h4 style={{ marginBottom: '1rem' }}>활동 자동 보상 설정</h4>
        <p style={{ fontSize: '0.9rem', color: '#4b5563', marginBottom: '1.5rem' }}>
          학생들이 특정 활동을 할 때마다 자동으로 지급될 보상 금액을 설정합니다. (0으로 설정 시 보상 없음)
        </p>
        
        <form onSubmit={handleSaveRewards} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '400px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label>청원 작성 보상</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input 
                type="number" 
                className="glass-input" 
                value={rewardPetitionCreate}
                onChange={(e) => setRewardPetitionCreate(e.target.value)}
                min="0"
                style={{ width: '100px', textAlign: 'right' }}
              />
              <span>{currencyName}</span>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label>청원 동의 보상</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input 
                type="number" 
                className="glass-input" 
                value={rewardPetitionAgree}
                onChange={(e) => setRewardPetitionAgree(e.target.value)}
                min="0"
                style={{ width: '100px', textAlign: 'right' }}
              />
              <span>{currencyName}</span>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label>법률안 발의 보상</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input 
                type="number" 
                className="glass-input" 
                value={rewardLawPropose}
                onChange={(e) => setRewardLawPropose(e.target.value)}
                min="0"
                style={{ width: '100px', textAlign: 'right' }}
              />
              <span>{currencyName}</span>
            </div>
          </div>

          <button 
            type="submit" 
            className="glass-button" 
            style={{ background: 'var(--primary)', color: 'white', marginTop: '0.5rem' }}
            disabled={isSavingRewards}
          >
            {isSavingRewards ? '저장 중...' : '보상 설정 저장'}
          </button>
        </form>
      </div>

      <div className="glass-panel" style={{ padding: '1.5rem' }}>
        <h4 style={{ marginBottom: '1rem' }}>학생 징수/지급 권한 부여</h4>
        <p style={{ fontSize: '0.9rem', color: '#4b5563', marginBottom: '1.5rem' }}>
          권한이 부여된 학생은 '정부 - 경제 및 징수' 탭에 접근하여 다른 학생들에게 벌금을 징수하거나 지원금을 지급할 수 있습니다.<br/>
          (단, 학생은 본인의 돈이 아닌 <strong>국고(국세청) 잔액</strong>으로만 거래할 수 있게 강제됩니다.)
        </p>

        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
              <th style={{ padding: '0.8rem' }}>학번</th>
              <th style={{ padding: '0.8rem' }}>이름</th>
              <th style={{ padding: '0.8rem' }}>현재 역할</th>
              <th style={{ padding: '0.8rem' }}>잔액</th>
              <th style={{ padding: '0.8rem' }}>경제 권한 (On/Off)</th>
            </tr>
          </thead>
          <tbody>
            {students.map(s => (
               <tr key={s.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={{ padding: '0.8rem' }}>{s.student_number}</td>
                <td style={{ padding: '0.8rem' }}>{s.name}</td>
                <td style={{ padding: '0.8rem', color: '#6b7280' }}>{s.role}</td>
                <td style={{ padding: '0.8rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                    <span style={{ fontWeight: 'bold', color: 'var(--primary)' }}>{(s.balance || 0).toLocaleString()}</span>
                    <button
                      onClick={() => handleUpdateStudentBalance(s.id, s.balance, s.name)}
                      style={{
                        background: 'none',
                        border: '1px solid #d1d5db',
                        borderRadius: '4px',
                        padding: '0.2rem 0.5rem',
                        fontSize: '0.8rem',
                        cursor: 'pointer',
                        color: '#4b5563'
                      }}
                    >
                      수정
                    </button>
                  </div>
                </td>
                <td style={{ padding: '0.8rem' }}>
                  <button
                    onClick={() => handleToggleAdmin(s.id, s.economy_admin)}
                    style={{
                      background: s.economy_admin ? '#10b981' : '#e5e7eb',
                      color: s.economy_admin ? 'white' : '#6b7280',
                      border: 'none',
                      padding: '0.4rem 1rem',
                      borderRadius: '20px',
                      cursor: 'pointer',
                      fontWeight: 'bold',
                      transition: 'all 0.2s'
                    }}
                  >
                    {s.economy_admin ? '권한 켜짐 ON' : '권한 꺼짐 OFF'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

