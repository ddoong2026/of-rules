'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/AuthProvider';

export default function TaxTab() {
  const { role, currency } = useAuth();
  const [students, setStudents] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  
  const isAuthorized = role?.role === 'TEACHER' || role?.role === 'PRESIDENT' || role?.department === '국세청/은행';

  const fetchStudents = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('users')
      .select('id, name, student_number, role, department, job, balance')
      .neq('role', 'TEACHER')
      .order('student_number', { ascending: true });
    
    if (data) setStudents(data);
    setIsLoading(false);
  };

  useEffect(() => {
    if (isAuthorized) {
      const initialFetchTimer = setTimeout(fetchStudents, 0);
      return () => clearTimeout(initialFetchTimer);
    }
  }, [isAuthorized]);

  const handleCollectTax = async (userId, amount, reason) => {
    if (!amount || isNaN(amount) || amount <= 0) return alert('올바른 금액을 입력하세요.');
    if (!reason) return alert('징수 사유를 입력하세요. (예: 지각 벌금, 소득세)');
    
    // Process transaction (negative amount for deduction)
    const { error } = await supabase.rpc('process_transaction', {
      p_user_id: userId,
      p_amount: -parseInt(amount, 10),
      p_description: reason,
      p_type: 'FINE'
    });

    if (error) {
      alert('징수 중 오류가 발생했습니다.');
      console.error(error);
    } else {
      alert('세금/벌금이 징수되었습니다.');
      fetchStudents(); // Refresh balance
      window.dispatchEvent(new CustomEvent('show-pet'));
    }
  };

  if (!isAuthorized) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>권한이 없습니다. (국세청 전용)</div>;
  }

  return (
    <div style={{ padding: '1rem' }}>
      <h2 style={{ marginBottom: '1.5rem', color: '#b91c1c' }}>🏛️ 국세청 - 세금 및 벌금 징수</h2>
      <p style={{ marginBottom: '2rem' }}>법률 위반에 따른 벌금이나 정기적인 세금을 징수할 수 있습니다.</p>

      {isLoading ? (
        <div>로딩중...</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: 'rgba(255,255,255,0.7)', borderRadius: '12px', overflow: 'hidden' }}>
            <thead>
              <tr style={{ background: '#b91c1c', color: 'white' }}>
                <th style={{ padding: '1rem' }}>학번</th>
                <th>이름</th>
                <th>현재 잔액</th>
                <th>징수 사유</th>
                <th>징수 금액</th>
                <th>징수</th>
              </tr>
            </thead>
            <tbody>
              {students.map((student) => (
                <tr key={student.id} style={{ borderBottom: '1px solid rgba(0,0,0,0.1)' }}>
                  <td style={{ padding: '1rem', textAlign: 'center' }}>{student.student_number}</td>
                  <td style={{ textAlign: 'center' }}>{student.name}</td>
                  <td style={{ textAlign: 'center', fontWeight: 'bold' }}>
                    {(student.balance || 0).toLocaleString()} {currency}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <input 
                      type="text" 
                      className="glass-input" 
                      placeholder="사유 (예: 벌금)" 
                      style={{ width: '150px', padding: '0.3rem', margin: 0 }}
                      id={`reason-${student.id}`}
                    />
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <input 
                      type="number" 
                      className="glass-input" 
                      placeholder="금액" 
                      style={{ width: '100px', padding: '0.3rem', margin: 0 }}
                      id={`tax-${student.id}`}
                    />
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <button 
                      className="glass-button" 
                      style={{ padding: '0.3rem 0.8rem', background: '#dc2626', color: 'white' }}
                      onClick={() => {
                        const amount = document.getElementById(`tax-${student.id}`).value;
                        const reason = document.getElementById(`reason-${student.id}`).value;
                        handleCollectTax(student.id, amount, reason);
                      }}
                    >
                      징수
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
