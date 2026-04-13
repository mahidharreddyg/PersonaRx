import React, { useState, useEffect } from 'react';

const MESSAGES = [
  "Uploading prescription to secure server...",
  "Initializing multi-agent AI pipeline...",
  "Running OCR text extraction...",
  "Analyzing context with LLM agents...",
  "Structuring medications and dosages...",
  "Cross-referencing medical terms...",
  "Finalizing data extraction (almost done)..."
];

const LoadingOverlay = () => {
  const [msgIndex, setMsgIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setMsgIndex(prev => (prev < MESSAGES.length - 1 ? prev + 1 : prev));
    }, 4500); // Change message every 4.5 seconds
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="loading-overlay">
      <div className="loading-inner">
        <div className="spinner-ring">
          <div className="spinner-track"/>
          <div className="spinner-arc"/>
          <div className="spinner-center">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M4.5 12.5l6-6a4.243 4.243 0 016 6l-6 6a4.243 4.243 0 01-6-6z"/>
              <line x1="7.5" y1="9.5" x2="14.5" y2="16.5"/>
            </svg>
          </div>
        </div>
        <div>
          <div className="loading-title">Analyzing Prescription</div>
          <div className="loading-sub" style={{ minHeight: '40px', transition: 'all 0.3s' }}>
            {MESSAGES[msgIndex]}
          </div>
        </div>
        <div className="dot-row">
          {[0,1,2].map(i => (
            <div key={i} className="dot-pulse" style={{ animationDelay:`${i*0.2}s` }}/>
          ))}
        </div>
      </div>
    </div>
  );
};

export default LoadingOverlay;
