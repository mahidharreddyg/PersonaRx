import React, { useState, useCallback } from 'react';

const JsonViewer = ({ data }) => {
  const [open, setOpen]     = useState(false);
  const [copied, setCopied] = useState(false);
  if (!data) return null;

  const json = JSON.stringify(data, null, 2);

  const copy = useCallback(async () => {
    try { await navigator.clipboard.writeText(json); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    catch(e) {}
  }, [json]);

  return (
    <div style={{ flex: 1 }}>
      <button className={`json-toggle${open ? ' open' : ''}`} onClick={() => setOpen(o => !o)}>
        <svg className="chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <polyline points="9 18 15 12 9 6"/>
        </svg>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ color:'var(--accent)', opacity:.7 }}>
          <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
        </svg>
        {open ? 'Hide' : 'View'} Raw JSON
      </button>

      {open && (
        <div className="json-block">
          <div className="json-topbar">
            <div style={{ display:'flex', alignItems:'center', gap: 8 }}>
              <div className="traffic-dots">
                <span className="td r"/><span className="td y"/><span className="td g"/>
              </div>
              <span className="json-filename">response.json</span>
            </div>
            <button className="json-copy" onClick={copy}>
              {copied
                ? <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{color:'var(--success)'}} strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg> Copied!</>
                : <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg> Copy</>
              }
            </button>
          </div>
          <pre className="json-pre"><code>{json}</code></pre>
        </div>
      )}
    </div>
  );
};

export default JsonViewer;
