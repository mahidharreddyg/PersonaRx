/**
 * useAnalyze Hook — v2
 * Added editResult state so users can modify extracted data inline.
 */

import { useState, useCallback } from 'react';

const useAnalyze = () => {
  const [file, setFile]           = useState(null);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState(null);
  const [result, setResult]       = useState(null);
  const [editResult, setEditResult] = useState(null); // mutable copy for editing

  const selectFile = useCallback((selectedFile) => {
    setFile(selectedFile);
    setError(null);
    setResult(null);
    setEditResult(null);
  }, []);

  const removeFile = useCallback(() => {
    setFile(null);
    setError(null);
    setResult(null);
    setEditResult(null);
  }, []);

  const analyze = useCallback(async () => {
    if (!file) { setError('Please select a prescription image first.'); return; }

    setLoading(true);
    setError(null);
    setResult(null);
    setEditResult(null);

    try {
      const formData = new FormData();
      formData.append('image', file);

      const response = await fetch('/api/analyze', { method: 'POST', body: formData });
      const data = await response.json();

      if (!response.ok) throw new Error(data.error || `Server error (${response.status})`);
      if (!data || typeof data !== 'object') throw new Error('Invalid response format from the server.');

      setResult(data);
      // Deep clone for editing so original is preserved
      setEditResult(JSON.parse(JSON.stringify(data)));
    } catch (err) {
      console.error('Analysis error:', err);
      if (err.name === 'TypeError' && err.message === 'Failed to fetch') {
        setError('Cannot connect to the server. Make sure the backend is running.');
      } else {
        setError(err.message || 'An unexpected error occurred.');
      }
    } finally {
      setLoading(false);
    }
  }, [file]);

  // Update a top-level field (patient, doctor)
  const updateField = useCallback((section, key, value) => {
    setEditResult(prev => ({
      ...prev,
      [section]: typeof prev[section] === 'object'
        ? { ...prev[section], [key]: value }
        : value,
    }));
  }, []);

  // Update a medication field
  const updateMedication = useCallback((index, key, value) => {
    setEditResult(prev => {
      const meds = [...(prev.medications || [])];
      meds[index] = { ...meds[index], [key]: value };
      return { ...prev, medications: meds };
    });
  }, []);

  const reset = useCallback(() => {
    setFile(null);
    setLoading(false);
    setError(null);
    setResult(null);
    setEditResult(null);
  }, []);

  return {
    file, loading, error,
    result: editResult,   // always expose the editable copy
    rawResult: result,    // original from Colab (for reference)
    selectFile, removeFile, analyze, reset,
    updateField, updateMedication,
  };
};

export default useAnalyze;
