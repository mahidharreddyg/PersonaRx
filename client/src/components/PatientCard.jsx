import React from 'react';
import EditableField from './EditableField';

const FIELDS = [
  { key: 'name',        label: 'Full Name',   icon: '👤' },
  { key: 'age',         label: 'Age',         icon: '🎂' },
  { key: 'gender',      label: 'Gender',      icon: '⚧'  },
  { key: 'date',        label: 'Date',        icon: '📅' },
  { key: 'address',     label: 'Address',     icon: '📍' },
  { key: 'phone',       label: 'Phone',       icon: '📞' },
  { key: 'id',          label: 'Patient ID',  icon: '🆔' },
  { key: 'weight',      label: 'Weight',      icon: '⚖️' },
  { key: 'blood_group', label: 'Blood Group', icon: '🩸' },
  { key: 'diagnosis',   label: 'Diagnosis',   icon: '🩺' },
];

const PatientCard = ({ patient, onUpdate }) => {
  if (!patient) return null;

  // Handle plain string
  if (typeof patient === 'string') {
    return (
      <div className="info-card" style={{ animationDelay:'0.1s' }}>
        <div className="info-card-header">
          <div className="info-card-icon pink">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>
            </svg>
          </div>
          <div className="info-card-title">Patient Information</div>
        </div>
        <EditableField label="Info" value={patient} icon="👤" onChange={v => onUpdate?.('name', v)} />
      </div>
    );
  }

  // Known fields + any extra keys from Colab
  const allKeys = [...new Set([...FIELDS.map(f => f.key), ...Object.keys(patient)])];
  const rows = allKeys
    .filter(k => patient[k] && patient[k] !== 'N/A' && patient[k] !== 'null')
    .map(k => {
      const cfg = FIELDS.find(f => f.key === k);
      return {
        key: k,
        label: cfg?.label || k.replace(/_/g,' ').replace(/\b\w/g, c=>c.toUpperCase()),
        icon:  cfg?.icon  || '📋',
      };
    });

  return (
    <div className="info-card" style={{ animationDelay:'0.1s' }}>
      <div className="info-card-header">
        <div className="info-card-icon pink">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>
          </svg>
        </div>
        <div className="info-card-title">Patient Information</div>
        <span style={{ marginLeft:'auto', fontSize:10, color:'var(--text-3)', fontWeight:600 }}>Click any field to edit</span>
      </div>
      <div className="field-list">
        {rows.map(f => (
          <EditableField
            key={f.key}
            label={f.label}
            value={String(patient[f.key])}
            icon={f.icon}
            onChange={v => onUpdate?.(f.key, v)}
          />
        ))}
      </div>
    </div>
  );
};

export default PatientCard;
