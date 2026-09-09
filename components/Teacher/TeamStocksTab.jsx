'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function TeamStocksTab() {
  const [teams, setTeams] = useState([]);
  const [students, setStudents] = useState([]);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');

  const load = async () => {
    const [{ data: teamData }, { data: studentData }, { data: memberData }] = await Promise.all([
      supabase.from('stock_teams').select('*').order('code'),
      supabase.from('users').select('id,name,student_number').neq('role', 'TEACHER').order('student_number'),
      supabase.from('stock_team_members').select('user_id,team_id'),
    ]);
    const teamByUser = Object.fromEntries((memberData || []).map(m => [m.user_id, m.team_id]));
    setTeams(teamData || []);
    setStudents((studentData || []).map(s => ({ ...s, teamId: teamByUser[s.id] || '' })));
  };

  useEffect(() => { load(); }, []);

  const createTeam = async (event) => {
    event.preventDefault();
    const { error } = await supabase.from('stock_teams').insert({ name, code: code.trim().toUpperCase() });
    if (error) return alert(`모둠 생성 실패: ${error.message}`);
    setName(''); setCode(''); load();
  };

  const assign = async (userId, teamId) => {
    await supabase.from('stock_team_members').delete().eq('user_id', userId);
    if (teamId) {
      const { error } = await supabase.from('stock_team_members').insert({ user_id: userId, team_id: teamId });
      if (error) return alert(`배정 실패: ${error.message}`);
    }
    load();
  };

  return <div>
    <h3 style={{ color: 'var(--primary)' }}>모둠 주식 · 배당 관리</h3>
    <p>모둠 코드는 독서오름나무의 모둠 코드와 정확히 같아야 합니다. 경험치 1은 배당 재원 1로 적립됩니다.</p>
    <form onSubmit={createTeam} style={{ display: 'flex', gap: '0.5rem', margin: '1rem 0' }}>
      <input className="glass-input" value={name} onChange={e => setName(e.target.value)} placeholder="모둠 이름" required />
      <input className="glass-input" value={code} onChange={e => setCode(e.target.value)} placeholder="코드 (예: G1)" required />
      <button className="glass-button" type="submit">모둠 만들기</button>
    </form>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
      {teams.map(team => <div key={team.id} className="glass-panel" style={{ padding: '0.75rem' }}><b>{team.name}</b> ({team.code})<br />배당 재원: {team.dividend_pool}</div>)}
    </div>
    <table style={{ width: '100%' }}><thead><tr><th>학번</th><th>학생</th><th>모둠 배정</th></tr></thead><tbody>
      {students.map(student => <tr key={student.id}><td>{student.student_number}</td><td>{student.name}</td><td><select value={student.teamId} onChange={e => assign(student.id, e.target.value)}><option value="">미배정</option>{teams.map(team => <option key={team.id} value={team.id}>{team.name} ({team.code})</option>)}</select></td></tr>)}
    </tbody></table>
  </div>;
}
