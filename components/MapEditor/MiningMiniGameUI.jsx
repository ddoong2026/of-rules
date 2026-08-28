'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import useMapStore from '@/store/useMapStore';

function generateCondition() {
  const isRange = Math.random() > 0.5;
  const isNumberLine = Math.random() > 0.5;

  if (!isRange) {
    // Single boundary
    const type = ['초과', '미만', '이상', '이하'][Math.floor(Math.random() * 4)];
    const value = Math.floor(Math.random() * 8) + 2; // 2 to 9
    
    return {
      isRange: false,
      type,
      value,
      isNumberLine,
      text: `${value} ${type}`
    };
  } else {
    // Double boundary (e.g. 3 이상 7 이하)
    const type1 = ['초과', '이상'][Math.floor(Math.random() * 2)];
    const type2 = ['미만', '이하'][Math.floor(Math.random() * 2)];
    
    // Ensure value1 < value2 and there is at least 1 valid natural number between them
    let value1, value2;
    while (true) {
      value1 = Math.floor(Math.random() * 7) + 1; // 1 to 7
      value2 = Math.floor(Math.random() * 7) + 4; // 4 to 10
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
      isNumberLine,
      text: `${value1} ${type1} ${value2} ${type2}`
    };
  }
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
  const [isStopped, setIsStopped] = useState(false);
  const [successCount, setSuccessCount] = useState(0);
  const [feedback, setFeedback] = useState(null);

  // Performance Optimization: Use refs instead of state for high-frequency animation
  const currentValueRef = useRef(1);
  const directionRef = useRef(1);
  const arrowRef = useRef(null);

  const requestRef = useRef(null);
  const lastUpdateRef = useRef(0);
  const SPEED = 80; // ms per block

  const initRound = useCallback(() => {
    setCondition(generateCondition());
    currentValueRef.current = 1;
    directionRef.current = 1;
    setIsStopped(false);
    setFeedback(null);
    
    // Reset arrow style
    if (arrowRef.current) {
      arrowRef.current.style.transform = `translateX(32px) translateX(-50%)`;
      arrowRef.current.style.color = '#3B82F6';
    }
  }, []);

  useEffect(() => {
    if (active) {
      setSuccessCount(0);
      initRound();
    }
  }, [active, initRound]);

  // Gauge animation loop (Single element transform for maximum performance)
  const animate = useCallback((time) => {
    if (isStopped || !active) return;
    
    if (time - lastUpdateRef.current > SPEED) {
      const prev = currentValueRef.current;
      let next = prev + directionRef.current;
      if (next >= 10) {
        directionRef.current = -1;
        next = 10;
      } else if (next <= 1) {
        directionRef.current = 1;
        next = 1;
      }
      
      // Move arrow only (1 DOM mutation)
      if (arrowRef.current) {
        const nextX = 32 + (next - 1) * 44;
        arrowRef.current.style.transform = `translateX(${nextX}px) translateX(-50%)`;
      }
      
      currentValueRef.current = next;
      lastUpdateRef.current = time;
    }
    requestRef.current = requestAnimationFrame(animate);
  }, [isStopped, active]);

  useEffect(() => {
    if (active && !isStopped) {
      requestRef.current = requestAnimationFrame(animate);
    }
    return () => cancelAnimationFrame(requestRef.current);
  }, [active, isStopped, animate]);

  // Handle Spacebar
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!active) return;
      
      // 스페이스바를 누르면 정지 및 판별
      if (e.code === 'Space' && !isStopped) {
        e.preventDefault();
        e.stopPropagation();
        
        setIsStopped(true);
        const isSuccess = checkCondition(currentValueRef.current, condition);
        
        // Jiggle 
        window.dispatchEvent(new CustomEvent('mine-jiggle', { detail: { id: assetId, type: assetType } }));

        if (isSuccess) {
          setFeedback('SUCCESS');
          const nextCount = successCount + 1;
          if (nextCount >= 3) {
            // 채집 완료
            setTimeout(() => {
              window.dispatchEvent(new CustomEvent('mine-complete', { detail: { id: assetId, type: assetType } }));
              setMineMiniGame(false);
            }, 500);
          } else {
            setSuccessCount(nextCount);
            setTimeout(() => {
              initRound();
            }, 800);
          }
        } else {
          setFeedback('FAIL');
          setTimeout(() => {
            initRound();
          }, 800);
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [active, isStopped, condition, successCount, assetId, assetType, setMineMiniGame, initRound]);

  // Handle color updates when feedback or isStopped changes
  useEffect(() => {
    if (!active || !isStopped) return;
    if (arrowRef.current) {
      arrowRef.current.style.color = feedback === 'SUCCESS' ? '#10B981' : (feedback === 'FAIL' ? '#EF4444' : '#3B82F6');
    }
  }, [isStopped, feedback, active]);

  if (!active || !condition) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0, 0, 0, 0.65)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1000,
      userSelect: 'none'
    }}>
      <div style={{
        background: 'rgba(255, 255, 255, 0.95)',
        padding: '2rem 3rem',
        borderRadius: '24px',
        boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '2rem',
        minWidth: '500px'
      }}>
        {/* Title & Progress */}
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: '1.5rem', color: '#111827' }}>수학 채집 게임</h2>
          <div style={{ display: 'flex', gap: '8px' }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{
                width: '24px', height: '24px', borderRadius: '50%',
                background: i < successCount ? '#10B981' : '#E5E7EB',
                border: '2px solid',
                borderColor: i < successCount ? '#059669' : '#D1D5DB'
              }} />
            ))}
          </div>
        </div>

        {/* Condition Display */}
        <div style={{
          padding: '1.5rem',
          background: '#F3F4F6',
          borderRadius: '16px',
          width: '100%',
          textAlign: 'center',
          minHeight: '120px',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center'
        }}>
          {condition.isNumberLine ? (
            <NumberLine condition={condition} />
          ) : (
            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#1F2937' }}>
              {condition.text}
            </div>
          )}
        </div>

        {/* Gauge */}
        <div style={{
          display: 'flex',
          gap: '4px',
          padding: '12px 12px 36px 12px', // Bottom padding for arrow
          background: '#E5E7EB',
          borderRadius: '12px',
          position: 'relative',
          marginBottom: '10px'
        }}>
          {Array.from({ length: 10 }, (_, i) => i + 1).map(num => (
            <div 
              key={num} 
              style={{
              width: '40px',
              height: '50px',
              borderRadius: '8px',
              background: '#FFFFFF',
              border: '1px solid #D1D5DB',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              fontSize: '1.25rem',
              fontWeight: 'bold',
              color: '#374151',
            }}>
              {num}
            </div>
          ))}
          {/* Moving Arrow */}
          <div 
            ref={arrowRef}
            style={{
              position: 'absolute',
              bottom: '4px',
              left: 0,
              fontSize: '24px',
              color: '#3B82F6',
              transform: 'translateX(32px) translateX(-50%)',
              transition: 'transform 0.05s linear',
              textShadow: '0 2px 4px rgba(0,0,0,0.3)',
              fontWeight: 'bold'
            }}
          >
            ⇧
          </div>
        </div>

        {/* Instructions / Feedback */}
        <div style={{
          height: '40px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '1.5rem',
          fontWeight: 'bold',
          color: feedback === 'SUCCESS' ? '#10B981' : (feedback === 'FAIL' ? '#EF4444' : '#6B7280')
        }}>
          {feedback === 'SUCCESS' ? '정답입니다! 🎯' : 
           feedback === 'FAIL' ? '틀렸습니다! 💦' : 
           '스페이스바를 눌러 멈추세요!'}
        </div>
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
