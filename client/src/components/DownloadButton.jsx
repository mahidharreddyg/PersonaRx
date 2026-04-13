import React, { useCallback } from 'react';

const DownloadButton = ({ data }) => {
  const dl = useCallback(() => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type:'application/json' });
    const url  = URL.createObjectURL(blob);
    const ts   = new Date().toISOString().slice(0,19).replace(/[:.]/g,'-');
    const a    = Object.assign(document.createElement('a'), { href:url, download:`prescription-${ts}.json` });
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  }, [data]);

  if (!data) return null;
  return (
    <button className="btn-dl" onClick={dl}>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
        <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
      </svg>
      Download JSON
    </button>
  );
};

export default DownloadButton;
