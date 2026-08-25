'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function EconomyAdminTab() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [treasury, setTreasury] = useState(0);

  useEffect(() => {
    fetchData();
    fetchTreasury();
  }, []);

  const fetchData = async () => {
    const { data } = await supabase
      .from('users')
      .select('id, name, student_number, role, economy_admin')
      .neq('role', 'TEACHER')
      .order('student_number');
    if (data) setStudents(data);
    setLoading(false);
  };

  const fetchTreasury = async () => {
    const { data } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'treasury_balance')
      .single();
    if (data) {
      setTreasury(parseInt(data.value || '0', 10));
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

  if (loading) return <div>로딩중...</div>;

  return (
    <div style={{ marginTop: '2rem' }}>
      <h3 style={{ color: 'var(--primary)', marginBottom: '1rem' }}>국고(국세청) 및 학생 권한 관리</h3>
      
      <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: '0.9rem', color: '#6b7280' }}>현재 국고(국세청) 잔액</div>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#3b82f6' }}>
            {treasury.toLocaleString()}
          </div>
        </div>
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
