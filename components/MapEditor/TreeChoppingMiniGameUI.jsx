'use client';

import { useCallback, useEffect, useState } from 'react';
import useMapStore from '@/store/useMapStore';

const CONDITIONS = [
  { type: '이상', matches: (answer, value) => answer >= value, explanation: '기준 수를 포함하여 그보다 큰 수' },
  { type: '이하', matches: (answer, value) => answer <= value, explanation: '기준 수를 포함하여 그보다 작은 수' },
  { type: '초과', matches: (answer, value) => answer > value, explanation: '기준 수를 포함하지 않고 그보다 큰 수' },
  { type: '미만', matches: (answer, value) => answer < value, explanation: '기준 수를 포함하지 않고 그보다 작은 수' }
];

function createProblem() {
  const condition = CONDITIONS[Math.floor(Math.random() * CONDITIONS.length)];
  const value = Math.floor(Math.random() * 7) + 2;
  return { ...condition, value };
}

function requestGamePointerLock() {
  const canvas = document.querySelector('canvas');
  if (!canvas || typeof canvas.requestPointerLock !== 'function') return;
  try {
    const result = canvas.requestPointerLock();
    if (result && typeof result.catch === 'function') result.catch(() => {});
  } catch {
    // Pointer lock can be rejected when the browser no longer considers this a user gesture.
  }
}

export default function TreeChoppingMiniGameUI() {
  const { mineMiniGame, setMineMiniGame } = useMapStore();
  const { active, assetId, assetType } = mineMiniGame;
  const [problem] = useState(createProblem);
  const [answer, setAnswer] = useState('');
  const [feedback, setFeedback] = useState(null);

  const close = useCallback(() => {
    setMineMiniGame(false, null, null);
    requestGamePointerLock();
  }, [setMineMiniGame]);

  const submit = useCallback(() => {
    if (feedback === 'SUCCESS') return;
    const numericAnswer = Number(answer);
    if (!Number.isInteger(numericAnswer) || numericAnswer < 1 || numericAnswer > 10) {
      setFeedback('1부터 10까지의 자연수를 입력해 주세요.');
      return;
    }

    window.dispatchEvent(new CustomEvent('mine-jiggle', { detail: { id: assetId, type: assetType } }));
    if (!problem.matches(numericAnswer, problem.value)) {
      setFeedback(`아직 조건에 맞지 않아요. '${problem.type}'은 ${problem.explanation}를 뜻합니다.`);
      setAnswer('');
      return;
    }

    setFeedback('SUCCESS');
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('mine-complete', { detail: { id: assetId, type: assetType } }));
      setMineMiniGame(false, null, null);
    }, 1000);
  }, [answer, assetId, assetType, feedback, problem, setMineMiniGame]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (!active) return;
      if (event.key === 'Escape') close();
      if (event.key === 'Enter') submit();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [active, close, submit]);

  if (!active || assetType !== 'tree') return null;

  return <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.65)', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
    {feedback === 'SUCCESS' && <div style={{ position: 'absolute', inset: 0, zIndex: 2, background: 'rgba(16,185,129,0.92)', color: 'white', display: 'grid', placeItems: 'center', fontSize: '3.5rem', fontWeight: 900, textAlign: 'center' }}>정답입니다!<br />나무를 채집했어요 🌳</div>}
    <div style={{ width: 'min(620px, 100%)', background: 'white', borderRadius: 24, padding: '2rem', display: 'grid', gap: '1.25rem', boxShadow: '0 24px 70px rgba(0,0,0,0.35)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div><div style={{ color: '#15803d', fontWeight: 800 }}>🌳 나무 채집 수학</div><h2 style={{ margin: '0.25rem 0 0' }}>조건에 맞는 수 찾기</h2></div>
        <button type="button" onClick={close} aria-label="닫기" style={{ border: 0, background: 'transparent', fontSize: 24, cursor: 'pointer' }}>✕</button>
      </div>

      <div style={{ background: '#f0fdf4', border: '2px solid #86efac', borderRadius: 16, padding: '1.4rem', textAlign: 'center' }}>
        <div style={{ fontSize: '1.2rem', marginBottom: 10 }}>나뭇가지가 <b>{problem.value}개 {problem.type}</b>이 되도록 모으려고 합니다.</div>
        <div style={{ fontSize: '1.05rem', color: '#374151' }}>조건을 만족하는 수를 하나 입력하세요. (1~10)</div>
        <div style={{ fontSize: '2.2rem', fontWeight: 900, color: '#166534', marginTop: 14 }}>나뭇가지 {problem.value}개 {problem.type}</div>
      </div>

      <input autoFocus type="number" min="1" max="10" step="1" value={answer} onChange={(event) => { setAnswer(event.target.value); if (feedback) setFeedback(null); }} placeholder="정답 입력" style={{ fontSize: '1.5rem', padding: '0.9rem', textAlign: 'center', border: '2px solid #d1d5db', borderRadius: 12 }} />
      {feedback && feedback !== 'SUCCESS' && <div style={{ background: '#fef2f2', color: '#991b1b', borderRadius: 10, padding: '0.9rem', lineHeight: 1.5 }}>{feedback}</div>}
      <button type="button" onClick={submit} style={{ padding: '0.9rem', border: 0, borderRadius: 12, background: '#16a34a', color: 'white', fontSize: '1.2rem', fontWeight: 800, cursor: 'pointer' }}>정답 확인하고 나무 캐기</button>
      <div style={{ color: '#6b7280', fontSize: '0.85rem', textAlign: 'center' }}>한 문제를 맞히면 나무가 채집됩니다.</div>
    </div>
  </div>;
}
