import React from 'react';

const ErrorMessage = ({ message, onRetry }) => {
  if (!message) return null;
  return (
    <div className="error-card">
      <div className="error-row">
        <div className="error-icon-box">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
        </div>
        <div>
          <div className="error-title">Analysis Failed</div>
          <div className="error-msg">{message}</div>
        </div>
      </div>
      {onRetry && (
        <button className="btn-retry" onClick={onRetry}>Try Again</button>
      )}
    </div>
  );
};

export default ErrorMessage;
