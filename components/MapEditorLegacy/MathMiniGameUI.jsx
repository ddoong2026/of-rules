'use client';

import React, { useState, useEffect, useRef } from 'react';
import useMapStore from '@/store/useMapStore';
import useInventoryStore from '@/store/useInventoryStore';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/AuthProvider';
import { Canvas, useFrame } from '@react-three/fiber';
import { Environment, OrthographicCamera } from '@react-three/drei';

import { Model as Caveman1 } from './Caveman1';
import { Model as Caveman2 } from './Caveman2';
import { Model as Caveman3 } from './Caveman3';
import { Model as Caveman4 } from './Caveman4';

const NpcModel = ({ type }) => {
  const ref = useRef();
  useFrame((state) => {
    if (ref.current) {
      ref.current.rotation.y = Math.sin(state.clock.elapsedTime * 2) * 0.2;
      ref.current.position.y = Math.sin(state.clock.elapsedTime * 5) * 0.1 - 2.0;
    }
  });

  let ModelComp = Caveman1;
  if (type === 'caveman2') ModelComp = Caveman2;
  else if (type === 'caveman3') ModelComp = Caveman3;
  else if (type === 'caveman4') ModelComp = Caveman4;

  return (
    <group ref={ref} scale={5}>
      <ModelComp />
    </group>
  );
};

const getEmoji = (objName) => {
  if (!objName) return '📦';
  if (objName.includes('도토리')) return '🌰';
  if (objName.includes('사과')) return '🍎';
  if (objName.includes('상자')) return '📦';
  if (objName.includes('나무')) return '🪵';
  if (objName.includes('돌') || objName.includes('광석')) return '🪨';
  if (objName.includes('고기')) return '🥩';
  return '📦';
};

export default function MathMiniGameUI() {
  const { mathMiniGame, setMathMiniGame, currentMapId } = useMapStore();
  const { active, questData } = mathMiniGame;
  const { activeAsset, isAccepted, questId, currentQuestIndex, hasItems, randomMathParams } = questData || {};

  const { completeQuest, addCompletedQuest, items, consumeItem, addItem } = useInventoryStore();
  const { user, role } = useAuth();

  const [mathAnswer, setMathAnswer] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [isShaking, setIsShaking] = useState(false);

  if (!active || !questData) return null;

  const currentQuest = activeAsset.quests?.[currentQuestIndex];
  const objName = isAccepted.mathObject || currentQuest?.mathObject || '물건';
  const emoji = getEmoji(objName);

  const generateMathProblem = (mathObject) => {
    const types = ['CEIL', 'FLOOR', 'ROUND'];
    const type = types[Math.floor(Math.random() * types.length)];
    const unitOptions = [10, 100, 1000];
    const unit = unitOptions[Math.floor(Math.random() * unitOptions.length)];
    let target = 0;
    if (unit === 10) target = Math.floor(Math.random() * 900) + 100;
    else if (unit === 100) target = Math.floor(Math.random() * 9000) + 1000;
    else target = Math.floor(Math.random() * 90000) + 10000;
    
    const obj = mathObject || '물건';
    const isCountQuestion = Math.random() < 0.5;
    
    return { type, unit, target, isCountQuestion, title: '' };
  };

  const evaluateMath = (target, unit, type, isCountQuestion) => {
    const safeDiv = parseFloat((target / unit).toFixed(10));
    let val = 0;
    if (type === 'CEIL') val = Math.ceil(safeDiv);
    else if (type === 'FLOOR') val = Math.floor(safeDiv);
    else if (type === 'ROUND') val = Math.round(safeDiv);
    
    if (isCountQuestion && (type === 'CEIL' || type === 'FLOOR')) {
      return val;
    }
    return parseFloat((val * unit).toFixed(10));
  };

  const handleSubmit = async () => {
    if (mathAnswer === '') return;
    if (!hasItems) {
      alert('아이템이 부족하여 진행할 수 없습니다.');
      return;
    }

    const ans = Number(mathAnswer);
    const target = isAccepted.mathTargetNumber || 0;
    const unit = isAccepted.mathUnit || 10;
    const type = isAccepted.mathType || 'CEIL';
    const isCountQuestion = isAccepted.mathIsCountQuestion ?? false;
    const correctAns = evaluateMath(target, unit, type, isCountQuestion);

    if (ans === correctAns) {
      setFeedback('SUCCESS');
      
      setTimeout(async () => {
        let solvedCount = (isAccepted.mathSolvedCount || 0) + 1;
        let problemCount = isAccepted.mathProblemCount || 1;
        let rewardMode = isAccepted.mathRewardMode || 'ALL_AT_ONCE';

        // Consume items on first correct answer if not already consumed
        if (isAccepted.requireItem && isAccepted.consumeItem !== false && !isAccepted.itemsConsumed) {
          consumeItem(isAccepted.requireItem, isAccepted.requireAmount);
          useInventoryStore.getState().updateActiveQuest(activeAsset.id, isAccepted.questId || isAccepted.title, { itemsConsumed: true });
        }

        // Give partial reward if PER_PROBLEM
        if (rewardMode === 'PER_PROBLEM') {
          if (isAccepted.rewardItem) {
            if (isAccepted.rewardItem === 'money') {
              if (user && role?.role !== 'GUEST_MATH') {
                try {
                  await supabase.rpc('process_transaction', {
                    p_user_id: user.id,
                    p_amount: isAccepted.rewardAmount,
                    p_description: `문제 풀이 보상: ${isAccepted.title}`,
                    p_type: 'ETC'
                  });
                } catch (e) {
                  console.error(e);
                }
              }
            } else {
              addItem(isAccepted.rewardItem, isAccepted.rewardAmount);
            }
          }
        }

        if (solvedCount < problemCount) {
          // Move to next problem
          if (isAccepted.originalType === 'RANDOM_MATH') {
            const newParams = generateMathProblem(isAccepted.mathObject);
            useInventoryStore.getState().updateActiveQuest(activeAsset.id, isAccepted.questId || isAccepted.title, {
              mathSolvedCount: solvedCount,
              title: newParams.title,
              mathType: newParams.type,
              mathTargetNumber: newParams.target,
              mathUnit: newParams.unit
            });
            // Update local questData state to reflect changes immediately
            setMathMiniGame({
              active: true,
              questData: {
                ...questData,
                isAccepted: {
                  ...isAccepted,
                  mathSolvedCount: solvedCount,
                  title: newParams.title,
                  mathType: newParams.type,
                  mathTargetNumber: newParams.target,
                  mathUnit: newParams.unit
                }
              }
            });
            alert(`정답입니다! (${solvedCount}/${problemCount} 완료)\n다음 문제로 넘어갑니다.`);
            setMathAnswer('');
          } else {
            useInventoryStore.getState().updateActiveQuest(activeAsset.id, isAccepted.questId || isAccepted.title, { mathSolvedCount: solvedCount });
            setMathMiniGame({
              active: true,
              questData: {
                ...questData,
                isAccepted: {
                  ...isAccepted,
                  mathSolvedCount: solvedCount
                }
              }
            });
            alert(`정답입니다! (${solvedCount}/${problemCount} 완료)\n동일한 문제가 계속됩니다.`);
            setMathAnswer('');
          }
          setFeedback(null);
        } else {
          // Complete quest
          if (rewardMode === 'ALL_AT_ONCE') {
            // Give reward once at the end
            if (isAccepted.rewardItem) {
              if (isAccepted.rewardItem === 'money') {
                if (user && role?.role !== 'GUEST_MATH') {
                  try {
                    await supabase.rpc('process_transaction', {
                      p_user_id: user.id,
                      p_amount: isAccepted.rewardAmount,
                      p_description: `퀘스트 보상: ${isAccepted.title}`,
                      p_type: 'ETC'
                    });
                  } catch (e) {}
                }
              } else {
                addItem(isAccepted.rewardItem, isAccepted.rewardAmount);
              }
            }
          }
          
          if (user && role?.role !== 'GUEST_MATH') {
            try {
              await supabase.from('activity_logs').insert([{
                user_id: user.id,
                action_type: 'QUEST_COMPLETED',
                description: `퀘스트 완료: ${isAccepted.title}`,
                details: { map_id: currentMapId, asset_id: activeAsset.id, quest_id: questId, title: isAccepted.title, reward: isAccepted.rewardItem }
              }]);
            } catch (e) {}
          }

          completeQuest(activeAsset.id, isAccepted.questId || isAccepted.title);
          addCompletedQuest(questId);
          // Auto close without alert, wait for success animation
          setMathMiniGame({ active: false, questData: null });
        }
      }, 1500);
    } else {
      let errFeedback = '';
      if (type === 'FLOOR') {
        errFeedback = `오답입니다! 버림하여 [${unit}] 단위까지 나타내어 [${ans}]이(가) 되려면, 원래의 수는 [${ans}] 이상 [${parseFloat((ans + unit).toFixed(10))}] 미만이어야 합니다. 하지만 문제의 숫자 ${target}은(는) 이 범위에 속하지 않습니다.`;
      } else if (type === 'CEIL') {
        errFeedback = `오답입니다! 올림하여 [${unit}] 단위까지 나타내어 [${ans}]이(가) 되려면, 원래의 수는 [${parseFloat((ans - unit).toFixed(10))}] 초과 [${ans}] 이하여야 합니다. 하지만 문제의 숫자 ${target}은(는) 이 범위에 속하지 않습니다.`;
      } else if (type === 'ROUND') {
        errFeedback = `오답입니다! 반올림하여 [${unit}] 단위까지 나타내어 [${ans}]이(가) 되려면, 원래의 수는 [${parseFloat((ans - (unit/2)).toFixed(10))}] 이상 [${parseFloat((ans + (unit/2)).toFixed(10))}] 미만이어야 합니다. 하지만 문제의 숫자 ${target}은(는) 이 범위에 속하지 않습니다.`;
      }
      setFeedback(errFeedback);
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 500);
      setMathAnswer('');
    }
  };

  const handleClose = () => {
    setMathMiniGame({ active: false, questData: null });
  };

  const getEulLeul = (word) => {
    if (!word) return '을';
    const lastChar = word.charCodeAt(word.length - 1);
    if (lastChar < 0xAC00 || lastChar > 0xD7A3) return '을';
    const hasBatchim = (lastChar - 0xAC00) % 28 > 0;
    return hasBatchim ? '을' : '를';
  };

  const constructProblemText = () => {
    const target = isAccepted?.mathTargetNumber || currentQuest?.mathTargetNumber || randomMathParams?.target || 0;
    const unit = isAccepted?.mathUnit || currentQuest?.mathUnit || randomMathParams?.unit || 10;
    const mathType = isAccepted?.mathType || currentQuest?.mathType || randomMathParams?.type || 'CEIL';
    const isCountQuestion = isAccepted?.mathIsCountQuestion ?? currentQuest?.mathIsCountQuestion ?? randomMathParams?.isCountQuestion ?? false;
    const obj = objName || '물건';
    const eulLeul = getEulLeul(obj);
    
    if (mathType === 'CEIL') {
      if (isCountQuestion) {
        return `제가 구한 ${obj}의 수는 ${target}개입니다. 이 ${obj}${eulLeul} ${unit}개 단위로 상자에 남김없이 모두 담으려면, 필요한 상자는 총 몇 개인가요?`;
      } else {
        return `제가 구한 ${obj}의 수는 ${target}개입니다. 이 ${obj}${eulLeul} ${unit}개 단위로 상자에 남김없이 모두 담으려면, 필요한 상자에는 총 몇 개의 ${obj}${eulLeul} 담을 수 있나요? (어림하여 ${unit}의 자리까지 나타내기)`;
      }
    }
    if (mathType === 'FLOOR') {
      if (isCountQuestion) {
        return `제가 구한 ${obj}의 수는 ${target}개입니다. 이 ${obj}${eulLeul} ${unit}개 단위로 묶어서 팔려고 합니다. 낱개는 팔 수 없다고 할 때, 최대 몇 묶음까지 만들 수 있나요?`;
      } else {
        return `제가 구한 ${obj}의 수는 ${target}개입니다. 이 ${obj}${eulLeul} ${unit}개 단위로 묶어서 팔려고 합니다. 낱개는 팔 수 없다고 할 때, 묶음으로 파는 ${obj}의 총 개수는 몇 개인가요? (어림하여 ${unit}의 자리까지 나타내기)`;
      }
    }
    if (mathType === 'ROUND') {
      return `제가 구한 ${obj}의 수는 ${target}개입니다. 이 ${obj}의 개수를 실제 개수와 가장 가깝게 기록장에 대략적으로 적어야 합니다. 얼마로 적어야 할까요? (어림하여 ${unit}의 자리까지 나타내기)`;
    }
    
    return currentQuest?.title || '';
  };

  let titleText = isAccepted?.mathProblemText || currentQuest?.mathProblemText || '';
  if (!titleText) {
    if (currentQuest?.type === 'RANDOM_MATH' || isAccepted?.originalType === 'RANDOM_MATH') {
      titleText = constructProblemText();
    } else {
      titleText = isAccepted?.title || currentQuest?.title || '';
    }
  }

  const parts = titleText.split(' (어림하여');
  const mainText = parts[0];
  const hintText = parts.length > 1 ? `(어림하여${parts[1]}` : '';

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(15, 23, 42, 0.85)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 9999,
      fontFamily: 'sans-serif'
    }}>
      {/* 닫기 버튼 */}
      <button 
        onClick={handleClose}
        style={{
          position: 'absolute', top: '20px', right: '30px',
          background: 'rgba(255,255,255,0.1)', color: 'white',
          border: '1px solid rgba(255,255,255,0.2)', borderRadius: '50%',
          width: '48px', height: '48px', fontSize: '24px',
          cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center',
          transition: 'all 0.2s'
        }}
        onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
        onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
      >
        ×
      </button>

      {feedback === 'SUCCESS' && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(34, 197, 94, 0.9)',
          display: 'flex', flexDirection: 'column',
          justifyContent: 'center', alignItems: 'center',
          color: 'white', zIndex: 10000,
          animation: 'fadeIn 0.3s ease-out'
        }}>
          <div style={{ fontSize: '6rem', marginBottom: '1rem' }}>🎉</div>
          <h1 style={{ fontSize: '3rem', margin: 0 }}>정답입니다!</h1>
          <p style={{ fontSize: '1.5rem', opacity: 0.9 }}>보상을 받았습니다.</p>
        </div>
      )}

      <div style={{
        display: 'flex',
        width: '100%',
        maxWidth: '1000px',
        background: 'linear-gradient(145deg, #1e293b, #0f172a)',
        borderRadius: '24px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        overflow: 'hidden',
        border: '1px solid #334155'
      }}>
        {/* Left Side: 3D Animation & Emoji */}
        <div style={{
          flex: '1',
          position: 'relative',
          background: '#0f172a',
          borderRight: '1px solid #334155',
          overflow: 'hidden',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center'
        }}>
          {/* Animated emojis floating around */}
          <div style={{
            position: 'absolute',
            fontSize: '3rem',
            animation: 'bounceFloat 2s infinite ease-in-out',
            zIndex: 10
          }}>
            {emoji}
          </div>
          <div style={{
            position: 'absolute',
            fontSize: '2rem',
            left: '20%',
            top: '30%',
            animation: 'bounceFloat 2.5s infinite ease-in-out reverse',
            zIndex: 10,
            opacity: 0.7
          }}>
            {emoji}
          </div>
          <div style={{
            position: 'absolute',
            fontSize: '2.5rem',
            right: '25%',
            bottom: '25%',
            animation: 'bounceFloat 2.2s infinite ease-in-out 0.5s',
            zIndex: 10,
            opacity: 0.8
          }}>
            {emoji}
          </div>

          <Canvas style={{ width: '100%', height: '400px', zIndex: 1 }}>
            <OrthographicCamera makeDefault position={[0, 2, 5]} zoom={40} />
            <ambientLight intensity={1.5} />
            <directionalLight position={[5, 5, 5]} intensity={2} />
            <NpcModel type={activeAsset?.type} />
          </Canvas>
        </div>

        {/* Right Side: Question & Input */}
        <div style={{
          flex: '1.2',
          padding: '3rem',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          position: 'relative'
        }}>
          <style>
            {`
              @keyframes shake {
                0%, 100% { transform: translateX(0); }
                10%, 30%, 50%, 70%, 90% { transform: translateX(-10px); }
                20%, 40%, 60%, 80% { transform: translateX(10px); }
              }
              @keyframes bounceFloat {
                0%, 100% { transform: translateY(0) rotate(0deg); }
                50% { transform: translateY(-20px) rotate(10deg); }
              }
              @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
              }
            `}
          </style>

          <div style={{ 
            color: '#60a5fa', 
            fontWeight: 'bold', 
            fontSize: '1rem', 
            marginBottom: '1rem',
            letterSpacing: '0.05em'
          }}>
            어림하기 퀘스트
          </div>

          <h2 style={{
            color: '#f8fafc',
            fontSize: '1.4rem',
            lineHeight: '1.6',
            marginBottom: '2rem',
            fontWeight: '600',
            wordBreak: 'keep-all'
          }}>
            {mainText}
            {hintText && (
              <div style={{ color: '#fbbf24', marginTop: '0.5rem', fontSize: '1.2rem' }}>
                {hintText}
              </div>
            )}
          </h2>

          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            animation: isShaking ? 'shake 0.5s' : 'none'
          }}>
            <input 
              autoFocus
              type="number"
              step="any"
              value={mathAnswer}
              onChange={(e) => setMathAnswer(e.target.value)}
              placeholder="정답을 입력하세요"
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              style={{
                width: '100%',
                padding: '1rem 1.5rem',
                fontSize: '1.5rem',
                background: 'rgba(255,255,255,0.05)',
                border: '2px solid #475569',
                borderRadius: '12px',
                color: '#f8fafc',
                outline: 'none',
                transition: 'all 0.2s'
              }}
              onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
              onBlur={(e) => e.target.style.borderColor = '#475569'}
            />
            
            <button 
              onClick={handleSubmit}
              disabled={!hasItems || !mathAnswer}
              style={{
                width: '100%',
                padding: '1rem',
                fontSize: '1.2rem',
                fontWeight: 'bold',
                background: (!hasItems || !mathAnswer) ? '#334155' : '#3b82f6',
                color: (!hasItems || !mathAnswer) ? '#94a3b8' : 'white',
                border: 'none',
                borderRadius: '12px',
                cursor: (!hasItems || !mathAnswer) ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
                boxShadow: (!hasItems || !mathAnswer) ? 'none' : '0 4px 14px 0 rgba(59, 130, 246, 0.39)'
              }}
              onMouseOver={(e) => {
                if(hasItems && mathAnswer) e.currentTarget.style.background = '#2563eb';
              }}
              onMouseOut={(e) => {
                if(hasItems && mathAnswer) e.currentTarget.style.background = '#3b82f6';
              }}
            >
              제출하기
            </button>
          </div>

          {feedback && feedback !== 'SUCCESS' && (
            <div style={{
              marginTop: '1.5rem',
              padding: '1rem',
              background: 'rgba(239, 68, 68, 0.1)',
              borderLeft: '4px solid #ef4444',
              color: '#fca5a5',
              fontSize: '0.95rem',
              lineHeight: '1.5',
              borderRadius: '0 8px 8px 0',
              animation: 'fadeIn 0.3s'
            }}>
              {feedback}
            </div>
          )}
          
          {!hasItems && (
            <div style={{
              marginTop: '1rem',
              color: '#fca5a5',
              fontSize: '0.9rem',
              textAlign: 'center'
            }}>
              아이템이 부족하여 퀘스트를 진행할 수 없습니다.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
