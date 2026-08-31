'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import useMapStore from '@/store/useMapStore';

function generateSingleCondition(isRange, oldCond = null) {
  if (!isRange) {
    const type = oldCond ? oldCond.type : ['초과', '미만', '이상', '이하'][Math.floor(Math.random() * 4)];
    let value;
    do {
      value = Math.floor(Math.random() * 8) + 2; // 2 to 9
    } while (oldCond && value === oldCond.value);

    return {
      isRange: false,
      type,
      value,
      text: `${value} ${type}`
    };
  } else {
    const type1 = oldCond ? oldCond.type1 : ['초과', '이상'][Math.floor(Math.random() * 2)];
    const type2 = oldCond ? oldCond.type2 : ['미만', '이하'][Math.floor(Math.random() * 2)];
    let value1, value2;
    while (true) {
      value1 = Math.floor(Math.random() * 7) + 1;
      value2 = Math.floor(Math.random() * 7) + 4;
      if (value1 >= value2) continue;
      if (oldCond && value1 === oldCond.value1 && value2 === oldCond.value2) continue;
      
      let hasValid = false;
      for (let i = 1; i <= 10; i++) {
        const c1 = type1 === '초과' ? i > value1 : i >= value1;
        const c2 = type2 === '미만' ? i < value2 : i <= value2;
        if (c1 && c2) {
          hasValid = true;
          break;
        }
      }
      if (hasValid) break;
    }
    return {
      isRange: true,
      type1,
      type2,
      value1,
      value2,
      text: `${value1} ${type1} ${value2} ${type2}`
    };
  }
}

function generateCondition(oldCond = null) {
  const isRange = oldCond ? oldCond.isRange : Math.random() > 0.5;
  let gameType = oldCond ? oldCond.gameType : 'multi-select';
  
  if (!oldCond) {
    const gameTypeRand = Math.random();
    if (gameTypeRand > 0.66) gameType = 'text-to-line';
    else if (gameTypeRand > 0.33) gameType = 'line-to-text';
  }

  const trueCond = generateSingleCondition(isRange, oldCond);
  trueCond.gameType = gameType;

  if (gameType === 'multi-select') {
    trueCond.isNumberLine = oldCond ? oldCond.isNumberLine : Math.random() > 0.5;
  } else {
    const options = [trueCond];
    if (!trueCond.isRange) {
      const types = ['초과', '미만', '이상', '이하'];
      const otherTypes = types.filter(t => t !== trueCond.type).sort(() => Math.random() - 0.5);
      for (let i = 0; i < 3; i++) {
        options.push({
          ...trueCond,
          type: otherTypes[i],
          text: `${trueCond.value} ${otherTypes[i]}`
        });
      }
    } else {
      const allType1 = ['초과', '이상'];
      const allType2 = ['미만', '이하'];
      allType1.forEach(t1 => {
        allType2.forEach(t2 => {
          if (t1 === trueCond.type1 && t2 === trueCond.type2) return;
          options.push({
            ...trueCond,
            type1: t1,
            type2: t2,
            text: `${trueCond.value1} ${t1} ${trueCond.value2} ${t2}`
          });
        });
      });
    }
    trueCond.options = options.sort(() => Math.random() - 0.5);
  }
  return trueCond;
}

function checkCondition(val, cond) {
  if (!cond.isRange) {
    if (cond.type === '초과') return val > cond.value;
    if (cond.type === '미만') return val < cond.value;
    if (cond.type === '이상') return val >= cond.value;
    if (cond.type === '이하') return val <= cond.value;
  } else {
    const c1 = cond.type1 === '초과' ? val > cond.value1 : val >= cond.value1;
    const c2 = cond.type2 === '미만' ? val < cond.value2 : val <= cond.value2;
    return c1 && c2;
  }
  return false;
}

export default function MiningMiniGameUI() {
  const { mineMiniGame, setMineMiniGame } = useMapStore();
  const { active, assetId, assetType } = mineMiniGame;

  const [condition, setCondition] = useState(null);
  const [successCount, setSuccessCount] = useState(0);
  const [feedback, setFeedback] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [canRetry, setCanRetry] = useState(false);
  const [userAnswerStr, setUserAnswerStr] = useState('');
  const [attempts, setAttempts] = useState(0);

  const [selectedNumbers, setSelectedNumbers] = useState(new Set());
  const [selectedOptionIndex, setSelectedOptionIndex] = useState(null);

  const [isDragging, setIsDragging] = useState(false);
  const [dragMode, setDragMode] = useState(null);

  const initRound = useCallback((keepType = false) => {
    setCondition(prev => keepType && prev ? generateCondition(prev) : generateCondition());
    setSelectedNumbers(new Set());
    setSelectedOptionIndex(null);
    setFeedback(null);
    setErrorMessage('');
    setCanRetry(false);
    setUserAnswerStr('');
    setAttempts(0);
  }, []);

  useEffect(() => {
    if (active) {
      setSuccessCount(0);
      initRound();
    }
  }, [active, initRound]);

  const handleMouseDown = (num) => {
    if (feedback !== null) return;
    setIsDragging(true);
    const newSet = new Set(selectedNumbers);
    const mode = newSet.has(num) ? 'deselect' : 'select';
    setDragMode(mode);
    if (mode === 'select') newSet.add(num);
    else newSet.delete(num);
    setSelectedNumbers(newSet);
  };

  const handleMouseEnter = (num) => {
    if (!isDragging || !dragMode || feedback !== null) return;
    const newSet = new Set(selectedNumbers);
    if (dragMode === 'select') newSet.add(num);
    else newSet.delete(num);
    setSelectedNumbers(newSet);
  };

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setDragMode(null);
  }, []);

  useEffect(() => {
    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, [handleMouseUp]);

  const handleSubmit = useCallback(() => {
    if (feedback !== null || !condition) return;

    let userAnswer = '';
    if (condition.gameType === 'multi-select') {
      userAnswer = Array.from(selectedNumbers).sort((a, b) => a - b).join(', ');
      if (userAnswer === '') userAnswer = '선택 안 함';
    } else {
      if (selectedOptionIndex !== null) {
        userAnswer = condition.options[selectedOptionIndex].text;
      }
    }
    setUserAnswerStr(userAnswer);

    let isSuccess = false;
    let err = '';

    if (condition.gameType === 'multi-select') {
      let correct = true;
      let missed = [];
      let wrongSelected = [];

      for (let i = 1; i <= 10; i++) {
        const shouldBeSelected = checkCondition(i, condition);
        const isSelected = selectedNumbers.has(i);
        if (shouldBeSelected && !isSelected) missed.push(i);
        if (!shouldBeSelected && isSelected) wrongSelected.push(i);
      }

      if (missed.length > 0 || wrongSelected.length > 0) {
        correct = false;

        if (attempts === 0) {
          let concepts = [];
          if (condition.isRange) {
            if (condition.type1 === '초과') concepts.push(`'초과'는 기준 수보다 크다는 뜻으로, 기준 수를 포함하지 않아요.`);
            else if (condition.type1 === '이상') concepts.push(`'이상'은 기준 수보다 크거나 같다는 뜻으로, 기준 수도 포함해요.`);

            if (condition.type2 === '미만') concepts.push(`'미만'은 기준 수보다 작다는 뜻으로, 기준 수를 포함하지 않아요.`);
            else if (condition.type2 === '이하') concepts.push(`'이하'는 기준 수보다 작거나 같다는 뜻으로, 기준 수도 포함해요.`);
          } else {
            if (condition.type === '초과') concepts.push(`'초과'는 기준 수보다 크다는 뜻으로, 기준 수를 포함하지 않아요.`);
            else if (condition.type === '미만') concepts.push(`'미만'은 기준 수보다 작다는 뜻으로, 기준 수를 포함하지 않아요.`);
            else if (condition.type === '이상') concepts.push(`'이상'은 기준 수보다 크거나 같다는 뜻으로, 기준 수도 포함해요.`);
            else if (condition.type === '이하') concepts.push(`'이하'는 기준 수보다 작거나 같다는 뜻으로, 기준 수도 포함해요.`);
          }
          err = `아직 정답이 아니에요! 개념을 다시 한 번 생각해 볼까요?\n\n💡 ${concepts.join('\n💡 ')}`;
        } else {
          if (missed.length > 0 && wrongSelected.length > 0) {
            err = `${missed.join(', ')}은(는) 포함해야 하고, ${wrongSelected.join(', ')}은(는) 빼야 해요.`;
          } else if (missed.length > 0) {
            err = `${missed.join(', ')}도 포함해야 해요.`;
          } else {
            err = `${wrongSelected.join(', ')}은(는) 포함하면 안 돼요.`;
          }
        }
      }
      isSuccess = correct;
    } else {
      if (selectedOptionIndex === null) {
        err = '정답을 선택해주세요.';
        isSuccess = false;
      } else {
        const selected = condition.options[selectedOptionIndex];
        isSuccess = selected.text === condition.text;
        if (!isSuccess) {
          let detail = '';
          if (!condition.isRange) {
            const v = condition.value;
            const cType = condition.type;
            const uType = selected.type;
            let reason = '';

            if ((cType === '초과' && uType === '미만') || (cType === '미만' && uType === '초과') ||
              (cType === '이상' && uType === '이하') || (cType === '이하' && uType === '이상')) {
              reason = '방향을 반대로 생각했어요! ';
              if (cType === '초과' || cType === '이상') reason += '오른쪽(더 큰 수)을 의미합니다.';
              else reason += '왼쪽(더 작은 수)을 의미합니다.';
            } else if ((cType === '초과' && uType === '이상') || (cType === '미만' && uType === '이하')) {
              reason = '거의 맞혔어요! 하지만 해당 숫자는 포함하지 않아야 해요. (빈 동그라미)';
            } else if ((cType === '이상' && uType === '초과') || (cType === '이하' && uType === '미만')) {
              reason = '거의 맞혔어요! 해당 숫자도 포함해야 해요. (색칠된 동그라미)';
            } else {
              reason = '방향과 포함 여부를 다시 한 번 확인해 보세요.';
            }

            if (cType === '초과') detail = `'초과'란 ${v}보다 크다는 뜻입니다. ${v}은(는) 포함되지 않아요.`;
            else if (cType === '미만') detail = `'미만'이란 ${v}보다 작다는 뜻입니다. ${v}은(는) 포함되지 않아요.`;
            else if (cType === '이상') detail = `'이상'이란 ${v}보다 크거나 같다는 뜻입니다. ${v}도 포함해야 해요.`;
            else if (cType === '이하') detail = `'이하'란 ${v}보다 작거나 같다는 뜻입니다. ${v}도 포함해야 해요.`;

            err = `틀렸어요! 정답은 '${condition.text}' 입니다.\n${reason}\n💡 ${detail}`;
          } else {
            const c1 = condition.type1;
            const c2 = condition.type2;
            const u1 = selected.type1;
            const u2 = selected.type2;
            let reason = '';

            if (c1 !== u1 && c2 !== u2) {
              reason = '양쪽 경계의 포함 여부를 모두 다르게 생각했어요.';
            } else if (c1 !== u1) {
              reason = `왼쪽 경계(${condition.value1})의 포함 여부를 다르게 생각했어요.`;
            } else if (c2 !== u2) {
              reason = `오른쪽 경계(${condition.value2})의 포함 여부를 다르게 생각했어요.`;
            } else {
              reason = '수직선의 의미를 다시 확인해 보세요.';
            }

            const v1 = condition.value1;
            const v2 = condition.value2;
            const exp1 = c1 === '초과' ? `${v1}보다 크고 (${v1} 미포함)` : `${v1}보다 크거나 같고 (${v1} 포함)`;
            const exp2 = c2 === '미만' ? `${v2}보다 작은 (${v2} 미포함)` : `${v2}보다 작거나 같은 (${v2} 포함)`;
            detail = `정답은 ${exp1}, ${exp2} 수를 의미합니다.`;

            err = `틀렸어요! 정답은 '${condition.text}' 입니다.\n${reason}\n💡 ${detail}`;
          }
        }
      }
    }

    if (selectedOptionIndex === null && condition.gameType !== 'multi-select') {
      return;
    }

    window.dispatchEvent(new CustomEvent('mine-jiggle', { detail: { id: assetId, type: assetType } }));

    if (isSuccess) {
      setFeedback('SUCCESS');
      setErrorMessage('');
      setTimeout(() => {
        if (attempts === 0) {
          if (successCount + 1 >= 2) {
            window.dispatchEvent(new CustomEvent('mine-complete', { detail: { id: assetId, type: assetType } }));
            setMineMiniGame(false, null, null);
          } else {
            setSuccessCount(s => s + 1);
            initRound();
          }
        } else {
          // 2회차 이상 성공 시 정답 횟수 오르지 않고 다음 문제로
          initRound();
        }
      }, 1000);
    } else {
      setFeedback('FAIL');
      setErrorMessage(err);
      setAttempts(prev => prev + 1);
      setCanRetry(false);
      setTimeout(() => {
        setCanRetry(true);
      }, 4000); // 4초 대기
    }
  }, [feedback, condition, selectedNumbers, selectedOptionIndex, successCount, assetId, assetType, setMineMiniGame, initRound]);

  const handleCancel = useCallback(() => {
    if (feedback === 'FAIL' && !canRetry) return; // 4초간 창 닫기 불가

    setMineMiniGame(false, null, null);
    const canvas = document.querySelector('canvas');
    if (canvas && typeof canvas.requestPointerLock === 'function') {
      try {
        const p = canvas.requestPointerLock();
        if (p && typeof p.catch === 'function') p.catch(() => { });
      } catch (err) { }
    }
  }, [setMineMiniGame]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!active) return;
      if (e.key === 'Escape' || e.key.toLowerCase() === 'x') {
        handleCancel();
        return;
      }

      if (feedback === 'FAIL' && canRetry && (e.code === 'Space' || e.key === 'Enter')) {
        e.preventDefault();
        if (attempts >= 2) {
          initRound(true);
        } else {
          setFeedback(null);
        }
        return;
      }

      if (feedback !== null) return;
      if (e.code === 'Space') {
        e.preventDefault();
        handleSubmit();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [active, feedback, handleSubmit, handleCancel, canRetry, initRound]);

  if (!active || !condition) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.6)',
      display: 'flex', justifyContent: 'center', alignItems: 'center',
      zIndex: 1000,
      userSelect: 'none'
    }}>
      {feedback === 'SUCCESS' && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(16, 185, 129, 0.9)',
          borderRadius: '24px',
          display: 'flex', justifyContent: 'center', alignItems: 'center',
          fontSize: '4rem', fontWeight: 'bold', color: 'white',
          flexDirection: 'column',
          textAlign: 'center',
          padding: '2rem',
          zIndex: 10
        }}>
          <div>성공!</div>
        </div>
      )}
      <div style={{
        background: '#fff',
        padding: '2rem',
        borderRadius: '24px',
        width: '100%',
        maxWidth: '700px',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem',
        position: 'relative'
      }}>
        {feedback === 'FAIL' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h3 style={{ color: '#EF4444', marginBottom: 0, fontSize: '2rem' }}>오답입니다!</h3>
            <p style={{ fontSize: '1.2rem', margin: 0, padding: '12px', background: '#FEF2F2', borderRadius: '8px', color: '#991B1B' }}>
              {errorMessage.split('\n').map((line, idx) => <span key={idx}>{line}<br /></span>)}
            </p>

            {/* 문제 시각화 */}
            <div style={{ padding: '1rem', border: '2px solid #9CA3AF', borderRadius: '12px', background: '#F3F4F6' }}>
              <div style={{ fontWeight: 'bold', marginBottom: '8px', color: '#4B5563' }}>📝 원래 문제</div>
              {condition.gameType === 'line-to-text' || (condition.gameType === 'multi-select' && condition.isNumberLine) ? (
                <NumberLine condition={condition} />
              ) : (
                <div style={{ textAlign: 'center', fontSize: '1.5rem', fontWeight: 'bold', color: '#374151' }}>{condition.text}</div>
              )}
            </div>

            {/* 내 제출 시각화 */}
            <div style={{ padding: '1rem', border: '2px solid #FCA5A5', borderRadius: '12px', background: '#fef2f2' }}>
              <div style={{ fontWeight: 'bold', marginBottom: '8px', color: '#EF4444' }}>🚫 내 제출</div>
              {condition.gameType === 'multi-select' && (
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                  {Array.from({ length: 10 }, (_, i) => i + 1).map(num => {
                    const isSelected = selectedNumbers.has(num);
                    return (
                      <div key={num} style={{
                        width: 40, height: 50, background: isSelected ? '#EF4444' : '#fff', border: '2px solid #FCA5A5',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, color: isSelected ? '#fff' : '#EF4444', fontWeight: 'bold'
                      }}>{num}</div>
                    );
                  })}
                </div>
              )}
              {condition.gameType === 'text-to-line' && selectedOptionIndex !== null && (
                <NumberLine condition={condition.options[selectedOptionIndex]} />
              )}
              {condition.gameType === 'line-to-text' && selectedOptionIndex !== null && (
                <div style={{ textAlign: 'center', fontSize: '1.5rem', fontWeight: 'bold', color: '#EF4444' }}>
                  {condition.options[selectedOptionIndex].text}
                </div>
              )}
            </div>

            {/* 올바른 정답 시각화 (2회차 이상 실패 시) */}
            {attempts >= 2 && (
              <div style={{ padding: '1rem', border: '2px solid #34D399', borderRadius: '12px', background: '#ECFDF5' }}>
                <div style={{ fontWeight: 'bold', marginBottom: '8px', color: '#059669' }}>✅ 올바른 정답</div>
                {condition.gameType === 'multi-select' && (
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                    {Array.from({ length: 10 }, (_, i) => i + 1).map(num => {
                      const isSelected = checkCondition(num, condition);
                      return (
                        <div key={num} style={{
                          width: 40, height: 50, background: isSelected ? '#10B981' : '#fff', border: '2px solid #6EE7B7',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, color: isSelected ? '#fff' : '#059669', fontWeight: 'bold'
                        }}>{num}</div>
                      );
                    })}
                  </div>
                )}
                {condition.gameType === 'text-to-line' && (
                  <NumberLine condition={condition} />
                )}
                {condition.gameType === 'line-to-text' && (
                  <div style={{ textAlign: 'center', fontSize: '1.5rem', fontWeight: 'bold', color: '#059669' }}>
                    {condition.text}
                  </div>
                )}
              </div>
            )}

            {canRetry && (
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '1rem' }}>
                {attempts < 2 && (
                  <button onClick={() => setFeedback(null)} style={{ padding: '12px 24px', fontSize: '1.2rem', background: '#F59E0B', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', boxShadow: '0 4px 6px rgba(0,0,0,0.2)' }}>
                    다시 풀어보기 (기회 1번)
                  </button>
                )}
                {attempts >= 2 && (
                  <button onClick={() => initRound(true)} style={{ padding: '12px 24px', fontSize: '1.2rem', background: '#3B82F6', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', boxShadow: '0 4px 6px rgba(0,0,0,0.2)' }}>
                    새로운 문제로 넘어가기
                  </button>
                )}
              </div>
            )}
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2>{condition.gameType === 'multi-select' ? '조건에 맞는 숫자 고르기' : '올바른 짝 찾기'}</h2>
              <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {[0, 1].map(i => <div key={i} style={{ width: 24, height: 24, borderRadius: '50%', background: i < successCount ? '#10B981' : '#ccc' }} />)}
                </div>
                <button onClick={handleCancel} style={{
                  background: 'transparent', border: 'none', fontSize: '1.5rem', cursor: 'pointer', padding: '0 8px', color: '#666'
                }}>✕</button>
              </div>
            </div>

            <div style={{ padding: '1rem', background: '#f3f4f6', borderRadius: '12px' }}>
              {condition.gameType === 'line-to-text' || (condition.gameType === 'multi-select' && condition.isNumberLine) ? (
                <NumberLine condition={condition} />
              ) : (
                <div style={{ textAlign: 'center', fontSize: '1.5rem', fontWeight: 'bold' }}>{condition.text}</div>
              )}
            </div>

            {condition.gameType === 'multi-select' && (
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                {Array.from({ length: 10 }, (_, i) => i + 1).map(num => {
                  const isSelected = selectedNumbers.has(num);
                  return (
                    <div key={num} onMouseDown={() => handleMouseDown(num)} onMouseEnter={() => handleMouseEnter(num)} style={{
                      width: 40, height: 50, background: isSelected ? '#3B82F6' : '#fff', border: '2px solid #ccc',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', borderRadius: 8, color: isSelected ? '#fff' : '#000'
                    }}>{num}</div>
                  );
                })}
              </div>
            )}

            {condition.gameType === 'text-to-line' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {condition.options.map((opt, idx) => (
                  <div key={idx} onClick={() => feedback === null && setSelectedOptionIndex(idx)} style={{ padding: 10, border: `2px solid ${selectedOptionIndex === idx ? '#3B82F6' : '#ccc'}`, borderRadius: 8, cursor: 'pointer' }}>
                    <NumberLine condition={opt} />
                  </div>
                ))}
              </div>
            )}

            {condition.gameType === 'line-to-text' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                {condition.options.map((opt, idx) => (
                  <div key={idx} onClick={() => feedback === null && setSelectedOptionIndex(idx)} style={{ padding: 20, border: `2px solid ${selectedOptionIndex === idx ? '#3B82F6' : '#ccc'}`, borderRadius: 8, cursor: 'pointer', textAlign: 'center' }}>
                    {opt.text}
                  </div>
                ))}
              </div>
            )}

            <button onClick={handleSubmit} style={{ padding: '15px', fontSize: '1.2rem', background: '#10B981', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}>제출</button>
          </>
        )}
      </div>
    </div>
  );
}

function NumberLine({ condition }) {
  // Render a visual number line for 1 to 10
  return (
    <div style={{ position: 'relative', width: '100%', padding: '20px 10px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ position: 'relative', width: '100%', height: '40px' }}>
        {/* Main Line */}
        <div style={{ position: 'absolute', top: '20px', left: 0, right: 0, height: '4px', background: '#9CA3AF', borderRadius: '2px' }} />

        {/* Range Highlight */}
        {condition.isRange ? (
          <div style={{
            position: 'absolute',
            top: '20px',
            left: `${(condition.value1 - 1) * (100 / 9)}%`,
            width: `${(condition.value2 - condition.value1) * (100 / 9)}%`,
            height: '4px',
            background: '#3B82F6'
          }} />
        ) : (
          <div style={{
            position: 'absolute',
            top: '20px',
            left: (condition.type === '이상' || condition.type === '초과') ? `${(condition.value - 1) * (100 / 9)}%` : '0%',
            width: (condition.type === '이상' || condition.type === '초과') ? `${(10 - condition.value) * (100 / 9)}%` : `${(condition.value - 1) * (100 / 9)}%`,
            height: '4px',
            background: '#3B82F6'
          }} />
        )}

        {/* Ticks and Numbers */}
        {Array.from({ length: 10 }, (_, i) => i + 1).map(num => {
          let isBoundary = false;
          let isFilled = false;
          if (!condition.isRange) {
            if (num === condition.value) {
              isBoundary = true;
              isFilled = (condition.type === '이상' || condition.type === '이하');
            }
          } else {
            if (num === condition.value1) {
              isBoundary = true;
              isFilled = (condition.type1 === '이상');
            }
            if (num === condition.value2) {
              isBoundary = true;
              isFilled = (condition.type2 === '이하');
            }
          }

          return (
            <div key={num} style={{
              position: 'absolute',
              left: `${(num - 1) * (100 / 9)}%`,
              top: '12px',
              transform: 'translateX(-50%)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center'
            }}>
              {isBoundary ? (
                <div style={{
                  width: '20px',
                  height: '20px',
                  borderRadius: '50%',
                  border: '4px solid #3B82F6',
                  background: isFilled ? '#3B82F6' : '#F3F4F6',
                  zIndex: 2,
                  position: 'relative'
                }} />
              ) : (
                <div style={{
                  width: '4px',
                  height: '20px',
                  background: '#9CA3AF',
                  marginTop: '8px'
                }} />
              )}
              <span style={{
                marginTop: '12px',
                fontSize: '1.1rem',
                fontWeight: isBoundary ? 'bold' : 'normal',
                color: isBoundary ? '#1F2937' : '#6B7280'
              }}>{num}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
