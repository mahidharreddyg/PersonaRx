import React from 'react';

const ImagePreview = ({ file, onRemove, disabled }) => {
  if (!file) return null;
  const url  = URL.createObjectURL(file);
  const size = file.size > 1048576
    ? `${(file.size/1048576).toFixed(2)} MB`
    : `${(file.size/1024).toFixed(1)} KB`;

  return (
    <div className="preview-card" style={{ animation:'fadeInUp 0.4s ease' }}>
      <div className="preview-bar">
        <div className="preview-file-info">
          <div className="preview-file-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
              <polyline points="21 15 16 10 5 21"/>
            </svg>
          </div>
          <div>
            <div className="preview-file-name">{file.name}</div>
            <div className="preview-file-meta">{size} · {file.type.split('/')[1].toUpperCase()}</div>
          </div>
        </div>
        <button className="preview-remove" onClick={onRemove} disabled={disabled} title="Remove">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
      <div className="preview-img-wrap">
        <img src={url} alt="Prescription preview" onLoad={() => URL.revokeObjectURL(url)}/>
      </div>
    </div>
  );
};

export default ImagePreview;
