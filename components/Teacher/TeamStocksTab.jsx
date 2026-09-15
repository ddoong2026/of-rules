'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import styles from './TeamStocksTab.module.css';

export default function TeamStocksTab() {
  const [teams, setTeams] = useState([]);
  const [students, setStudents] = useState([]);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [bulkTeamId, setBulkTeamId] = useState('');

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

  const assignSelected = async () => {
    if (!bulkTeamId || selectedStudents.length === 0) return alert('모둠과 학생을 선택하세요.');
    for (const userId of selectedStudents) await assign(userId, bulkTeamId);
    setSelectedStudents([]);
  };

  const editTeam = async (team) => {
    const nextName = prompt('모둠 이름', team.name); const nextCode = prompt('모둠 코드', team.code);
    if (!nextName || !nextCode) return;
    const { error } = await supabase.rpc('update_team_stock', { p_team_id: team.id, p_name: nextName, p_code: nextCode });
    if (error) return alert(error.message); load();
  };

  const adjustShares = async (team) => {
    const studentNumber = Number(prompt('수정할 학생 학번')); const delta = Number(prompt('증감 수량 (회수는 음수)')); const price = Number(prompt('기준 가격'));
    const student = students.find(s => s.student_number === studentNumber);
    if (!student || !Number.isInteger(delta) || !Number.isInteger(price) || !delta || price <= 0) return alert('학번, 수량, 가격을 확인하세요.');
    const { error } = await supabase.rpc('adjust_team_share_issue', { p_team_id: team.id, p_user_id: student.id, p_delta: delta, p_reference_price: price });
    if (error) return alert(error.message); load();
  };

  const issue = async (team) => {
    const studentNumber = Number(prompt('초기 주식을 받을 학생 학번'));
    const quantity = Number(prompt('발행 수량'));
    const price = Number(prompt('기준 가격'));
    const student = students.find(s => s.student_number === studentNumber);
    if (!student || !Number.isInteger(quantity) || !Number.isInteger(price) || quantity <= 0 || price <= 0) return alert('학번, 수량, 가격을 확인하세요.');
    const { error } = await supabase.rpc('issue_team_shares', { p_team_id: team.id, p_user_id: student.id, p_quantity: quantity, p_reference_price: price });
    if (error) return alert(error.message); alert('초기 주식이 발행되었습니다. 이제 학생이 매도 주문을 낼 수 있습니다.'); load();
  };

  const payDividend = async (team) => {
    if (!confirm(`${team.name}의 배당 재원을 현재 보유 주식 수량대로 지급할까요?`)) return;
    const { data, error } = await supabase.rpc('pay_team_dividend', { p_team_id: team.id });
    if (error) return alert(error.message); alert(`${data.toLocaleString()}이 배당되었습니다.`); load();
  };

  const adjustPool = async (team) => {
    const amount = Number(prompt('증감액 (차감은 음수)'));
    const reason = prompt('조정 사유') || '';
    if (!Number.isInteger(amount) || amount === 0) return;
    const { error } = await supabase.rpc('adjust_team_dividend_pool', { p_team_id: team.id, p_amount: amount, p_reason: reason });
    if (error) return alert(error.message); load();
  };

  return <div className={styles.layout}>
    <div className={styles.intro}><h3>모둠 주식 · 배당 관리</h3><p>모둠 코드는 독서오름나무의 모둠 코드와 정확히 같아야 합니다. 경험치 1은 배당 재원 1로 적립됩니다.</p></div>
    <form onSubmit={createTeam} className={styles.createForm}>
      <input className="glass-input" value={name} onChange={e => setName(e.target.value)} placeholder="모둠 이름" required />
      <input className="glass-input" value={code} onChange={e => setCode(e.target.value)} placeholder="코드 (예: G1)" required />
      <button className="glass-button" type="submit">모둠 만들기</button>
    </form>
    <div className={styles.teamGrid}>
      {teams.map(team => <div key={team.id} className={styles.teamCard}><div className={styles.teamName}>{team.name} <span className={styles.code}>({team.code})</span></div><div className={styles.pool}>배당 재원 {team.dividend_pool.toLocaleString()}</div><div className={styles.actions}><button className="glass-button" onClick={()=>editTeam(team)}>모둠 수정</button><button className="glass-button" onClick={()=>issue(team)}>초기 주식 발행</button><button className="glass-button" onClick={()=>adjustShares(team)}>주식 수량 수정</button><button className="glass-button" onClick={()=>adjustPool(team)}>재원 조정</button><button className="glass-button" onClick={()=>payDividend(team)}>배당 지급</button></div></div>)}
    </div>
    <section className={styles.studentPanel}><h4>학생 모둠 배정</h4><div className={styles.bulkBar}><span>{selectedStudents.length}명 선택</span><select className={styles.select} value={bulkTeamId} onChange={e=>setBulkTeamId(e.target.value)}><option value="">배정할 모둠</option>{teams.map(team=><option key={team.id} value={team.id}>{team.name} ({team.code})</option>)}</select><button className="glass-button" onClick={assignSelected}>선택 학생 일괄 배정</button></div><div className={styles.tableWrap}><table className={styles.table}><thead><tr><th><input type="checkbox" checked={students.length>0 && selectedStudents.length===students.length} onChange={e=>setSelectedStudents(e.target.checked?students.map(s=>s.id):[])}/></th><th>학번</th><th>학생</th><th>모둠 배정</th></tr></thead><tbody>
      {students.map(student => <tr key={student.id}><td><input type="checkbox" checked={selectedStudents.includes(student.id)} onChange={e=>setSelectedStudents(e.target.checked?[...selectedStudents,student.id]:selectedStudents.filter(id=>id!==student.id))}/></td><td>{student.student_number}</td><td>{student.name}</td><td><select className={styles.select} value={student.teamId} onChange={e => assign(student.id, e.target.value)}><option value="">미배정</option>{teams.map(team => <option key={team.id} value={team.id}>{team.name} ({team.code})</option>)}</select></td></tr>)}
    </tbody></table></div></section>
  </div>;
}
