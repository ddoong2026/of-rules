'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function ActivityLogsTab() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  async function fetchLogs() {
    // Fetch from activity_logs table joining users table for user_name
    const { data, error } = await supabase
      .from('activity_logs')
      .select('*, users(name, student_number)')
      .order('created_at', { ascending: false })
      .limit(100);

    if (data) setLogs(data);
    setLoading(false);
  };

  useEffect(() => {
    const initialFetchTimer = setTimeout(fetchLogs, 0);
    return () => clearTimeout(initialFetchTimer);
  }, []);

  if (loading) return <div>로딩중...</div>;

  return (
    <div style={{ padding: '1rem' }}>
      <h2 style={{ marginBottom: '1.5rem', color: 'var(--primary)' }}>📋 학급 활동 기록 (전체)</h2>
      
      <div style={{ background: 'white', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f3f4f6', textAlign: 'left' }}>
              <th style={{ padding: '1rem', borderBottom: '2px solid #e5e7eb' }}>시간</th>
              <th style={{ padding: '1rem', borderBottom: '2px solid #e5e7eb' }}>학생</th>
              <th style={{ padding: '1rem', borderBottom: '2px solid #e5e7eb' }}>유형</th>
              <th style={{ padding: '1rem', borderBottom: '2px solid #e5e7eb' }}>내용</th>
            </tr>
          </thead>
          <tbody>
            {logs.map(log => (
              <tr key={log.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                <td style={{ padding: '1rem', color: '#6b7280', fontSize: '0.9rem' }}>
                  {new Date(log.created_at).toLocaleString()}
                </td>
                <td style={{ padding: '1rem', fontWeight: 'bold' }}>
                  {log.users ? `${log.users.student_number} ${log.users.name}` : '시스템/알수없음'}
                </td>
                <td style={{ padding: '1rem' }}>
                  <span style={{ 
                    padding: '0.2rem 0.5rem', 
                    borderRadius: '4px', 
                    fontSize: '0.8rem',
                    background: log.action_type === 'TRANSACTION' ? '#dbeafe' : '#fce7f3',
                    color: log.action_type === 'TRANSACTION' ? '#1d4ed8' : '#be185d'
                  }}>
                    {log.action_type}
                  </span>
                </td>
                <td style={{ padding: '1rem' }}>{log.description}</td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr>
                <td colSpan="4" style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>
                  아직 기록된 활동이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
