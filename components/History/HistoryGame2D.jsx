'use client';

import {useEffect,useRef,useState} from 'react';
import {mapFor,STATIONS,walk} from '@/lib/history/maps.mjs';
import styles from './HistoryClassroom.module.css';

function Sprite({x,y,facing=0,frame=0,player=false}) {
  return <div className={styles.gameSprite} style={{left:`${x/9.6}%`,top:`${y/6.4}%`,backgroundPosition:`${frame*100/3}% ${facing*100/3}%`}}>{player&&<span>나</span>}</div>;
}
export default function HistoryGame2D({path,step,onInteract}) {
  const map=mapFor(path.id),target=STATIONS[Math.min(step,6)];
  const [pos,setPos]=useState({x:480,y:570}),[dialog,setDialog]=useState(-1);
  const [facing,setFacing]=useState(0),[spriteFrame,setSpriteFrame]=useState(0);
  const quadrant=path.id.charCodeAt(2)-65;
  const keys=useRef(new Set()),position=useRef(pos),frame=useRef(null),last=useRef(0);
  const close=Math.hypot(pos.x-target.x,pos.y-target.y)<90;
  const message=step===1?path.clues[0]:step===3?path.clues[1]:step===2?`찾아볼 자료: ${path.artifacts.join(' · ') || '교과서의 상황 자료'}. 그림을 확대해 형태와 쓰임을 살펴보세요.`:step===4?path.clues.join(' '):step===5?path.questions[0].prompt:step===6?path.situation:`${map.title}에 도착했어요. 표시된 장소를 따라 단서를 찾아보세요.`;
  useEffect(()=>()=>{cancelAnimationFrame(frame.current);keys.current.clear();},[]);
  function stop(){keys.current.clear();cancelAnimationFrame(frame.current);frame.current=null;last.current=0;setSpriteFrame(0);}
  function tick(time) {
    const dt=Math.min((time-(last.current||time))/1000,.04);last.current=time;
    const k=keys.current,dx=Number(k.has('ArrowRight')||k.has('d'))-Number(k.has('ArrowLeft')||k.has('a')),dy=Number(k.has('ArrowDown')||k.has('s'))-Number(k.has('ArrowUp')||k.has('w'));
    if(dx||dy){setFacing(Math.abs(dx)>Math.abs(dy)?(dx<0?1:2):(dy<0?3:0));setSpriteFrame(Math.floor(time/130)%4);const speed=190*dt/Math.hypot(dx,dy);position.current=walk(position.current,dx*speed,dy*speed);setPos(position.current);}
    if(k.size)frame.current=requestAnimationFrame(tick);else {frame.current=null;last.current=0;setSpriteFrame(0);}
  }
  function start(key){keys.current.add(key);if(frame.current===null)frame.current=requestAnimationFrame(tick);}
  function interact(){if(close){setDialog(step);onInteract();}}
  return <div className={styles.game2d}>
    <div className={styles.gameTop}><strong>{path.title} · {map.title}</strong><span>방향키 / WASD 이동 · E 대화</span></div>
    <div className={styles.gameViewport} tabIndex={0} role="application" aria-label={`${path.title} 2D 탐험 지도. 방향키 이동, E 상호작용`} onBlur={stop} onKeyDown={e=>{const key=e.key.toLowerCase()==='e'?'e':e.key.length===1?e.key.toLowerCase():e.key;if(key==='e'){e.preventDefault();interact();}else if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','w','a','s','d'].includes(key)){e.preventDefault();start(key);}}} onKeyUp={e=>keys.current.delete(e.key.length===1?e.key.toLowerCase():e.key)}>
      <div className={styles.gameBackdrop} style={{backgroundImage:`url(/history/game-map-${path.group}.png)`,backgroundPosition:`${quadrant%2*100}% ${Math.floor(quadrant/2)*100}%`}}/>
      <span className={styles.gamePlace} style={{left:'20%',top:'30%'}}>{map.left}</span><span className={styles.gamePlace} style={{left:'80%',top:'30%'}}>{map.right}</span>
      <Sprite x={340} y={270}/><span className={styles.gamePlace} style={{left:'35.4%',top:'47%'}}>마을 사람</span>
      <span className={styles.gamePlace} style={{left:'65.6%',top:'55%'}}>유물 조사</span><span className={styles.gamePlace} style={{left:'78.1%',top:'75%'}}>다른 장면</span><span className={styles.gamePlace} style={{left:'52.1%',top:'84%'}}>생각 정리</span>
      {step<7&&<div className={styles.gameTarget} style={{left:`${target.x/9.6}%`,top:`${target.y/6.4}%`}}><span>▼ 여기로</span></div>}
      <Sprite x={pos.x} y={pos.y} facing={facing} frame={spriteFrame} player/>
    </div>
    <div className={styles.gameControls}><span>{close?'E 키 또는 상호작용 버튼을 누르세요.':'표시된 장소 가까이 이동해 주세요.'}</span>{[['←','ArrowLeft'],['↑','ArrowUp'],['↓','ArrowDown'],['→','ArrowRight']].map(([label,key])=><button key={key} aria-label={`캐릭터 ${label} 이동`} onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);start(key);}} onPointerUp={stop} onPointerCancel={stop} onBlur={stop}>{label}</button>)}<button disabled={!close||step>=7} onClick={interact}>상호작용 · E</button></div>
    {dialog===step&&<div className={styles.gameDialog} role="status"><strong>{step===1||step===4?'마을 사람':'발견한 단서'}</strong><p>{message}</p><button onClick={()=>setDialog(-1)}>닫기</button></div>}
  </div>;
}
