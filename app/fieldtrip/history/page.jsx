'use client';

import { useAuth } from '@/components/AuthProvider';
import HistoryClassroom from '@/components/History/HistoryClassroom';
import Link from 'next/link';

export default function HistoryPage() {
  const {user,role,loading}=useAuth();
  if(loading)return <main style={{padding:40}}>학급 계정을 확인하고 있어요…</main>;
  if(!user)return <main style={{padding:40}}><h1>역사 탐구 교실</h1><p>기존 학급 계정으로 입장해 주세요.</p><Link href="/login">로그인하기 →</Link></main>;
  return <HistoryClassroom user={user} teacher={role?.role==='TEACHER'} />;
}
