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
    if (canvas) canvas.requestPointerLock();
  };

  if (!isPlaying || !activeAsset) return null;

  return (
    <div 
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        background: 'rgba(0, 0, 0, 0.7)',
        zIndex: 10000,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        alignItems: 'center',
        paddingBottom: '40px'
      }}
      onClick={closeDialogue}
    >
      <div 
        style={{ width: '80%', maxWidth: '900px', display: 'flex', flexDirection: 'column' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Character Images Area */}
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 20px', marginBottom: '-10px' }}>
          {/* Player Image Placeholder */}
          <div style={{
            width: '150px', height: '200px',
            background: 'rgba(255,255,255,0.1)',
            border: '2px dashed rgba(255,255,255,0.3)',
            borderRadius: '8px 8px 0 0',
            display: 'flex', justifyContent: 'center', alignItems: 'center',
            color: 'rgba(255,255,255,0.5)', fontSize: '0.9rem'
          }}>
            [내 캐릭터 이미지]
          </div>
          
          {/* NPC Image Placeholder */}
          <div style={{
            width: '150px', height: '200px',
            background: 'rgba(255,255,255,0.1)',
            border: '2px dashed rgba(255,255,255,0.3)',
            borderRadius: '8px 8px 0 0',
            display: 'flex', justifyContent: 'center', alignItems: 'center',
            color: 'rgba(255,255,255,0.5)', fontSize: '0.9rem',
            flexDirection: 'column'
          }}>
            <span>[NPC 이미지]</span>
            <span style={{ fontSize: '0.8rem', marginTop: '4px', color: 'white' }}>{activeAsset.npcName || 'NPC'}</span>
          </div>
        </div>

        {/* Dialogue Box */}
        <div style={{
          background: 'linear-gradient(to bottom, #1e293b, #0f172a)',
          border: '4px solid #94a3b8',
          borderRadius: '12px',
          padding: '24px',
          boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
          minHeight: '150px',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative'
        }}>
          {/* NPC Name Tag */}
          <div style={{
            position: 'absolute',
            top: '-20px',
            left: '30px',
            background: '#334155',
            border: '2px solid #94a3b8',
            color: 'white',
            padding: '4px 16px',
            borderRadius: '20px',
            fontWeight: 'bold',
            fontSize: '1.1rem',
            boxShadow: '0 4px 6px rgba(0,0,0,0.3)'
          }}>
            {activeAsset.npcName || '알 수 없는 주민'}
          </div>

          <div style={{ color: 'white', fontSize: '1.2rem', lineHeight: '1.6', marginTop: '10px' }}>
            {activeAsset.dialogue ? (
              <p style={{ margin: 0 }}>{activeAsset.dialogue}</p>
            ) : (
              <p style={{ margin: 0, fontStyle: 'italic', color: '#94a3b8' }}>...</p>
            )}
          </div>
          
          {activeAsset.quest && (
            <div style={{ marginTop: '20px', background: 'rgba(234, 179, 8, 0.1)', border: '1px solid #eab308', padding: '12px', borderRadius: '8px' }}>
              <strong style={{ color: '#fde047', display: 'block', marginBottom: '4px' }}>[퀘스트]</strong>
              <span style={{ color: '#fef08a', fontSize: '0.95rem' }}>{activeAsset.quest}</span>
            </div>
          )}

          <div style={{
            position: 'absolute',
            bottom: '16px',
            right: '24px',
            color: '#94a3b8',
            fontSize: '0.8rem',
            animation: 'pulse 1.5s infinite'
          }}>
            (E 또는 Esc를 눌러 닫기, 빈 곳 클릭)
          </div>
        </div>
      </div>
      
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes pulse {
          0% { opacity: 0.5; }
          50% { opacity: 1; }
          100% { opacity: 0.5; }
        }
      `}} />
    </div>
  );
}
