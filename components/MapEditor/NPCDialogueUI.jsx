'use client';

import { useState, useEffect } from 'react';
import useMapStore from '@/store/useMapStore';

export default function NPCDialogueUI() {
  const { isPlaying } = useMapStore();
  const [activeAsset, setActiveAsset] = useState(null);

  useEffect(() => {
    const handleInteract = (e) => {
      if (isPlaying) {
        setActiveAsset(e.detail.asset);
      }
    };
    window.addEventListener('npc-interact', handleInteract);
    return () => window.removeEventListener('npc-interact', handleInteract);
  }, [isPlaying]);

  useEffect(() => {
    if (!activeAsset) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape' || e.key.toLowerCase() === 'e') {
        closeDialogue();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeAsset]);

  const closeDialogue = () => {
    setActiveAsset(null);
    const canvas = document.querySelector('canvas');
    if (canvas && typeof canvas.requestPointerLock === 'function') {
      try {
        const p = canvas.requestPointerLock();
        if (p && typeof p.catch === 'function') p.catch(() => {});
      } catch (err) {}
    }
  };

  if (!isPlaying || !activeAsset) return null;

  const npcEmoji = {
    caveman1: '🧔‍♂️',
    caveman2: '🧑‍🌾',
    caveman3: '🧙‍♂️',
    caveman4: '🤠',
  }[activeAsset.type] || '👤';

  const defaultNames = {
    caveman1: '원시인 1',
    caveman2: '원시인 2',
    caveman3: '원시인 3',
    caveman4: '원시인 4',
  };
  const npcName = activeAsset.npcName || defaultNames[activeAsset.type] || '주민';

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
      onClick={closeDialogue}
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
        <div style={{
          background: 'linear-gradient(145deg, #1e293b 0%, #0f172a 100%)',
          border: '3px solid #64748b',
          borderRadius: '16px',
          padding: '32px 28px 24px 28px',
          boxShadow: '0 20px 40px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.1)',
          minHeight: '140px',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          gap: '16px'
        }}>
          {/* Dialogue Text */}
          <div style={{ color: '#f8fafc', fontSize: '1.15rem', lineHeight: '1.7', fontWeight: '500' }}>
            {activeAsset.dialogue ? (
              <p style={{ margin: 0 }}>&ldquo;{activeAsset.dialogue}&rdquo;</p>
            ) : (
              <p style={{ margin: 0, fontStyle: 'italic', color: '#94a3b8' }}>&ldquo;안녕하세요!&rdquo;</p>
            )}
          </div>
          
          {/* Quest Area if present */}
          {activeAsset.quest && (
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
              onClick={closeDialogue}
              style={{
                padding: '6px 16px',
                background: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: 'bold',
                fontSize: '0.9rem',
                boxShadow: '0 2px 4px rgba(59, 130, 246, 0.4)'
              }}
            >
              대화 마치기 (닫기)
            </button>
            <div style={{
              color: '#94a3b8',
              fontSize: '0.8rem',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              <kbd style={{ background: '#334155', padding: '2px 6px', borderRadius: '4px', border: '1px solid #64748b' }}>E</kbd>
              <span>또는</span>
              <kbd style={{ background: '#334155', padding: '2px 6px', borderRadius: '4px', border: '1px solid #64748b' }}>ESC</kbd>
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
