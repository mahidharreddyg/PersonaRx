import React from 'react';
import { useAuth } from '../context/AuthContext';

const Header = ({ isDemoMode, onToggleDemoMode }) => {
  const { user, logout } = useAuth();
  
  return (
    <header className="site-header">
      <div className="site-header-inner">
        <div className="logo-wrap" style={{ alignItems: 'center' }}>
          <div className="logo-icon" style={{ 
            width: '42px', height: '42px', 
            borderRadius: '10px', 
            overflow: 'hidden',
            border: '1px solid rgba(255,255,255,0.1)',
            background: 'rgba(255,255,255,0.03)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <img src="/logo.png" alt="PersonaRx Logo" style={{ width: '120%', height: '120%', objectFit: 'cover' }} />
          </div>
          <div style={{ marginLeft: '12px' }}>
            <div className="logo-title" style={{ fontSize: '20px', fontWeight: 700, color: '#fff', lineHeight: 1.1 }}>PersonaRx</div>
            <div className="logo-sub" style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginTop: '2px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Precision Adherence. AI-Driven Care.
            </div>
          </div>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {user && (
            <div style={{ position: 'relative' }}>
              <button 
                onClick={(e) => {
                  const dropdown = e.currentTarget.nextSibling;
                  dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
                }}
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-1)',
                  width: '36px', height: '36px',
                  borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '14px', fontWeight: 'bold',
                  cursor: 'pointer', transition: 'all 0.2s',
                  padding: 0
                }}
                title="Account Options"
              >
                {user.email ? user.email.charAt(0).toUpperCase() : 'U'}
              </button>
              
              <div style={{
                display: 'none',
                position: 'absolute', top: '100%', right: 0, marginTop: '12px',
                background: 'var(--bg-card)', backdropFilter: 'blur(16px)',
                border: '1px solid var(--border)', borderRadius: '12px',
                padding: '8px', minWidth: '220px',
                boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                zIndex: 100
              }}>
                <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', marginBottom: '8px' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Account</div>
                  <div style={{ fontSize: '13px', color: 'var(--text-1)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.email || 'user@example.com'}</div>
                </div>
                
                <button
                  onClick={() => {
                    const dropdown = document.activeElement.parentElement;
                    if(dropdown) dropdown.style.display = 'none';
                    if(onToggleDemoMode) onToggleDemoMode();
                  }}
                  style={{
                    width: '100%', textAlign: 'left',
                    padding: '10px 12px', borderRadius: '8px',
                    background: isDemoMode ? 'var(--bg-hover)' : 'transparent',
                    border: 'none', color: isDemoMode ? 'var(--accent)' : 'var(--text-2)',
                    fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: '8px',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                  onMouseLeave={e => e.currentTarget.style.background = isDemoMode ? 'var(--bg-hover)' : 'transparent'}
                >
                  🎭 {isDemoMode ? 'Exit Simulation Mode' : 'Simulation Profile'}
                </button>
                
                <button
                  onClick={logout}
                  style={{
                    width: '100%', textAlign: 'left',
                    padding: '10px 12px', borderRadius: '8px',
                    background: 'transparent',
                    border: 'none', color: '#ff77aa',
                    fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                    marginTop: '4px',
                    display: 'flex', alignItems: 'center', gap: '8px'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.1)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  🚪 Sign Out
                </button>
              </div>
            </div>
          )}
          
          <div className="status-pill">
            <span className="status-dot" style={{ background: isDemoMode ? '#fbbf24' : 'var(--success)', boxShadow: isDemoMode ? '0 0 6px rgba(251,191,36,0.5)' : '0 0 6px rgba(16,185,129,0.5)' }} />
            {isDemoMode ? 'Demo Mode' : 'System Ready'}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
