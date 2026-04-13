/**
 * EditableField — inline click-to-edit field.
 * Click the value to turn it into an input, blur/Enter to save.
 */
import React, { useState, useRef, useEffect } from 'react';

const EditableField = ({ label, value, icon, onChange, placeholder = 'Not specified' }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft]     = useState(value || '');
  const inputRef              = useRef(null);

  useEffect(() => { setDraft(value || ''); }, [value]);
  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  const commit = () => {
    setEditing(false);
    if (draft !== value) onChange?.(draft);
  };

  return (
    <div
      className="field-item"
      style={{ cursor: editing ? 'default' : 'text' }}
      onClick={() => !editing && setEditing(true)}
      title={editing ? '' : 'Click to edit'}
    >
      <span className="field-emoji">{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="field-label">{label}</div>
        {editing ? (
          <input
            ref={inputRef}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setDraft(value||''); setEditing(false); } }}
            style={{
              background: 'transparent',
              border: 'none',
              borderBottom: '1px solid var(--accent)',
              outline: 'none',
              color: 'var(--text-1)',
              fontSize: 14,
              fontWeight: 600,
              width: '100%',
              padding: '2px 0',
              fontFamily: 'inherit',
            }}
          />
        ) : (
          <div className="field-value" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ flex: 1 }}>{value || <span style={{ color:'var(--text-3)', fontStyle:'italic' }}>{placeholder}</span>}</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ opacity: 0.3, flexShrink: 0 }} strokeWidth="2" strokeLinecap="round">
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </div>
        )}
      </div>
    </div>
  );
};

export default EditableField;
