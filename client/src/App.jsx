import React from 'react';
import Header from './components/Header';
import UploadArea from './components/UploadArea';
import ImagePreview from './components/ImagePreview';
import AnalyzeButton from './components/AnalyzeButton';
import LoadingOverlay from './components/LoadingOverlay';
import ResultsPanel from './components/ResultsPanel';
import ErrorMessage from './components/ErrorMessage';
import JsonViewer from './components/JsonViewer';
import DownloadButton from './components/DownloadButton';
import useAnalyze from './hooks/useAnalyze';
import './index.css';

function App() {
  const {
    file, loading, error, result,
    selectFile, removeFile, analyze, reset,
    updateField, updateMedication,
  } = useAnalyze();

  return (
    <div className="app-bg">
      {loading && <LoadingOverlay />}
      <Header />

      <main className="main-content">
        {/* Hero */}
        <div className="hero" style={{ animation:'fadeInUp 0.5s ease' }}>
          <h2 className="hero-title">
            Extract Medical Data from{' '}
            <span className="accent">Prescriptions</span>
          </h2>
          <p className="hero-desc">
            Upload a prescription image and our multi-agent AI pipeline will extract
            patient details, doctor information, and medications in seconds.
          </p>
        </div>

        {/* Upload flow */}
        {!result && (
          <div style={{ animation:'fadeInUp 0.5s ease 0.1s both' }}>
            <UploadArea onFileSelect={selectFile} disabled={loading} />
            <ImagePreview file={file} onRemove={removeFile} disabled={loading} />
            {file && (
              <div style={{ animation:'fadeIn 0.3s ease' }}>
                <AnalyzeButton onClick={analyze} disabled={!file} loading={loading} />
              </div>
            )}
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{ maxWidth:680, margin:'32px auto 0' }}>
            <ErrorMessage message={error} onRetry={analyze} />
          </div>
        )}

        {/* Results */}
        {result && (
          <div style={{ animation:'fadeIn 0.4s ease' }}>
            <ResultsPanel
              data={result}
              onUpdateField={updateField}
              onUpdateMedication={updateMedication}
            />
            <div className="actions-bar">
              <JsonViewer data={result} />
              <div className="btn-row">
                <DownloadButton data={result} />
                <button className="btn-new" onClick={reset}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <polyline points="23 4 23 10 17 10"/>
                    <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/>
                  </svg>
                  New Analysis
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="site-footer">
        <div className="footer-text">AI Prescription Analyzer — React · Express · Multi-Agent AI</div>
        <div className="footer-note">For educational purposes only. Not a substitute for medical advice.</div>
      </footer>
    </div>
  );
}

export default App;
