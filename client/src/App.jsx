import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import Header from './components/Header';
import UploadArea from './components/UploadArea';
import ImagePreview from './components/ImagePreview';
import AnalyzeButton from './components/AnalyzeButton';
import LoadingOverlay from './components/LoadingOverlay';
import ResultsPanel from './components/ResultsPanel';
import ErrorMessage from './components/ErrorMessage';
import JsonViewer from './components/JsonViewer';
import DownloadButton from './components/DownloadButton';
import ScheduleView from './components/ScheduleView';
import DemoDashboard from './components/DemoDashboard';
import useAnalyze from './hooks/useAnalyze';
import './index.css';

const MainApp = () => {
  const [isDemoMode, setIsDemoMode] = useState(false);
  
  const {
    file, loading, sessionLoading, error, result,
    agentScheduling, agentResult, isRestoredSession,
    startDate, setStartDate,
    currentPrescriptionId,
    selectFile, removeFile, analyze, reset, scheduleAgent,
    updateField, updateMedication,
    saveConfirmedSchedule, mergeSchedule, deleteSchedule,
  } = useAnalyze();

  return (
    <div className="app-bg">
      {(loading || agentScheduling) && <LoadingOverlay />}
      <Header isDemoMode={isDemoMode} onToggleDemoMode={() => setIsDemoMode(!isDemoMode)} />

      {/* Session loading spinner — shown briefly while checking Atlas for previous session */}
      {sessionLoading && !isDemoMode && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0f', zIndex: 100 }}>
          <div style={{ textAlign: 'center', color: 'var(--text-2)' }}>
            <div style={{ fontSize: '32px', marginBottom: '16px' }}>💊</div>
            <div style={{ fontSize: '15px' }}>Loading your schedule...</div>
          </div>
        </div>
      )}

      {isDemoMode ? (
        <DemoDashboard onClose={() => setIsDemoMode(false)} />
      ) : (
        <main className="main-content">
          {/* Hero */}
          <div className="hero" style={{ animation: 'fadeInUp 0.5s ease' }}>
            <h2 className="hero-title">
              Extract Medical Data from{' '}
              <span className="accent">Prescriptions</span>
            </h2>
            <p className="hero-desc">
              Upload a prescription image and our multi-agent AI pipeline will extract
              patient details, doctor information, and medications in seconds.
            </p>
          </div>

          {/* Upload flow — only shown when no confirmed schedule exists */}
          {!result && !sessionLoading && (
          <div style={{ animation: 'fadeInUp 0.5s ease 0.1s both' }}>
            <UploadArea onFileSelect={selectFile} disabled={loading} />
            <ImagePreview file={file} onRemove={removeFile} disabled={loading} />
            {file && (
              <div style={{ animation: 'fadeIn 0.3s ease' }}>
                <AnalyzeButton onClick={analyze} disabled={!file} loading={loading} />
              </div>
            )}
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{ maxWidth: 680, margin: '32px auto 0' }}>
            <ErrorMessage message={error} onRetry={analyze} />
          </div>
        )}

        {/* Results */}
        {result && (
          <div style={{ animation: 'fadeIn 0.4s ease' }}>
            <ResultsPanel
              data={result}
              onUpdateField={updateField}
              onUpdateMedication={updateMedication}
            />
            <div className="actions-bar" style={{ alignItems: 'flex-start' }}>
              <div style={{ flexGrow: 1, maxWidth: '100%' }}>
                <JsonViewer data={result} />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '20px' }}>
                {/* Start Date Picker — only show before schedule is generated */}
                {!agentResult && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '14px',
                    padding: '16px 20px', borderRadius: '14px',
                    background: 'rgba(157,78,221,0.06)',
                    border: '1px solid rgba(157,78,221,0.2)',
                    width: 'fit-content'
                  }}>
                    <div style={{ fontSize: '20px' }}>📅</div>
                    <div style={{ flex: 1, marginRight: '12px' }}>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: '#c084fc', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Treatment Start Date</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-3)' }}>Day 1 of the medication schedule</div>
                    </div>
                    <input
                      type="date"
                      value={startDate}
                      min={(() => {
                        const d = new Date();
                        return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
                      })()}
                      onChange={e => setStartDate(e.target.value)}
                      style={{
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(157,78,221,0.35)',
                        borderRadius: '10px',
                        color: 'var(--text-1)',
                        padding: '9px 14px',
                        fontSize: '14px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        outline: 'none',
                        colorScheme: 'dark',
                      }}
                    />
                  </div>
                )}

                <div className="btn-row" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  <button className="btn-new" onClick={reset}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <polyline points="23 4 23 10 17 10" />
                      <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" />
                    </svg>
                    New Analysis
                  </button>
                  <DownloadButton data={result} />
                  <button
                    className="btn-primary"
                    onClick={scheduleAgent}
                    disabled={agentScheduling}
                    style={{ background: 'linear-gradient(to right, #9d4edd, #ff4d6d)', border: 'none', color: '#fff', padding: '12px 24px', borderRadius: '12px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
                  >
                    {agentScheduling ? 'Scheduling...' : 'Confirm & Schedule Agent'}
                  </button>
                </div>
              </div>
            </div>

            {/* Agent Schedule View */}
            {agentResult && (
              <ScheduleView
                agentResult={agentResult}
                alreadyConfirmed={isRestoredSession}
                startDate={startDate}
                onStartDateChange={setStartDate}
                onConfirm={() => {
                  const prescriptionId = currentPrescriptionId || result?._id;
                  if (prescriptionId) {
                    saveConfirmedSchedule(prescriptionId, agentResult);
                  }
                }}
                onDelete={async () => {
                  await deleteSchedule();
                }}
                onBack={() => { }}
              />
            )}
          </div>
        )}
      </main>
      )}

      <footer className="site-footer">
        <div className="footer-text">© {new Date().getFullYear()} Prescript AI — Intelligent Prescription Management System</div>
        <div className="footer-note">For educational purposes only. Not a substitute for professional medical advice, diagnosis, or treatment.</div>
      </footer>
    </div>
  );
};

function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <MainApp />
              </ProtectedRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;
