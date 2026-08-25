'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Bell } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from './AuthProvider';
import styles from './Inbox.module.css';

export default function Inbox() {
  const { user, role } = useAuth();
  const [messages, setMessages] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [readIds, setReadIds] = useState([]);
  const dropdownRef = useRef(null);

  // 로컬 스토리지에서 읽음 처리된 메시지 ID 목록 가져오기
  useEffect(() => {
    if (user) {
      const stored = localStorage.getItem(`read_messages_${user.id}`);
      if (stored) {
        try {
          setReadIds(JSON.parse(stored));
        } catch (e) {
          console.error(e);
        }
      }
    }
  }, [user]);

  // 쪽지 데이터 가져오기
  const fetchMessages = async () => {
    if (!user || !role) return;
    
    let fetchedMessages = [];
    
    const isAssembly = ['ASSEMBLY', 'TEACHER'].includes(role.role);
    const isMinister = ['MINISTER', 'ASSEMBLY', 'TEACHER'].includes(role.role) && role.department;
    const isTeacher = role.role === 'TEACHER';

    // 1. 국회 계류 중인 청원 (국회의원용)
    if (isAssembly) {
      const { data: petitions } = await supabase
        .from('petitions')
        .select('id, title, content, created_at')
        .eq('status', 'IN_ASSEMBLY');
        
      if (petitions) {
        fetchedMessages = [...fetchedMessages, ...petitions.map(p => ({
          ...p,
          type: 'ASSEMBLY',
          typeLabel: '국회 계류 청원',
          desc: p.content,
          link: '/assembly'
        }))];
      }
    }

    // 2. 부처로 전송된 공포 법률 (장관용)
    if (isMinister || isTeacher) {
      // 선생님은 모든 부처의 법률을 볼 수 있고, 장관은 본인 부처만
      let query = supabase.from('laws').select('id, title, reason, created_at').eq('status', 'PROMULGATED');
      if (!isTeacher && role.department) {
        query = query.eq('target_department', role.department);
      }

      const { data: laws } = await query;
      
      if (laws) {
        fetchedMessages = [...fetchedMessages, ...laws.map(l => ({
          ...l,
          type: 'MINISTER',
          typeLabel: '소관 부처 법률',
          desc: l.reason,
          link: '/government'
        }))];
      }
    }

    // 최신순 정렬
    fetchedMessages.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    setMessages(fetchedMessages);
  };

  useEffect(() => {
    fetchMessages();
    
    // 간단한 폴링 (실시간 반영을 위함)
    const interval = setInterval(fetchMessages, 10000);
    return () => clearInterval(interval);
  }, [user, role]);

  // 외부 클릭 시 드롭다운 닫기
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // 안 읽은 메시지 필터링
  const unreadMessages = messages.filter(m => !readIds.includes(m.id));
  const unreadCount = unreadMessages.length;

  const handleToggle = () => {
    setIsOpen(!isOpen);
    if (!isOpen) {
      fetchMessages(); // 열 때 한번 더 새로고침
    }
  };

  const handleMarkAllRead = () => {
    const allIds = messages.map(m => m.id);
    setReadIds(allIds);
    if (user) {
      localStorage.setItem(`read_messages_${user.id}`, JSON.stringify(allIds));
    }
  };

  const handleMessageClick = (id) => {
    // 특정 메시지 하나만 읽음 처리
    if (!readIds.includes(id)) {
      const newReadIds = [...readIds, id];
      setReadIds(newReadIds);
      if (user) {
        localStorage.setItem(`read_messages_${user.id}`, JSON.stringify(newReadIds));
      }
    }
    setIsOpen(false);
  };

  if (!user || (!['ASSEMBLY', 'MINISTER', 'TEACHER'].includes(role?.role))) {
    return null; // 대상자가 아니면 렌더링 안함
  }

  return (
    <div className={styles.inboxContainer} ref={dropdownRef}>
      <button 
        className={`${styles.bellBtn} ${unreadCount > 0 ? styles.hasUnread : ''}`}
        onClick={handleToggle}
        title="쪽지함"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className={styles.badge}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className={styles.dropdown}>
          <div className={styles.dropdownHeader}>
            <h3>쪽지함</h3>
            {unreadCount > 0 && (
              <button className={styles.markReadBtn} onClick={handleMarkAllRead}>
                모두 읽음 처리
              </button>
            )}
          </div>
          
          <div className={styles.dropdownBody}>
            {messages.length === 0 ? (
              <div className={styles.emptyState}>수신된 쪽지가 없습니다.</div>
            ) : (
              messages.map(msg => {
                const isUnread = !readIds.includes(msg.id);
                return (
                  <Link 
                    href={msg.link} 
                    key={msg.id} 
                    className={`${styles.messageCard} ${isUnread ? styles.unread : ''}`}
                    onClick={() => handleMessageClick(msg.id)}
                  >
                    <div className={styles.msgHeader}>
                      <span className={`${styles.msgType} ${msg.type === 'ASSEMBLY' ? styles.typeAssembly : styles.typeMinister}`}>
                        {msg.typeLabel}
                      </span>
                      <span className={styles.msgDate}>
                        {new Date(msg.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <h4 className={styles.msgTitle}>{msg.title}</h4>
                    <p className={styles.msgDesc}>{msg.desc}</p>
                  </Link>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
