'use client';

import {useEffect, useRef, useState} from 'react';
import Image from 'next/image';
import styles from './HistoryClassroom.module.css';
import {explorationImage} from '@/lib/history/exploration.mjs';
import {PATHS} from '@/lib/history/content.mjs';

const kinds=['보이는 것','궁금한 것','내 생각·추측'];
const colors=['#fff0a6','#dbeaff','#f6dce9'];
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
// The picture stays in the centre, with a 600px note margin on all eight sides.
const W=2800,H=2268,MARGIN=600;
const frame=image=>({x:MARGIN+((image-1)%2)*800,y:MARGIN+Math.floor((image-1)/2)*534});
const anchor=n=>({x:frame(n.image).x+n.x*800,y:frame(n.image).y+n.y*534});
const position=n=>({
  x:n.noteX===undefined?(n.image%2?100:2250):n.boardVersion===2?n.noteX*W:MARGIN+n.noteX*2140,
  y:n.noteY===undefined?anchor(n).y-70:n.boardVersion===2?n.noteY*H:MARGIN+n.noteY*1068,
});

export default function ObservationBoard({state,draft,change,onMoveNote}) {
  const host=useRef(null),drag=useRef(null);
  const [size,setSize]=useState({width:1600,height:1068});
  const [view,setView]=useState({zoom:1,x:0,y:0});
  const [kind,setKind]=useState(kinds[0]),[tool,setTool]=useState(onMoveNote?'pan':'note'),[selected,setSelected]=useState('');
  const [moving,setMoving]=useState(null);
  useEffect(()=>{
    const observer=new ResizeObserver(([entry])=>setSize({width:entry.contentRect.width,height:entry.contentRect.height}));
    observer.observe(host.current);return()=>observer.disconnect();
  },[]);
  useEffect(()=>{
    const element=host.current;
    const wheel=e=>{if(e.target.closest('textarea'))return;e.preventDefault();e.stopPropagation();setView(v=>({...v,zoom:clamp(v.zoom+(e.deltaY<0?.1:-.1),.5,4)}));};
    element.addEventListener('wheel',wheel,{passive:false});
    return()=>element.removeEventListener('wheel',wheel);
  },[]);
  const scale=Math.min(size.width/W,size.height/H)*view.zoom;
  const paperScale=Math.min(2,Math.max(1,.85/scale));
  const paperPosition=n=>{const p=position(n);return {x:clamp(p.x,0,W-224*paperScale),y:clamp(p.y,0,H-210*paperScale)};};
  const offset={x:(size.width-W*scale)/2+view.x,y:(size.height-H*scale)/2+view.y};
  const ownIds=new Set(draft.notes.map(n=>n.id));
  const notes=[...state.notes.filter(n=>!ownIds.has(n.id)),...draft.notes.map(n=>({...n,author:state.me?.name,authorId:state.me?.id}))];
  const update=(id,patch)=>onMoveNote?onMoveNote(notes.find(n=>n.id===id),patch):change({...draft,notes:draft.notes.map(n=>n.id===id?{...n,...patch}:n)});
  const point=e=>{const r=host.current.getBoundingClientRect();return {x:(e.clientX-r.left-offset.x)/scale,y:(e.clientY-r.top-offset.y)/scale};};
  function add(image,x=.5,y=.5) {
    if(onMoveNote)return;
    const n={id:crypto.randomUUID(),image,x,y,kind,text:''};const p=paperPosition(n);
    change({...draft,notes:[...draft.notes,{...n,noteX:p.x/W,noteY:p.y/H,boardVersion:2}]});setSelected(n.id);
  }
  function down(e,type,n) {
    if(e.button!==0)return;e.preventDefault();e.stopPropagation();
    const p=n?paperPosition(n):view;
    drag.current={type,id:n?.id,x:e.clientX,y:e.clientY,start:p};
    e.currentTarget.setPointerCapture(e.pointerId);if(n)setSelected(n.id);
  }
  function move(e) {
    const d=drag.current;if(!d)return;
    if(d.type==='pan')setView(v=>({...v,x:d.start.x+e.clientX-d.x,y:d.start.y+e.clientY-d.y}));
    else setMoving({id:d.id,x:clamp(d.start.x+(e.clientX-d.x)/scale,0,W-224*paperScale),y:clamp(d.start.y+(e.clientY-d.y)/scale,0,H-210*paperScale)});
  }
  function up() {
    if(moving)update(moving.id,{noteX:moving.x/W,noteY:moving.y/H,boardVersion:2});setMoving(null);drag.current=null;
  }
  const zoom=amount=>setView(v=>({...v,zoom:clamp(v.zoom+amount,.5,4)}));
  return <section className={styles.observationWorkspace} aria-label="그림과 연결 메모 보드">
    <div className={styles.boardToolbar}>
      <strong>관찰 보드</strong><span className={styles.muted}>{onMoveNote?'교사 · 모든 학생 메모 이동 가능':state.liveNotes?'친구 메모 실시간 공개 중':state.published?'선생님이 전체 공개한 메모':'내 메모만 보여요'}</span>
      {!onMoveNote&&kinds.map((k,i)=><button key={k} aria-pressed={tool==='note'&&kind===k} style={{background:colors[i]}} onClick={()=>{setKind(k);setTool('note');}}>{k}</button>)}
      <button aria-pressed={tool==='pan'} onClick={()=>setTool(t=>t==='pan'?'note':'pan')}>✥ 화면 이동</button>
      <span className={styles.boardHint}>{tool==='note'?'그림을 눌러 메모 · 메모 상단을 끌어 이동':'빈 곳을 드래그 · 휠로 확대'}</span>
      <button aria-label="관찰 보드 축소" onClick={()=>zoom(-.25)}>−</button><span>{Math.round(view.zoom*100)}%</span><button aria-label="관찰 보드 확대" onClick={()=>zoom(.25)}>＋</button><button onClick={()=>setView({zoom:1,x:0,y:0})}>화면 맞춤</button>
    </div>
    <div ref={host} className={styles.boardCanvas} onPointerDown={e=>down(e,'pan')} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
      <div className={styles.boardPlane} style={{width:W,height:H,transform:`translate(${offset.x}px,${offset.y}px) scale(${scale})`}}>
        <aside className={styles.noteShelf} aria-hidden="true"><strong>메모지</strong><span>그림의 상하좌우·모서리 어디든 놓아 보세요</span></aside>
        {[1,2,3,4].map(image=><div key={image} className={styles.boardImage} style={{left:frame(image).x,top:frame(image).y}} role="button" tabIndex={0} aria-label={`그림 ${image}. 눌러 연결 메모 추가`} onPointerDown={e=>{if(tool==='note')e.stopPropagation();}} onClick={e=>{if(tool!=='note')return;const p=point(e),f=frame(image);add(image,clamp((p.x-f.x)/800,0,1),clamp((p.y-f.y)/534,0,1));}} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();add(image);}}}>
          <Image src={explorationImage(image)} alt={`역사 관찰 그림 ${image}`} fill sizes={view.zoom>1?'1536px':'50vw'} draggable={false} style={{pointerEvents:'none'}} loading="eager"/>
          <span className={styles.imageLabel}>그림 {image} · 학습용 재구성</span>{PATHS.filter(p=>p.group===image).map((p,i)=><span key={p.id} className={styles.eraLabel} style={{left:`${i%2*50+2}%`,top:`${Math.floor(i/2)*50+7}%`}}>{p.title}</span>)}
        </div>)}
        <svg className={styles.connections} width={W} height={H} aria-label="그림 위치와 메모지를 잇는 연결선">
          {notes.map(n=>{const a=anchor(n),p=moving?.id===n.id?moving:paperPosition(n);return <g key={n.id}><line x1={a.x} y1={a.y} x2={p.x+112*paperScale} y2={p.y+24*paperScale} stroke="white" strokeWidth="6"/><line x1={a.x} y1={a.y} x2={p.x+112*paperScale} y2={p.y+24*paperScale} stroke="#385b54" strokeWidth="2.5"/><circle cx={a.x} cy={a.y} r="7" fill={colors[kinds.indexOf(n.kind)]} stroke="#385b54" strokeWidth="2"/></g>;})}
        </svg>
        {notes.map(n=>{const p=moving?.id===n.id?moving:paperPosition(n),own=ownIds.has(n.id);return <article key={n.id} className={styles.sticky} style={{left:p.x,top:p.y,transform:`scale(${paperScale})`,transformOrigin:'0 0',background:colors[kinds.indexOf(n.kind)],zIndex:selected===n.id?4:3}} onPointerDown={e=>e.stopPropagation()}>
          <div className={styles.stickyHeader}><button className={styles.stickyHandle} disabled={!own&&!onMoveNote} aria-label={`${n.kind} 메모 이동. 방향키 사용 가능`} onPointerDown={e=>down(e,'note',n)} onKeyDown={e=>{const d={ArrowLeft:[-20,0],ArrowRight:[20,0],ArrowUp:[0,-20],ArrowDown:[0,20]}[e.key];if(d){e.preventDefault();update(n.id,{noteX:clamp(p.x+d[0],0,W-224*paperScale)/W,noteY:clamp(p.y+d[1],0,H-210*paperScale)/H,boardVersion:2});}}}>⠿ {n.kind}</button>{own&&<button aria-label="메모 삭제" onClick={()=>change({...draft,notes:draft.notes.filter(x=>x.id!==n.id)})}>×</button>}</div>
          <textarea aria-label={`${n.kind} 관찰 메모`} readOnly={!own} autoFocus={own&&selected===n.id} placeholder={n.kind===kinds[0]?'예: 사람들이 모여 있어요.':n.kind===kinds[1]?'예: 저 물건은 어디에 쓸까요?':'예: 함께 일하는 것 같아요.'} value={n.text} onFocus={()=>setSelected(n.id)} onWheel={e=>e.stopPropagation()} onChange={e=>update(n.id,{text:e.target.value})}/>
          <footer>{n.author} · 그림 {n.image}{!own?(onMoveNote?' · 위치 이동 가능':' · 읽기 전용'):''}</footer>
        </article>;})}
      </div>
    </div>
  </section>;
}
