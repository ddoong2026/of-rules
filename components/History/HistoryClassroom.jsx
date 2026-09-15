'use client';

import {STORIES,STORY_NOTICE,storyLines} from '@/lib/history/stories.mjs';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import { supabase } from '@/lib/supabase';
import { ACTIVITIES, PATHS, REACTIONS, STEPS, pathById, readiness } from '@/lib/history/content.mjs';
import { applyOperation, createLesson, studentView } from '@/lib/history/state.mjs';
import styles from './HistoryClassroom.module.css';
import ObservationBoard from './ObservationBoard';
import ArtifactReference from './ArtifactReference';
import {PATH_CONTEXT} from '@/lib/history/references.mjs';
import {ARTIFACT_SPOTS,explorationImage} from '@/lib/history/exploration.mjs';

const Game2D=dynamic(()=>import('./HistoryGame2D'),{ssr:false,loading:()=> <p>2D 탐험 지도를 준비하고 있어요…</p>});
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
    if(data.state.me && pending.current) {
      const item=pending.current;
      item.draft={...item.draft,notes:item.draft.notes.map(n=>{
        const server=data.state.me.notes.find(x=>x.id===n.id);
        return (server?.positionRevision||0)>(n.positionRevision||0)?{...n,noteX:server.noteX,noteY:server.noteY,boardVersion:server.boardVersion,positionRevision:server.positionRevision}:n;
      })};
      setDraft(item.draft);
      try{localStorage.setItem(key,JSON.stringify(item));}catch{setError('임시 저장 공간이 부족합니다.');}
    }
    if(data.state.me && !pending.current) setDraft(draftOf(data.state.me));
  },[key]);
  const serialized=useCallback(task=>{
    const result=queue.current.then(task);queue.current=result.catch(()=>{});return result;
  },[]);
  const flush=useCallback(()=>serialized(async()=>{
    const item=pending.current;if(!item || item.conflict || rowRef.current?.state.locked)return;
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
            const updated=await request({session:sessionId,operation:{id:`ack-${user.id}-${me.command.sequence}`,type:'ack',sequence:me.command.sequence,saveState:pending.current?(pending.current.conflict?'충돌':'저장 대기'):'저장됨'}});
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
    if((previewRef.current || rowRef.current?.state)?.locked)return;
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
  return <main className={`${styles.root} ${active?styles.inSession:''}`}>

    <header className={styles.header}><Link href="/fieldtrip" className={styles.back}>← 나가기</Link><h1>역사 탐구 교실</h1><span className={styles.status} role="status">{preview?'교사 미리보기 · 저장하지 않음':status}</span><button onClick={async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{setError('브라우저 전체화면을 열지 못했습니다. F11을 이용해 주세요.');}}}>전체화면</button></header>
    {error && <div role="alert" className={styles.error}>{error}</div>}
    {conflict && <section className={styles.notice}><strong>다른 탭의 기록과 충돌했습니다. 초안은 이 기기에 남아 있습니다.</strong><p>아래 초안을 복사한 뒤 서버 기록을 불러오고 필요한 내용을 합쳐 주세요.</p><textarea readOnly aria-label="보존된 로컬 초안" value={JSON.stringify(draft,null,2)}/><button onClick={()=>{pending.current=null;localStorage.removeItem(key);setDraft(draftOf(row.state.me));setConflict(false);setError('');}}>서버 기록 불러오기</button></section>}
    {preview && <details className={styles.previewControls}><summary>교사 도구 · 활동 전환</summary><strong>교사용 기능 미리보기 — 역사 시각 자료 검수 대기</strong><div className={styles.row}><select aria-label="미리볼 배정" value={previewId} onChange={e=>{setPreviewId(e.target.value);setDraft(draftOf(preview.students[e.target.value]));}}>{Object.values(preview.students).map(s=><option key={s.id} value={s.id}>{s.name} · {pathById(s.path).title}</option>)}</select>{ACTIVITIES.map(a=><button key={a} onClick={()=>operate({type:'move',targets:[previewId],activity:a})}>{a==='3D'?'2D 체험·일기':a}</button>)}<button aria-pressed={!!preview.locked} onClick={()=>operate({type:'lock',locked:!preview.locked})}>{preview.locked?'학생 조작 다시 시작':'전체 학생 조작 멈춤'}</button><button onClick={()=>operate({type:'publish'})}>메모 전체 공개</button><button aria-pressed={!!(preview.liveNotes??preview.published)} onClick={()=>operate({type:'noteVisibility',mode:(preview.liveNotes??preview.published)?'hidden':'live'})}>메모 실시간 공개 {(preview.liveNotes??preview.published)?'끄기':'켜기'}</button><button onClick={()=>operate({type:'noteVisibility',mode:'hidden'})}>친구 메모 숨김</button><button onClick={()=>operate({type:'reveal'})}>배정 공개</button><button onClick={()=>operate({type:'assignFeedback'})}>피드백 배정</button><button onClick={()=>operate({type:'approve'})}>피드백한 맵 승인</button>{!previewOnly && <button onClick={()=>{previewRef.current=null;setPreview(null);setDraft(null);}}>미리보기 닫기</button>}</div></details>}
    {!sessionId && !preview ? <>
      <section className={styles.hero}><div><div className={styles.eyebrow} style={{color:'#b9cfb9'}}>우리의 탐구 · 40분</div><h2>아주 오래전, 나는 어떻게 살았을까?</h2><p>그림을 관찰하고, 유물을 조사하고, 당시 사람의 처지에서 일기를 써 보세요.<br/>친구의 생각을 읽으면 또 다른 역사 탐구가 열립니다.</p></div><div className={styles.seal}>관찰<br/><small style={{fontSize:13}}>에서 이해로</small></div></section>
      <div className={styles.steps}>{['01 관찰 · 5분','02 조사 · 8분','03 체험·일기 · 19분','04 피드백 · 5분','05 정리 · 3분'].map(a=><span key={a}>{a}</span>)}</div>
      <div className={styles.layout}><section className={styles.panel}><h2>{teacher?'수업 준비':'나의 수업'}</h2>{sessions.length? sessions.map(s=><div key={s.id} className={styles.row}><button className={styles.primary} onClick={()=>{rowRef.current=null;setSessionId(s.id);}}>{s.title} →</button><span className={styles.muted}>{new Date(s.created_at).toLocaleDateString('ko-KR')}</span></div>):<p>아직 배정된 역사 수업이 없습니다.</p>}
      {teacher && <><div className={styles.row}><button onClick={startPreview}>16개 배정 기능 미리보기</button></div><h3>기존 학생 16명 선택 · {selected.length}/16</h3><p className={styles.muted}>선택 순서대로 1-A부터 4-D까지 배정됩니다. 별도 학생 계정을 만들지 않습니다.</p><div className={styles.roster}>{roster.map(s=><label key={s.id}><input type="checkbox" checked={selected.includes(s.id)} onChange={e=>setSelected(e.target.checked?[...selected,s.id]:selected.filter(id=>id!==s.id))}/>{s.student_number}. {s.name}{selected.includes(s.id)&&<small>{PATHS[selected.indexOf(s.id)]?.id}</small>}</label>)}</div><button className={styles.primary} disabled={selected.length!==16} onClick={create}>이 배정으로 수업 만들기</button></>}
      </section><aside className={styles.panel}><span className={styles.badge}>학생 노트북 기준</span><h3 style={{marginTop:14}}>가볍게, 차근차근</h3><p className={styles.muted}>i5 13세대 · 메모리 16GB<br/>Iris Xe · 1920 × 1080<br/>스프라이트 기반 2D 탐험<br/>키보드·화면 버튼 이동</p>{teacher&&<details open><summary>수업 사용 전 확인</summary>{readiness().map(t=><p className={styles.muted} key={t}>{t}</p>)}</details>}</aside></div>
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
  return <><div className={styles.notice}><strong>준비 상태: 시각 자료 검수 대기</strong>{readiness().map(t=><p key={t}>{t}</p>)}</div><section className={styles.panel}><h2>수업 진행</h2><div className={styles.row}><button aria-pressed={!!state.locked} onClick={()=>operate({type:'lock',locked:!state.locked})}>{state.locked?'학생 조작 다시 시작':'전체 학생 조작 멈춤'}</button><button onClick={()=>operate({type:'reveal'})}>지정한 모둠·주제 공개</button><button onClick={()=>operate({type:'publish'})}>메모 전체 공개</button><button aria-pressed={!!(state.liveNotes??state.published)} onClick={()=>operate({type:'noteVisibility',mode:(state.liveNotes??state.published)?'hidden':'live'})}>메모 실시간 공개 {(state.liveNotes??state.published)?'끄기':'켜기'}</button><button onClick={()=>operate({type:'noteVisibility',mode:'hidden'})}>친구 메모 숨김</button><button onClick={()=>operate({type:'assignFeedback'})}>피드백 대상 배정 / 재배정</button><button className={styles.primary} onClick={()=>operate({type:'approve'})}>피드백한 맵 열기(전체 승인)</button></div><div className={styles.row}><select aria-label="이동할 활동" value={activity} onChange={e=>setActivity(e.target.value)}>{ACTIVITIES.map(a=><option key={a} value={a}>{a==='3D'?'2D 체험·일기':a}</option>)}</select><button onClick={()=>operate({type:'move',activity,targets:students.map(s=>s.id)})}>전체 학생 보내기</button><button disabled={!targets.length} onClick={()=>operate({type:'move',activity,targets})}>선택한 {targets.length}명 보내기</button></div><p className={styles.muted}>현재 입력을 보존하고 지정한 활동으로 이동합니다. 미체험 단서는 보충으로 제공하며 퀘스트 완료로 처리하지 않습니다.</p></section>
    <details open className={styles.panel}><summary>실시간 전체 관찰 메모 · 교사가 위치 옮기기</summary><div className={styles.teacherObservation}><ObservationBoard state={{published:state.published,notes:students.flatMap(s=>s.notes.map(n=>({...n,author:s.name,authorId:s.id})))}} draft={{notes:[]}} onMoveNote={(note,patch)=>operate({type:'moveNote',owner:note.authorId,noteId:note.id,...patch})}/></div></details><section className={styles.panel}><h2>학생별 진행</h2><div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>선택</th><th>학생</th><th>개인 주제</th><th>활동</th><th>명령 수신</th><th>저장</th><th>연결</th><th>체험</th><th>해금</th><th>기록</th></tr></thead><tbody>{students.map(s=><tr key={s.id}><td><input type="checkbox" aria-label={`${s.name} 선택`} checked={targets.includes(s.id)} onChange={e=>setTargets(e.target.checked?[...targets,s.id]:targets.filter(id=>id!==s.id))}/></td><td>{s.name}</td><td>{s.path} {pathById(s.path).title}</td><td>{s.activity==='3D'?'2D 체험·일기':s.activity}</td><td>{s.command?.sequence>s.ack?'미수신':'적용됨'}</td><td>{s.saveState || '미작성'}</td><td>{s.lastSeen && now-Date.parse(s.lastSeen)<30000?'연결됨':'응답 대기'}</td><td>{s.attempts[s.path]?.complete?'완료':s.attempts[s.path]?.interrupted?'중단':'미완료'}</td><td>{s.grants.length}개</td><td><button onClick={()=>setInspect(s.id)}>열람</button></td></tr>)}</tbody></table></div></section>
    {student && <section className={styles.panel}><h2>{student.name}의 연결 기록</h2><p>{student.path} · {pathById(student.path).title}</p><h3>관찰</h3>{student.notes.map(n=><p key={n.id}>{n.kind}: {n.text}</p>)}<h3>조사</h3>{Object.values(state.cards).filter(c=>c.owner===student.id || c.helpers.includes(student.id)).map(c=><p key={c.id}>{c.name || '명칭 미입력'} — {c.usage || '쓰임 미입력'} / 출처: {c.source || '미기입'} / {c.status}</p>)}<h3>퀘스트</h3><p>{student.attempts[student.path]?.checkpoint || 0}/{STEPS.length} · {student.attempts[student.path]?.mode || '미시작'}</p><h3>일기 선택 · 감정과 생각</h3>{pathById(student.path).questions.map(q=><p key={q.id}>{q.prompt} {q.options[student.diary.answers[q.id]] || '미입력'}</p>)}<p style={{whiteSpace:'pre-wrap'}}>{student.diary.text || '작성 내용 없음'}</p><h3>받은 / 남긴 피드백</h3>{Object.values(state.feedback).filter(f=>f.author===student.id || f.recipient===student.id).map(f=><p key={f.author}>{state.students[f.author].name} → {state.students[f.recipient].name}: {f.reaction} {f.text || '작성 내용 없음'} · {f.approved?'승인됨':'승인 전'}</p>)}</section>}
  </>;
}

function StudentWorkspace({state,draft,change,operate,preview}) {
  const s=state.me,path=pathById(s.path),[activePath,setActivePath]=useState(s.path);
  const activity=s.activity==='일기'?'3D':s.activity;
  const currentPath=pathById(activePath),attempt=s.attempts[activePath];
  const target=state.diaries.find(d=>d.id===s.target?.recipient),version=target?.versions.find(v=>v.version===s.target.version);
  const ownFeedback=state.feedback.find(f=>f.author===s.id);
  if(state.locked)return <section className={styles.notice} role="status"><h2>선생님이 조작을 잠시 멈췄어요.</h2><p>작성 중인 내용은 보관되어 있어요. 선생님이 다시 시작하면 이어서 활동할 수 있어요.</p></section>;
  if(activity==='관찰')return <ObservationBoard state={state} draft={draft} change={change}/>;
  return <><div className={styles.steps}>{ACTIVITIES.map((a,i)=><span key={a} className={a===activity?styles.active:''}>{String(i+1).padStart(2,'0')} {a==='3D'?'2D 체험·일기':a}</span>)}</div>
    <div className={styles.layout}><div>
      {activity==='준비' && <section className={styles.hero}><div><span className={styles.badge}>수업 준비</span><h2 style={{marginTop:18}}>단서를 발견할 준비가 되었나요?</h2><p>선생님이 수업을 시작하면 네 장의 그림이 함께 열립니다.</p>{state.revealed && <h3>{s.group}모둠 · {path.title}</h3>}</div><div className={styles.seal}>나의<br/>발견</div></section>}
      {activity==='조사' && <><h2>유물이 들려주는 이야기</h2>{PATH_CONTEXT[path.id]&&<p className={styles.notice}>{PATH_CONTEXT[path.id]}</p>}<p className={styles.muted}>자기 모둠의 그림에서 유물을 골라 명칭과 쓰임을 조사해요. 실물 사진은 조사 카드에서 펼쳐 볼 수 있어요.</p><div className={styles.notice}>그림 속 표시를 눌러 조사할 자료를 찾으세요. 생성된 학습 그림이므로 실물 형태는 교과서와 함께 확인해요.</div><Observation index={s.group} notes={[]} onPin={n=>document.getElementById(`research-${n.artifact}`)?.scrollIntoView({block:'center'})}/><div className={styles.grid} style={{marginTop:18}}>{path.artifacts.map((a,i)=><ResearchCard key={a} artifact={a} index={i+1} card={state.cards.find(c=>c.artifact===a)} research={draft.research || {}} changeResearch={(id,r)=>change({...draft,research:{...draft.research,[id]:r}})} operate={operate}/>)}</div>{!path.artifacts.length&&<section className={styles.panel}><h3>교과서 생활 단서 조사</h3>{path.clues.map(c=><p className={styles.clue} key={c}>{c}</p>)}<label>단서에서 알게 된 생활과 그 근거<textarea value={draft.notes.find(n=>n.id===`inquiry-${path.id}`)?.text||''} onChange={e=>{const id=`inquiry-${path.id}`,note={id,image:s.group,x:.5,y:.5,kind:'내 생각·추측',text:e.target.value};change({...draft,notes:[...draft.notes.filter(n=>n.id!==id),note]});}}/></label><p className={styles.muted}>조사 기록은 자동 저장되어 정리 단계에서 다시 볼 수 있어요.</p></section>}<h3>우리 모둠 공동보드</h3>{state.cards.map(c=><ResearchCard key={c.id} artifact={c.artifact} card={c} research={draft.research || {}} changeResearch={(id,r)=>change({...draft,research:{...draft.research,[id]:r}})} operate={operate}/>)}</>}
      {activity==='3D' && <><h2>{currentPath.title} · 개인 추체험</h2><div className={styles.row}><select aria-label="승인된 체험 맵" value={activePath} onChange={e=>setActivePath(e.target.value)}>{[...new Set([s.path,...s.grants])].map(id=><option key={id} value={id}>{pathById(id).title}{id===s.path?' · 나의 배정':' · 승인된 추가 체험'}</option>)}</select></div><Experience key={activePath} path={currentPath} research={[...Object.values(draft.research || {}),...state.cards]} attempt={attempt} operate={operate} preview={preview} diary={activePath===s.path?draft.diary:undefined} onDiaryChange={diary=>change({...draft,diary})} versions={s.diary.versions.length}/></>}
      {activity==='피드백' && <><h2>친구의 하루에 답장을 보내요</h2>{version?<section className={styles.panel}><span className={styles.badge}>{target.name} · {pathById(target.path).title} · 일기 v{version.version}</span>{pathById(target.path).questions.map(q=><p key={q.id}>{q.prompt} {q.options[version.answers[q.id]] || '미입력'}</p>)}<p className={styles.quote} style={{whiteSpace:'pre-wrap'}}>{version.text || '작성 내용 없음'}</p><div className={styles.row}>{REACTIONS.map(r=><button key={r} disabled={ownFeedback?.valid} aria-pressed={draft.feedbackDraft.reaction===r} className={draft.feedbackDraft.reaction===r?styles.primary:''} onClick={()=>change({...draft,feedbackDraft:{...draft.feedbackDraft,reaction:r}})}>{r}</button>)}</div><label>친구에게 남길 말<textarea disabled={ownFeedback?.valid} value={draft.feedbackDraft.text} onChange={e=>change({...draft,feedbackDraft:{...draft.feedbackDraft,text:e.target.value}})} placeholder="친구의 일기를 읽고 떠오른 말을 남겨 주세요."/></label><button className={styles.primary} disabled={ownFeedback?.valid} onClick={()=>operate({type:'feedback'})}>{ownFeedback?.approved?'맵 승인됨':ownFeedback?.valid?'제출 완료 · 교사 승인 대기':'피드백 제출하기'}</button><p className={styles.muted}>선생님이 승인하면 피드백한 친구의 개인 맵이 열립니다.</p></section>:<section className={styles.panel}>공유된 일기에서 피드백 대상을 배정하고 있어요. 잠시 기다려 주세요.</section>}</>}
      {activity==='정리' && <section className={styles.panel}><h2>작은 단서가 역사가 되었어요</h2><p>관찰한 모습, 조사한 유물의 쓰임, 시대의 생활을 서로 연결해 이야기해 봅시다.</p><h3>나의 탐구 기록</h3><p>관찰 메모 {draft.notes.length}개 · 조사 기록 {Object.keys(draft.research||{}).length}개 · 퀴즈 {path.questions.filter(q=>draft.diary.answers[q.id]===q.answer).length}/{path.questions.length} · 공유한 일기 {s.diary.versions.length}개</p>{draft.notes.map(n=><p key={n.id}>{n.kind}: {n.text}</p>)}<h3>완성한 나의 일기</h3>{path.questions.map(q=><p key={q.id}>{q.prompt} {q.options[draft.diary.answers[q.id]]||'미작성'}</p>)}<p style={{whiteSpace:'pre-wrap'}}>{draft.diary.text||'아직 감정과 생각을 기록하지 않았어요.'}</p><h3>내가 받은 피드백</h3>{state.feedback.filter(f=>f.recipient===s.id).map(f=><p className={styles.note} key={f.author}>{f.reaction}<br/>{f.text}</p>)}<h3>승인된 추가 맵</h3>{s.grants.length?s.grants.map(id=><p key={id}>{pathById(id).title} · 선생님이 추체험 활동으로 보내면 들어갈 수 있어요.</p>):<p>아직 추가로 승인된 맵이 없어요.</p>}</section>}
    </div><aside><section className={styles.panel}><span className={styles.badge}>{state.revealed?`${s.group}모둠 · ${s.path}`:'나의 탐구'}</span><h3 style={{marginTop:14}}>{state.revealed?path.title:'곧 주제가 공개돼요'}</h3><p className={styles.muted}>{s.name}<br/>관찰 → 유물 → 생활 → 마음</p></section>{activity!=='준비'&&<section className={styles.panel}><h3>탐구 도움말</h3><p className={styles.muted}>보이는 사실과 내 추측을 구분해요. 정답이 떠오르지 않으면 단서를 다시 읽어도 괜찮아요.</p>{(s.supplement || ['일기','3D','피드백','정리'].includes(activity)) && <details open={s.supplement}><summary>놓친 단서 / 다시 읽기</summary>{path.clues.map((c,i)=><div className={styles.clue} key={c}><small>{s.attempts[s.path]?.seen.includes(i)?'체험에서 확인':'미체험 보충'}</small><p>{c}</p></div>)}<p className={styles.muted}>교과서 {path.pages}쪽 · 학습용으로 재구성한 설명</p></details>}</section>}</aside></div>
  </>;
}

function Observation({index,notes,onPin}) {
  const [view,setView]=useState({zoom:1,x:0,y:0});const drag=useRef(null);
  const zoom=amount=>setView(v=>({...v,zoom:Math.max(1,Math.min(5,v.zoom+amount))}));
  return <section><div className={styles.picture} role="button" tabIndex={0} aria-label={`그림 ${index} 관찰 영역. Enter로 가운데 메모 추가`} onKeyDown={e=>{if(e.key==='Enter')onPin({id:crypto.randomUUID(),image:index,x:.5,y:.5});}} onWheel={e=>zoom(e.deltaY<0?.2:-.2)} onPointerDown={e=>{if(e.target.closest('button'))return;drag.current={x:e.clientX,y:e.clientY,v:view};e.currentTarget.setPointerCapture(e.pointerId);}} onPointerMove={e=>{if(!drag.current)return;const d=drag.current;setView({...d.v,x:d.v.x+e.clientX-d.x,y:d.v.y+e.clientY-d.y});}} onPointerUp={e=>{const d=drag.current;drag.current=null;if(!d)return;if(Math.hypot(e.clientX-d.x,e.clientY-d.y)>5)return;const r=e.currentTarget.getBoundingClientRect();onPin({id:crypto.randomUUID(),image:index,x:Math.max(0,Math.min(1,(e.clientX-r.left-view.x)/(r.width*view.zoom))),y:Math.max(0,Math.min(1,(e.clientY-r.top-view.y)/(r.height*view.zoom)))});}} onPointerCancel={()=>{drag.current=null;}}><div className={styles.pictureContent} style={{transform:`translate(${view.x}px,${view.y}px) scale(${view.zoom})`}}><Image src={explorationImage(index)} alt={`그림 ${index} · 검수용 역사 장면 초안`} fill sizes={view.zoom>1?'1536px':'(max-width: 1000px) 90vw, 70vw'} draggable={false} style={{objectFit:'contain',pointerEvents:'none'}} loading="eager"/>{(ARTIFACT_SPOTS[index] || []).map(([artifact,x,y],i)=><button key={`${artifact}-${i}`} className={styles.artifactSpot} style={{left:`${x*100}%`,top:`${y*100}%`}} title={artifact} aria-label={`${artifact} 조사 위치`} onClick={e=>{e.stopPropagation();onPin({artifact});}}>⌕</button>)}{notes.filter(n=>n.image===index).map(n=><button key={n.id} className={styles.pin} style={{left:`${n.x*100}%`,top:`${n.y*100}%`}} title={`${n.kind}: ${n.text}`} onClick={e=>{e.stopPropagation();onPin(n);}}>●</button>)}</div></div><div className={styles.tools}><strong>그림 {String(index).padStart(2,'0')} <small className={styles.muted}>검수용 초안</small></strong><div><button aria-label={`그림 ${index} 축소`} onClick={()=>zoom(-.25)}>−</button><button aria-label={`그림 ${index} 확대`} onClick={()=>zoom(.25)}>＋</button><button onClick={()=>setView({zoom:1,x:0,y:0})}>초기화</button></div></div></section>;
}

function ResearchCard({artifact,index,card,research,changeResearch,operate}) {
  const [newId]=useState(()=>crypto.randomUUID());
  const id=card?.id || Object.keys(research).find(key=>research[key].artifact===artifact) || newId;
  const fields=research[id] || {artifact,name:card?.name || '',usage:card?.usage || '',source:card?.source || '',base:card?.revision || 0};
  return <section id={`research-${artifact}`} className={styles.panel}><span className={styles.badge}>조사 카드 {index || ''} · {card?.status || '작성 전'}</span><h3>{artifact}</h3><ArtifactReference artifact={artifact}/><p className={styles.muted}>입력은 자동 저장됩니다.</p><label>정식 명칭<input value={fields.name} onChange={e=>changeResearch(id,{...fields,name:e.target.value})}/></label><label>쓰임<textarea value={fields.usage} onChange={e=>changeResearch(id,{...fields,usage:e.target.value})}/></label><label>출처 · 교과서 쪽 또는 URL<input value={fields.source} onChange={e=>changeResearch(id,{...fields,source:e.target.value})}/></label><button className={styles.primary} onClick={()=>operate({type:'submitResearch',cardId:id})}>조사 제출</button>{card && card.revision!==fields.base && <div className={styles.notice}>공동보드의 새 버전이 있습니다. 입력을 비교하고 불러오세요.<p>{card.name} / {card.usage} / {card.source}</p><button onClick={()=>changeResearch(id,{artifact,name:card.name,usage:card.usage,source:card.source,base:card.revision})}>최신 카드 불러오기</button></div>}</section>;
}

function Experience({path,research,attempt,operate,diary,onDiaryChange,versions}) {
  const [alternative,setAlternative]=useState(false),[extraDiary,setExtraDiary]=useState({answers:{},text:''}),[busy,setBusy]=useState(false);
  const record=diary || extraDiary,update=diary?onDiaryChange:setExtraDiary;
  const step=attempt?.checkpoint || 0,story=STORIES[path.id],lines=storyLines(path);
  const question=step===1?path.questions[0]:step===2?path.questions[1]:null;
  const correct=path.questions.every(q=>record.answers[q.id]===q.answer);
  async function run(operation){setBusy(true);try{await operate(operation);}finally{setBusy(false);}}
  const diaryPage=<section className={styles.diary} aria-label="탐험 일기">
    <h3>나의 탐험 일기 · {path.questions.filter(q=>record.answers[q.id]===q.answer).length}/{path.questions.length}</h3>
    <p className={styles.muted}>{diary?'NPC 퀴즈의 답과 내 생각이 자동 저장됩니다.':'추가 맵 연습 일기 · 배정된 맵의 일기에는 반영되지 않습니다.'}</p>
    {path.questions.map(q=><div key={q.id}><strong>{q.prompt}</strong><p>{q.options[record.answers[q.id]] || 'NPC와 대화하고 퀴즈를 풀어 기록해요.'}</p>{step>=5&&record.answers[q.id]!==q.answer&&<div><p className={styles.clue}>{q.hint}</p>{q.options.map((option,i)=><button type="button" className={styles.quizOption} key={option} aria-pressed={record.answers[q.id]===i} onClick={()=>update({...record,answers:{...record.answers,[q.id]:i}})}>{option}</button>)}</div>}</div>)}
    {step>=5&&correct&&<><h3>오늘 내가 겪은 상황</h3><p className={styles.quote}>{story.opening}</p><p>{story.turn}</p><p>{story.reflection}</p><label>그때의 나였다면 느꼈을 감정과 생각<textarea value={record.text} placeholder="배운 유물과 생활을 떠올리며 나의 하루를 써 보세요." onChange={e=>update({...record,text:e.target.value})}/></label></>}
    {step>=7&&diary&&<><button className={styles.primary} disabled={busy||!correct||!record.text.trim()} onClick={()=>run({type:'diary'})}>일기 공유하기</button><p>공유한 버전 {versions}개 · 수정 후 다시 공유할 수 있어요.</p></>}
  </section>;
  const actions=<>
    {question&&<fieldset><legend>유물과 생활 퀴즈 · 일기 문장 고르기</legend><p>{question.prompt}</p>{question.options.map((option,i)=><button type="button" className={styles.quizOption} aria-pressed={record.answers[question.id]===i} key={option} onClick={()=>update({...record,answers:{...record.answers,[question.id]:i}})}><span>{record.answers[question.id]===i?"✓":i+1}</span>{option}</button>)}{record.answers[question.id]!==undefined&&<p role="status" className={styles.clue}>{record.answers[question.id]===question.answer?'정답이에요! 이 문장이 일기에 기록되었어요.':`단서를 다시 읽고 골라 보세요: ${question.hint}`}</p>}</fieldset>}
    {step>=5&&diaryPage}
    {step<7&&<button className={styles.primary} disabled={busy||(question&&record.answers[question.id]!==question.answer)||(step===6&&(!correct||!record.text.trim()))} onClick={()=>run({type:'step',path:path.id,step,mode:alternative?'alternative':'2D'})}>{step===6?'탐험과 일기 완성':question?'일기에 기록하고 다음 장소로 →':'읽고 다음 장소로 →'}</button>}
  </>;
  return <section className={styles.panel}><h3>{story.title} · NPC와 함께 쓰는 일기</h3><p className={styles.muted}>{STORY_NOTICE}</p><p>NPC 대화 → 유물과 생활 퀴즈 → 내 생각 쓰기 → 일기 공유</p><button onClick={()=>setAlternative(v=>!v)}>{alternative?'2D 게임 보기':'텍스트 대체 흐름 사용'}</button>
    {!alternative&&<Game2D key={path.id} path={path} research={research} step={step} onInteract={()=>{}}>{actions}</Game2D>}
    {alternative&&step<7&&<section className={styles.gameDialog}><h3>{STEPS[step]}</h3><p>{lines[step]}</p>{path.clues.map(c=><p className={styles.clue} key={c}>{c}</p>)}{step===2&&path.artifacts.map(a=><ArtifactReference key={a} artifact={a}/>)}{actions}</section>}
    {step<5&&<details><summary>지금까지 쓴 일기 펼치기</summary>{diaryPage}</details>}
    {step>=7&&<><p role="status">탐험을 마쳤어요. 일기를 확인하고 공유해 주세요.</p>{diaryPage}</>}
  </section>;
}
