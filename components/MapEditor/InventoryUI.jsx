'use client';

import { useEffect } from 'react';
import useInventoryStore from '@/store/useInventoryStore';
import useMapStore from '@/store/useMapStore';

// Helper to get image emoji and label for assets
const getAssetInfo = (type) => {
  switch (type) {
    case 'tree': return { name: '나무', img: '🌳' };
    case 'rock': return { name: '바위', img: '🪨' };
    case 'house': return { name: '집', img: '🏠' };
    case 'cave': return { name: '동굴', img: '🕳️' };
    case 'lake': return { name: '호수', img: '💧' };
    default: return { name: type, img: '❓' };
  }
};

export default function InventoryUI() {
  const { items, selectedSlot, isOpen, setIsOpen, setSlot } = useInventoryStore();
  const { isPlaying } = useMapStore();
  
  useEffect(() => {
    if (!isPlaying) {
      setIsOpen(false);
      return;
    }

    const handleKeyDown = (e) => {
      // Toggle inventory
      if (e.key.toLowerCase() === 'e') {
        if (isOpen) {
          // Close inventory and request pointer lock
          setIsOpen(false);
          const canvas = document.querySelector('canvas');
          if (canvas) canvas.requestPointerLock();
        } else {
          // Open inventory and release pointer lock
          setIsOpen(true);
          document.exitPointerLock();
        }
      }

      // Hotbar selection (1-9)
      if (e.key >= '1' && e.key <= '9') {
        setSlot(parseInt(e.key) - 1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, isOpen, setIsOpen, setSlot]);

  if (!isPlaying) return null;

  const hotbarItems = items.slice(0, 9);
  const mainItems = items.slice(9);

  return (
    <>
      {/* Hotbar */}
      <div style={{
        position: 'absolute',
        bottom: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        gap: '4px',
        background: 'rgba(0, 0, 0, 0.4)',
        padding: '6px',
        borderRadius: '8px',
        zIndex: isOpen ? 10 : 9999, // 인벤토리가 열려있을 때는 뒤로 가도록 설정
        pointerEvents: isOpen ? 'auto' : 'none'
      }}>
        {hotbarItems.map((item, idx) => (
          <div 
            key={idx}
            onClick={() => isOpen && setSlot(idx)}
            style={{
              width: '50px',
              height: '50px',
              background: idx === selectedSlot ? 'rgba(255, 255, 255, 0.4)' : 'rgba(255, 255, 255, 0.2)',
              border: idx === selectedSlot ? '3px solid #fbbf24' : '2px solid rgba(0,0,0,0.5)',
              borderRadius: '4px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              position: 'relative',
              cursor: isOpen ? 'pointer' : 'default',
              boxShadow: 'inset 0 0 10px rgba(0,0,0,0.5)'
            }}
          >
            {item && (
              <>
                <span style={{ fontSize: '1.8rem', pointerEvents: 'none' }}>{getAssetInfo(item.type).img}</span>
                <span style={{ position: 'absolute', bottom: '2px', right: '4px', color: 'white', fontSize: '0.8rem', fontWeight: 'bold', textShadow: '1px 1px 0 #000' }}>
                  {item.count}
                </span>
              </>
            )}
            <span style={{ position: 'absolute', top: '2px', left: '4px', color: 'rgba(255,255,255,0.6)', fontSize: '0.7rem' }}>
              {idx + 1}
            </span>
          </div>
        ))}
      </div>

      {/* Main Inventory Modal (Minecraft Style) */}
      {isOpen && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          background: '#c6c6c6',
          border: '4px solid #555',
          borderRadius: '8px',
          padding: '20px',
          zIndex: 10000,
          boxShadow: '0 0 0 9999px rgba(0,0,0,0.5)', // Dim background
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          width: '500px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ margin: 0, color: '#333', fontSize: '1.2rem', fontFamily: 'sans-serif' }}>인벤토리</h2>
            <button onClick={() => {
              setIsOpen(false);
              const canvas = document.querySelector('canvas');
              if (canvas) canvas.requestPointerLock();
            }} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: '#555' }}>✖</button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(9, 1fr)', gap: '4px' }}>
            {mainItems.map((item, idx) => (
              <div 
                key={idx + 9}
                style={{
                  width: '46px',
                  height: '46px',
                  background: '#8b8b8b',
                  borderTop: '2px solid #373737',
                  borderLeft: '2px solid #373737',
                  borderBottom: '2px solid #fff',
                  borderRight: '2px solid #fff',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  position: 'relative',
                  cursor: 'pointer'
                }}
              >
                {item && (
                  <>
                    <span style={{ fontSize: '1.8rem', pointerEvents: 'none' }}>{getAssetInfo(item.type).img}</span>
                    <span style={{ position: 'absolute', bottom: '2px', right: '4px', color: 'white', fontSize: '0.8rem', fontWeight: 'bold', textShadow: '1px 1px 0 #000' }}>
                      {item.count}
                    </span>
                  </>
                )}
              </div>
            ))}
          </div>
          
          <div style={{ fontSize: '0.8rem', color: '#555', textAlign: 'center', fontFamily: 'sans-serif' }}>
            E키를 누르거나 ✖ 버튼을 클릭해 닫으세요.
          </div>
        </div>
      )}
    </>
  );
}
