import { supabaseAdmin as db } from '@/lib/supabase-admin';
import { applyOperation, createLesson, studentView } from '@/lib/history/state.mjs';

const json=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
async function identity(request) {
  const token=request.headers.get('authorization')?.match(/^Bearer (.+)$/)?.[1];
  if(!token) throw Error('401:로그인이 필요합니다.');
  const {data,error}=await db.auth.getUser(token);
  if(error || !data.user) throw Error('401:로그인이 만료되었습니다.');
  const {data:profile}=await db.from('users').select('id,name,role').eq('id',data.user.id).single();
  if(!profile) throw Error('403:기존 학급 계정을 찾지 못했습니다.');
  return profile;
}
async function lesson(id,user) {
  if(!/^[\da-f-]{36}$/i.test(id || '')) throw Error('400:수업 ID가 올바르지 않습니다.');
  const {data,error}=await db.from('history_sessions').select('*').eq('id',id).single();
  if(error || !data) throw Error('404:수업을 찾을 수 없습니다. DB 설정도 확인해 주세요.');
  const teacher=data.teacher_id===user.id && user.role==='TEACHER';
  if(!teacher){const {data:member}=await db.from('history_members').select('user_id').eq('session_id',id).eq('user_id',user.id).maybeSingle();if(!member)throw Error('403:이 학급 수업에 접근할 수 없습니다.');}
  if(!teacher&&data.state.distributed===false)throw Error('403:선생님이 아직 배포하지 않았거나 배포를 중단한 수업입니다.');
  return {...data,teacher};
}
function report(error) {
  const match=error.message?.match(/^(\d{3}):(.*)$/s);
  return json({error:match?.[2] || error.message || '요청을 처리하지 못했습니다.'},match?Number(match[1]):error.message?.startsWith('CONFLICT:')?409:400);
}
export async function GET(request) {
  try {
    const user=await identity(request);
    const id=new URL(request.url).searchParams.get('session');
    if(id){const row=await lesson(id,user);return json({id:row.id,title:row.title,classId:row.class_id,teacher:row.teacher,revision:row.revision,state:row.teacher?row.state:studentView(row.state,user.id)});}
    let query=db.from('history_sessions').select('id,title,class_id,created_at,distributed:state->distributed').order('created_at',{ascending:false});
    if(user.role==='TEACHER') query=query.eq('teacher_id',user.id);
    else {
      const {data,error}=await db.from('history_members').select('session_id').eq('user_id',user.id);
      if(error) throw Error('역사 수업 DB가 준비되지 않았습니다. history_init.sql을 적용해 주세요.');
      query=query.in('id',(data || []).map(x=>x.session_id));
    }
    const {data,error}=await query;
    if(error) throw Error('역사 수업 DB가 준비되지 않았습니다. history_init.sql을 적용해 주세요.');
    let roster=[];
    if(user.role==='TEACHER') {const r=await db.from('users').select('id,name,student_number').neq('role','TEACHER').order('student_number');if(r.error)throw Error('학생 명단을 읽지 못했습니다.');roster=r.data;}
    return json({sessions:data.filter(s=>user.role==='TEACHER'||s.distributed!==false).map(s=>({...s,distributed:s.distributed!==false})),roster});
  }catch(error){return report(error);}
}
export async function POST(request) {
  try {
    const user=await identity(request);
    const body=await request.json();
    if(body.type==='create') {
      if(user.role!=='TEACHER') throw Error('403:교사만 수업을 만들 수 있습니다.');
      if(!Array.isArray(body.students) || body.students.length!==16 || new Set(body.students).size!==16) throw Error('16명의 기존 학생을 선택해 주세요.');
      const {data:roster,error}=await db.from('users').select('id,name,role').in('id',body.students);
      if(error || roster?.length!==16 || roster.some(x=>x.role==='TEACHER')) throw Error('학생 배정을 확인해 주세요.');
      const ordered=body.students.map(id=>roster.find(x=>x.id===id));
      // The existing app has one global class roster. Keep a stable teacher-owned namespace across runs.
      const {data,error:insertError}=await db.from('history_sessions').insert({class_id:user.id,teacher_id:user.id,title:typeof body.title==='string'?body.title.trim() || '역사 탐구 수업':'역사 탐구 수업',state:{...createLesson(ordered),distributed:false}}).select('id').single();
      if(insertError) throw Error('수업을 생성하지 못했습니다. DB 마이그레이션을 확인해 주세요.');
      const {error:memberError}=await db.from('history_members').insert(ordered.map(s=>({session_id:data.id,user_id:s.id})));
      if(memberError){await db.from('history_sessions').delete().eq('id',data.id);throw Error('수업 명단 저장에 실패했습니다. 다시 시도해 주세요.');}
      return json({id:data.id});
    }
    if(body.type==='delete') {
      const row=await lesson(body.session,user);
      if(!row.teacher)throw Error('403:수업을 만든 교사만 삭제할 수 있습니다.');
      const {data,error}=await db.from('history_sessions').delete().eq('id',row.id).eq('teacher_id',user.id).eq('revision',row.revision).select('id');
      if(error)throw Error('수업을 삭제하지 못했습니다.');
      if(!data?.length)throw Error('409:수업 기록이 변경되었습니다. 확인 후 다시 삭제해 주세요.');
      return json({deleted:row.id});
    }
    // Compare-and-swap makes concurrent requests atomic without process-local locks.
    for(let attempt=0;attempt<8;attempt++) {
      const row=await lesson(body.session,user);
      const state=applyOperation(row.state,user.id,row.teacher,body.operation);
      const {data,error}=await db.from('history_sessions').update({state,revision:row.revision+1}).eq('id',row.id).eq('revision',row.revision).select('revision').maybeSingle();
      if(error) throw Error('저장하지 못했습니다. 로컬 초안은 유지됩니다.');
      if(data)return json({revision:data.revision,state:row.teacher?state:studentView(state,user.id)});
    }
    throw Error('409:동시에 많은 변경이 있었습니다. 초안을 보존했으니 다시 저장해 주세요.');
  }catch(error){return report(error);}
}
