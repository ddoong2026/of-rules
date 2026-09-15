'use client';

import {useEffect,useRef,useState} from 'react';
import {mapFor,STATIONS,walk,gameMapImage} from '@/lib/history/maps.mjs';
import {charactersFor,spriteStyle} from '@/lib/history/characters.mjs';
import {STORIES,storyLines} from '@/lib/history/stories.mjs';
import {PATH_CONTEXT} from '@/lib/history/references.mjs';
import ArtifactReference from './ArtifactReference';
import styles from './HistoryClassroom.module.css';

function Sprite({x,y,facing=0,frame=0,player=false,appearance}) {
  return <div className={styles.gameSprite} role="img" aria-label={player?'나의 캐릭터':`${appearance.name} · ${appearance.role}`} style={{...spriteStyle(appearance,facing,frame),left:`${x/9.6}%`,top:`${y/6.4}%`}}>{player&&<span>나</span>}</div>;
}
export default function HistoryGame2D({path,step,onInteract}) {
  const cast=charactersFor(path.id),map=mapFor(path.id),target=STATIONS[Math.min(step,6)];
  const [pos,setPos]=useState({x:480,y:570}),[dialog,setDialog]=useState(-1);
  const [facing,setFacing]=useState(0),[spriteFrame,setSpriteFrame]=useState(0);
  const quadrant=path.id.charCodeAt(2)-65;
  const keys=useRef(new Set()),position=useRef(pos),frame=useRef(null),last=useRef(0);
  const close=Math.hypot(pos.x-target.x,pos.y-target.y)<90;
  const story=STORIES[path.id],message=storyLines(path)[step] || story.reflection;
  useEffect(()=>{
    const heldKeys=keys.current;
    function pause(){heldKeys.clear();cancelAnimationFrame(frame.current);frame.current=null;last.current=0;setSpriteFrame(0);}
    function visibility(){if(document.hidden)pause();}
    window.addEventListener('blur',pause);
    document.addEventListener('visibilitychange',visibility);
    return ()=>{window.removeEventListener('blur',pause);document.removeEventListener('visibilitychange',visibility);cancelAnimationFrame(frame.current);heldKeys.clear();};
  },[]);
  function stop(){keys.current.clear();cancelAnimationFrame(frame.current);frame.current=null;last.current=0;setSpriteFrame(0);}
  function tick(time) {
    const dt=Math.min((time-(last.current||time))/1000,.04);last.current=time;
    const k=keys.current,dx=Number(k.has('ArrowRight')||k.has('d'))-Number(k.has('ArrowLeft')||k.has('a')),dy=Number(k.has('ArrowDown')||k.has('s'))-Number(k.has('ArrowUp')||k.has('w'));
    if(dx||dy){setFacing(Math.abs(dx)>Math.abs(dy)?(dx<0?1:2):(dy<0?3:0));setSpriteFrame(Math.floor(time/130)%4);const speed=190*dt/Math.hypot(dx,dy);position.current=walk(position.current,dx*speed,dy*speed);setPos(position.current);}
    if(k.size)frame.current=requestAnimationFrame(tick);else {frame.current=null;last.current=0;setSpriteFrame(0);}
  }
  function start(key){keys.current.add(key);if(frame.current===null)frame.current=requestAnimationFrame(tick);}
  function nudge(key){
    const dx=key==='ArrowLeft'?-24:key==='ArrowRight'?24:0,dy=key==='ArrowUp'?-24:key==='ArrowDown'?24:0;
    setFacing(dx<0?1:dx>0?2:dy<0?3:0);position.current=walk(position.current,dx,dy);setPos(position.current);
  }
  function interact(){if(close){setDialog(step);onInteract();}}
  return <div className={styles.game2d}>
    <div className={styles.gameTop}><strong>{path.title} · {map.title}</strong><span>방향키 / WASD 이동 · E 대화</span></div>
    <div className={styles.gameViewport} tabIndex={0} role="application" aria-label={`${path.title} 2D 탐험 지도. 방향키 이동, E 상호작용`} onBlur={stop} onKeyDown={e=>{const key=e.key.toLowerCase()==='e'?'e':e.key.length===1?e.key.toLowerCase():e.key;if(key==='e'){e.preventDefault();interact();}else if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','w','a','s','d'].includes(key)){e.preventDefault();start(key);}}} onKeyUp={e=>keys.current.delete(e.key.length===1?e.key.toLowerCase():e.key)}>
      <div className={styles.gameBackdrop} style={{backgroundImage:`url(${gameMapImage(path.group)})`,backgroundPosition:`${quadrant%2*100}% ${Math.floor(quadrant/2)*100}%`}}/>
      <span className={styles.gamePlace} style={{left:'20%',top:'30%'}}>{map.left}</span><span className={styles.gamePlace} style={{left:'80%',top:'30%'}}>{map.right}</span>
      <Sprite x={340} y={270} appearance={cast.companion}/><span className={styles.gamePlace} style={{left:'35.4%',top:'47%'}}>{cast.companion.name} · {cast.companion.role}</span>
      <Sprite x={630} y={320} appearance={cast.expert}/><span className={styles.gamePlace} style={{left:'65.6%',top:'55%'}}>{cast.expert.name} · {cast.expert.role}</span><span className={styles.gamePlace} style={{left:'78.1%',top:'75%'}}>다른 장면</span><span className={styles.gamePlace} style={{left:'52.1%',top:'84%'}}>생각 정리</span>
      {step<7&&<div className={styles.gameTarget} style={{left:`${target.x/9.6}%`,top:`${target.y/6.4}%`}}><span>▼ 여기로</span></div>}
      <Sprite x={pos.x} y={pos.y} facing={facing} frame={spriteFrame} player appearance={cast.player}/>
    </div>
    <div className={styles.gameControls}><span>{close?'E 키 또는 상호작용 버튼을 누르세요.':'표시된 장소 가까이 이동해 주세요.'}</span>{[['←','ArrowLeft'],['↑','ArrowUp'],['↓','ArrowDown'],['→','ArrowRight']].map(([label,key])=><button key={key} aria-label={`캐릭터 ${label} 이동`} onClick={e=>{if(e.detail===0)nudge(key);}} onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);start(key);}} onPointerUp={stop} onPointerCancel={stop} onBlur={stop}>{label}</button>)}<button disabled={!close||step>=7} onClick={interact}>상호작용 · E</button></div>
    {dialog===step&&<div className={styles.gameDialog} role="region" aria-label="NPC 대화"><strong>{step===2?`${cast.expert.name} · ${cast.expert.role}`:step===1||step===4?`${cast.companion.name} · ${cast.companion.role}`:'나의 생각'}</strong>{[1,2,4].includes(step)&&<small className={styles.muted}>이야기 속 가상 인물</small>}<p>{step===2?`나는 ${cast.expert.name}, ${cast.expert.role}이야. 이 자료를 함께 살펴보며 네 고민에 도움이 될 단서를 찾아보자.`:message}</p>{[1,3,4].includes(step)&&<p className={styles.clue}>교과서 단서: {path.clues[step===3?1:0]}</p>}{step===2&&<>{PATH_CONTEXT[path.id]&&<p className={styles.muted}>{PATH_CONTEXT[path.id]}</p>}{path.artifacts.map(a=><ArtifactReference key={a} artifact={a}/>)}{!path.artifacts.length&&path.clues.map(c=><p key={c}>{c}</p>)}</>}<button onClick={()=>setDialog(-1)}>닫기</button></div>}
  </div>;
}
