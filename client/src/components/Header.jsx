import React from 'react';

const Header = () => (
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
      <div className="status-pill">
        <span className="status-dot" />
        System Ready
      </div>
    </div>
  </header>
);

export default Header;
