'use client';

import {STORIES,STORY_NOTICE} from '@/lib/history/stories.mjs';

import { Component, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import { supabase } from '@/lib/supabase';
import { ACTIVITIES, PATHS, STEPS, pathById, readiness } from '@/lib/history/content.mjs';
import { applyOperation, createLesson, studentView, groupComplete, chainQuizProgress, groupScores } from '@/lib/history/state.mjs';
import styles from './HistoryClassroom.module.css';
import ObservationChat from './ObservationChat';
import ArtifactReference from './ArtifactReference';
import QuestConversation from './QuestConversation';
import {PATH_CONTEXT} from '@/lib/history/references.mjs';
import {ARTIFACT_SPOTS,explorationImage} from '@/lib/history/exploration.mjs';

const Game2D=dynamic(()=>import('./HistoryGame2D'),{ssr:false,loading:()=> <p>2D 탐험 지도를 준비하고 있어요…</p>});
// A dialogue-rendering crash must not blank the whole quest screen; let the
// student retry the current step instead of getting stuck with no way forward.
class QuestBoundary extends Component {
  state={failed:false};
  static getDerivedStateFromError(){return {failed:true};}
  componentDidUpdate(prev){if(this.state.failed && prev.resetKey!==this.props.resetKey)this.setState({failed:false});}
  render(){return this.state.failed?<section className={styles.notice} role="alert"><strong>대화 화면을 불러오지 못했습니다.</strong><p>아래에서 이 장소를 다시 눌러 대화를 다시 열어 보세요.</p></section>:this.props.children;}
}
const draftOf=s=>({notes:s.notes,diary:{answers:s.diary.answers,text:s.diary.text},research:s.research || {}});
async function request(body,query='') {
  const {data:{session}}=await supabase.auth.getSession();
  const response=await fetch(`/api/history${query}`,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',Authorization:`Bearer ${session?.access_token || ''}`},...(body?{body:JSON.stringify(body)}:{})});
  const data=await response.json();
  if(!response.ok){const error=Error(data.error || '연결하지 못했습니다.');error.status=response.status;throw error;}
  return data;
}
const previewRoster=()=>Array.from({length:16},(_,i)=>({id:`preview-${i}`,name:`학생 ${String(i+1).padStart(2,'0')}`}));

export default function HistoryClassroom({user,teacher,previewOnly=false}) {
  const [sessions,setSessions]=useState([]),[roster,setRoster]=useState([]),[selected,setSelected]=useState([]);
  const [sessionId,setSessionId]=useState(''),[row,setRow]=useState(null),[error,setError]=useState(''),[status,setStatus]=useState('연결 확인 중');
  const [preview,setPreview]=useState(()=>previewOnly?createLesson(previewRoster()):null),[previewId,setPreviewId]=useState('preview-0');
  const [draft,setDraft]=useState(null),[conflict,setConflict]=useState(false);
  const [managing,setManaging]=useState(false),[deleteTarget,setDeleteTarget]=useState(null);
  const pending=useRef(null),queue=useRef(Promise.resolve()),rowRef=useRef(null),saveTimer=useRef(null),polling=useRef(false),previewRef=useRef(preview);
  const key=`history:${user.id}:${sessionId}`;
  useEffect(()=>{if(previewOnly)return;request().then(data=>{setSessions(data.sessions);setRoster(data.roster);setStatus('연결됨');}).catch(e=>{setError(e.message);setStatus('설정 확인 필요');});},[previewOnly]);
  useEffect(()=>{
    if(previewOnly||sessionId||preview)return;
    let stopped=false;
    const refresh=()=>request().then(data=>{if(!stopped){setSessions(data.sessions);setRoster(data.roster);}}).catch(e=>{if(!stopped)setError(e.message);});
    refresh();const timer=setInterval(refresh,3000);
    return()=>{stopped=true;clearInterval(timer);};
  },[previewOnly,sessionId,preview]);
  async function manageSession(session,type) {
    if(managing)return;
    setManaging(true);setError('');
    try {
      await request(type==='delete'?{type,session:session.id}:{session:session.id,operation:{id:crypto.randomUUID(),type:'distribution',distributed:!session.distributed}});
      setDeleteTarget(null);
      const data=await request();setSessions(data.sessions);
      setStatus(type==='delete'?'수업 삭제됨':session.distributed?'배포 중단됨':'학생에게 배포됨');
    }catch(e){setError(e.message);}finally{setManaging(false);}
  }
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
      }catch(e){if(!stopped){
        if(e.status===403||e.status===404){pending.current=null;rowRef.current=null;setRow(null);setSessionId('');setDraft(null);setConflict(false);setStatus('수업 목록');}
        else setStatus('연결이 끊겨 임시 저장 중');
        setError(e.message);
      }}finally{polling.current=false;}
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
    {preview && <details className={styles.previewControls}><summary>교사 도구 · 활동 전환</summary><strong>교사용 기능 미리보기 — 역사 시각 자료 검수 대기</strong><div className={styles.row}><select aria-label="미리볼 배정" value={previewId} onChange={e=>{setPreviewId(e.target.value);setDraft(draftOf(preview.students[e.target.value]));}}>{Object.values(preview.students).map(s=><option key={s.id} value={s.id}>{s.name} · {pathById(s.path).title}</option>)}</select>{ACTIVITIES.map(a=><button key={a} onClick={()=>operate({type:'move',targets:[previewId],activity:a})}>{a==='3D'?'2D 체험·일기':a}</button>)}<button aria-pressed={!!preview.locked} onClick={()=>operate({type:'lock',locked:!preview.locked})}>{preview.locked?'학생 조작 다시 시작':'전체 학생 조작 멈춤'}</button><button onClick={()=>operate({type:'publish'})}>메모 전체 공개</button><button aria-pressed={!!(preview.liveNotes??preview.published)} onClick={()=>operate({type:'noteVisibility',mode:(preview.liveNotes??preview.published)?'hidden':'live'})}>메모 실시간 공개 {(preview.liveNotes??preview.published)?'끄기':'켜기'}</button><button onClick={()=>operate({type:'noteVisibility',mode:'hidden'})}>친구 메모 숨김</button><button onClick={()=>operate({type:'reveal'})}>배정 공개</button><button aria-pressed={!!preview.scoreVisible} onClick={()=>operate({type:'scoreVisibility',visible:!preview.scoreVisible})}>모둠 점수 {preview.scoreVisible?'숨기기':'공개'}</button><button aria-pressed={!!preview.freeMode} onClick={()=>operate({type:'freeMode',enabled:!preview.freeMode})}>모두 잠금 해제 모드 {preview.freeMode?'끄기':'켜기'}</button>{!previewOnly && <button onClick={()=>{previewRef.current=null;setPreview(null);setDraft(null);}}>미리보기 닫기</button>}</div></details>}
    {!sessionId && !preview ? <>
      <section className={styles.hero}><div><div className={styles.eyebrow} style={{color:'#b9cfb9'}}>우리의 탐구 · 40분</div><h2>아주 오래전, 나는 어떻게 살았을까?</h2><p>그림을 관찰하고, 유물을 조사하고, 당시 사람의 처지에서 일기를 써 보세요.<br/>맵을 모두 체험하면 다른 모둠의 이야기도 만날 수 있어요.</p></div><div className={styles.seal}>관찰<br/><small style={{fontSize:13}}>에서 이해로</small></div></section>
      <div className={styles.steps}>{['01 관찰 · 5분','02 조사 · 8분','03 체험·일기 · 24분','04 정리 · 3분'].map(a=><span key={a}>{a}</span>)}</div>
      <div className={styles.layout}><section className={styles.panel}><h2>{teacher?'수업 준비':'나의 수업'}</h2>{teacher&&<p>수업을 만든 뒤 ‘학생에게 배포’를 누르면 배정된 학생의 수업 목록에 나타납니다. 기존 수업은 배포 상태가 유지됩니다.</p>}
      {sessions.length?sessions.map(s=><section key={s.id} className={styles.panel}>
        <div className={styles.row}><button className={styles.primary} onClick={()=>{rowRef.current=null;setSessionId(s.id);}}>{s.title} →</button><span className={styles.muted}>{new Date(s.created_at).toLocaleString('ko-KR')}</span></div>
        {teacher&&<div className={styles.row}><span className={styles.badge}>{s.distributed?'학생 배포 중':'미배포'}</span><button disabled={managing} onClick={()=>manageSession(s,'distribution')}>{s.distributed?'배포 중단':'학생에게 배포'}</button><button disabled={managing} onClick={()=>setDeleteTarget(s.id)}>수업 삭제</button></div>}
        {teacher&&deleteTarget===s.id&&<div className={styles.notice}><p>‘{s.title}’ 수업과 학생들의 관찰·조사·일기 기록을 모두 삭제합니다. 되돌릴 수 없습니다.</p><button disabled={managing} onClick={()=>manageSession(s,'delete')}>기록까지 삭제하기</button><button disabled={managing} onClick={()=>setDeleteTarget(null)}>취소</button></div>}
      </section>):<p>{teacher?'생성된 역사 수업이 없습니다.':'선생님이 배포한 수업이 없습니다. 배포되면 여기에 표시됩니다.'}</p>}

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
  const scores=groupScores(state);
  const cardsByGroup=group=>Object.values(state.cards).filter(c=>c.group===group);
  return <><div className={styles.notice}><strong>시각 자료 검수 대기 · 수업 진행 가능</strong><p>검수 상태와 관계없이 아래에서 활동을 선택해 학생들과 수업을 진행할 수 있습니다.</p>{readiness().map(t=><p key={t}>{t}</p>)}</div><section className={styles.panel}><h2>수업 진행</h2><div className={styles.row}><button aria-pressed={!!state.locked} onClick={()=>operate({type:'lock',locked:!state.locked})}>{state.locked?'학생 조작 다시 시작':'전체 학생 조작 멈춤'}</button><button onClick={()=>operate({type:'reveal'})}>지정한 모둠·주제 공개</button><button onClick={()=>operate({type:'publish'})}>메모 전체 공개</button><button aria-pressed={!!(state.liveNotes??state.published)} onClick={()=>operate({type:'noteVisibility',mode:(state.liveNotes??state.published)?'hidden':'live'})}>메모 실시간 공개 {(state.liveNotes??state.published)?'끄기':'켜기'}</button><button onClick={()=>operate({type:'noteVisibility',mode:'hidden'})}>친구 메모 숨김</button><button aria-pressed={!!state.scoreVisible} onClick={()=>operate({type:'scoreVisibility',visible:!state.scoreVisible})}>모둠 점수 {state.scoreVisible?'학생에게 숨기기':'학생에게 공개'}</button><button aria-pressed={!!state.freeMode} onClick={()=>operate({type:'freeMode',enabled:!state.freeMode})}>모두 잠금 해제 모드 {state.freeMode?'끄기':'켜기'}</button></div><div className={styles.row}><select aria-label="이동할 활동" value={activity} onChange={e=>setActivity(e.target.value)}>{ACTIVITIES.map(a=><option key={a} value={a}>{a==='3D'?'2D 체험·일기':a}</option>)}</select><button onClick={()=>operate({type:'move',activity,targets:students.map(s=>s.id)})}>전체 학생 보내기</button><button disabled={!targets.length} onClick={()=>operate({type:'move',activity,targets})}>선택한 {targets.length}명 보내기</button></div><p className={styles.muted}>현재 입력을 보존하고 지정한 활동으로 이동합니다. 미체험 단서는 보충으로 제공하며 퀘스트 완료로 처리하지 않습니다.</p></section>
    <section className={styles.panel}><h2>모둠 경쟁 점수 · {state.scoreVisible?'학생에게 공개 중':'학생에게는 숨김'}</h2><p className={styles.muted}>완료한 맵 개수를 모둠원 전체 합산으로 집계합니다.</p><div className={styles.row}>{scores.map(({group,score})=><span key={group} className={styles.badge}>{group}모둠 · {score}점</span>)}</div></section>
    <details open className={styles.panel}><summary>실시간 관찰 채팅 모니터링</summary><div className={styles.teacherObservation}><ObservationChat state={state} readOnly/></div></details>
    <details open className={styles.panel}><summary>모둠별 조사 카드 실시간 확인</summary><div className={styles.researchGrid}>{[1,2,3,4].map(group=><div key={group} className={styles.panel}><h3>{group}모둠</h3>{cardsByGroup(group).length?cardsByGroup(group).map(c=><p key={c.id}>{c.artifact} — {c.name||'명칭 미입력'} / {c.usage||'쓰임 미입력'} · {c.status}</p>):<p className={styles.muted}>아직 제출된 조사 카드가 없습니다.</p>}</div>)}</div></details>
    <section className={styles.panel}><h2>학생별 진행</h2><div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>선택</th><th>학생</th><th>개인 주제</th><th>활동</th><th>명령 수신</th><th>저장</th><th>연결</th><th>체험</th><th>해금</th><th>기록</th></tr></thead><tbody>{students.map(s=><tr key={s.id}><td><input type="checkbox" aria-label={`${s.name} 선택`} checked={targets.includes(s.id)} onChange={e=>setTargets(e.target.checked?[...targets,s.id]:targets.filter(id=>id!==s.id))}/></td><td>{s.name}</td><td>{s.path} {pathById(s.path).title}</td><td>{s.activity==='3D'?'2D 체험·일기':s.activity}</td><td>{s.command?.sequence>s.ack?'미수신':'적용됨'}</td><td>{s.saveState || '미작성'}</td><td>{s.lastSeen && now-Date.parse(s.lastSeen)<30000?'연결됨':'응답 대기'}</td><td>{s.attempts[s.path]?.complete?'완료':s.attempts[s.path]?.interrupted?'중단':'미완료'}</td><td>{s.grants.length}개</td><td><button onClick={()=>setInspect(s.id)}>열람</button></td></tr>)}</tbody></table></div></section>
    {student && <section className={styles.panel}><h2>{student.name}의 연결 기록</h2><p>{student.path} · {pathById(student.path).title}</p><h3>관찰</h3>{student.notes.map(n=><p key={n.id}>{n.kind}: {n.text}</p>)}<h3>조사</h3>{Object.values(state.cards).filter(c=>c.owner===student.id || c.helpers.includes(student.id)).map(c=><p key={c.id}>{c.name || '명칭 미입력'} — {c.usage || '쓰임 미입력'} / 출처: {c.source || '미기입'} / {c.status}</p>)}<h3>퀘스트</h3><p>{student.attempts[student.path]?.checkpoint || 0}/{STEPS.length} · {student.attempts[student.path]?.mode || '미시작'}</p><h3>일기 선택 · 감정과 생각</h3>{pathById(student.path).questions.map(q=><p key={q.id}>{q.prompt} {q.options[student.diary.answers[q.id]] || '미입력'}</p>)}<p style={{whiteSpace:'pre-wrap'}}>{student.diary.text || '작성 내용 없음'}</p><h3>체험한 맵</h3>{[student.path,...student.grants].map(id=><p key={id}>{pathById(id).title}{student.attempts[id]?.complete?' · 완료':' · 진행 중'}</p>)}<h3>다음 맵 잠금 해제 퀴즈</h3>{(()=>{const q=chainQuizProgress(student);return q.current?<p>{pathById(q.current).title} 기준 · {q.score}/{q.needed}문제 {q.passed?'통과':'진행 중'}</p>:<p className={styles.muted}>아직 자신의 맵을 완료하지 않았습니다.</p>;})()}</section>}
  </>;
}

// Students can jump to any tab and back at will; nothing is force-submitted on the way out.
function ActivityTabs({activity,operate}) {
  return <div className={styles.steps}>{ACTIVITIES.map((a,i)=><button key={a} type="button" aria-current={a===activity?'step':undefined} className={a===activity?styles.active:''} onClick={()=>a!==activity&&operate({type:'selfMove',activity:a})}>{String(i+1).padStart(2,'0')} {a==='3D'?'2D 체험·일기':a}</button>)}</div>;
}

function StudentWorkspace({state,draft,change,operate,preview}) {
  const s=state.me,path=pathById(s.path),activePath=s.activePath||s.path;
  const activity=s.activity==='일기'?'3D':s.activity;
  const currentPath=pathById(activePath),attempt=s.attempts[activePath];
  if(state.locked)return <section className={styles.notice} role="status"><h2>선생님이 조작을 잠시 멈췄어요.</h2><p>작성 중인 내용은 보관되어 있어요. 선생님이 다시 시작하면 이어서 활동할 수 있어요.</p></section>;
  if(activity==='관찰')return <><ActivityTabs activity={activity} operate={operate}/><ObservationChat state={state} operate={operate}/></>;
  return <><ActivityTabs activity={activity} operate={operate}/>
    <div className={styles.layout}><div>
      {activity==='준비' && <section className={styles.hero}><div><span className={styles.badge}>수업 준비</span><h2 style={{marginTop:18}}>단서를 발견할 준비가 되었나요?</h2><p>선생님이 수업을 시작하면 네 장의 그림이 함께 열립니다.</p>{state.revealed && <h3>{s.group}모둠 · {path.title}</h3>}</div><div className={styles.seal}>나의<br/>발견</div></section>}
      {activity==='조사' && <ResearchWorkspace key={s.path} state={state} draft={draft} change={change} operate={operate}/>}
      {activity==='3D' && <><h2>{currentPath.title} · 개인 추체험</h2><div className={styles.row}><select aria-label="체험할 맵" value={activePath} onChange={e=>operate({type:'enterExperience',path:e.target.value})}>{[...new Set([s.path,...s.grants,...(state.freeMode?PATHS.map(p=>p.id):[])])].map(id=><option key={id} value={id}>{pathById(id).title}{id===s.path?' · 나의 배정':state.freeMode&&!s.grants.includes(id)?' · 자유 체험':' · 잠금 해제한 체험'}</option>)}</select></div><Experience key={activePath} path={currentPath} research={[...Object.values(draft.research || {}),...state.cards]} attempt={attempt} operate={operate} preview={preview} diary={activePath===s.path?draft.diary:undefined} onDiaryChange={diary=>change({...draft,diary})} versions={s.diary.versions.length}/><MapUnlocks state={state} operate={operate}/></>}
      {activity==='정리' && <section className={styles.panel}><h2>작은 단서가 역사가 되었어요</h2><p>관찰한 모습, 조사한 유물의 쓰임, 시대의 생활을 서로 연결해 이야기해 봅시다.</p><h3>나의 탐구 기록</h3><p>관찰 메모 {draft.notes.length}개 · 조사 기록 {Object.keys(draft.research||{}).length}개 · 퀴즈 {path.questions.filter(q=>draft.diary.answers[q.id]===q.answer).length}/{path.questions.length} · 공유한 일기 {s.diary.versions.length}개</p>{draft.notes.map(n=><p key={n.id}>{n.kind}: {n.text}</p>)}<h3>완성한 나의 일기</h3>{path.questions.map(q=><p key={q.id}>{q.prompt} {q.options[draft.diary.answers[q.id]]||'미작성'}</p>)}<p style={{whiteSpace:'pre-wrap'}}>{draft.diary.text||'아직 감정과 생각을 기록하지 않았어요.'}</p><h3>체험한 맵</h3>{[s.path,...s.grants].map(id=><p key={id}>{pathById(id).title}{s.attempts[id]?.complete?' · 완료':' · 진행 중'} · 위의 체험 시작 버튼으로 들어갈 수 있어요.</p>)}{state.scores&&<><h3>모둠 경쟁 점수</h3>{state.scores.map(({group,score})=><p key={group}>{group}모둠{group===s.group?' · 우리 모둠':''} · {score}점</p>)}</>}</section>}
    </div><aside><section className={styles.panel}><span className={styles.badge}>{state.revealed?`${s.group}모둠 · ${s.path}`:'나의 탐구'}</span><h3 style={{marginTop:14}}>{state.revealed?path.title:'곧 주제가 공개돼요'}</h3><p className={styles.muted}>{s.name}<br/>관찰 → 유물 → 생활 → 마음</p></section>{state.scores&&<section className={styles.panel}><h3>모둠 경쟁 점수</h3>{state.scores.map(({group,score})=><p key={group} className={group===s.group?styles.badge:styles.muted}>{group}모둠 · {score}점</p>)}</section>}{activity!=='준비'&&<section className={styles.panel}><h3>탐구 도움말</h3><p className={styles.muted}>보이는 사실과 내 추측을 구분해요. 정답이 떠오르지 않으면 단서를 다시 읽어도 괜찮아요.</p>{(s.supplement || ['일기','3D','정리'].includes(activity)) && <details open={s.supplement}><summary>놓친 단서 / 다시 읽기</summary>{path.clues.map((c,i)=><div className={styles.clue} key={c}><small>{s.attempts[s.path]?.seen.includes(i)?'체험에서 확인':'미체험 보충'}</small><p>{c}</p></div>)}<p className={styles.muted}>교과서 {path.pages}쪽 · 학습용으로 재구성한 설명</p></details>}</section>}</aside></div>
  </>;
}

// Finishing a map unlocks nothing by itself: the student must first pass a small quiz built
// from the map they just finished (plus one question from whichever map came right before it,
// once there is one), and passing it lets them pick exactly one further map to unlock. Only one
// unlocked-but-unfinished map may exist at a time, which keeps "the map I just finished" well
// defined for the next quiz. Crossing into another group additionally needs that group's
// research cards reviewed first.
function MapUnlocks({state,operate}) {
  const s=state.me;
  if(state.freeMode)return <FreeModeMapList state={state} operate={operate}/>;
  const pendingId=s.grants.find(id=>!s.attempts[id]?.complete);
  if(pendingId)return <section className={styles.panel}><h3>다른 맵 체험하기</h3><p className={styles.muted}>지금 <strong>{pathById(pendingId).title}</strong>을(를) 체험하고 있어요. 완료하면 다음 맵을 잠금 해제할 수 있어요.</p></section>;
  const quiz=chainQuizProgress(s);
  if(!quiz.current)return <section className={styles.panel}><h3>다른 맵 체험하기</h3><p className={styles.muted}>내 맵을 완료하면 대화를 떠올리는 문제를 풀고 체험할 다른 맵을 고를 수 있어요.</p></section>;
  const ownedOrOwn=new Set([s.path,...s.grants]);
  const siblingChoices=PATHS.filter(p=>p.group===s.group&&!ownedOrOwn.has(p.id));
  const homeDone=groupComplete(s,s.group);
  const otherGroups=[1,2,3,4].filter(g=>g!==s.group);
  const remainingElsewhere=otherGroups.some(g=>PATHS.some(p=>p.group===g&&!ownedOrOwn.has(p.id)));
  if(!siblingChoices.length && homeDone && !remainingElsewhere)return <section className={styles.panel}><h3>다른 맵 체험하기</h3><p className={styles.muted}>16개 맵을 모두 체험했어요! 정말 대단해요.</p></section>;
  if(!quiz.passed)return <section className={styles.panel}>
    <h3>다음 맵 잠금 해제 퀴즈</h3>
    <p className={styles.muted}><strong>{pathById(quiz.current).title}</strong>의 대화를 떠올리며 문제를 모두 맞혀 보세요. 다 맞히면 체험할 맵을 하나 골라 잠금 해제할 수 있어요.</p>
    <ReviewQuiz quiz={quiz} operate={operate}/>
  </section>;
  const unlockRow=p=><li key={p.id}>{p.title} <button onClick={()=>operate({type:'unlockMap',path:p.id})}>이 맵 선택</button></li>;
  return <section className={styles.panel}>
    <h3>체험할 맵을 하나 선택하세요</h3>
    {siblingChoices.length>0&&<><h4>같은 모둠</h4><ul>{siblingChoices.map(unlockRow)}</ul></>}
    {homeDone?<>
      <h4>다른 모둠</h4>
      {otherGroups.map(group=>{
        const groupChoices=PATHS.filter(p=>p.group===group&&!ownedOrOwn.has(p.id));
        if(!groupChoices.length)return null;
        const reviewed=(s.reviewedGroups||[]).includes(group);
        const cards=state.cards.filter(c=>c.group===group);
        return <div key={group} className={styles.panel}>
          <strong>{group}모둠</strong>
          {!reviewed?<>
            {cards.length?cards.map(c=><p key={c.id}>{c.artifact} — {c.name||'명칭 미입력'} / {c.usage||'쓰임 미입력'}</p>):<p className={styles.muted}>아직 제출된 조사 카드가 없습니다.</p>}
            <button disabled={!cards.length} onClick={()=>operate({type:'reviewGroup',group})}>조사 카드 확인 완료</button>
          </>:<ul>{groupChoices.map(unlockRow)}</ul>}
        </div>;
      })}
    </>:<p className={styles.muted}>우리 모둠 맵을 모두 체험하면 다른 모둠의 맵도 선택할 수 있어요.</p>}
  </section>;
}

// The teacher's all-unlock mode: every map is directly selectable with no quiz gate, and a
// separate, purely optional quiz-by-topic list is offered for students who still want practice.
function FreeModeMapList({state,operate}) {
  const s=state.me;
  const [quizPath,setQuizPath]=useState(null);
  return <section className={styles.panel}>
    <h3>모두 잠금 해제 모드</h3>
    <p className={styles.muted}>선생님이 모든 맵을 열어 두었어요. 퀴즈를 풀지 않아도 목록에서 자유롭게 골라 체험할 수 있어요.</p>
    {[1,2,3,4].map(group=><div key={group} className={styles.row}><strong>{group}모둠</strong>{PATHS.filter(p=>p.group===group).map(p=><button key={p.id} onClick={()=>operate({type:'enterExperience',path:p.id})}>{p.title}{p.id===s.path?' · 나의 배정':''}{s.attempts[p.id]?.complete?' · 완료':''}</button>)}</div>)}
    <h3>복습 퀴즈 · 자유롭게 풀어보기</h3>
    <p className={styles.muted}>주제를 골라 언제든 풀어 볼 수 있어요. 체험과는 별개로, 원할 때만 풀면 됩니다.</p>
    <div className={styles.row}>{PATHS.map(p=><button key={p.id} aria-pressed={quizPath===p.id} className={quizPath===p.id?styles.primary:''} onClick={()=>setQuizPath(quizPath===p.id?null:p.id)}>{p.title}</button>)}</div>
    {quizPath&&<FreeQuiz path={quizPath} record={s.reviewQuizzes?.[quizPath]||{}} operate={operate}/>}
  </section>;
}

function FreeQuiz({path,record,operate}) {
  const [busy,setBusy]=useState(false);
  const questions=PATHS.find(p=>p.id===path).questions;
  async function answer(questionId,choice) {
    setBusy(true);
    try {await operate({type:'answerReviewQuiz',path,questionId,choice});} finally {setBusy(false);}
  }
  return <>{questions.map((q,index)=>{
    const selected=record[q.id]?.choice,correct=selected===q.answer;
    return <fieldset key={q.id}><legend>{index+1}. {q.prompt}</legend>{q.options.map((option,choice)=><button type="button" key={option} className={styles.quizOption} aria-pressed={selected===choice} disabled={busy||correct} onClick={()=>answer(q.id,choice)}>{choice+1}. {option}</button>)}{selected!==undefined&&<p role="status" className={styles.clue}>{correct?'정답이에요!':'다시 생각해 보세요.'} {q.hint}</p>}</fieldset>;
  })}</>;
}

function ReviewQuiz({quiz,operate}) {
  const [busy,setBusy]=useState(false);
  async function answer(questionId,choice) {
    setBusy(true);
    try {await operate({type:'answerReviewQuiz',questionId,choice});} finally {setBusy(false);}
  }
  return <>{quiz.questions.map((q,index)=>{
    const selected=quiz.record[q.id]?.choice,correct=selected===q.answer;
    const source=PATHS.find(p=>p.questions.some(pq=>pq.id===q.id));
    return <fieldset key={q.id}><legend>{index+1}. {source&&source.id!==quiz.current?`${source.title} · `:''}{q.prompt}</legend>{q.options.map((option,choice)=><button type="button" key={option} className={styles.quizOption} aria-pressed={selected===choice} disabled={busy||correct} onClick={()=>answer(q.id,choice)}>{choice+1}. {option}</button>)}{selected!==undefined&&<p role="status" className={styles.clue}>{correct?'정답이에요!':'다시 생각해 보세요.'} {q.hint}</p>}</fieldset>;
  })}</>;
}

function ResearchWorkspace({state,draft,change,operate}) {
  const s=state.me,path=pathById(s.path);
  const [selected,setSelected]=useState(null);
  const [adding,setAdding]=useState(false),[extraTarget,setExtraTarget]=useState('');
  const opposite=selected?(selected.group%2?selected.group+1:selected.group-1):0;
  const select=(group,artifact)=>setSelected({group,artifact});
  const card=selected&&state.cards.find(c=>c.group===selected.group&&c.artifact===selected.artifact);
  const changeResearch=(id,r)=>change({...draft,research:{...draft.research,[id]:r}});
  return <>
    <h2>유물이 들려주는 이야기</h2>
    <p className={styles.notice}>노란 테두리가 내가 맡은 그림이에요. 돋보기를 누르면 그림 반대편에 조사 카드가 열려요.</p>
    {PATH_CONTEXT[path.id]&&<p className={styles.muted}>{PATH_CONTEXT[path.id]}</p>}
    {state.canAddResearch&&<section className={styles.panel}>
      <button className={styles.primary} aria-expanded={adding} onClick={()=>setAdding(!adding)}>✦ 숨겨진 탐구 · 추가 조사하기</button>
      {adding&&<form onSubmit={e=>{
        e.preventDefault();const artifact=extraTarget.trim();if(!artifact)return;
        if(!state.cards.some(c=>c.group===s.group&&c.artifact===artifact)&&!Object.values(draft.research||{}).some(r=>r.artifact===artifact))changeResearch(crypto.randomUUID(),{artifact,extra:true,name:artifact,usage:'',source:'',base:0});
        select(s.group,artifact);setExtraTarget('');setAdding(false);
      }}>
        <p>우리 모둠 그림의 조사를 모두 마쳤어요! 2개 제한으로 담지 못한 교과서 속 대상이나 교과서 밖 자료를 더 조사해 보세요.</p>
        <label>추가로 조사할 대상<input required maxLength={100} value={extraTarget} onChange={e=>setExtraTarget(e.target.value)} placeholder="더 알아보고 싶은 유물이나 생활 모습"/></label>
        <p className={styles.muted}>조사 카드에 명칭, 쓰임과 알게 된 점, 교과서 쪽 또는 자료 URL을 기록해 주세요.</p>
        <button type="submit" disabled={!extraTarget.trim()}>조사 카드 열기</button>
      </form>}
    </section>}
    <div className={styles.researchGrid}>
      {[1,2,3,4].map(group=>group===opposite?<div key={group} className={styles.researchDrawer} role="region" aria-label="선택한 유물 조사 카드">
        <button onClick={()=>setSelected(null)}>카드 닫기 ×</button>
        <ResearchCard key={selected.group+'-'+selected.artifact} artifact={selected.artifact} card={card} research={draft.research||{}} changeResearch={changeResearch} operate={operate}/>
      </div>:<section key={group} className={group===s.group?styles.assignedPicture:styles.researchPicture}>
        <h3>그림 {group}{group===s.group?' · 내가 맡은 그림':''}</h3>
        <div className={styles.picture}>
          <Image src={explorationImage(group)} alt={`그림 ${group} · 역사 조사 장면`} fill sizes="(max-width: 700px) 90vw, 45vw" draggable={false} style={{objectFit:'contain'}}/>
          {(ARTIFACT_SPOTS[group]||[]).map(([artifact,x,y],i)=>{
            const enabled=group===s.group||(state.canHelpResearch&&state.cards.some(c=>c.group===group&&c.artifact===artifact));
            return <button key={artifact+i} className={styles.artifactSpot} style={{left:`${x*100}%`,top:`${y*100}%`}} disabled={!enabled} title={enabled?artifact:'내 조사 완료 후 친구가 작성한 카드를 도울 수 있어요'} aria-label={`그림 ${group} · ${artifact} 조사 카드 열기`} aria-pressed={selected?.group===group&&selected?.artifact===artifact} onClick={()=>select(group,artifact)}>⌕{enabled&&<span className={styles.artifactSpotLabel} aria-hidden="true">{artifact} · 눌러서 조사하기</span>}</button>;
          })}
        </div>
      </section>)}
    </div>
    {!path.artifacts.length&&<section className={styles.panel}><h3>교과서 생활 단서 조사</h3>{path.clues.map(c=><p className={styles.clue} key={c}>{c}</p>)}<label>단서에서 알게 된 생활과 그 근거<textarea value={draft.notes.find(n=>n.id===`inquiry-${path.id}`)?.text||''} onChange={e=>{const id=`inquiry-${path.id}`,note={id,image:s.group,x:.5,y:.5,kind:'내 생각·추측',text:e.target.value};change({...draft,notes:[...draft.notes.filter(n=>n.id!==id),note]});}}/></label><p>조사 기록은 자동 저장돼요.</p></section>}
    <h3>{state.canHelpResearch?'친구 조사 도와주기':'우리 모둠 공동보드'}</h3>
    <p>{state.canHelpResearch?'친구의 그림에 있는 돋보기나 아래 카드 이름을 눌러 조사에 내용을 보태 주세요.':'내 조사 카드를 모두 제출하면 다른 모둠 친구의 조사도 도울 수 있어요.'}</p>
    <div className={styles.row}>{state.cards.map(c=><button key={c.id} onClick={()=>select(c.group,c.artifact)}>{c.group}모둠 · {c.artifact} · {c.status}</button>)}</div>
  </>;
}

function ResearchCard({artifact,index,card,research,changeResearch,operate}) {
  const [newId]=useState(()=>crypto.randomUUID());
  const id=card?.id || Object.keys(research).find(key=>research[key].artifact===artifact) || newId;
  const fields=research[id] || {artifact,name:card?.name || '',usage:card?.usage || '',source:card?.source || '',base:card?.revision || 0};
  return <section id={`research-${artifact}`} className={styles.panel}><span className={styles.badge}>조사 카드 {index || ''} · {card?.status || '작성 전'}</span><h3>{artifact}</h3>{card&&<small>{card.group}모둠 · 함께 조사한 학생 {card.helpers?.length||1}명</small>}<ArtifactReference artifact={artifact}/><p className={styles.muted}>입력은 자동 저장됩니다.</p><label>정식 명칭<input value={fields.name} onChange={e=>changeResearch(id,{...fields,name:e.target.value})}/></label><label>쓰임<textarea value={fields.usage} onChange={e=>changeResearch(id,{...fields,usage:e.target.value})}/></label><label>출처 · 교과서 쪽 또는 URL<input value={fields.source} onChange={e=>changeResearch(id,{...fields,source:e.target.value})}/></label><button className={styles.primary} onClick={()=>operate({type:'submitResearch',cardId:id})}>조사 제출</button>{card && card.revision!==fields.base && <div className={styles.notice}>공동보드의 새 버전이 있습니다. 입력을 비교하고 불러오세요.<p>{card.name} / {card.usage} / {card.source}</p><button onClick={()=>changeResearch(id,{artifact,name:card.name,usage:card.usage,source:card.source,base:card.revision})}>최신 카드 불러오기</button></div>}</section>;
}

function Experience({path,research,attempt,operate,diary,onDiaryChange,versions}) {
  const [alternative,setAlternative]=useState(false),[extraDiary,setExtraDiary]=useState({answers:{},text:''}),[busy,setBusy]=useState(false);
  const record=diary || extraDiary,update=diary?onDiaryChange:setExtraDiary;
  const step=attempt?.checkpoint || 0,story=STORIES[path.id];
  const question=step===1?path.questions[0]:step===2?path.questions[1]:null;
  const correct=path.questions.every(q=>record.answers[q.id]===q.answer);
  async function run(operation){setBusy(true);try{await operate(operation);}finally{setBusy(false);}}
  const diaryPage=<section className={styles.diary} aria-label="탐험 일기">
    <h3>나의 탐험 일기 · {path.questions.filter(q=>record.answers[q.id]===q.answer).length}/{path.questions.length}</h3>
    <p className={styles.muted}>{diary?'NPC 퀴즈의 답과 내 생각이 자동 저장됩니다.':'추가 맵 연습 일기 · 배정된 맵의 일기에는 반영되지 않습니다.'}</p>
    {path.questions.map(q=><div key={q.id}><strong>{q.prompt}</strong><p>{q.options[record.answers[q.id]] || 'NPC와 대화하고 퀴즈를 풀어 기록해요.'}</p>{step>=5&&record.answers[q.id]!==q.answer&&<div><p className={styles.clue}>{q.hint}</p>{q.options.map((option,i)=><button type="button" className={styles.quizOption} key={option} aria-pressed={record.answers[q.id]===i} onClick={()=>update({...record,answers:{...record.answers,[q.id]:i}})}>{option}</button>)}</div>}</div>)}
    {step>=5&&correct&&<><details><summary>오늘의 상황 다시 보기</summary><p className={styles.quote}>{story.opening}</p><p>{story.turn}</p><p>{story.reflection}</p></details><label>그때의 나였다면 느꼈을 감정과 생각<textarea value={record.text} placeholder="배운 유물과 생활을 떠올리며 나의 하루를 써 보세요." onChange={e=>update({...record,text:e.target.value})}/></label></>}
    {step>=7&&diary&&<><button className={styles.primary} disabled={busy||!correct||!record.text.trim()} onClick={()=>run({type:'diary'})}>일기 공유하기</button><p>공유한 버전 {versions}개 · 수정 후 다시 공유할 수 있어요.</p></>}
  </section>;
  const actions=<>
    {question&&<fieldset><legend>유물과 생활 퀴즈 · 일기 문장 고르기</legend><p>{question.prompt}</p>{question.options.map((option,i)=><button type="button" className={styles.quizOption} aria-pressed={record.answers[question.id]===i} key={option} onClick={()=>update({...record,answers:{...record.answers,[question.id]:i}})}><span>{record.answers[question.id]===i?"✓":i+1}</span>{option}</button>)}{record.answers[question.id]!==undefined&&<p role="status" className={styles.clue}>{record.answers[question.id]===question.answer?'정답이에요! 이 문장이 일기에 기록되었어요.':`단서를 다시 읽고 골라 보세요: ${question.hint}`}</p>}</fieldset>}
    {step>=5&&diaryPage}
    {step<7&&<button className={styles.primary} disabled={busy||(question&&record.answers[question.id]!==question.answer)||(step===6&&(!correct||!record.text.trim()))} onClick={()=>run({type:'step',path:path.id,step,mode:alternative?'alternative':'2D'})}>{step===6?'탐험과 일기 완성':question?'일기에 기록하고 다음 장소로 →':'읽고 다음 장소로 →'}</button>}
  </>;
  return <section className={styles.panel}><h3>{story.title} · NPC와 함께 쓰는 일기</h3><p className={styles.muted}>{STORY_NOTICE}</p><p>NPC 대화 → 유물과 생활 퀴즈 → 내 생각 쓰기 → 일기 공유</p><button onClick={()=>setAlternative(v=>!v)}>{alternative?'2D 게임 보기':'텍스트 대체 흐름 사용'}</button>
    {!alternative&&<QuestBoundary resetKey={`${path.id}-${step}`}><Game2D key={path.id} path={path} research={research} step={step} onInteract={()=>{}}>{actions}</Game2D></QuestBoundary>}
    {alternative&&step<7&&<section className={styles.textConversation}><QuestBoundary resetKey={`${path.id}-${step}`}><QuestConversation key={`${path.id}-${step}`} path={path} step={step}><details><summary>필요할 때 단서 다시 보기</summary>{path.clues.map(c=><p className={styles.clue} key={c}>{c}</p>)}</details>{step===2&&path.artifacts.map(a=><ArtifactReference key={a} artifact={a}/>)}{actions}</QuestConversation></QuestBoundary></section>}
    {step<5&&<details><summary>지금까지 쓴 일기 펼치기</summary>{diaryPage}</details>}
    {step>=7&&<><p role="status">탐험을 마쳤어요. 일기를 확인하고 공유해 주세요.</p>{diaryPage}</>}
  </section>;
}
