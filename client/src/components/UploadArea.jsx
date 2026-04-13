import React, { useCallback, useRef, useState } from 'react';

const ALLOWED = ['image/png','image/jpeg','image/jpg','image/webp'];
const MAX = 10 * 1024 * 1024;

const UploadArea = ({ onFileSelect, disabled }) => {
  const [dragging, setDragging]   = useState(false);
  const [valErr, setValErr]       = useState('');
  const inputRef                  = useRef(null);

  const validate = useCallback((file) => {
    if (!ALLOWED.includes(file.type)) { setValErr('Invalid type. Use PNG, JPG, or WebP.'); return false; }
    if (file.size > MAX)              { setValErr('File too large — max 10 MB.');            return false; }
    setValErr(''); return true;
  }, []);

  const handle = useCallback((file) => { if (validate(file)) onFileSelect(file); }, [onFileSelect, validate]);

  const onDE = useCallback((e) => { e.preventDefault(); e.stopPropagation(); if (!disabled) setDragging(true);  }, [disabled]);
  const onDL = useCallback((e) => { e.preventDefault(); e.stopPropagation(); setDragging(false); },              []);
  const onDO = useCallback((e) => { e.preventDefault(); e.stopPropagation(); },                                  []);
  const onDrop = useCallback((e) => {
    e.preventDefault(); e.stopPropagation(); setDragging(false);
    if (!disabled && e.dataTransfer.files[0]) handle(e.dataTransfer.files[0]);
  }, [disabled, handle]);

  return (
    <div className="upload-wrap">
      <div
        className={`upload-zone${dragging ? ' dragging' : ''}`}
        onClick={() => !disabled && inputRef.current?.click()}
        onDragEnter={onDE} onDragLeave={onDL} onDragOver={onDO} onDrop={onDrop}
        style={disabled ? { opacity: 0.45, cursor: 'not-allowed', pointerEvents: 'none' } : {}}
      >
        <div className="upload-icon-box">
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/>
            <line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
        </div>
        <p className="upload-title">{dragging ? 'Drop your prescription here' : 'Upload Prescription Image'}</p>
        <p className="upload-sub">Drag & drop or <span className="link">browse files</span></p>
        <p className="upload-hint">PNG, JPG, WebP · Max 10 MB</p>
        <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/jpg,image/webp"
          style={{ display:'none' }} disabled={disabled}
          onChange={(e) => { if (e.target.files[0]) handle(e.target.files[0]); e.target.value=''; }} />
      </div>

      {valErr && (
        <p style={{ marginTop:12, textAlign:'center', fontSize:13, color:'var(--error)' }}>{valErr}</p>
      )}
    </div>
  );
};

export default UploadArea;
