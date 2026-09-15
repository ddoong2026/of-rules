'use client';

import {useEffect,useRef,useState} from 'react';
import {mapFor,STATIONS,walk,walkToward,gameMapImage} from '@/lib/history/maps.mjs';
import {charactersFor,spriteStyle} from '@/lib/history/characters.mjs';
import QuestConversation from './QuestConversation';
import {PATH_CONTEXT} from '@/lib/history/references.mjs';
import ArtifactReference from './ArtifactReference';
import styles from './HistoryClassroom.module.css';

function Sprite({x,y,facing=0,frame=0,player=false,appearance}) {
  return <div className={styles.gameSprite} role="img" aria-label={player?'나의 캐릭터':`${appearance.name} · ${appearance.role}`} style={{...spriteStyle(appearance,facing,frame),left:`${x/9.6}%`,top:`${y/6.4}%`}}>{player&&<span>나</span>}</div>;
}
export default function HistoryGame2D({path,research=[],step,onInteract,children}) {
  const cast=charactersFor(path.id),map=mapFor(path.id),target=STATIONS[Math.min(step,6)];
  const [pos,setPos]=useState({x:480,y:570}),[dialog,setDialog]=useState(-1),[place,setPlace]=useState(null);
  const [facing,setFacing]=useState(0),[spriteFrame,setSpriteFrame]=useState(0);
  const quadrant=path.id.charCodeAt(2)-65;
  const destination=useRef(null),keys=useRef(new Set()),position=useRef(pos),frame=useRef(null),last=useRef(0);
  const close=Math.hypot(pos.x-target.x,pos.y-target.y)<90;
  const records=path.artifacts.map(artifact=>research.find(r=>r.artifact===artifact&&r.usage?.trim())).filter(Boolean);
  const evidence=path.artifacts.join(' · ') || '교과서 단서';
  const quests=[`${map.left} · 생활 배경 살피기`,`${cast.companion.name}에게 당시 생활 묻기`,`${evidence}의 쓰임 확인하기`,`${map.right} · 생활 비교하기`,`${evidence}와 교과서 단서 연결하기`,'퀴즈로 기록한 일기 살펴보기','나의 감정과 생각으로 일기 완성하기'];
  useEffect(()=>{
    const heldKeys=keys.current;
    function pause(){destination.current=null;heldKeys.clear();cancelAnimationFrame(frame.current);frame.current=null;last.current=0;setSpriteFrame(0);}
    function visibility(){if(document.hidden)pause();}
    window.addEventListener('blur',pause);
    document.addEventListener('visibilitychange',visibility);
    return ()=>{window.removeEventListener('blur',pause);document.removeEventListener('visibilitychange',visibility);cancelAnimationFrame(frame.current);heldKeys.clear();};
  },[]);
  function stop(){destination.current=null;keys.current.clear();cancelAnimationFrame(frame.current);frame.current=null;last.current=0;setSpriteFrame(0);}
  function tick(time) {
    const dt=Math.min((time-(last.current||time))/1000,.04);last.current=time;
    const goal=destination.current;
    if(goal){
      const dx=goal.x-position.current.x,dy=goal.y-position.current.y,distance=Math.hypot(dx,dy);
      if(distance<4){stop();if(goal.interact&&(step<7||goal.place!=null)){setPlace(goal.place??null);setDialog(step);if(goal.place==null)onInteract();}return;}
      const next=walkToward(position.current,goal,dt);
      if(dt>0&&next.x===position.current.x&&next.y===position.current.y){stop();return;}
      setFacing(Math.abs(dx)>Math.abs(dy)?(dx<0?1:2):(dy<0?3:0));setSpriteFrame(Math.floor(time/130)%4);
      position.current=next;setPos(next);frame.current=requestAnimationFrame(tick);return;
    }
    const k=keys.current,dx=Number(k.has('ArrowRight')||k.has('d'))-Number(k.has('ArrowLeft')||k.has('a')),dy=Number(k.has('ArrowDown')||k.has('s'))-Number(k.has('ArrowUp')||k.has('w'));
    if(dx||dy){setFacing(Math.abs(dx)>Math.abs(dy)?(dx<0?1:2):(dy<0?3:0));setSpriteFrame(Math.floor(time/130)%4);const speed=190*dt/Math.hypot(dx,dy);position.current=walk(position.current,dx*speed,dy*speed);setPos(position.current);}
    if(k.size)frame.current=requestAnimationFrame(tick);else {frame.current=null;last.current=0;setSpriteFrame(0);}
  }
  function start(key){destination.current=null;keys.current.add(key);if(frame.current===null)frame.current=requestAnimationFrame(tick);}
  function nudge(key){
    const dx=key==='ArrowLeft'?-24:key==='ArrowRight'?24:0,dy=key==='ArrowUp'?-24:key==='ArrowDown'?24:0;
    setFacing(dx<0?1:dx>0?2:dy<0?3:0);position.current=walk(position.current,dx,dy);setPos(position.current);
  }
  function moveTo(point,interact=false,place=null){stop();setDialog(-1);destination.current={...point,interact,place};frame.current=requestAnimationFrame(tick);}
  function clickMap(e){
    if(e.target.closest('button,aside'))return;
    const rect=e.currentTarget.getBoundingClientRect(),point={x:(e.clientX-rect.left)/rect.width*960,y:(e.clientY-rect.top)/rect.height*640};
    if(step<7&&Math.hypot(point.x-target.x,point.y-target.y)<75)moveTo(target,true);else moveTo(point);
  }
  function interact(){if(close&&step<7){stop();setPlace(null);setDialog(step);onInteract();}}
  return <div className={styles.game2d}>
    <div className={styles.gameTop}><strong>{path.title} · {map.title}</strong><span>지도 클릭으로 이동 · 목표 클릭으로 대화</span></div>
    <div className={styles.gameViewport} onClick={clickMap} tabIndex={0} role="application" aria-label={`${path.title} 2D 탐험 지도. 지도 클릭으로 이동, 목표 클릭으로 상호작용. 방향키와 E도 사용 가능`} onBlur={stop} onKeyDown={e=>{const key=e.key.toLowerCase()==='e'?'e':e.key.length===1?e.key.toLowerCase():e.key;if(key==='e'){e.preventDefault();interact();}else if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','w','a','s','d'].includes(key)){e.preventDefault();start(key);}}} onKeyUp={e=>keys.current.delete(e.key.length===1?e.key.toLowerCase():e.key)}>
      <div className={styles.gameBackdrop} style={{backgroundImage:`url(${gameMapImage(path.group)})`,backgroundPosition:`${quadrant%2*100}% ${Math.floor(quadrant/2)*100}%`}}/>
      <aside className={styles.questTracker} aria-label="체험 퀘스트 목록">
        <strong>탐험 퀘스트 · {Math.min(step,7)} / 7</strong>
        <ol>{quests.map((quest,index)=><li key={quest} className={index<step?styles.questDone:index===step?styles.questActive:''}><span>{index<step?'✓':String(index+1).padStart(2,'0')}</span><button disabled={index!==step} onClick={()=>moveTo(target,true)}>{quest}</button>{index===2&&path.artifacts.length>0&&<small>조사한 자료와 연결</small>}</li>)}</ol>
      </aside>
      <button className={`${styles.gamePlace} ${styles.locationButton}`} style={{left:'20%',top:'36%'}} onClick={()=>moveTo(STATIONS[0],true,step===0?null:0)}>{map.left} · 살펴보기</button><button className={`${styles.gamePlace} ${styles.locationButton}`} style={{left:'80%',top:'65%'}} onClick={()=>moveTo(STATIONS[3],true,step===3?null:1)}>{map.right} · 살펴보기</button>
      <Sprite x={340} y={270} appearance={cast.companion}/><span className={`${styles.gamePlace} ${styles.npcLabel}`} style={{left:'35.4%',top:'47%'}}>{cast.companion.name} · {cast.companion.role}</span>
      <Sprite x={630} y={320} appearance={cast.expert}/><span className={`${styles.gamePlace} ${styles.npcLabel}`} style={{left:'65.6%',top:'55%'}}>{cast.expert.name} · {cast.expert.role}</span><span className={styles.gamePlace} style={{left:'78.1%',top:'75%'}}>다른 장면</span><span className={styles.gamePlace} style={{left:'52.1%',top:'84%'}}>생각 정리</span>
      {step<7&&<button aria-label={`${quests[step]} · 이동하고 상호작용`} onClick={()=>moveTo(target,true)} className={styles.gameTarget} style={{left:`${target.x/9.6}%`,top:`${target.y/6.4}%`}}><span style={step===0?{top:-76}:undefined}>▼ 클릭하여 조사</span></button>}
      <Sprite x={pos.x} y={pos.y} facing={facing} frame={spriteFrame} player appearance={cast.player}/>
    </div>
    <div className={styles.gameControls}><span>{close?'상호작용 버튼으로 대화할 수 있어요.':'지도나 현재 퀘스트를 클릭해 이동하세요. 장애물은 돌아가세요.'}</span>{[['←','ArrowLeft'],['↑','ArrowUp'],['↓','ArrowDown'],['→','ArrowRight']].map(([label,key])=><button key={key} aria-label={`캐릭터 ${label} 이동`} onClick={e=>{if(e.detail===0)nudge(key);}} onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);start(key);}} onPointerUp={stop} onPointerCancel={stop} onBlur={stop}>{label}</button>)}<button disabled={step>=7} onClick={()=>close?interact():moveTo(target,true)}>{close?'상호작용':'퀘스트 장소로 이동'}</button></div>
    {dialog===step&&<div className={styles.gameDialog} role="region" aria-label="NPC 대화"><QuestConversation key={`${path.id}-${step}-${place}`} path={path} step={place===null?step:place===0?0:3}>{[1,2,3,4].includes(step)&&<details><summary>필요할 때 단서 다시 보기</summary><p className={styles.clue}>{path.clues[step===2||step===3?1:0]}</p></details>}{[2,4,5,6].includes(step)&&records.map(r=><p className={styles.clue} key={r.artifact}>우리 모둠 조사 기록 · {r.artifact}: {r.usage}{r.source&&<small> · 출처: {r.source}</small>}</p>)}{step===2&&<><p>{evidence}의 자료를 앞서 조사한 쓰임과 비교해 보세요. 당시 사람들의 생활을 무엇으로 알 수 있을까요?</p>{PATH_CONTEXT[path.id]&&<p className={styles.muted}>{PATH_CONTEXT[path.id]}</p>}{path.artifacts.map(a=><ArtifactReference key={a} artifact={a}/>)}{!path.artifacts.length&&path.clues.map(c=><p key={c}>{c}</p>)}</>}{place===null&&children}</QuestConversation><button onClick={()=>setDialog(-1)}>대화 닫기</button></div>}
  </div>;
}
