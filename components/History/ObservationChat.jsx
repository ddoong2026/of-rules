'use client';

import {useEffect,useRef,useState} from 'react';
import Image from 'next/image';
import styles from './HistoryClassroom.module.css';
import {explorationImage} from '@/lib/history/exploration.mjs';
import {PATHS} from '@/lib/history/content.mjs';

export default function ObservationChat({state,operate,readOnly=false}) {
  const [text,setText]=useState('');
  const list=useRef(null);
  const messages=state.chat||[];
  useEffect(()=>{const el=list.current;if(el)el.scrollTop=el.scrollHeight;},[messages.length]);
  function send(e) {
    e.preventDefault();
    const value=text.trim();
    if(!value)return;
    operate({type:'chat',text:value});
    setText('');
  }
  return <section className={styles.observationLayout} aria-label="관찰 그림과 실시간 채팅">
    <div className={styles.observationPictures}>{[1,2,3,4].map(image=><div key={image} className={styles.picture}>
      <Image src={explorationImage(image)} alt={`역사 관찰 그림 ${image}`} fill sizes="(max-width: 900px) 45vw, 25vw" style={{objectFit:'contain'}}/>
      <span className={styles.imageLabel}>그림 {image}</span>
      {PATHS.filter(p=>p.group===image).map((p,i)=><span key={p.id} className={styles.eraLabel} style={{left:`${i%2*50+2}%`,top:`${Math.floor(i/2)*50+7}%`}}>{p.title}</span>)}
    </div>)}</div>
    <div className={styles.observationChat} aria-label="관찰 실시간 채팅">
      <div className={styles.boardToolbar}><strong>관찰 채팅</strong><span className={styles.muted}>{readOnly?'전체 학생 실시간 대화 모니터링':'그림에서 본 것과 궁금한 것을 친구들과 실시간으로 나눠 보세요'}</span></div>
      <div ref={list} className={styles.chatMessages} role="log" aria-live="polite" aria-label="채팅 기록">
        {messages.length?messages.map(m=><article key={m.id} className={`${styles.chatMessage} ${!readOnly&&m.authorId===state.me?.id?styles.chatOwn:''}`}>
          <header><strong>{m.author}</strong><time>{new Date(m.at).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'})}</time></header>
          <p>{m.text}</p>
        </article>):<p className={styles.muted}>아직 채팅이 없어요.{!readOnly&&' 그림을 보고 관찰한 것을 먼저 나눠 보세요.'}</p>}
      </div>
      {!readOnly&&<form className={styles.chatForm} onSubmit={send}>
        <label className={styles.chatLabel}>관찰한 것을 나누기<input value={text} maxLength={300} onChange={e=>setText(e.target.value)} placeholder="예: 사람들이 모여 도구를 만들고 있어요."/></label>
        <button className={styles.primary} type="submit" disabled={!text.trim()}>보내기</button>
      </form>}
    </div>
  </section>;
}
