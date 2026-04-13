import React from 'react';
import EditableField from './EditableField';

// All possible drug name field keys from various Colab pipelines
const NAME_KEYS = [
  'drug_name','drugName','name','medicine','medicine_name',
  'medication_name','medication','drug','tablet','generic_name',
  'brand_name','product_name','item','title',
];

const ATTRS = [
  {
    key: ['dosage','dose','strength','quantity'],
    label: 'Dosage', cls: 'blue',
    icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4.5 12.5l6-6a4.243 4.243 0 016 6l-6 6a4.243 4.243 0 01-6-6z"/></svg>,
    suggestions: ['mg', 'g', 'ml'],
  },
  {
    key: ['frequency','freq','times_per_day','schedule'],
    label: 'Frequency', cls: 'purple',
    icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
    suggestions: ['0-0-1', '0-1-0', '0-1-1', '1-0-0', '1-0-1', '1-1-0', '1-1-1'],
  },
  {
    key: ['duration','days','period','course'],
    label: 'Duration', cls: 'green',
    icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
    suggestions: ['3 days', '5 days', '7 days', '10 days', '1 month'],
  },
  {
    key: ['constraint','instructions','timing','when','food_relation','note','remarks'],
    label: 'Instructions', cls: 'amber',
    icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 8h1a4 4 0 010 8h-1"/><path d="M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>,
    suggestions: ['Before food', 'After food', 'Empty stomach', 'At night'],
  },
];

// Find the first matching key in a medication object
const findKey = (med, keys) => keys.find(k => k in med && med[k] && med[k] !== 'N/A');
const findVal = (med, keys) => { const k = findKey(med, keys); return k ? String(med[k]) : null; };

// Find drug name — tries all NAME_KEYS, then falls back to first string value
const getDrugName = (med) => {
  const found = findVal(med, NAME_KEYS);
  if (found) return found;
  // Last resort: first non-empty string value in the object
  for (const v of Object.values(med)) {
    if (typeof v === 'string' && v && v !== 'N/A') return v;
  }
  return null;
};

const MedicationCard = ({ medication, index = 0, onUpdate }) => {
  if (!medication) return null;

  const name = getDrugName(medication);

  const attrs = ATTRS.map(a => {
    // If the backend returned an empty/null value for the active key or it's missing
    const activeKey = findKey(medication, a.key) || a.key[0];
    const value = findVal(medication, a.key) || null;
    return {
      ...a,
      activeKey,
      value,
    };
  });

  const handleNameChange = (val) => {
    const activeKey = findKey(medication, NAME_KEYS) || 'drug_name';
    onUpdate?.(activeKey, val);
  };

  return (
    <div className="med-card" style={{ animationDelay:`${(index + 2) * 0.1}s` }}>
      {/* Drug name — editable */}
      <div className="med-header">
        <div className="med-icon">💊</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="med-number">Rx #{index + 1}</div>
          <MedNameEdit name={name} onChange={handleNameChange} />
        </div>
      </div>

      {/* Attributes — editable */}
      <div className="med-attrs">
        {attrs.map(a => (
          <MedAttrEdit
            key={a.label}
            label={a.label}
            value={a.value}
            cls={a.cls}
            icon={a.icon}
            suggestions={a.suggestions}
            onChange={val => onUpdate?.(a.activeKey, val)}
          />
        ))}
        {!attrs.length && (
          <p style={{ fontSize:13, color:'var(--text-3)', fontStyle:'italic' }}>No additional details</p>
        )}
      </div>
    </div>
  );
};

/* ——— Inline editable drug name ——— */
const MedNameEdit = ({ name, onChange }) => {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft]     = React.useState(name || '');
  const ref                   = React.useRef(null);

  React.useEffect(() => { setDraft(name || ''); }, [name]);
  React.useEffect(() => { if (editing) ref.current?.focus(); }, [editing]);

  const commit = () => { setEditing(false); if (draft !== name) onChange?.(draft); };

  return editing ? (
    <input
      ref={ref}
      value={draft}
      onChange={e => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setDraft(name||''); setEditing(false); } }}
      style={{
        background: 'transparent',
        border: 'none',
        borderBottom: '2px solid var(--accent)',
        outline: 'none',
        color: 'var(--text-1)',
        fontSize: 19,
        fontWeight: 900,
        width: '100%',
        letterSpacing: '-0.03em',
        fontFamily: 'inherit',
        padding: '2px 0',
      }}
    />
  ) : (
    <div
      className="med-name"
      onClick={() => setEditing(true)}
      title="Click to edit"
      style={{ cursor: 'text', display: 'flex', alignItems: 'center', gap: 8 }}
    >
      <span>{name || <span style={{ color:'var(--text-3)', fontStyle:'italic', fontWeight:400, fontSize:15 }}>Unknown — click to enter name</span>}</span>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ opacity:0.3, flexShrink:0 }} strokeWidth="2" strokeLinecap="round">
        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
        <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
      </svg>
    </div>
  );
};

/* ——— Inline editable attribute row ——— */
const MedAttrEdit = ({ label, value, cls, icon, onChange, suggestions }) => {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft]     = React.useState(value || '');
  const ref                   = React.useRef(null);

  React.useEffect(() => { setDraft(value || ''); }, [value]);
  React.useEffect(() => { if (editing) ref.current?.focus(); }, [editing]);

  const commit = () => { setEditing(false); if (draft !== value) onChange?.(draft); };

  const handleChange = (e) => {
    let val = e.target.value;
    if (label === 'Frequency') {
      // Enforce 1s and 0s with dashes
      let digits = val.replace(/[^01]/g, '').slice(0, 3);
      if (digits.length === 2) val = `${digits[0]}-${digits[1]}`;
      else if (digits.length === 3) val = `${digits[0]}-${digits[1]}-${digits[2]}`;
      else val = digits;
    }
    setDraft(val);
  };

  const handleSuggestion = (e, sg) => {
    e.preventDefault(); // Prevents input from losing focus
    if (['mg', 'g', 'ml', 'drops'].includes(sg)) {
      setDraft(prev => {
        let text = prev.trim();
        const units = ['tablets', 'tablet', 'drops', 'mcg', 'mg', 'ml', 'g'];
        for (const u of units) {
          if (text.toLowerCase().endsWith(u)) {
            text = text.substring(0, text.length - u.length).trim();
            break;
          }
        }
        return text + sg;
      });
    } else {
      setDraft(sg); // Full replace
    }
  };

  return (
    <div
      className={`med-attr ${cls}`}
      onClick={() => !editing && setEditing(true)}
      style={{ cursor: editing ? 'default' : 'text', flexWrap: editing ? 'wrap' : 'nowrap' }}
      title={editing ? '' : 'Click to edit'}
    >
      <span className="med-attr-icon">{icon}</span>
      <span className="med-attr-label">{label}</span>
      {editing ? (
        <React.Fragment>
          <input
            ref={ref}
            value={draft}
            onChange={handleChange}
            onBlur={commit}
            onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setDraft(value||''); setEditing(false); } }}
            style={{
              background: 'transparent',
              border: 'none',
              borderBottom: '1px solid currentColor',
              outline: 'none',
              color: 'inherit',
              fontSize: 13,
              fontWeight: 600,
              flex: 1,
              fontFamily: 'inherit',
              padding: '1px 0',
            }}
          />
          {suggestions && (
            <div style={{ width: '100%', display: 'flex', gap: 8, flexWrap: 'wrap', paddingLeft: 24, marginTop: 8, animate: 'fadeIn 0.2s ease' }}>
              {suggestions.map(sg => (
                <button
                  key={sg}
                  onMouseDown={e => handleSuggestion(e, sg)}
                  style={{
                    background: 'rgba(255,255,255,0.08)',
                    border: '1px solid currentColor',
                    opacity: 0.85,
                    borderRadius: 8,
                    padding: '4px 12px',
                    fontSize: 12,
                    fontWeight: 700,
                    color: 'inherit',
                    cursor: 'pointer',
                    transition: 'opacity 0.2s'
                  }}
                  onMouseEnter={e => e.target.style.opacity = 1}
                  onMouseLeave={e => e.target.style.opacity = 0.85}
                >
                  {sg}
                </button>
              ))}
            </div>
          )}
        </React.Fragment>
      ) : (
        <span className="med-attr-value" style={{ flex:1, display:'flex', alignItems:'center', gap:6 }}>
          <span style={{ flex:1 }}>{value}</span>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ opacity:0.35, flexShrink:0 }} strokeWidth="2" strokeLinecap="round">
            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        </span>
      )}
    </div>
  );
};

export default MedicationCard;
