/**
 * useAnalyze Hook — v4
 * Auto-loads previous confirmed schedule on login.
 * Notifications are automatically re-scheduled on mount.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  registerServiceWorker,
  requestNotificationPermission,
  scheduleNotifications,
} from '../utils/notifications.js';

// Shift all schedule dates so Day 1 = chosenStartDate
const shiftScheduleDates = (schedule, startDateStr) => {
  if (!startDateStr || !schedule?.length) return schedule;
  const minDay = Math.min(...schedule.map(d => d.day ?? 1));
  return schedule.map(dose => {
    const offset = (dose.day ?? 1) - minDay; // 0-indexed
    const d = new Date(startDateStr + 'T00:00:00');
    d.setDate(d.getDate() + offset);
    return { ...dose, date: d.toISOString().split('T')[0] };
  });
};

const useAnalyze = () => {
  const { token } = useAuth();
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [editResult, setEditResult] = useState(null);
  const [agentScheduling, setAgentScheduling] = useState(false);
  const [agentResult, setAgentResult] = useState(null);
  const [isRestoredSession, setIsRestoredSession] = useState(false);

  // Track the prescription id for save/delete operations
  const [currentPrescriptionId, setCurrentPrescriptionId] = useState(null);

  // Start date for shifting the schedule — defaults to today
  const todayStr = new Date().toISOString().split('T')[0];
  const [startDate, setStartDate] = useState(todayStr);

  // Keep startDate in a ref so callbacks always see the latest value
  const startDateRef = useRef(startDate);
  useEffect(() => { startDateRef.current = startDate; }, [startDate]);

  // On mount: auto-load the last confirmed schedule + re-fire notifications
  useEffect(() => {
    if (!token) { setSessionLoading(false); return; }

    const loadPreviousSession = async () => {
      try {
        const res = await fetch('/api/prescriptions/latest', {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (res.ok) {
          const data = await res.json();

          // Only auto-load if the user has a confirmed schedule
          if (data.saved_schedule && data.saved_schedule.length > 0) {
            // Restore the prescription data & schedule into state
            const prescriptionData = data.raw_response || { medications: data.medications, _id: data._id };
            setResult(prescriptionData);
            setEditResult(JSON.parse(JSON.stringify(prescriptionData)));
            setCurrentPrescriptionId(data._id);
            setAgentResult({
              session_id: data.session_id,
              schedule: data.saved_schedule,
              meal_times: data.meal_times || { breakfast: '08:00', lunch: '14:00', dinner: '20:00' },
            });
            setIsRestoredSession(true); // skip confirm bar

            // Auto re-schedule notifications silently in the background
            try {
              await registerServiceWorker();
              const perm = await requestNotificationPermission();
              if (perm === 'granted') {
                await scheduleNotifications(data.saved_schedule, data.session_id);
                console.log('[Session] Notifications re-scheduled from saved session.');
              }
            } catch (notifErr) {
              console.warn('[Session] Could not re-schedule notifications:', notifErr.message);
            }
          }
        }
      } catch (err) {
        console.warn('[Session] Could not load previous session:', err.message);
      } finally {
        setSessionLoading(false);
      }
    };

    loadPreviousSession();
  }, [token]);

  const selectFile = useCallback((selectedFile) => {
    setFile(selectedFile);
    setError(null);
    setResult(null);
    setEditResult(null);
    setAgentResult(null);
  }, []);

  const removeFile = useCallback(() => {
    setFile(null);
    setError(null);
    setResult(null);
    setEditResult(null);
    setAgentResult(null);
  }, []);

  const analyze = useCallback(async () => {
    if (!file) { setError('Please select a prescription image first.'); return; }

    setLoading(true);
    setError(null);
    setResult(null);
    setEditResult(null);
    setAgentResult(null);
    setIsRestoredSession(false); // fresh analysis — not restored

    try {
      const formData = new FormData();
      formData.append('image', file);

      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      const data = await response.json();

      if (!response.ok) throw new Error(data.error || `Server error (${response.status})`);
      if (!data || typeof data !== 'object') throw new Error('Invalid response format from the server.');

      setResult(data);
      setEditResult(JSON.parse(JSON.stringify(data)));
      // Store prescription id if included
      if (data._id) setCurrentPrescriptionId(data._id);
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
  }, [file, token]);

  const updateField = useCallback((section, key, value) => {
    setEditResult(prev => ({
      ...prev,
      [section]: typeof prev[section] === 'object'
        ? { ...prev[section], [key]: value }
        : value,
    }));
  }, []);

  const updateMedication = useCallback((index, key, value) => {
    setEditResult(prev => {
      const meds = [...(prev.medications || [])];
      meds[index] = { ...meds[index], [key]: value };
      return { ...prev, medications: meds };
    });
  }, []);

  const scheduleAgent = useCallback(async () => {
    if (!editResult) { setError('No data to schedule.'); return; }

    setAgentScheduling(true);
    setError(null);
    setAgentResult(null);

    try {
      const response = await fetch('/api/schedule', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(editResult)
      });
      const data = await response.json();

      if (!response.ok) throw new Error(data.error || `Server error (${response.status})`);

      // Always use the CURRENT startDate from ref (fixes stale closure bug)
      const shifted = {
        ...data,
        schedule: shiftScheduleDates(data.schedule, startDateRef.current),
      };
      setAgentResult(shifted);
    } catch (err) {
      console.error('Schedule error:', err);
      setError(err.message || 'An unexpected error occurred while scheduling.');
    } finally {
      setAgentScheduling(false);
    }
  }, [editResult, token]);

  // Re-shift the currently displayed schedule when the user changes the start date.
  // Uses DATE-based diff (not the day field) so it works even if day fields are missing/wrong.
  const reshiftSchedule = useCallback((newStartDate) => {
    setStartDate(newStartDate);
    setAgentResult(prev => {
      if (!prev?.schedule?.length) return prev;
      // Find the current "Day 1" date from the existing schedule
      const currentDay1 = [...prev.schedule].map(d => d.date).sort()[0];
      if (!currentDay1) return prev;
      const baseMsec = new Date(currentDay1 + 'T00:00:00').getTime();
      const newMsec  = new Date(newStartDate  + 'T00:00:00').getTime();
      const diffDays = Math.round((newMsec - baseMsec) / 86_400_000);
      const shifted = prev.schedule.map(dose => {
        const d = new Date(dose.date + 'T00:00:00');
        d.setDate(d.getDate() + diffDays);
        return { ...dose, date: d.toISOString().split('T')[0] };
      });
      return { ...prev, schedule: shifted };
    });
  }, []);


  // Called when user clicks "Confirm Schedule" in ScheduleView
  // Saves the schedule to MongoDB so it auto-loads next login
  const saveConfirmedSchedule = useCallback(async (prescriptionId, agentData) => {
    if (!prescriptionId || !agentData) return;
    try {
      const res = await fetch(`/api/prescriptions/${prescriptionId}/schedule`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          schedule: agentData.schedule,
          session_id: agentData.session_id,
          meal_times: agentData.meal_times,
        })
      });
      if (res.ok) {
        setCurrentPrescriptionId(prescriptionId);
        console.log('💾 Schedule saved — will auto-load on next login');
      }
    } catch (err) {
      console.warn('Could not save schedule:', err.message);
    }
  }, [token]);

  // Merge a new prescription's schedule into the existing one (overlapping dates)
  const mergeSchedule = useCallback(async (prescriptionId, newAgentData) => {
    if (!newAgentData?.schedule) return;
    try {
      // Merge locally first
      setAgentResult(prev => {
        if (!prev?.schedule) return newAgentData;
        const existingIds = new Set(prev.schedule.map(d => d.dose_id));
        const merged = [
          ...prev.schedule,
          ...newAgentData.schedule.filter(d => !existingIds.has(d.dose_id)),
        ];
        return { ...prev, schedule: merged };
      });

      // Then persist the merged schedule
      if (prescriptionId) {
        await saveConfirmedSchedule(prescriptionId, newAgentData);
      }
    } catch (err) {
      console.warn('Could not merge schedule:', err.message);
    }
  }, [saveConfirmedSchedule]);

  // Delete the confirmed schedule (clear from DB + reset UI)
  const deleteSchedule = useCallback(async () => {
    const pid = currentPrescriptionId;
    if (!pid) return;
    try {
      await fetch(`/api/prescriptions/${pid}/schedule`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      console.log('🗑️ Schedule deleted');
    } catch (err) {
      console.warn('Could not delete schedule:', err.message);
    } finally {
      // Always reset local state
      setAgentResult(null);
      setIsRestoredSession(false);
      setCurrentPrescriptionId(null);
    }
  }, [currentPrescriptionId, token]);

  const reset = useCallback(() => {
    setFile(null);
    setLoading(false);
    setError(null);
    setResult(null);
    setEditResult(null);
    setAgentResult(null);
    setCurrentPrescriptionId(null);
  }, []);

  return {
    file, loading, sessionLoading, error,
    result: editResult,
    rawResult: result,
    agentScheduling, agentResult, isRestoredSession,
    startDate, setStartDate: reshiftSchedule,
    currentPrescriptionId,
    selectFile, removeFile, analyze, reset, scheduleAgent,
    updateField, updateMedication,
    saveConfirmedSchedule, mergeSchedule, deleteSchedule,
  };
};

export default useAnalyze;
