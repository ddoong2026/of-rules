'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { supabase } from '@/lib/supabase';
import styles from './teacher.module.css';

const ROLES = [
  { value: 'CITIZEN', label: '일반 국민' },
  { value: 'ASSEMBLY', label: '국회의원' },
  { value: 'MINISTER', label: '장관' },
  { value: 'PRESIDENT', label: '대통령' }
];

const DEPARTMENTS = [
  '', '국방부', '교육부', '재정경제부/기획예산처', '국세청/은행', 
  '법무부', '보건복지부', '기후에너지환경부', '칠판용사', '감사원'
];

export default function TeacherDashboard() {
  const { user, role, loading: authLoading } = useAuth();
  
  const [activeTab, setActiveTab] = useState('create'); // 'create' | 'manage' | 'economy'

  // --- Economy Tab State ---
  const [currencyName, setCurrencyName] = useState('미소');
  const [shopItems, setShopItems] = useState([]);
  const [newItemName, setNewItemName] = useState('');
  const [newItemPrice, setNewItemPrice] = useState('');
  const [isSavingEconomy, setIsSavingEconomy] = useState(false);

  // --- Create Tab State ---
  const [grade, setGrade] = useState('1');
  const [classNum, setClassNum] = useState('1');
  const [startNum, setStartNum] = useState('1');
  const [endNum, setEndNum] = useState('30');
  const [missingNums, setMissingNums] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [createResult, setCreateResult] = useState(null);

  // --- Manage Tab State ---
  const [students, setStudents] = useState([]);
  const [isLoadingStudents, setIsLoadingStudents] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateResult, setUpdateResult] = useState(null);

  useEffect(() => {
    if (role?.role === 'TEACHER') {
      if (activeTab === 'manage') fetchStudents();
      if (activeTab === 'economy') fetchEconomyData();
    }
  }, [activeTab, role]);

  const fetchEconomyData = async () => {
    const { data: curData } = await supabase.from('settings').select('value').eq('key', 'currency_name').single();
    if (curData) setCurrencyName(curData.value);

    const { data: items } = await supabase.from('shop_items').select('*').order('created_at', { ascending: false });
    if (items) setShopItems(items);
  };

  const handleSaveCurrency = async () => {
    setIsSavingEconomy(true);
    await supabase.from('settings').upsert({ key: 'currency_name', value: currencyName });
    alert('화폐 단위가 저장되었습니다.');
    setIsSavingEconomy(false);
  };

  const handleAddShopItem = async (e) => {
    e.preventDefault();
    if (!newItemName || !newItemPrice) return;
    setIsSavingEconomy(true);
    
    const { error } = await supabase.from('shop_items').insert([{
      name: newItemName,
      price: parseInt(newItemPrice, 10),
      description: '',
      stock: -1
    }]);

    if (!error) {
      setNewItemName('');
      setNewItemPrice('');
      fetchEconomyData();
    } else {
      alert('상품 등록 중 오류가 발생했습니다.');
    }
    setIsSavingEconomy(false);
  };

  const handleToggleItemActive = async (id, currentStatus) => {
    await supabase.from('shop_items').update({ is_active: !currentStatus }).eq('id', id);
    fetchEconomyData();
  };

  const handleDeleteItem = async (id) => {
    if (confirm('이 상품을 삭제하시겠습니까?')) {
      await supabase.from('shop_items').delete().eq('id', id);
      fetchEconomyData();
    }
  };

  const fetchStudents = async () => {
    setIsLoadingStudents(true);
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .neq('role', 'TEACHER') // 교사 제외
      .order('student_number', { ascending: true });
    
    if (error) {
      console.error(error);
      alert('학생 목록을 불러오는데 실패했습니다.');
    } else {
      setStudents(data || []);
    }
    setIsLoadingStudents(false);
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    setIsCreating(true);
    setCreateResult(null);

    const missingArray = missingNums.split(',').map(n => parseInt(n.trim(), 10)).filter(n => !isNaN(n));
    const start = parseInt(startNum, 10);
    const end = parseInt(endNum, 10);
    
    if (start > end) {
      alert('시작 번호는 끝 번호보다 작거나 같아야 합니다.');
      setIsCreating(false);
      return;
    }

    const usersToCreate = [];
    
    for (let i = start; i <= end; i++) {
      if (missingArray.includes(i)) continue;
      
      const studentNumberStr = `${grade}${classNum.padStart(2, '0')}${i.toString().padStart(2, '0')}`;
      const email = `s${studentNumberStr}@class.com`;
      const name = `${grade}학년 ${classNum}반 ${i}번`;
      
      usersToCreate.push({
        student_number: parseInt(studentNumberStr, 10),
        name,
        email,
        role: 'CITIZEN',
        department: null
      });
    }

    if (usersToCreate.length === 0) {
      alert('생성할 대상이 없습니다.');
      setIsCreating(false);
      return;
    }

    if (!confirm(`총 ${usersToCreate.length}명의 계정을 생성하시겠습니까?\n(비밀번호: 123456)`)) {
      setIsCreating(false);
      return;
    }

    try {
      const res = await fetch('/api/admin/create-users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ users: usersToCreate })
      });
      
      const data = await res.json();
      
      if (res.ok) {
        setCreateResult(data.results);
      } else {
        alert(data.error || '오류가 발생했습니다.');
      }
    } catch (err) {
      console.error(err);
      alert('네트워크 오류가 발생했습니다.');
    }
    
    setIsCreating(false);
  };

  const handleStudentChange = (index, field, value) => {
    const updated = [...students];
    updated[index][field] = value;
    // 만약 장관이나 국회의원이 아닌 다른 직업으로 바뀌면 부처 초기화
    if (field === 'role' && value !== 'MINISTER' && value !== 'ASSEMBLY') {
      updated[index]['department'] = null;
    }
    setStudents(updated);
  };

  const handleUpdateSubmit = async () => {
    setIsUpdating(true);
    setUpdateResult(null);

    try {
      const res = await fetch('/api/admin/update-users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates: students }) // 전체 학생 데이터 전송
      });
      
      const data = await res.json();
      
      if (res.ok) {
        setUpdateResult(data.results);
        // 성공적으로 저장되면 목록 새로고침
        if (data.results.failed === 0) {
          alert('모든 변경사항이 성공적으로 저장되었습니다!');
          fetchStudents();
        }
      } else {
        alert(data.error || '오류가 발생했습니다.');
      }
    } catch (err) {
      console.error(err);
      alert('네트워크 오류가 발생했습니다.');
    }
    
    setIsUpdating(false);
  };

  if (authLoading) return <div className={styles.center}>로딩중...</div>;
  if (!user || role?.role !== 'TEACHER') {
    return (
      <div className={styles.center}>
        <h2>접근 권한이 없습니다.</h2>
        <p>교사(관리자) 계정으로만 접근 가능한 페이지입니다.</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>👨‍🏫 교사 대시보드</h1>
        <p className={styles.subtitle}>학생 계정 생성 및 직업 관리 시스템</p>
      </header>

      <div className={styles.tabs}>
        <button 
          className={`${styles.tabBtn} ${activeTab === 'create' ? styles.active : ''}`}
          onClick={() => setActiveTab('create')}
        >
          ➕ 계정 일괄 생성
        </button>
        <button 
          className={`${styles.tabBtn} ${activeTab === 'manage' ? styles.active : ''}`}
          onClick={() => setActiveTab('manage')}
        >
          🛠 학생 직업 관리
        </button>
        <button 
          className={`${styles.tabBtn} ${activeTab === 'economy' ? styles.active : ''}`}
          onClick={() => setActiveTab('economy')}
        >
          💰 경제 관리
        </button>
      </div>

      <div className={`glass-panel ${styles.panel}`}>
        {activeTab === 'create' && (
          <>
            <p style={{fontSize: '0.9rem', color: 'var(--danger)', marginBottom: '1.5rem', textAlign: 'center'}}>
              * 초기 발급되는 비밀번호는 <strong>123456</strong> 으로 통일됩니다.<br/>
              * 이메일은 <code>s[학번]@class.com</code> 형식으로 자동 생성됩니다.
            </p>
            <form onSubmit={handleCreateSubmit}>
              <div className={styles.formGrid}>
                <div className={styles.inputGroup}>
                  <label>학년</label>
                  <select className="glass-input" value={grade} onChange={(e) => setGrade(e.target.value)}>
                    {[1, 2, 3, 4, 5, 6].map(n => <option key={n} value={n}>{n}학년</option>)}
                  </select>
                </div>
                
                <div className={styles.inputGroup}>
                  <label>반</label>
                  <select className="glass-input" value={classNum} onChange={(e) => setClassNum(e.target.value)}>
                    {Array.from({length: 15}, (_, i) => i + 1).map(n => <option key={n} value={n}>{n}반</option>)}
                  </select>
                </div>

                <div className={styles.inputGroup}>
                  <label>시작 번호</label>
                  <input 
                    type="number" 
                    className="glass-input" 
                    value={startNum} 
                    onChange={(e) => setStartNum(e.target.value)}
                    min="1"
                    required
                  />
                </div>

                <div className={styles.inputGroup}>
                  <label>끝 번호</label>
                  <input 
                    type="number" 
                    className="glass-input" 
                    value={endNum} 
                    onChange={(e) => setEndNum(e.target.value)}
                    min="1"
                    required
                  />
                </div>

                <div className={`${styles.inputGroup} ${styles.fullWidth}`}>
                  <label>결번 입력 (선택사항)</label>
                  <input 
                    type="text" 
                    className="glass-input" 
                    value={missingNums} 
                    onChange={(e) => setMissingNums(e.target.value)}
                    placeholder="예: 4, 13 (쉼표로 구분하여 입력)"
                  />
                  <span className={styles.hint}>위에서 설정한 시작~끝 번호 중 생성하지 않을 번호만 적어주세요.</span>
                </div>
              </div>

              <div className={styles.actions}>
                <button 
                  type="submit" 
                  className="glass-button" 
                  style={{background: 'var(--primary)', color: 'white', padding: '0.75rem 2rem', fontSize: '1.1rem'}} 
                  disabled={isCreating}
                >
                  {isCreating ? '계정 생성 중...' : '계정 일괄 생성'}
                </button>
              </div>
            </form>

            {createResult && (
              <div className={styles.resultBox}>
                <h3 style={{color: 'var(--primary)', marginBottom: '1rem'}}>생성 결과</h3>
                <p style={{fontWeight: 'bold', color: '#15803d'}}>✅ 성공: {createResult.success}건</p>
                <p style={{fontWeight: 'bold', color: '#b91c1c'}}>❌ 실패: {createResult.failed}건</p>
                {createResult.errors.length > 0 && (
                  <ul className={styles.errorList}>
                    {createResult.errors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </>
        )}

        {activeTab === 'manage' && (
          <div className={styles.manageSection}>
            <div className={styles.manageHeader}>
              <p>총 {students.length}명의 학생이 있습니다.</p>
              <button 
                className="glass-button" 
                style={{background: 'var(--primary)', color: 'white'}}
                onClick={handleUpdateSubmit}
                disabled={isUpdating || students.length === 0}
              >
                {isUpdating ? '저장 중...' : '일괄 저장'}
              </button>
            </div>

            {isLoadingStudents ? (
              <p style={{textAlign: 'center', padding: '2rem'}}>목록을 불러오는 중...</p>
            ) : (
              <div className={styles.tableWrapper}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>학번</th>
                      <th>이름</th>
                      <th>직업(역할)</th>
                      <th>부처 (장관 및 국회의원 겸임 가능)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((student, index) => (
                      <tr key={student.id}>
                        <td style={{textAlign: 'center'}}>{student.student_number}</td>
                        <td style={{textAlign: 'center'}}>{student.name}</td>
                        <td>
                          <select 
                            className="glass-input" 
                            value={student.role}
                            onChange={(e) => handleStudentChange(index, 'role', e.target.value)}
                          >
                            {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                          </select>
                        </td>
                        <td>
                          <select 
                            className="glass-input" 
                            value={student.department || ''}
                            onChange={(e) => handleStudentChange(index, 'department', e.target.value)}
                            disabled={student.role !== 'MINISTER' && student.role !== 'ASSEMBLY'}
                          >
                            {DEPARTMENTS.map(d => <option key={d} value={d}>{d || '해당 없음'}</option>)}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {updateResult && (
              <div className={styles.resultBox} style={{marginTop: '1rem'}}>
                <h3 style={{color: 'var(--primary)', marginBottom: '1rem'}}>저장 결과</h3>
                <p style={{fontWeight: 'bold', color: '#15803d'}}>✅ 성공: {updateResult.success}건</p>
                <p style={{fontWeight: 'bold', color: '#b91c1c'}}>❌ 실패: {updateResult.failed}건</p>
                {updateResult.errors.length > 0 && (
                  <ul className={styles.errorList}>
                    {updateResult.errors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'economy' && (
          <div className={styles.manageSection}>
            <div style={{ marginBottom: '2rem' }}>
              <h3 style={{ marginBottom: '1rem', color: 'var(--primary)' }}>화폐 단위 설정</h3>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <input 
                  type="text" 
                  className="glass-input" 
                  value={currencyName}
                  onChange={(e) => setCurrencyName(e.target.value)}
                  placeholder="예: 미소, 원"
                  style={{ maxWidth: '200px' }}
                />
                <button 
                  className="glass-button" 
                  style={{ background: 'var(--primary)', color: 'white', padding: '0.6rem 1.2rem' }}
                  onClick={handleSaveCurrency}
                  disabled={isSavingEconomy}
                >
                  {isSavingEconomy ? '저장 중...' : '저장'}
                </button>
              </div>
            </div>

            <hr style={{ borderColor: 'rgba(0,0,0,0.1)', margin: '2rem 0' }} />

            <div>
              <h3 style={{ marginBottom: '1rem', color: 'var(--primary)' }}>상점 아이템 관리</h3>
              
              <form onSubmit={handleAddShopItem} style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', alignItems: 'center' }}>
                <input 
                  type="text" 
                  className="glass-input" 
                  placeholder="아이템 이름 (예: 자리 변경권)"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  required
                />
                <input 
                  type="number" 
                  className="glass-input" 
                  placeholder="가격"
                  value={newItemPrice}
                  onChange={(e) => setNewItemPrice(e.target.value)}
                  min="0"
                  style={{ maxWidth: '150px' }}
                  required
                />
                <button 
                  type="submit"
                  className="glass-button" 
                  style={{ background: 'var(--secondary)', color: 'white' }}
                  disabled={isSavingEconomy}
                >
                  추가
                </button>
              </form>

              <div className={styles.tableWrapper}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>아이템명</th>
                      <th>가격</th>
                      <th>상태</th>
                      <th>관리</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shopItems.map(item => (
                      <tr key={item.id} style={{ opacity: item.is_active ? 1 : 0.5 }}>
                        <td>{item.name}</td>
                        <td style={{ textAlign: 'center' }}>{item.price.toLocaleString()} {currencyName}</td>
                        <td style={{ textAlign: 'center' }}>
                          {item.is_active ? <span style={{ color: '#15803d', fontWeight: 'bold' }}>판매 중</span> : <span style={{ color: '#b91c1c' }}>단종됨</span>}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <button 
                            className="glass-button" 
                            style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem', marginRight: '0.5rem' }}
                            onClick={() => handleToggleItemActive(item.id, item.is_active)}
                          >
                            {item.is_active ? '판매중지' : '판매재개'}
                          </button>
                          <button 
                            className="glass-button" 
                            style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem', background: '#fee2e2', color: '#b91c1c' }}
                            onClick={() => handleDeleteItem(item.id)}
                          >
                            삭제
                          </button>
                        </td>
                      </tr>
                    ))}
                    {shopItems.length === 0 && (
                      <tr>
                        <td colSpan="4" style={{ textAlign: 'center', padding: '1.5rem' }}>등록된 아이템이 없습니다.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
