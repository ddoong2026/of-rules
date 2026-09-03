'use client';

import { useState, useEffect } from 'react';
import useMapStore from '@/store/useMapStore';
import useInventoryStore from '@/store/useInventoryStore';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/AuthProvider';

export default function NPCDialogueUI() {
  const { isPlaying, setActiveDialogue, currentMapId } = useMapStore();
  const { activeQuests, completedQuests, acceptQuest, completeQuest, addCompletedQuest, items, consumeItem, addItem } = useInventoryStore();
  const { user, role } = useAuth();
  const [activeAsset, setActiveAsset] = useState(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [mathAnswer, setMathAnswer] = useState('');
  const [randomMathParams, setRandomMathParams] = useState({});

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

  useEffect(() => {
    const handleInteract = (e) => {
      if (isPlaying) {
        const asset = e.detail.asset;
        const newRandomParams = {};
        if (asset.quests) {
          asset.quests.forEach((q, idx) => {
            if (q.type === 'RANDOM_MATH') {
              newRandomParams[idx] = generateMathProblem(q.mathObject);
            }
          });
        } else if (asset.quest && asset.questType === 'RANDOM_MATH') {
           newRandomParams[0] = generateMathProblem(asset.mathObject);
        }
        setRandomMathParams(newRandomParams);
        
        setActiveAsset(asset);
        setCurrentStep(0);
        setMathAnswer('');
        setActiveDialogue(true);
      }
    };
    window.addEventListener('npc-interact', handleInteract);
    return () => window.removeEventListener('npc-interact', handleInteract);
  }, [isPlaying]);

  const dialogueLines = activeAsset?.dialogue
    ? activeAsset.dialogue.split('\n').map(l => l.trim()).filter(l => l)
    : ['안녕하세요!'];

  const isLastStep = currentStep >= dialogueLines.length - 1;

  const closeDialogue = () => {
    setActiveAsset(null);
    setCurrentStep(0);
    setActiveDialogue(false);
    const canvas = document.querySelector('canvas');
    if (canvas && typeof canvas.requestPointerLock === 'function') {
      try {
        const p = canvas.requestPointerLock();
        if (p && typeof p.catch === 'function') p.catch(() => {});
      } catch (err) {}
    }
  };

  const handleNext = (e) => {
    if (e) e.stopPropagation();
    if (isLastStep) {
      closeDialogue();
    } else {
      setCurrentStep(prev => prev + 1);
    }
  };

  useEffect(() => {
    if (!activeAsset) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape' || e.key.toLowerCase() === 'e') {
        closeDialogue();
      } else if (e.code === 'Space' || e.key === 'Enter') {
        e.preventDefault();
        handleNext();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeAsset, currentStep, isLastStep]);

  if (!isPlaying || !activeAsset) return null;

  const npcEmoji = {
    caveman1: '🧔‍♂️',
    caveman2: '🧑‍🌾',
    caveman3: '🧙‍♂️',
    caveman4: '🤠',
    tree: '🌳',
    rock: '🪨',
    house: '🏠',
    cave: '🕳️',
    lake: '💧',
  }[activeAsset.type] || '👤';

  const defaultNames = {
    caveman1: '원시인 1',
    caveman2: '원시인 2',
    caveman3: '원시인 3',
    caveman4: '원시인 4',
    tree: '나무',
    rock: '바위',
    house: '집',
    cave: '동굴',
    lake: '호수',
  };
  const npcName = activeAsset.npcName || defaultNames[activeAsset.type] || '알 수 없음';

  return (
    <div 
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        background: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(3px)',
        zIndex: 10000,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        alignItems: 'center',
        paddingBottom: '48px',
        animation: 'fadeIn 0.2s ease-out'
      }}
      onClick={handleNext}
    >
      <div 
        style={{ width: '85%', maxWidth: '850px', display: 'flex', flexDirection: 'column' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 24px', marginBottom: '-14px', zIndex: 2 }}>
          <div style={{
            background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.9), rgba(30, 58, 138, 0.95))',
            border: '2px solid #60a5fa',
            borderRadius: '12px',
            padding: '8px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
            color: 'white',
            fontWeight: 'bold',
            fontSize: '0.95rem'
          }}>
            <span style={{ fontSize: '1.4rem' }}>🏃‍♂️</span>
            <span>나 (모험가)</span>
          </div>
          
          <div style={{
            background: 'linear-gradient(135deg, rgba(234, 179, 8, 0.9), rgba(161, 98, 7, 0.95))',
            border: '2px solid #fde047',
            borderRadius: '12px',
            padding: '8px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
            color: 'white',
            fontWeight: 'bold',
            fontSize: '0.95rem'
          }}>
            <span style={{ fontSize: '1.4rem' }}>{npcEmoji}</span>
            <span>{npcName}</span>
          </div>
        </div>

        <div 
          style={{
            background: 'linear-gradient(145deg, #1e293b 0%, #0f172a 100%)',
            border: '3px solid #64748b',
            borderRadius: '16px',
            padding: '32px 28px 24px 28px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.1)',
            minHeight: '140px',
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
            gap: '16px',
            cursor: 'pointer'
          }}
          onClick={handleNext}
        >
          <div style={{ color: '#f8fafc', fontSize: '1.15rem', lineHeight: '1.7', fontWeight: '500' }}>
            <p style={{ margin: 0 }}>&ldquo;{dialogueLines[currentStep]}&rdquo;</p>
          </div>
          
          {(() => {
            if (!isLastStep) return null;
            
            let npcQuests = activeAsset.quests || [];
            if (npcQuests.length === 0 && activeAsset.quest) {
              npcQuests = [{
                title: activeAsset.quest,
                type: activeAsset.questType,
                requireItem: activeAsset.questRequireItem,
                requireAmount: activeAsset.questRequireAmount || 1,
                rewardItem: activeAsset.questRewardItem,
                rewardAmount: activeAsset.questRewardAmount || 1,
                consumeItem: activeAsset.questConsumeItem !== false,
                mathType: activeAsset.mathType,
                mathTargetNumber: activeAsset.mathTargetNumber,
                mathUnit: activeAsset.mathUnit,
                mathObject: activeAsset.mathObject,
                mathProblemCount: activeAsset.mathProblemCount || 1,
                mathRewardMode: activeAsset.mathRewardMode || 'ALL_AT_ONCE'
              }];
            }
            
            if (npcQuests.length === 0) return null;

            const currentQuestIndex = npcQuests.findIndex((q, idx) => {
              const questId = q.type === 'RANDOM_MATH' ? `random_math_${activeAsset.id}_${idx}` : q.title;
              return !completedQuests.includes(questId);
            });
            
            if (currentQuestIndex === -1) {
              return (
                <div style={{
                  background: 'linear-gradient(90deg, rgba(34, 197, 94, 0.15), rgba(34, 197, 94, 0.05))',
                  border: '1px solid #22c55e',
                  borderLeft: '4px solid #22c55e',
                  padding: '12px 16px',
                  borderRadius: '8px'
                }}>
                  <strong style={{ color: '#4ade80', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px', fontSize: '0.9rem' }}>
                    📜 <span>퀘스트 완료</span>
                  </strong>
                  <span style={{ fontSize: '0.95rem', color: '#e2e8f0' }}>모든 퀘스트를 완료했습니다! 도와주셔서 감사합니다.</span>
                </div>
              );
            }

            const currentQuest = npcQuests[currentQuestIndex];
            const questId = currentQuest.type === 'RANDOM_MATH' ? `random_math_${activeAsset.id}_${currentQuestIndex}` : currentQuest.title;
            const isAccepted = activeQuests.find(q => q.assetId === activeAsset.id && (q.questId === questId || (!q.questId && q.title === currentQuest.title) || (!q.questId && q.originalTitle === currentQuest.title)));

            let questToRender = currentQuest;

            return (
              <div style={{
                background: 'linear-gradient(90deg, rgba(234, 179, 8, 0.15), rgba(234, 179, 8, 0.05))',
                border: '1px solid #facc15',
                borderLeft: '4px solid #facc15',
                padding: '12px 16px',
                borderRadius: '8px'
              }}>
                <strong style={{ color: '#fef08a', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px', fontSize: '0.9rem' }}>
                  📜 <span>퀘스트 {npcQuests.length > 1 ? `(${currentQuestIndex + 1}/${npcQuests.length})` : ''}
                  {isAccepted && isAccepted.mathProblemCount > 1 && ` [문제 ${Math.min((isAccepted.mathSolvedCount || 0) + 1, isAccepted.mathProblemCount)}/${isAccepted.mathProblemCount}]`}</span>
                </strong>
                <span style={{ color: '#ffffff', fontSize: '0.95rem' }}>{questToRender.title}</span>
                {questToRender.description && (
                  <div style={{ color: '#cbd5e1', fontSize: '0.85rem', marginTop: '6px', lineHeight: '1.4' }}>
                    {questToRender.description}
                  </div>
                )}
                
                {(() => {
                  if (!isAccepted) {
                    return (
                      <div style={{ marginTop: '10px' }}>
                        <button onClick={(e) => {
                          e.stopPropagation();
                          const accepted = acceptQuest({
                            assetId: activeAsset.id,
                            questId: questId,
                            title: currentQuest.title,
                            description: currentQuest.description,
                            mathProblemText: currentQuest.mathProblemText,
                            mathIsCountQuestion: currentQuest.type === 'RANDOM_MATH' ? randomMathParams[currentQuestIndex]?.isCountQuestion : currentQuest.mathIsCountQuestion,
                            type: currentQuest.type === 'RANDOM_MATH' ? 'MATH' : currentQuest.type,
                            originalType: currentQuest.type,
                            mathType: currentQuest.type === 'RANDOM_MATH' ? randomMathParams[currentQuestIndex]?.type : currentQuest.mathType,
                            mathTargetNumber: currentQuest.type === 'RANDOM_MATH' ? randomMathParams[currentQuestIndex]?.target : currentQuest.mathTargetNumber,
                            mathUnit: currentQuest.type === 'RANDOM_MATH' ? randomMathParams[currentQuestIndex]?.unit : currentQuest.mathUnit,
                            mathObject: currentQuest.mathObject,
                            mathProblemCount: currentQuest.mathProblemCount || 1,
                            mathRewardMode: currentQuest.mathRewardMode || 'ALL_AT_ONCE',
                            mathSolvedCount: 0,
                            itemsConsumed: false,
                            requireItem: currentQuest.requireItem,
                            requireAmount: currentQuest.requireAmount || 1,
                            rewardItem: currentQuest.rewardItem,
                            rewardAmount: currentQuest.rewardAmount || 1,
                            consumeItem: currentQuest.consumeItem !== false,
                          });
                          if (accepted) {
                            alert('퀘스트를 수락했습니다!');
                            closeDialogue();
                          } else {
                            alert('이미 수락한 퀘스트입니다.');
                          }
                        }} style={{ padding: '6px 12px', background: '#eab308', color: 'black', fontWeight: 'bold', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                          수락하기
                        </button>
                      </div>
                    );
                  } else {
                    // Check if player has required items
                    let hasItems = false;
                    if (isAccepted.itemsConsumed) {
                      hasItems = true;
                    } else if (!isAccepted.requireItem) {
                      hasItems = true;
                    } else {
                      let total = 0;
                      items.forEach(item => {
                        if (item && item.type === isAccepted.requireItem) total += item.count;
                      });
                      if (total >= isAccepted.requireAmount) hasItems = true;
                    }

                    const handleComplete = async (e) => {
                      e.stopPropagation();
                      if (!hasItems) {
                        alert('아이템이 부족합니다!');
                        return;
                      }
                      
                      // Consume items
                      if (isAccepted.requireItem && isAccepted.consumeItem !== false) {
                        consumeItem(isAccepted.requireItem, isAccepted.requireAmount);
                      }
                      
                      // Give rewards
                      if (isAccepted.rewardItem) {
                        if (isAccepted.rewardItem === 'money') {
                          if (user && role?.role !== 'GUEST_MATH') {
                            await supabase.rpc('process_transaction', {
                              p_user_id: user.id,
                              p_amount: isAccepted.rewardAmount,
                              p_description: `퀘스트 보상: ${isAccepted.title}`,
                              p_type: 'ETC'
                            });
                          }
                        } else {
                          addItem(isAccepted.rewardItem, isAccepted.rewardAmount);
                        }
                      }
                      
                      // Log to activity_logs
                      if (user && role?.role !== 'GUEST_MATH') {
                        await supabase.from('activity_logs').insert([{
                          user_id: user.id,
                          action_type: 'QUEST_COMPLETED',
                          description: `퀘스트 완료: ${isAccepted.title}`,
                          details: { map_id: currentMapId, asset_id: activeAsset.id, title: isAccepted.title, reward: isAccepted.rewardItem }
                        }]);
                      }

                      completeQuest(activeAsset.id);
                      addCompletedQuest(questId);
                      alert('퀘스트를 완료하고 보상을 받았습니다!');
                      closeDialogue();
                    };

                    if (isAccepted.type === 'MATH') {
                      return (
                        <div style={{ marginTop: '10px' }}>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              useMapStore.getState().setMathMiniGame({
                                active: true,
                                questData: {
                                  activeAsset,
                                  isAccepted,
                                  questId,
                                  currentQuestIndex: activeAsset.quests.findIndex(q => q.title === (isAccepted.originalTitle || isAccepted.title)),
                                  hasItems,
                                  randomMathParams: randomMathParams[activeAsset.quests.findIndex(q => q.title === (isAccepted.originalTitle || isAccepted.title))]
                                }
                              });
                              setActiveDialogue(false);
                              setActiveAsset(null);
                            }} 
                            style={{ 
                              padding: '6px 12px', 
                              background: hasItems ? '#3b82f6' : '#64748b', 
                              color: 'white', 
                              fontWeight: 'bold', 
                              border: 'none', 
                              borderRadius: '4px', 
                              cursor: hasItems ? 'pointer' : 'not-allowed' 
                            }}
                          >
                            수학 퀘스트 도전하기 ✏️
                          </button>
                          {!hasItems && <span style={{ fontSize: '0.8rem', color: '#f87171' }}>요구 아이템 부족</span>}
                        </div>
                      );
                    }

                    return (
                      <div style={{ marginTop: '10px' }}>
                        <span style={{ fontSize: '0.85rem', color: hasItems ? '#4ade80' : '#f87171', marginRight: '10px' }}>
                          상태: {hasItems ? '조건 달성!' : '진행 중...'}
                        </span>
                        <button onClick={handleComplete} disabled={!hasItems} style={{ padding: '6px 12px', background: hasItems ? '#22c55e' : '#64748b', color: 'white', fontWeight: 'bold', border: 'none', borderRadius: '4px', cursor: hasItems ? 'pointer' : 'not-allowed' }}>
                          보상 받기
                        </button>
                      </div>
                    );
                  }
                })()}
              </div>
            );
          })()}

          {/* Footer Controls */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: '8px',
            borderTop: '1px solid rgba(255,255,255,0.1)',
            paddingTop: '12px'
          }}>
            <button
              onClick={handleNext}
              style={{
                padding: '6px 16px',
                background: isLastStep ? '#3b82f6' : '#22c55e',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: 'bold',
                fontSize: '0.9rem',
                boxShadow: `0 2px 4px ${isLastStep ? 'rgba(59, 130, 246, 0.4)' : 'rgba(34, 197, 94, 0.4)'}`
              }}
            >
              {isLastStep ? '대화 마치기 (닫기)' : '다음 대화 ▼'}
            </button>
            <div style={{
              color: '#94a3b8',
              fontSize: '0.8rem',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              <kbd style={{ background: '#334155', padding: '2px 6px', borderRadius: '4px', border: '1px solid #64748b' }}>Space</kbd>
              <span>또는</span>
              <kbd style={{ background: '#334155', padding: '2px 6px', borderRadius: '4px', border: '1px solid #64748b' }}>클릭</kbd>
            </div>
          </div>
        </div>
      </div>
      
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}} />
    </div>
  );
}
