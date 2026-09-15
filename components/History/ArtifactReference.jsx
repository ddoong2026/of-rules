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
    <summary>{artifact} · 교과서 {source.pages}쪽 자료 보기</summary>
    {open&&<>
      {source.photo&&<figure><Image src={source.photo} alt={`교과서에 실린 ${artifact} 실물 사진`} width={320} height={230} unoptimized style={{width:'100%',height:230,objectFit:'contain'}}/><figcaption>제공된 1단원 교과서 {source.pages}쪽의 유물 사진 · 생성 그림과 구분해 살펴봐요.</figcaption></figure>}
      <p>{source.observe}</p>
      {!source.photo&&<p className={styles.muted}>교과서 {source.pages}쪽의 실물 사진과 비교해 주세요.</p>}
    </>}
  </details>;
}
