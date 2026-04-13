import React, { useState } from 'react';
import PatientCard from './PatientCard';
import DoctorCard from './DoctorCard';
import MedicationCard from './MedicationCard';

const ResultsPanel = ({ data, onUpdateField, onUpdateMedication }) => {
  if (!data) return null;
  const { patient, doctor, medications } = data;
  const hasMeds = Array.isArray(medications) && medications.length > 0;
  const [showDetails, setShowDetails] = useState(false);

  return (
    <div className="results-wrap">
      {/* Success strip */}
      <div className="success-banner" style={{ marginBottom: 36 }}>
        <div className="success-icon-box">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
          </svg>
        </div>
        <div style={{ flex: 1 }}>
          <div className="success-title">Analysis Complete</div>
          <div className="success-sub">
            {hasMeds ? `${medications.length} medication${medications.length > 1 ? 's' : ''} found` : 'No medications detected'}
            {patient?.name && ` · ${patient.name}`}
            {typeof doctor === 'string' && ` · ${doctor}`}
            {doctor?.name && ` · ${doctor.name}`}
          </div>
        </div>
        <button
          onClick={() => setShowDetails(v => !v)}
          style={{
            flexShrink: 0,
            background: showDetails ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.05)',
            border: '1px solid',
            borderColor: showDetails ? 'rgba(16,185,129,0.2)' : 'var(--border-2)',
            borderRadius: 10,
            padding: '8px 16px',
            fontSize: 12,
            fontWeight: 700,
            color: showDetails ? 'var(--success)' : 'var(--text-2)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            transition: 'all 0.2s',
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
            style={{ transform: showDetails ? 'rotate(180deg)' : 'none', transition: 'transform 0.25s' }}>
            <polyline points="6 9 12 15 18 9"/>
          </svg>
          {showDetails ? 'Hide' : 'Details'}
        </button>
      </div>

      {/* Patient & Doctor — expandable */}
      {showDetails && (
        <div style={{ marginBottom: 40, animation: 'fadeInUp 0.35s ease' }}>
          <div className="section-label">Patient & Doctor</div>
          <div className="info-grid">
            <PatientCard patient={patient} onUpdate={(key, val) => onUpdateField?.('patient', key, val)} />
            <DoctorCard  doctor={doctor}   onUpdate={(key, val) => onUpdateField?.('doctor', key, val)} />
          </div>
        </div>
      )}

      {/* No meds warning */}
      {!hasMeds && (
        <div className="warn-banner" style={{ marginBottom:32 }}>
          <div className="warn-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          </div>
          <div>
            <div className="warn-title">No Medications Detected</div>
            <div className="warn-sub">The AI could not find medications. Try uploading a clearer image.</div>
          </div>
        </div>
      )}

      {/* Medications — main focus */}
      {hasMeds && (
        <>
          <div className="meds-header">
            <div className="section-label" style={{ margin: 0 }}>Prescribed Medications</div>
            <span className="meds-count">{medications.length}</span>
            <span style={{ marginLeft:'auto', fontSize:11, color:'var(--text-3)', fontWeight:600 }}>
              ✏️ Click any field to edit
            </span>
          </div>
          <div className="meds-grid">
            {medications.map((med, i) => (
              <MedicationCard
                key={i}
                medication={med}
                index={i}
                onUpdate={(key, val) => onUpdateMedication?.(i, key, val)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default ResultsPanel;
