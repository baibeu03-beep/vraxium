'use client';
import { useState, useEffect } from 'react';

const DemoToggle = () => {
  const [isDemoMode, setIsDemoMode] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('demoMode');
    if (stored === 'true') setIsDemoMode(true);
  }, []);

  const toggle = () => {
    const next = !isDemoMode;
    setIsDemoMode(next);
    localStorage.setItem('demoMode', String(next));
    window.location.reload();
  };

  // 시크릿 키로 활성화: ?admin=true로 한 번 접속하면 이후 버튼 표시
  const [isAdminActivated, setIsAdminActivated] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('admin') === 'true') {
      localStorage.setItem('adminMode', 'true');
      setIsAdminActivated(true);
    } else {
      setIsAdminActivated(localStorage.getItem('adminMode') === 'true');
    }
  }, []);

  if (!isAdminActivated) return null;

  return (
    <button
      onClick={toggle}
      style={{
        position: 'fixed',
        bottom: '80px',
        right: '20px',
        zIndex: 99999,
        padding: '8px 16px',
        borderRadius: '20px',
        border: 'none',
        cursor: 'pointer',
        fontSize: '13px',
        fontWeight: 700,
        fontFamily: 'Pretendard',
        background: isDemoMode ? '#FAAB07' : '#333',
        color: isDemoMode ? '#000' : '#888',
        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
        transition: 'all 0.2s',
      }}
    >
      {isDemoMode ? '🎭 Demo ON' : '🎭 Demo OFF'}
    </button>
  );
};

export default DemoToggle;
