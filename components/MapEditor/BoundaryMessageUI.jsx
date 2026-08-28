import React, { useState, useEffect } from 'react';

export default function BoundaryMessageUI() {
  const [message, setMessage] = useState('');
  const [additionalMessage, setAdditionalMessage] = useState('');

  useEffect(() => {
    let timeoutId;
    
    const handleCollide = (e) => {
      setMessage(e.detail.message);
      setAdditionalMessage(e.detail.additionalMessage || '');
      
      // Clear previous timeout if it exists
      if (timeoutId) clearTimeout(timeoutId);
      
      // Hide message after 3.5 seconds
      timeoutId = setTimeout(() => {
        setMessage('');
        setAdditionalMessage('');
      }, 3500);
    };

    window.addEventListener('boundary-collide', handleCollide);
    return () => {
      window.removeEventListener('boundary-collide', handleCollide);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []);

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
        animation: 'fadeInOut 3.5s ease-in-out',
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
        `}
      </style>
      <div>{message}</div>
      {additionalMessage && (
        <div style={{ fontSize: '1rem', color: '#fef08a', fontWeight: 'normal' }}>
          {additionalMessage}
        </div>
      )}
    </div>
  );
}
