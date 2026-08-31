'use client';

import { useState, useEffect } from 'react';
import useMapStore from '@/store/useMapStore';

export default function NPCDialogueUI() {
  const { isPlaying, setActiveDialogue } = useMapStore();
  const [activeAsset, setActiveAsset] = useState(null);
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    const handleInteract = (e) => {
      if (isPlaying) {
        setActiveAsset(e.detail.asset);
        setCurrentStep(0);
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
  }, [activeAsset, currentStep, isLastStep]); // added dependencies

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
        {/* Character Portrait Badges */}
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 24px', marginBottom: '-14px', zIndex: 2 }}>
          {/* Player Portrait */}
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
          
          {/* NPC Portrait */}
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

        {/* Dialogue Box */}
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
          {/* Dialogue Text */}
          <div style={{ color: '#f8fafc', fontSize: '1.15rem', lineHeight: '1.7', fontWeight: '500' }}>
            <p style={{ margin: 0 }}>&ldquo;{dialogueLines[currentStep]}&rdquo;</p>
          </div>
          
          {/* Quest Area if present - Show only on the last step */}
          {isLastStep && activeAsset.quest && (
            <div style={{
              background: 'linear-gradient(90deg, rgba(234, 179, 8, 0.15), rgba(234, 179, 8, 0.05))',
              border: '1px solid #facc15',
              borderLeft: '4px solid #facc15',
              padding: '12px 16px',
              borderRadius: '8px'
            }}>
              <strong style={{ color: '#fef08a', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px', fontSize: '0.9rem' }}>
                📜 <span>퀘스트</span>
              </strong>
              <span style={{ color: '#ffffff', fontSize: '0.95rem' }}>{activeAsset.quest}</span>
            </div>
          )}

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
