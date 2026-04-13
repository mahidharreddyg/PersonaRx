import React from 'react';

const AnalyzeButton = ({ onClick, disabled, loading }) => (
  <div className="btn-wrap">
    <button className="btn-analyze" onClick={onClick} disabled={disabled || loading}>
      {loading ? (
        <>
          <svg style={{animation:'spin 1s linear infinite'}} width="18" height="18" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="white" strokeWidth="3" strokeDasharray="31 31" strokeLinecap="round"/>
          </svg>
          Analyzing…
        </>
      ) : (
        <>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          Analyze Prescription
        </>
      )}
    </button>
  </div>
);

export default AnalyzeButton;
