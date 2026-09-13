'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import { supabase } from '@/lib/supabase';
import { ACTIVITIES, GROUPS, PATHS, REACTIONS, STEPS, pathById, readiness } from '@/lib/history/content.mjs';
import { applyOperation, createLesson, studentView } from '@/lib/history/state.mjs';
import styles from './HistoryClassroom.module.css';

const Scene=dynamic(()=>import('./HistoryScene'),{ssr:false,loading:()=> <p>가벼운 3D 장면을 준비하고 있어요…</p>});
const draftOf=s=>({notes:s.notes,diary:{answers:s.diary.answers,text:s.diary.text},feedbackDraft:s.feedbackDraft,research:s.research || {}});
async function request(body,query='') {
  const {data:{session}}=await supabase.auth.getSession();
  const response=await fetch(`/api/history${query}`,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',Authorization:`Bearer ${session?.access_token || ''}`},...(body?{body:JSON.stringify(body)}:{})});
  const data=await response.json();
  if(!response.ok)throw Error(data.error || '연결하지 못했습니다.');
  return data;
}
const previewRoster=()=>Array.from({length:16},(_,i)=>({id:`preview-${i}`,name:`학생 ${String(i+1).padStart(2,'0')}`}));

export default function HistoryClassroom({user,teacher,previewOnly=false}) {
  const [sessions,setSessions]=useState([]),[roster,setRoster]=useState([]),[selected,setSelected]=useState([]);
  const [sessionId,setSessionId]=useState(''),[row,setRow]=useState(null),[error,setError]=useState(''),[status,setStatus]=useState('연결 확인 중');
  const [preview,setPreview]=useState(()=>previewOnly?createLesson(previewRoster()):null),[previewId,setPreviewId]=useState('preview-0');
  const [draft,setDraft]=useState(null),[conflict,setConflict]=useState(false);
  const pending=useRef(null),queue=useRef(Promise.resolve()),rowRef=useRef(null),saveTimer=useRef(null),polling=useRef(false),previewRef=useRef(preview);
  const key=`history:${user.id}:${sessionId}`;
  useEffect(()=>{if(previewOnly)return;request().then(data=>{setSessions(data.sessions);setRoster(data.roster);setStatus('연결됨');}).catch(e=>{setError(e.message);setStatus('설정 확인 필요');});},[previewOnly]);
  const receive=useCallback(data=>{
    rowRef.current=data;setRow(data);
    if(data.state.me && !pending.current) setDraft(draftOf(data.state.me));
  },[]);
  const serialized=useCallback(task=>{
    const result=queue.current.then(task);queue.current=result.catch(()=>{});return result;
  },[]);
  const flush=useCallback(()=>serialized(async()=>{
    const item=pending.current;if(!item || item.conflict)return;
    setStatus('저장 중');
    try {
      const data=await request({session:sessionId,operation:{id:item.id,type:'draft',base:item.base,draft:item.draft}});
      if(pending.current===item){pending.current=null;localStorage.removeItem(key);setConflict(false);}
      else if(pending.current) {
        pending.current.base=data.state.me.revision;
        for(const [id,r] of Object.entries(pending.current.draft.research || {})) {
          if(r.base===(item.draft.research || {})[id]?.base && data.state.me.research?.[id])r.base=data.state.me.research[id].base;
        }
        localStorage.setItem(key,JSON.stringify(pending.current));
      }
      receive({...rowRef.current,...data});setStatus(pending.current?'저장 대기':'저장됨');
    } catch(e) {
      if(e.message.startsWith('CONFLICT:')){item.conflict=true;setConflict(true);setError(e.message);}
      setStatus('로컬 초안 보관 · 서버 저장 대기');throw e;
    }
  }),[serialized,sessionId,key,receive]);
  const operate=useCallback(async operation=>{
    setError('');
    try {
      if(previewRef.current) {
        let next=applyOperation(previewRef.current,previewId,true,{id:crypto.randomUUID(),...operation},true);
        const s=next.students[previewId];
        if(s.command && s.command.sequence>s.ack) next=applyOperation(next,previewId,false,{id:crypto.randomUUID(),type:'ack',sequence:s.command.sequence},true);
        previewRef.current=next;setPreview(next);setDraft(draftOf(next.students[previewId]));return;
      }
      if(pending.current?.conflict)throw Error('보존된 로컬 초안과 서버 기록의 충돌을 먼저 해결해 주세요.');
      await flush();
      await serialized(async()=>{
        const data=await request({session:sessionId,operation:{id:crypto.randomUUID(),...operation}});
        receive({...rowRef.current,...data});setStatus('저장됨');
      });
    }catch(e){setError(e.message);}
  },[flush,serialized,sessionId,receive,previewId]);
  useEffect(()=>{
    if(!sessionId || preview)return;
    let stopped=false;
    const poll=async()=>{
      if(polling.current)return;polling.current=true;
      try {
        const data=await request(null,`?session=${sessionId}`);if(stopped)return;
        if(!rowRef.current) {
          try {const stored=JSON.parse(localStorage.getItem(key));if(stored){pending.current=stored;setDraft(stored.draft);setStatus('로컬 초안 복원');}}catch{setError('로컬 초안을 읽지 못했습니다.');}
        }
        receive(data);
        const me=data.state.me;
        if(me?.command && me.command.sequence>me.ack) {
          try{await flush();}catch(e){setError(e.message);}
          await serialized(async()=>{
            const updated=await request({session:sessionId,operation:{id:`ack-${user.id}-${me.command.sequence}`,type:'ack',sequence:me.command.sequence}});
            if(!stopped)receive({...data,...updated});
          });
        } else if(pending.current && !pending.current.conflict) await flush();
        if(!pending.current)setStatus('저장됨');
      }catch(e){if(!stopped){setStatus('연결이 끊겨 임시 저장 중');setError(e.message);}}finally{polling.current=false;}
    };
    poll();const timer=setInterval(poll,1100);
    const online=()=>poll();window.addEventListener('online',online);
    return()=>{stopped=true;clearInterval(timer);window.removeEventListener('online',online);};
  },[sessionId,preview,receive,flush,serialized,key,user.id]);
  useEffect(()=>{
    if(!sessionId || teacher || preview)return;
    const timer=setInterval(()=>{if(!pending.current)operate({type:'heartbeat'});},15000);
    return()=>clearInterval(timer);
  },[sessionId,teacher,preview,operate]);
  useEffect(()=>()=>clearTimeout(saveTimer.current),[]);
  function changeDraft(next) {
    setDraft(next);
    if(previewRef.current){
      const s=previewRef.current.students[previewId];
      const updated=applyOperation(previewRef.current,previewId,false,{id:crypto.randomUUID(),type:'draft',base:s.revision,draft:next},true);
      previewRef.current=updated;setPreview(updated);setDraft(draftOf(updated.students[previewId]));return;
    }
    const item={id:crypto.randomUUID(),base:pending.current?.base ?? rowRef.current.state.me.revision,draft:next,conflict:pending.current?.conflict || false};
    pending.current=item;
    try{localStorage.setItem(key,JSON.stringify(item));setStatus('로컬 저장 · 서버 저장 대기');}catch{setError('기기의 임시 저장 공간이 부족합니다. 화면을 닫기 전에 기록을 복사해 주세요.');}
    clearTimeout(saveTimer.current);saveTimer.current=setTimeout(()=>flush().catch(e=>setError(e.message)),500);
  }
  function startPreview(){const next=createLesson(previewRoster());previewRef.current=next;setPreview(next);setDraft(draftOf(next.students[previewId]));setError('');}
  async function create(){try{const data=await request({type:'create',students:selected,title:'한반도 구석기 시대부터 고대 국가까지'});rowRef.current=null;setSessionId(data.id);setError('');}catch(e){setError(e.message);}}
  const active=preview?{id:'preview',teacher:false,state:studentView(preview,previewId)}:row;
  return <main className={styles.root}>
    <Link href="/fieldtrip" className={styles.back}>← 수학이란 무엇인가</Link>
    <header className={styles.header}><div><div className={styles.eyebrow}>HISTORY EXPLORER · 함께 만드는 역사</div><h1>역사 탐구 교실</h1><p className={styles.muted}>작은 단서를 모아, 옛사람의 하루 속으로.</p></div><span className={styles.status} role="status">{preview?'교사 미리보기 · 저장하지 않음':status}</span></header>
    {error && <div role="alert" className={styles.error}>{error}</div>}
    {conflict && <section className={styles.notice}><strong>다른 탭의 기록과 충돌했습니다. 초안은 이 기기에 남아 있습니다.</strong><p>아래 초안을 복사한 뒤 서버 기록을 불러오고 필요한 내용을 합쳐 주세요.</p><textarea readOnly aria-label="보존된 로컬 초안" value={JSON.stringify(draft,null,2)}/><button onClick={()=>{pending.current=null;localStorage.removeItem(key);setDraft(draftOf(row.state.me));setConflict(false);setError('');}}>서버 기록 불러오기</button></section>}
    {preview && <section className={styles.notice}><strong>교사용 기능 미리보기 — 역사 시각 자료 제작·검수가 남아 있습니다.</strong><div className={styles.row}><select aria-label="미리볼 배정" value={previewId} onChange={e=>{setPreviewId(e.target.value);setDraft(draftOf(preview.students[e.target.value]));}}>{Object.values(preview.students).map(s=><option key={s.id} value={s.id}>{s.name} · {pathById(s.path).title}</option>)}</select>{ACTIVITIES.map(a=><button key={a} onClick={()=>operate({type:'move',targets:[previewId],activity:a})}>{a}</button>)}<button onClick={()=>operate({type:'publish'})}>메모 공개</button><button onClick={()=>operate({type:'reveal'})}>배정 공개</button><button onClick={()=>operate({type:'assignFeedback'})}>피드백 배정</button><button onClick={()=>operate({type:'approve'})}>피드백한 맵 승인</button>{!previewOnly && <button onClick={()=>{previewRef.current=null;setPreview(null);setDraft(null);}}>미리보기 닫기</button>}</div></section>}
    {!sessionId && !preview ? <>
      <section className={styles.hero}><div><div className={styles.eyebrow} style={{color:'#b9cfb9'}}>우리의 탐구 · 40분</div><h2>아주 오래전, 나는 어떻게 살았을까?</h2><p>그림을 관찰하고, 유물을 조사하고, 당시 사람의 처지에서 일기를 써 보세요.<br/>친구의 생각을 읽으면 또 다른 역사 탐구가 열립니다.</p></div><div className={styles.seal}>관찰<br/><small style={{fontSize:13}}>에서 이해로</small></div></section>
      <div className={styles.steps}>{['01 관찰 · 5분','02 조사 · 8분','03 추체험 · 12분','04 일기 · 7분','05 피드백 · 5분','06 정리 · 3분'].map(a=><span key={a}>{a}</span>)}</div>
      <div className={styles.layout}><section className={styles.panel}><h2>{teacher?'수업 준비':'나의 수업'}</h2>{sessions.length? sessions.map(s=><div key={s.id} className={styles.row}><button className={styles.primary} onClick={()=>{rowRef.current=null;setSessionId(s.id);}}>{s.title} →</button><span className={styles.muted}>{new Date(s.created_at).toLocaleDateString('ko-KR')}</span></div>):<p>아직 배정된 역사 수업이 없습니다.</p>}
      {teacher && <><div className={styles.row}><button onClick={startPreview}>16개 배정 기능 미리보기</button></div><h3>기존 학생 16명 선택 · {selected.length}/16</h3><p className={styles.muted}>선택 순서대로 1-A부터 4-D까지 배정됩니다. 별도 학생 계정을 만들지 않습니다.</p><div className={styles.roster}>{roster.map(s=><label key={s.id}><input type="checkbox" checked={selected.includes(s.id)} onChange={e=>setSelected(e.target.checked?[...selected,s.id]:selected.filter(id=>id!==s.id))}/>{s.student_number}. {s.name}{selected.includes(s.id)&&<small>{PATHS[selected.indexOf(s.id)]?.id}</small>}</label>)}</div><button className={styles.primary} disabled={selected.length!==16} onClick={create}>이 배정으로 수업 만들기</button></>}
      </section><aside className={styles.panel}><span className={styles.badge}>학생 노트북 기준</span><h3 style={{marginTop:14}}>가볍게, 차근차근</h3><p className={styles.muted}>i5 13세대 · 메모리 16GB<br/>Iris Xe · 1920 × 1080<br/>필요할 때만 3D 불러오기<br/>그림자·후처리 없는 기본 모드</p>{teacher&&<details open><summary>수업 사용 전 확인</summary>{readiness().map(t=><p className={styles.muted} key={t}>{t}</p>)}</details>}</aside></div>
    </>:active ? <>
      {!preview && <div className={styles.row}><button onClick={()=>{if(pending.current){setError('초안 저장 후 수업 목록으로 돌아갈 수 있습니다.');return;}setSessionId('');setRow(null);rowRef.current=null;}}>수업 목록</button><span className={styles.muted}>{row?.title}</span></div>}
      {active.teacher?<TeacherBoard state={active.state} operate={operate}/>:<StudentWorkspace key={active.state.me.id} state={active.state} draft={draft || draftOf(active.state.me)} change={changeDraft} operate={operate} preview={!!preview}/>}
    </>:<p>수업 기록을 불러오고 있어요…</p>}
  </main>;
}

function TeacherBoard({state,operate}) {
  const [now,setNow]=useState(()=>Date.now());
  useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),5000);return()=>clearInterval(timer);},[]);
  const [targets,setTargets]=useState([]),[activity,setActivity]=useState('관찰'),[inspect,setInspect]=useState('');
  const students=Object.values(state.students);
  const student=state.students[inspect];
  return <><div className={styles.notice}><strong>준비 상태: 시각 자료 검수 대기</strong>{readiness().map(t=><p key={t}>{t}</p>)}</div><section className={styles.panel}><h2>수업 진행</h2><div className={styles.row}><button onClick={()=>operate({type:'reveal'})}>지정한 모둠·주제 공개</button><button onClick={()=>operate({type:'publish'})}>관찰 메모 전체 공개</button><button onClick={()=>operate({type:'assignFeedback'})}>피드백 대상 배정 / 재배정</button><button className={styles.primary} onClick={()=>operate({type:'approve'})}>피드백한 맵 열기(전체 승인)</button></div><div className={styles.row}><select aria-label="이동할 활동" value={activity} onChange={e=>setActivity(e.target.value)}>{ACTIVITIES.map(a=><option key={a}>{a}</option>)}</select><button onClick={()=>operate({type:'move',activity,targets:students.map(s=>s.id)})}>전체 학생 보내기</button><button disabled={!targets.length} onClick={()=>operate({type:'move',activity,targets})}>선택한 {targets.length}명 보내기</button></div><p className={styles.muted}>현재 입력을 보존하고 지정한 활동으로 이동합니다. 미체험 단서는 보충으로 제공하며 퀘스트 완료로 처리하지 않습니다.</p></section>
    <section className={styles.panel}><h2>학생별 진행</h2><div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>선택</th><th>학생</th><th>개인 주제</th><th>활동</th><th>명령 수신</th><th>연결</th><th>체험</th><th>해금</th><th>기록</th></tr></thead><tbody>{students.map(s=><tr key={s.id}><td><input type="checkbox" aria-label={`${s.name} 선택`} checked={targets.includes(s.id)} onChange={e=>setTargets(e.target.checked?[...targets,s.id]:targets.filter(id=>id!==s.id))}/></td><td>{s.name}</td><td>{s.path} {pathById(s.path).title}</td><td>{s.activity}</td><td>{s.command?.sequence>s.ack?'미수신':'적용됨'}</td><td>{s.lastSeen && now-Date.parse(s.lastSeen)<30000?'연결됨':'응답 대기'}</td><td>{s.attempts[s.path]?.complete?'완료':s.attempts[s.path]?.interrupted?'중단':'미완료'}</td><td>{s.grants.length}개</td><td><button onClick={()=>setInspect(s.id)}>열람</button></td></tr>)}</tbody></table></div></section>
    {student && <section className={styles.panel}><h2>{student.name}의 연결 기록</h2><p>{student.path} · {pathById(student.path).title}</p><h3>관찰</h3>{student.notes.map(n=><p key={n.id}>{n.kind}: {n.text}</p>)}<h3>조사</h3>{Object.values(state.cards).filter(c=>c.owner===student.id || c.helpers.includes(student.id)).map(c=><p key={c.id}>{c.name || '명칭 미입력'} — {c.usage || '쓰임 미입력'} / 출처: {c.source || '미기입'} / {c.status}</p>)}<h3>퀘스트</h3><p>{student.attempts[student.path]?.checkpoint || 0}/{STEPS.length} · {student.attempts[student.path]?.mode || '미시작'}</p><h3>일기 선택 · 감정과 생각</h3>{pathById(student.path).questions.map(q=><p key={q.id}>{q.prompt} {q.options[student.diary.answers[q.id]] || '미입력'}</p>)}<p style={{whiteSpace:'pre-wrap'}}>{student.diary.text || '작성 내용 없음'}</p><h3>받은 / 남긴 피드백</h3>{Object.values(state.feedback).filter(f=>f.author===student.id || f.recipient===student.id).map(f=><p key={f.author}>{state.students[f.author].name} → {state.students[f.recipient].name}: {f.reaction} {f.text || '작성 내용 없음'} · {f.approved?'승인됨':'승인 전'}</p>)}</section>}
  </>;
}

function StudentWorkspace({state,draft,change,operate,preview}) {
  const s=state.me,path=pathById(s.path),[note,setNote]=useState(null),[noteKind,setNoteKind]=useState('보이는 것'),[activePath,setActivePath]=useState(s.path);
  const activity=s.activity;
  const currentPath=pathById(activePath),attempt=s.attempts[activePath];
  const target=state.diaries.find(d=>d.id===s.target?.recipient),version=target?.versions.find(v=>v.version===s.target.version);
  const ownFeedback=state.feedback.find(f=>f.author===s.id);
  return <><div className={styles.steps}>{ACTIVITIES.map((a,i)=><span key={a} className={a===activity?styles.active:''}>{String(i+1).padStart(2,'0')} {a==='3D'?'추체험':a}</span>)}</div>
    <div className={styles.layout}><div>
      {activity==='준비' && <section className={styles.hero}><div><span className={styles.badge}>수업 준비</span><h2 style={{marginTop:18}}>단서를 발견할 준비가 되었나요?</h2><p>선생님이 수업을 시작하면 네 장의 그림이 함께 열립니다.</p>{state.revealed && <h3>{s.group}모둠 · {path.title}</h3>}</div><div className={styles.seal}>나의<br/>발견</div></section>}
      {activity==='관찰' && <><h2>자세히 보면, 이야기가 보여요</h2><p className={styles.muted}>그림을 눌러 메모를 남기세요. 휠로 확대하고 드래그로 이동할 수 있어요.</p><div className={styles.row}>{['보이는 것','궁금한 것','내 생각·추측'].map(k=><button key={k} aria-pressed={noteKind===k} className={noteKind===k?styles.primary:''} onClick={()=>setNoteKind(k)}>{k}</button>)}</div><div className={styles.grid}>{GROUPS.map((g,i)=><Observation key={g} index={i+1} notes={state.notes} onPin={n=>{setNote({...n,readOnly:!!n.author && n.author!==s.name});if(n.kind)setNoteKind(n.kind);}}/>)}</div>{note&&<section className={styles.panel} style={{marginTop:18}}><h3>그림 {note.image} · {noteKind}</h3><textarea aria-label="관찰 메모" readOnly={note.readOnly} placeholder={noteKind==='보이는 것'?'예: 사람들이 모여 있어요.':noteKind==='궁금한 것'?'예: 저 물건은 어디에 쓸까요?':'예: 함께 일하는 것 같아요.'} value={note.readOnly?note.text:draft.notes.find(n=>n.id===note.id)?.text || ''} onChange={e=>{const n={...note,kind:noteKind,text:e.target.value};change({...draft,notes:[...draft.notes.filter(x=>x.id!==note.id),n]});}}/><button onClick={()=>setNote(null)}>메모 접기</button></section>}<section className={styles.panel}><h3>{state.published?'우리 반의 발견':'나의 발견'}</h3>{state.notes.map(n=><p className={styles.note} key={n.id}><span className={styles.badge}>{n.kind}</span> {n.text} <small>{n.author}</small></p>)}</section></>}
      {activity==='조사' && <><h2>유물이 들려주는 이야기</h2><p className={styles.muted}>자기 모둠의 그림에서 유물을 골라 명칭과 쓰임을 조사해요. 기본 2개, 먼저 마치면 친구를 도와요.</p><div className={styles.notice}>검수된 탐구 그림·유물 사진이 아직 연결되지 않았습니다. 아래 카드는 기능 확인용입니다.</div><Observation index={s.group} notes={[]} onPin={()=>{}}/><div className={styles.grid} style={{marginTop:18}}>{path.artifacts.map((a,i)=><ResearchCard key={a} artifact={a} index={i+1} card={state.cards.find(c=>c.artifact===a)} research={draft.research || {}} changeResearch={(id,r)=>change({...draft,research:{...draft.research,[id]:r}})} operate={operate}/>)}</div><h3>우리 모둠 공동보드</h3>{state.cards.map(c=><ResearchCard key={c.id} artifact={c.artifact} card={c} research={draft.research || {}} changeResearch={(id,r)=>change({...draft,research:{...draft.research,[id]:r}})} operate={operate}/>)}</>}
      {activity==='3D' && <><h2>{currentPath.title} · 개인 추체험</h2><div className={styles.row}><select aria-label="승인된 체험 맵" value={activePath} onChange={e=>setActivePath(e.target.value)}>{[...new Set([s.path,...s.grants])].map(id=><option key={id} value={id}>{pathById(id).title}{id===s.path?' · 나의 배정':' · 승인된 추가 체험'}</option>)}</select></div><Experience key={activePath} path={currentPath} attempt={attempt} operate={operate} preview={preview}/>{s.attempts[s.path]?.complete && <button className={styles.primary} onClick={()=>operate({type:'enterDiary'})}>나의 역사 일기 쓰기 →</button>}</>}
      {activity==='일기' && <><h2>그날의 하루를 써 볼까요?</h2><p className={styles.muted}>{path.title} · {path.role}의 처지에서 생각해요.</p><section className={styles.diary}>{path.questions.map(q=><label key={q.id}>{q.prompt}<select value={draft.diary.answers[q.id] ?? ''} onChange={e=>{const answers={...draft.diary.answers};if(e.target.value==='')delete answers[q.id];else answers[q.id]=Number(e.target.value);change({...draft,diary:{...draft.diary,answers}});}}><option value="">역사 문장 선택</option>{q.options.map((o,i)=><option key={o} value={i}>{o}</option>)}</select>{draft.diary.answers[q.id]!==undefined && draft.diary.answers[q.id]!==q.answer && <span className={styles.clue}>단서를 다시 살펴봐요: {q.hint}</span>}</label>)}<p>{path.situation}</p><label>이 상황에서 나의 감정이나 생각<textarea placeholder="그때의 나였다면 어떤 생각이 들까요?" value={draft.diary.text} onChange={e=>change({...draft,diary:{...draft.diary,text:e.target.value}})}/></label><button className={styles.primary} onClick={()=>operate({type:'diary'})}>일기 공유하기</button><p className={styles.muted}>공유한 버전 {s.diary.versions.length}개 · 수정하면 새 버전으로 보존됩니다.</p></section></>}
      {activity==='피드백' && <><h2>친구의 하루에 답장을 보내요</h2>{version?<section className={styles.panel}><span className={styles.badge}>{target.name} · {pathById(target.path).title} · 일기 v{version.version}</span>{pathById(target.path).questions.map(q=><p key={q.id}>{q.prompt} {q.options[version.answers[q.id]] || '미입력'}</p>)}<p className={styles.quote} style={{whiteSpace:'pre-wrap'}}>{version.text || '작성 내용 없음'}</p><div className={styles.row}>{REACTIONS.map(r=><button key={r} disabled={ownFeedback?.valid} aria-pressed={draft.feedbackDraft.reaction===r} className={draft.feedbackDraft.reaction===r?styles.primary:''} onClick={()=>change({...draft,feedbackDraft:{...draft.feedbackDraft,reaction:r}})}>{r}</button>)}</div><label>친구에게 남길 말<textarea disabled={ownFeedback?.valid} value={draft.feedbackDraft.text} onChange={e=>change({...draft,feedbackDraft:{...draft.feedbackDraft,text:e.target.value}})} placeholder="친구의 일기를 읽고 떠오른 말을 남겨 주세요."/></label><button className={styles.primary} disabled={ownFeedback?.valid} onClick={()=>operate({type:'feedback'})}>{ownFeedback?.approved?'맵 승인됨':ownFeedback?.valid?'제출 완료 · 교사 승인 대기':'피드백 제출하기'}</button><p className={styles.muted}>선생님이 승인하면 피드백한 친구의 개인 맵이 열립니다.</p></section>:<section className={styles.panel}>공유된 일기에서 피드백 대상을 배정하고 있어요. 잠시 기다려 주세요.</section>}</>}
      {activity==='정리' && <section className={styles.panel}><h2>작은 단서가 역사가 되었어요</h2><p>관찰한 모습, 조사한 유물의 쓰임, 시대의 생활을 서로 연결해 이야기해 봅시다.</p><h3>내가 받은 피드백</h3>{state.feedback.filter(f=>f.recipient===s.id).map(f=><p className={styles.note} key={f.author}>{f.reaction}<br/>{f.text}</p>)}<h3>승인된 추가 맵</h3>{s.grants.length?s.grants.map(id=><p key={id}>{pathById(id).title} · 선생님이 추체험 활동으로 보내면 들어갈 수 있어요.</p>):<p>아직 추가로 승인된 맵이 없어요.</p>}</section>}
    </div><aside><section className={styles.panel}><span className={styles.badge}>{state.revealed?`${s.group}모둠 · ${s.path}`:'나의 탐구'}</span><h3 style={{marginTop:14}}>{state.revealed?path.title:'곧 주제가 공개돼요'}</h3><p className={styles.muted}>{s.name}<br/>관찰 → 유물 → 생활 → 마음</p></section>{activity!=='준비'&&<section className={styles.panel}><h3>탐구 도움말</h3><p className={styles.muted}>보이는 사실과 내 추측을 구분해요. 정답이 떠오르지 않으면 단서를 다시 읽어도 괜찮아요.</p>{(s.supplement || ['일기','3D','피드백','정리'].includes(activity)) && <details open={s.supplement}><summary>놓친 단서 / 다시 읽기</summary>{path.clues.map((c,i)=><div className={styles.clue} key={c}><small>{s.attempts[s.path]?.seen.includes(i)?'체험에서 확인':'미체험 보충'}</small><p>{c}</p></div>)}<p className={styles.muted}>교과서 {path.pages}쪽 · 학습용으로 재구성한 설명</p></details>}</section>}</aside></div>
  </>;
}

function Observation({index,notes,onPin}) {
  const [view,setView]=useState({zoom:1,x:0,y:0});const drag=useRef(null);
  const zoom=amount=>setView(v=>({...v,zoom:Math.max(1,Math.min(5,v.zoom+amount))}));
  return <section><div className={styles.picture} role="button" tabIndex={0} aria-label={`그림 ${index} 관찰 영역. Enter로 가운데 메모 추가`} onKeyDown={e=>{if(e.key==='Enter')onPin({id:crypto.randomUUID(),image:index,x:.5,y:.5});}} onWheel={e=>zoom(e.deltaY<0?.2:-.2)} onPointerDown={e=>{if(e.target.closest('button'))return;drag.current={x:e.clientX,y:e.clientY,v:view};e.currentTarget.setPointerCapture(e.pointerId);}} onPointerMove={e=>{if(!drag.current)return;const d=drag.current;setView({...d.v,x:d.v.x+e.clientX-d.x,y:d.v.y+e.clientY-d.y});}} onPointerUp={e=>{const d=drag.current;drag.current=null;if(!d)return;if(Math.hypot(e.clientX-d.x,e.clientY-d.y)>5)return;const r=e.currentTarget.getBoundingClientRect();onPin({id:crypto.randomUUID(),image:index,x:Math.max(0,Math.min(1,(e.clientX-r.left-view.x)/(r.width*view.zoom))),y:Math.max(0,Math.min(1,(e.clientY-r.top-view.y)/(r.height*view.zoom)))});}} onPointerCancel={()=>{drag.current=null;}}><div className={styles.pictureContent} style={{transform:`translate(${view.x}px,${view.y}px) scale(${view.zoom})`}}><Image src={`/history/exploration-${index}-draft.png`} alt={`그림 ${index} · 검수용 역사 장면 초안`} fill sizes="(max-width: 1000px) 45vw, 35vw" draggable={false} style={{objectFit:'contain',pointerEvents:'none'}} loading="eager"/>{notes.filter(n=>n.image===index).map(n=><button key={n.id} className={styles.pin} style={{left:`${n.x*100}%`,top:`${n.y*100}%`}} title={`${n.kind}: ${n.text}`} onClick={e=>{e.stopPropagation();onPin(n);}}>●</button>)}</div></div><div className={styles.tools}><strong>그림 {String(index).padStart(2,'0')} <small className={styles.muted}>검수용 초안</small></strong><div><button aria-label={`그림 ${index} 축소`} onClick={()=>zoom(-.25)}>−</button><button aria-label={`그림 ${index} 확대`} onClick={()=>zoom(.25)}>＋</button><button onClick={()=>setView({zoom:1,x:0,y:0})}>초기화</button></div></div></section>;
}

function ResearchCard({artifact,index,card,research,changeResearch,operate}) {
  const [newId]=useState(()=>crypto.randomUUID());
  const id=card?.id || Object.keys(research).find(key=>research[key].artifact===artifact) || newId;
  const fields=research[id] || {artifact,name:card?.name || '',usage:card?.usage || '',source:card?.source || '',base:card?.revision || 0};
  return <section className={styles.panel}><span className={styles.badge}>조사 카드 {index || ''} · {card?.status || '작성 전'}</span><p className={styles.muted}>사진 자료 검수 대기 · 입력은 자동 저장됩니다.</p><label>정식 명칭<input value={fields.name} onChange={e=>changeResearch(id,{...fields,name:e.target.value})}/></label><label>쓰임<textarea value={fields.usage} onChange={e=>changeResearch(id,{...fields,usage:e.target.value})}/></label><label>출처 · 교과서 쪽 또는 URL<input value={fields.source} onChange={e=>changeResearch(id,{...fields,source:e.target.value})}/></label><button className={styles.primary} onClick={()=>operate({type:'submitResearch',cardId:id})}>조사 제출</button>{card && card.revision!==fields.base && <div className={styles.notice}>공동보드의 새 버전이 있습니다. 입력을 비교하고 불러오세요.<p>{card.name} / {card.usage} / {card.source}</p><button onClick={()=>changeResearch(id,{artifact,name:card.name,usage:card.usage,source:card.source,base:card.revision})}>최신 카드 불러오기</button></div>}</section>;
}

function Experience({path,attempt,operate,preview}) {
  const [alternative,setAlternative]=useState(false),[question,setQuestion]=useState(0),[choice,setChoice]=useState('');
  const step=attempt?.checkpoint || 0;
  const lines=[`${path.role}의 관점에서 주변을 살펴봅니다.`,path.clues[0],'조사 유물은 검수된 실물 자료를 연결한 뒤 자세히 볼 수 있습니다.',path.clues[1],path.clues[question],path.questions[0].prompt,path.situation];
  return <section className={styles.panel}><p className={styles.muted}>{preview?'기능 검증용 공간 · 역사 복원 장면 아님':'학습을 위한 재구성'} · 교과서 {path.pages}쪽</p><div className={styles.row}><button onClick={()=>setAlternative(v=>!v)}>{alternative?'3D 보기':'텍스트 대체 흐름 사용'}</button></div>{!alternative && <div className={styles.scene}><span className={styles.sceneLabel}>1인칭 관찰 · 드래그로 둘러보기 · 안내 이동</span><Scene step={step} onFailure={()=>setAlternative(true)}/></div>}<div className={styles.row}><span className={styles.badge}>{Math.min(step+1,STEPS.length)} / {STEPS.length}</span><h3>{STEPS[step] || '체험 완료'}</h3></div>{step===3 && <p className={styles.notice}>다른 시대 또는 상황의 장면을 살펴봅니다. 같은 사람이 수백 년을 산다는 뜻이 아니에요.</p>}<p className={styles.quote}>{[1,3,4].includes(step)?<strong>{lines[step]}</strong>:lines[step] || '기록한 단서를 바탕으로 하루를 써 볼까요?'}</p>{step===4 && <div className={styles.row}>{['생활은 어떠했나요?','무엇이 달라졌나요?'].map((q,i)=><button key={q} onClick={()=>setQuestion(i)}>{q}</button>)}</div>}{step===5 && <label>단서와 연결되는 생각<select value={choice} onChange={e=>setChoice(e.target.value)}><option value="">선택해 주세요</option>{path.questions[0].options.map(o=><option key={o}>{o}</option>)}</select>{choice && choice!==path.questions[0].options[0] && <small>다시 읽을 단서: {path.clues[0]}</small>}</label>}{step<STEPS.length && <button className={styles.primary} disabled={step===5&&!choice} onClick={()=>operate({type:'step',path:path.id,step,mode:alternative?'alternative':'3D'})}>{step===0?'안내 이동 · 관찰 마치기':step===6?'체험 기록 마치기':'읽고 다음으로 →'}</button>}{step===STEPS.length && path.group===3 && <details><summary>＋ 추가 문제</summary><p>삼국은 왜 한강 유역을 차지하려 했을까요? 교과서 33~35쪽 지도의 위치와 교류의 길을 연결해 이야기해 봅시다.</p><p>가야는 철과 교류를 바탕으로 성장했습니다. 삼국과 어떤 점이 같고 다른가요?</p></details>}</section>;
}
