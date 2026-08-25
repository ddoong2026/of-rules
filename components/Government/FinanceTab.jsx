'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/AuthProvider';

export default function FinanceTab() {
  const { role, currency } = useAuth();
  const [students, setStudents] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  
  const isAuthorized = role?.role === 'TEACHER' || role?.role === 'PRESIDENT' || role?.department === '재정경제부/기획예산처';

  useEffect(() => {
    if (isAuthorized) {
      fetchStudents();
    }
  }, [isAuthorized]);

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

  const handlePaySalary = async (userId, amount) => {
    if (!amount || isNaN(amount) || amount <= 0) return alert('올바른 금액을 입력하세요.');
    
    // Call the RPC to safely process transaction
    const { error } = await supabase.rpc('process_transaction', {
      p_user_id: userId,
      p_amount: parseInt(amount, 10),
      p_description: '월급 지급',
      p_type: 'SALARY'
    });

    if (error) {
      alert('지급 중 오류가 발생했습니다.');
      console.error(error);
    } else {
      alert('월급이 지급되었습니다.');
      fetchStudents(); // Refresh balance
      // Fire pet event
      window.dispatchEvent(new CustomEvent('show-pet'));
    }
  };

  if (!isAuthorized) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>권한이 없습니다. (재정경제부/기획예산처 전용)</div>;
  }

  return (
    <div style={{ padding: '1rem' }}>
      <h2 style={{ marginBottom: '1.5rem', color: 'var(--primary)' }}>💰 재정경제부 - 월급 지급</h2>
      <p style={{ marginBottom: '2rem' }}>각 직업이나 역할에 맞는 월급을 수동으로 지급할 수 있습니다.</p>

      {isLoading ? (
        <div>로딩중...</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: 'rgba(255,255,255,0.7)', borderRadius: '12px', overflow: 'hidden' }}>
            <thead>
              <tr style={{ background: 'var(--primary)', color: 'white' }}>
                <th style={{ padding: '1rem' }}>학번</th>
                <th>이름</th>
                <th>직업/부처</th>
                <th>현재 잔액</th>
                <th>월급 지급액</th>
                <th>지급</th>
              </tr>
            </thead>
            <tbody>
              {students.map((student) => (
                <tr key={student.id} style={{ borderBottom: '1px solid rgba(0,0,0,0.1)' }}>
                  <td style={{ padding: '1rem', textAlign: 'center' }}>{student.student_number}</td>
                  <td style={{ textAlign: 'center' }}>{student.name}</td>
                  <td style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '0.9em' }}>{student.role}</div>
                    <div style={{ color: 'var(--primary)', fontWeight: 'bold' }}>{student.department || student.job || '-'}</div>
                  </td>
                  <td style={{ textAlign: 'center', fontWeight: 'bold' }}>
                    {(student.balance || 0).toLocaleString()} {currency}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <input 
                      type="number" 
                      className="glass-input" 
                      placeholder="금액" 
                      style={{ width: '100px', padding: '0.3rem', margin: 0 }}
                      id={`pay-${student.id}`}
                    />
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <button 
                      className="glass-button" 
                      style={{ padding: '0.3rem 0.8rem', background: '#16a34a', color: 'white' }}
                      onClick={() => {
                        const amount = document.getElementById(`pay-${student.id}`).value;
                        handlePaySalary(student.id, amount);
                      }}
                    >
                      지급
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
