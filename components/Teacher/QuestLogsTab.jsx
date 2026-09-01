'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function QuestLogsTab() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [studentsProgress, setStudentsProgress] = useState({}); // { user_id: { name, number, completedQuests: [] } }

  useEffect(() => {
    fetchQuestLogs();
  }, []);

  const fetchQuestLogs = async () => {
    const { data, error } = await supabase
      .from('activity_logs')
      .select('*, users(name, student_number)')
      .eq('action_type', 'QUEST_COMPLETED')
      .order('created_at', { ascending: false });

    if (data) {
      setLogs(data);
      
      const progress = {};
      data.forEach(log => {
        if (!log.users) return;
        const uid = log.user_id;
        if (!progress[uid]) {
          progress[uid] = {
            name: log.users.name,
            number: log.users.student_number,
            completedQuests: []
          };
        }
        
        const title = log.details?.title || log.description.replace('퀘스트 완료: ', '');
        
        // Add only if not already exists
        if (!progress[uid].completedQuests.find(q => q.title === title)) {
          progress[uid].completedQuests.push({
            title,
            time: log.created_at
          });
        }
      });
      setStudentsProgress(progress);
    }
    setLoading(false);
  };

  if (loading) return <div>로딩중...</div>;

  return (
    <div style={{ padding: '1rem' }}>
      <h2 style={{ marginBottom: '1.5rem', color: 'var(--primary)' }}>🎯 학생별 학습 진행 상황 (퀘스트 완료 현황)</h2>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        {Object.values(studentsProgress).map(student => (
          <div key={student.number + student.name} style={{ background: 'white', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0' }}>
            <h3 style={{ margin: '0 0 1rem 0', color: '#1e293b', borderBottom: '2px solid #f1f5f9', paddingBottom: '0.5rem' }}>
              {student.number}번 {student.name}
            </h3>
            <div style={{ color: '#059669', fontWeight: 'bold', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>완료한 퀘스트: {student.completedQuests.length}개</span>
            </div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {student.completedQuests.map((q, idx) => (
                <li key={idx} style={{ background: '#f8fafc', padding: '0.5rem', borderRadius: '6px', fontSize: '0.9rem', display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontWeight: 'bold', color: '#334155' }}>✓ {q.title}</span>
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '2px' }}>
                    {new Date(q.time).toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
        {Object.keys(studentsProgress).length === 0 && (
          <div style={{ color: '#64748b', gridColumn: '1 / -1', textAlign: 'center', padding: '2rem' }}>
            아직 퀘스트를 완료한 학생이 없습니다.
          </div>
        )}
      </div>

      <h3 style={{ margin: '2rem 0 1rem 0', color: '#475569' }}>최근 퀘스트 완료 로그</h3>
      <div style={{ background: 'white', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f8fafc', textAlign: 'left' }}>
              <th style={{ padding: '1rem', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>시간</th>
              <th style={{ padding: '1rem', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>학생</th>
              <th style={{ padding: '1rem', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>퀘스트 명</th>
              <th style={{ padding: '1rem', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>보상</th>
            </tr>
          </thead>
          <tbody>
            {logs.slice(0, 20).map(log => (
              <tr key={log.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '1rem', color: '#64748b', fontSize: '0.9rem' }}>
                  {new Date(log.created_at).toLocaleString()}
                </td>
                <td style={{ padding: '1rem', fontWeight: 'bold', color: '#334155' }}>
                  {log.users ? \`\${log.users.student_number} \${log.users.name}\` : '알수없음'}
                </td>
                <td style={{ padding: '1rem', color: '#1e293b' }}>
                  {log.details?.title || log.description.replace('퀘스트 완료: ', '')}
                </td>
                <td style={{ padding: '1rem', color: '#059669', fontSize: '0.9rem', fontWeight: 'bold' }}>
                  {log.details?.reward === 'money' ? '돈 (기본 화폐)' : (log.details?.reward || '없음')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
