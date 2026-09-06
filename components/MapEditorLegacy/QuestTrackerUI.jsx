'use client';

import { useState, useEffect } from 'react';
import useInventoryStore from '@/store/useInventoryStore';
import useMapStore from '@/store/useMapStore';

export default function QuestTrackerUI() {
  const { activeQuests, items } = useInventoryStore();
  const { isPlaying, customItems } = useMapStore();
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ignore if typing in an input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      
      if (e.key.toLowerCase() === 'q') {
        setIsVisible(prev => !prev);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (!isPlaying || activeQuests.length === 0 || !isVisible) return null;

  return (
    <div style={{
      position: 'absolute',
      top: '80px', // Below the mini-map or other top-left UI if any, or just 20px
      left: '20px',
      background: 'rgba(15, 23, 42, 0.85)',
      backdropFilter: 'blur(8px)',
      border: '2px solid rgba(59, 130, 246, 0.5)',
      borderRadius: '12px',
      padding: '16px',
      color: 'white',
      width: '280px',
      zIndex: 5000, // Below full-screen overlays but above game
      boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
      pointerEvents: 'none' // Don't block clicks
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '8px' }}>
        <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#60a5fa', display: 'flex', alignItems: 'center', gap: '6px' }}>
          📜 진행 중인 퀘스트
        </h3>
        <span style={{ fontSize: '0.7rem', color: '#94a3b8', background: 'rgba(0,0,0,0.3)', padding: '2px 6px', borderRadius: '4px' }}>
          단축키 Q
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {activeQuests.map(quest => {
          // Calculate progress
          let currentAmount = 0;
          let itemName = quest.requireItem;
          let itemIcon = '📦';
          
          if (!quest.requireItem) {
            // Quest without require item
            return (
              <div key={quest.assetId} style={{ background: 'rgba(0,0,0,0.3)', padding: '10px', borderRadius: '8px', borderLeft: '3px solid #eab308' }}>
                <div style={{ fontSize: '0.9rem', fontWeight: 'bold', marginBottom: '4px', color: '#fef08a' }}>{quest.title}</div>
                <div style={{ fontSize: '0.8rem', color: '#4ade80' }}>조건 달성! NPC와 대화하세요.</div>
              </div>
            );
          }

          // Search custom items first
          const customItem = customItems?.find(i => i.id === quest.requireItem);
          if (customItem) {
            itemName = customItem.name;
            itemIcon = customItem.icon;
          } else if (quest.requireItem === 'rock') {
            itemName = '돌멩이';
            itemIcon = '🪨';
          } else if (quest.requireItem === 'tree') {
            itemName = '나뭇가지';
            itemIcon = '🌳';
          }

          items.forEach(item => {
            if (item && item.type === quest.requireItem) {
              currentAmount += item.count;
            }
          });

          const isComplete = currentAmount >= quest.requireAmount;

          return (
            <div key={quest.assetId} style={{ background: 'rgba(0,0,0,0.3)', padding: '10px', borderRadius: '8px', borderLeft: `3px solid ${isComplete ? '#4ade80' : '#eab308'}` }}>
              <div style={{ fontSize: '0.9rem', fontWeight: 'bold', marginBottom: '8px', color: isComplete ? '#bbf7d0' : '#fef08a' }}>
                {quest.title}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  {itemIcon} {itemName}
                </span>
                <span style={{ color: isComplete ? '#4ade80' : '#f87171', fontWeight: 'bold' }}>
                  {currentAmount} / {quest.requireAmount}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
