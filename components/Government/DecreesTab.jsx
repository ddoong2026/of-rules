'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/AuthProvider';
import styles from './GovernmentTabs.module.css';
import { CheckCircle, XCircle, Trash2, Search } from 'lucide-react';

export default function DecreesTab() {
  const [decrees, setDecrees] = useState([]);
  const [expandedDecreeId, setExpandedDecreeId] = useState(null);
  const [filterDept, setFilterDept] = useState('전체');
  const [searchTerm, setSearchTerm] = useState('');
  const { user, role } = useAuth();

  const fetchDecrees = async () => {
    const { data, error } = await supabase
      .from('decrees')
      .select(`
        id, law_id, department, title, content, status, created_at,
        laws (title),
        users:minister_id (name)
      `)
      .order('created_at', { ascending: false });
    
    if (data) setDecrees(data);
  };

  useEffect(() => {
    fetchDecrees();

    const channel = supabase.channel('public:decrees')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'decrees' }, () => {
        fetchDecrees();
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  const handleApprove = async (decreeId) => {
    if (role?.role !== 'TEACHER') return alert('선생님만 승인할 수 있습니다.');
    
    const { error } = await supabase
      .from('decrees')
      .update({ status: 'PRESIDENT_APPROVED' }) // Teacher acts as President here
      .eq('id', decreeId);
      
    if (error) alert('오류가 발생했습니다: ' + error.message);
    else fetchDecrees();
  };
  
  const handleDelete = async (decreeId) => {
    if (!confirm('이 명령안을 정말로 삭제/반려하시겠습니까?')) return;
    
    const { error } = await supabase
      .from('decrees')
      .delete()
      .eq('id', decreeId);
      
    if (error) alert('오류가 발생했습니다: ' + error.message);
    else fetchDecrees();
  };

  const getStatusBadge = (status) => {
    switch(status) {
      case 'DRAFT': return <span className={`${styles.badge} ${styles.badgePrimary}`}>결재 대기중</span>;
      case 'MINISTER_APPROVED': return <span className={`${styles.badge} ${styles.badgePrimary}`}>장관 승인</span>;
      case 'PRESIDENT_APPROVED': return <span className={`${styles.badge} ${styles.badgeSuccess}`}>시행중</span>;
      default: return null;
    }
  };

  const departments = ['전체', ...new Set(decrees.map(d => d.department))];
  
  const filteredDecrees = decrees.filter(d => {
    const matchesDept = filterDept === '전체' || d.department === filterDept;
    const matchesSearch = d.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          d.content.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesDept && matchesSearch;
  });

  return (
    <div>
      <div className={styles.tabHeader} style={{ flexWrap: 'wrap', gap: '1rem', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <h2>명령 현황</h2>
          <select 
            className="glass-input" 
            style={{ padding: '0.4rem 2rem 0.4rem 1rem', fontSize: '0.9rem', width: 'auto' }}
            value={filterDept}
            onChange={(e) => setFilterDept(e.target.value)}
          >
            {departments.map(dept => (
              <option key={dept} value={dept}>{dept}</option>
            ))}
          </select>
        </div>
        
        <div style={{ position: 'relative' }}>
          <Search size={18} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            className="glass-input"
            placeholder="명령 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ paddingLeft: '2.5rem', width: '250px' }}
          />
        </div>
      </div>

      <div className={styles.list}>
        {filteredDecrees.length === 0 ? (
          <p className={styles.empty}>
            {searchTerm ? '검색 결과가 없습니다.' : '해당하는 명령이 없습니다.'}
          </p>
        ) : (
          filteredDecrees.map(decree => (
            <div 
              key={decree.id} 
              className={styles.card} 
              style={{ borderLeft: decree.status === 'PRESIDENT_APPROVED' ? '4px solid var(--success)' : '4px solid var(--primary)', cursor: 'pointer' }}
              onClick={() => setExpandedDecreeId(expandedDecreeId === decree.id ? null : decree.id)}
            >
              <div className={styles.cardHeader}>
                <h3 className={styles.cardTitle}>{decree.title}</h3>
                {getStatusBadge(decree.status)}
              </div>
              
              <div 
                className={styles.cardContent} 
                style={{ WebkitLineClamp: expandedDecreeId === decree.id ? 'unset' : 3 }}
              >
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                  근거 법률: {decree.laws?.title}
                </div>
                {decree.content}
              </div>
              
              <div className={styles.cardFooter} onClick={(e) => e.stopPropagation()}>
                <div className={styles.meta}>
                  <span>소관 부처: {decree.department}</span>
                  <span>상신: {decree.users?.name} 장관</span>
                </div>
                
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  {decree.status === 'DRAFT' && role?.role === 'TEACHER' && (
                    <button 
                      className={styles.actionBtn} 
                      onClick={() => handleApprove(decree.id)} 
                      style={{color: '#15803d', border: '1px solid #bbf7d0', background: '#f0fdf4'}}
                    >
                      <CheckCircle size={16} /> 승인(시행)
                    </button>
                  )}
                  
                  {(role?.role === 'TEACHER' || (['MINISTER', 'ASSEMBLY'].includes(role?.role) && role?.department === decree.department && decree.status === 'DRAFT')) && (
                    <button 
                      className={styles.actionBtn} 
                      onClick={() => handleDelete(decree.id)} 
                      style={{color: '#b91c1c', border: '1px solid #fecaca', background: '#fef2f2'}}
                      title="삭제/반려"
                    >
                      <Trash2 size={16} /> 반려(삭제)
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
