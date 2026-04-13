import React from 'react';
import EditableField from './EditableField';

const FIELDS = [
  { key: 'name',            label: 'Doctor Name',   icon: '👨‍⚕️' },
  { key: 'specialization',  label: 'Specialization', icon: '🏥' },
  { key: 'clinic',          label: 'Clinic',         icon: '🏨' },
  { key: 'hospital',        label: 'Hospital',       icon: '🏨' },
  { key: 'phone',           label: 'Phone',          icon: '📞' },
  { key: 'registration',    label: 'Reg. No.',       icon: '📋' },
  { key: 'registration_no', label: 'Reg. No.',       icon: '📋' },
  { key: 'address',         label: 'Address',        icon: '📍' },
  { key: 'email',           label: 'Email',          icon: '✉️' },
  { key: 'qualification',   label: 'Qualification',  icon: '🎓' },
  { key: 'degree',          label: 'Degree',         icon: '🎓' },
];

const DoctorCard = ({ doctor, onUpdate }) => {
  if (!doctor) return null;

  if (typeof doctor === 'string') {
    return (
      <div className="info-card" style={{ animationDelay:'0.2s' }}>
        <div className="info-card-header">
          <div className="info-card-icon purple">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
            </svg>
          </div>
          <div className="info-card-title">Doctor Information</div>
        </div>
        <EditableField label="Doctor" value={doctor} icon="👨‍⚕️" onChange={v => onUpdate?.('name', v)} />
      </div>
    );
  }

  const allKeys = [...new Set([...FIELDS.map(f => f.key), ...Object.keys(doctor)])];
  const rows = allKeys
    .filter(k => doctor[k] && doctor[k] !== 'N/A' && doctor[k] !== 'null')
    .map(k => {
      const cfg = FIELDS.find(f => f.key === k);
      return {
        key: k,
        label: cfg?.label || k.replace(/_/g,' ').replace(/\b\w/g, c=>c.toUpperCase()),
        icon:  cfg?.icon  || '📋',
      };
    });

  return (
    <div className="info-card" style={{ animationDelay:'0.2s' }}>
      <div className="info-card-header">
        <div className="info-card-icon purple">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
          </svg>
        </div>
        <div className="info-card-title">Doctor Information</div>
        <span style={{ marginLeft:'auto', fontSize:10, color:'var(--text-3)', fontWeight:600 }}>Click any field to edit</span>
      </div>
      <div className="field-list">
        {rows.map(f => (
          <EditableField
            key={f.key}
            label={f.label}
            value={String(doctor[f.key])}
            icon={f.icon}
            onChange={v => onUpdate?.(f.key, v)}
          />
        ))}
      </div>
    </div>
  );
};

export default DoctorCard;
