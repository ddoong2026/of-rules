'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import useMapStore from '@/store/useMapStore';

function generateSingleCondition(isRange) {
  if (!isRange) {
    const type = ['초과', '미만', '이상', '이하'][Math.floor(Math.random() * 4)];
    const value = Math.floor(Math.random() * 8) + 2; // 2 to 9
    return {
      isRange: false,
      type,
      value,
      text: `${value} ${type}`
    };
  } else {
    const type1 = ['초과', '이상'][Math.floor(Math.random() * 2)];
    const type2 = ['미만', '이하'][Math.floor(Math.random() * 2)];
    let value1, value2;
    while (true) {
      value1 = Math.floor(Math.random() * 7) + 1;
      value2 = Math.floor(Math.random() * 7) + 4;
      if (value1 >= value2) continue;
      
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

function generateCondition() {
  const isRange = Math.random() > 0.5;
  const gameTypeRand = Math.random();
  let gameType = 'multi-select';
  if (gameTypeRand > 0.66) gameType = 'text-to-line';
  else if (gameTypeRand > 0.33) gameType = 'line-to-text';

  const trueCond = generateSingleCondition(isRange);
  trueCond.gameType = gameType;
  
  if (gameType === 'multi-select') {
    trueCond.isNumberLine = Math.random() > 0.5;
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

  const [selectedNumbers, setSelectedNumbers] = useState(new Set());
  const [selectedOptionIndex, setSelectedOptionIndex] = useState(null);
  
  const [isDragging, setIsDragging] = useState(false);
  const [dragMode, setDragMode] = useState(null);

  const initRound = useCallback(() => {
    setCondition(generateCondition());
    setSelectedNumbers(new Set());
    setSelectedOptionIndex(null);
    setFeedback(null);
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
    
    let isSuccess = false;
    if (condition.gameType === 'multi-select') {
      let correct = true;
      for (let i = 1; i <= 10; i++) {
        const shouldBeSelected = checkCondition(i, condition);
        const isSelected = selectedNumbers.has(i);
        if (shouldBeSelected !== isSelected) {
          correct = false;
          break;
        }
      }
      isSuccess = correct;
    } else {
      isSuccess = selectedOptionIndex !== null && condition.options[selectedOptionIndex].text === condition.text;
    }
    
    window.dispatchEvent(new CustomEvent('mine-jiggle', { detail: { id: assetId, type: assetType } }));

    if (isSuccess) {
      setFeedback('SUCCESS');
      setTimeout(() => {
        if (successCount + 1 >= 2) {
          window.dispatchEvent(new CustomEvent('mine-complete', { detail: { id: assetId, type: assetType } }));
          setMineMiniGame(false, null, null);
        } else {
          setSuccessCount(s => s + 1);
          initRound();
        }
      }, 1000);
    } else {
      setFeedback('FAIL');
      setTimeout(() => {
        initRound();
      }, 1500);
    }
  }, [feedback, condition, selectedNumbers, selectedOptionIndex, successCount, assetId, assetType, setMineMiniGame, initRound]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!active || feedback !== null) return;
      if (e.code === 'Space') {
        e.preventDefault();
        handleSubmit();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [active, feedback, handleSubmit]);

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
      <div style={{
        background: '#fff',
        padding: '2rem',
        borderRadius: '24px',
        width: '100%',
        maxWidth: '700px',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <h2>{condition.gameType === 'multi-select' ? '조건에 맞는 숫자 고르기' : '올바른 짝 찾기'}</h2>
          <div style={{ display: 'flex', gap: '8px' }}>
            {[0, 1].map(i => <div key={i} style={{ width: 24, height: 24, borderRadius: '50%', background: i < successCount ? '#10B981' : '#ccc' }} />)}
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
