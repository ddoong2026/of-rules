import React, { useState, useEffect } from 'react';

export default function BoundaryMessageUI() {
  const [message, setMessage] = useState('');
  const [additionalMessage, setAdditionalMessage] = useState('');
  const [hasTarget, setHasTarget] = useState(false);

  useEffect(() => {
    let timeoutId;
    
    const closeMessage = () => {
      setMessage('');
      setAdditionalMessage('');
      setHasTarget(false);
    };

    const handleCollide = (e) => {
      setMessage(e.detail.message);
      setAdditionalMessage(e.detail.additionalMessage || '');
      const targetExists = !!e.detail.targetAssetId;
      setHasTarget(targetExists);
      
      if (timeoutId) clearTimeout(timeoutId);
      
      if (!targetExists) {
        timeoutId = setTimeout(() => {
          closeMessage();
        }, 3500);
      }
    };

    window.addEventListener('boundary-collide', handleCollide);
    return () => {
      window.removeEventListener('boundary-collide', handleCollide);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []);
  const handleConfirm = () => {
    window.dispatchEvent(new CustomEvent('boundary-message-close'));
    setMessage('');
    setAdditionalMessage('');
    setHasTarget(false);
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (hasTarget && e.code === 'Space') {
        handleConfirm();
      }
    };
    
    if (hasTarget) {
      window.addEventListener('keydown', handleKeyDown);
    }
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [hasTarget, message]);

  if (!message) return null;

  return (
    <div 
      style={{
        position: 'absolute',
        top: '20%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        backgroundColor: 'rgba(239, 68, 68, 0.9)', // Red-500
        color: 'white',
        padding: '16px 24px',
        borderRadius: '8px',
        fontSize: '1.2rem',
        fontWeight: 'bold',
        boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
        pointerEvents: 'none',
        zIndex: 1000,
        animation: hasTarget ? 'fadeIn 0.5s ease-in-out' : 'fadeInOut 3.5s ease-in-out',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px'
      }}
    >
      <style>
        {`
          @keyframes fadeInOut {
            0% { opacity: 0; transform: translate(-50%, -60%); }
            10% { opacity: 1; transform: translate(-50%, -50%); }
            80% { opacity: 1; transform: translate(-50%, -50%); }
            100% { opacity: 0; transform: translate(-50%, -40%); }
          }
          @keyframes fadeIn {
            0% { opacity: 0; transform: translate(-50%, -60%); }
            100% { opacity: 1; transform: translate(-50%, -50%); }
          }
          @keyframes pulseText {
            0% { opacity: 0.5; }
            50% { opacity: 1; }
            100% { opacity: 0.5; }
          }
        `}
      </style>
      <div>{message}</div>
      {additionalMessage && (
        <div style={{ fontSize: '1rem', color: '#fef08a', fontWeight: 'normal' }}>
          {additionalMessage}
        </div>
      )}
      {hasTarget && (
        <div style={{ fontSize: '0.9rem', color: '#f87171', marginTop: '8px', fontWeight: 'normal', animation: 'pulseText 1.5s infinite' }}>
          [Space] 키를 누르면 돌아갑니다
        </div>
      )}
    </div>
  );
}
