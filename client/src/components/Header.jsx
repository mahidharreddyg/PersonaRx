import React from 'react';
import { useAuth } from '../context/AuthContext';

const Header = () => {
  const { user, logout } = useAuth();
  
  return (
    <header className="site-header">
      <div className="site-header-inner">
        <div className="logo-wrap">
          <div className="logo-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4.5 12.5l6-6a4.243 4.243 0 016 6l-6 6a4.243 4.243 0 01-6-6z"/>
              <line x1="7.5" y1="9.5" x2="14.5" y2="16.5"/>
            </svg>
          </div>
          <div>
            <div className="logo-title">AI Prescription Analyzer</div>
            <div className="logo-sub">Multi-Agent AI Pipeline</div>
          </div>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {user && (
            <button 
              onClick={logout}
              style={{
                background: 'rgba(255,51,136,0.1)',
                border: '1px solid rgba(255,51,136,0.2)',
                color: '#ff77aa',
                padding: '6px 12px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,51,136,0.2)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,51,136,0.1)'}
            >
              Sign Out
            </button>
          )}
          <div className="status-pill">
            <span className="status-dot" />
            System Ready
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
