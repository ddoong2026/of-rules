'use client';

import {useEffect,useRef,useState} from 'react';
import {charactersFor,portraitStyle} from '@/lib/history/characters.mjs';
import {questDialogue} from '@/lib/history/stories.mjs';
import styles from './HistoryClassroom.module.css';

function TypedSpeech({text,onFinished}) {
  const [count,setCount]=useState(0);
  useEffect(()=>{
    let shown=0;
    const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let timer;
    const reveal=()=>{
      shown=reduced?text.length:Math.min(text.length,shown+1);
      setCount(shown);
      if(shown===text.length){timer=setTimeout(onFinished,reduced?0:1000);return;}
      const character=text[shown-1];
      const delay=/[.!?。！？…]/.test(character)?900:/[,，:：;]/.test(character)?420:150;
      timer=setTimeout(reveal,delay);
    };
    timer=setTimeout(reveal,reduced?0:150);
    return()=>clearTimeout(timer);
  },[text,onFinished]);
  return <p className={styles.speechText}><span className={styles.speechAccessible}>{text}</span><span aria-hidden="true">{text.slice(0,count)}{count<text.length&&<span className={styles.typingCursor}>▌</span>}</span></p>;
}

export default function QuestConversation({path,step,children}) {
  const [turn,setTurn]=useState(0),[finished,setFinished]=useState(false);
  const [finishTyping]=useState(()=>()=>setFinished(true));
  const activity=useRef(null);
  const lines=questDialogue(path,step),cast=charactersFor(path.id);
  return <section className={styles.conversation} aria-label="캐릭터 대화">
    <header className={styles.conversationHeader}><strong>{path.title} · 퀘스트 {step+1}</strong><span>대화 {turn+1} / {lines.length}</span></header>
    {lines.slice(0,turn+1).map((line,index)=>{
      const player=line.speaker==='player',name=player?'나':cast[line.speaker].name;
      return <div key={index} className={`${styles.speechRow} ${player?styles.playerSpeech:''}`}>
        <div className={styles.speakerPortrait} role="img" aria-label={`${name}의 대화 초상`} style={portraitStyle(path.id,line.speaker)}/>
        <div className={styles.speechBubble}><strong>{name} <small>{player?'나의 생각':cast[line.speaker].role}</small></strong>{index===turn?<TypedSpeech key={index} text={line.text} onFinished={finishTyping}/>:<p className={styles.speechText}>{line.text}</p>}</div>
      </div>;
    })}
    <div className={styles.conversationActions}>{turn<lines.length-1?<button disabled={!finished} onClick={()=>{setFinished(false);setTurn(turn+1);}}>다음 대화 →</button>:!finished?<span>이야기를 듣고 있어요…</span>:<p role="status">이제 배운 내용을 퀘스트에 기록해 보세요.</p>}</div>
    {finished&&turn===lines.length-1&&<>
      <div className={styles.questScrollCue} role="status">
        <button onClick={()=>activity.current?.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'})}>
          <span aria-hidden="true">↓</span> 아래로 휠을 내려 다음 활동을 확인해요 <small>여기를 눌러 이동할 수도 있어요</small>
        </button>
      </div>
      <div ref={activity} className={styles.questActivity}>{children}</div>
    </>}
  </section>;
}
