'use client';

import {useState} from 'react';
import Image from 'next/image';
import {ARTIFACT_REFERENCES} from '@/lib/history/references.mjs';
import styles from './HistoryClassroom.module.css';

export default function ArtifactReference({artifact}) {
  const [open,setOpen]=useState(false);
  const source=ARTIFACT_REFERENCES[artifact];
  if(!source)return null;
  return <details className={styles.artifactReference} onToggle={e=>setOpen(e.currentTarget.open)}>
    <summary>
      <span className={styles.referenceHeading}>교과서 자료 · {artifact} <small>{source.pages}쪽</small></span>
      <span className={styles.referenceInvitation}>{source.photo?'그림에서 본 모습과 실제 유물은 같을까요? 사진을 펼쳐 비교해 보세요.':'교과서에서는 어디를 눈여겨보면 좋을까요? 관찰 안내를 펼쳐 보세요.'}</span>
      <span className={styles.referenceAction}>{open?'자료 접기 ↑':source.photo?'실물 사진 펼쳐 비교하기 ↓':'교과서 관찰 안내 펼치기 ↓'}</span>
    </summary>
    {open&&<>
      {source.photo&&<figure><Image src={source.photo} alt={`교과서에 실린 ${artifact} 실물 사진`} width={320} height={230} unoptimized style={{width:'100%',height:230,objectFit:'contain'}}/><figcaption>제공된 1단원 교과서 {source.pages}쪽의 유물 사진 · 생성 그림과 구분해 살펴봐요.</figcaption></figure>}
      <p className={styles.referenceFocus}><strong>눈여겨볼 부분</strong><br/>{source.observe}</p>
      {!source.photo&&<p className={styles.muted}>교과서 {source.pages}쪽의 실물 사진과 비교해 주세요.</p>}
      <p className={styles.muted}>관찰한 특징을 유물의 쓰임이나 당시 생활과 연결해 보세요.</p>
    </>}
  </details>;
}
