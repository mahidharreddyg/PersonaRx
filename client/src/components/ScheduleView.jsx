import React, { useState, useEffect } from 'react';
import {
  registerServiceWorker,
  requestNotificationPermission,
  scheduleNotifications,
  onDoseEvent,
  fireTestNotification,
} from '../utils/notifications';

const SLOT_CONFIG = {
  breakfast: { emoji: '🌅', label: 'Breakfast', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.25)' },
  lunch:     { emoji: '☀️', label: 'Lunch',     color: '#34d399', bg: 'rgba(52,211,153,0.1)', border: 'rgba(52,211,153,0.25)' },
  dinner:    { emoji: '🌙', label: 'Dinner',    color: '#a78bfa', bg: 'rgba(167,139,250,0.1)', border: 'rgba(167,139,250,0.25)' },
};

const DRUG_COLORS = [
  { color: '#ff3388', bg: 'rgba(255,51,136,0.12)',  border: 'rgba(255,51,136,0.3)',  glow: 'rgba(255,51,136,0.2)'  },
  { color: '#60a5fa', bg: 'rgba(96,165,250,0.12)',  border: 'rgba(96,165,250,0.3)',  glow: 'rgba(96,165,250,0.2)'  },
  { color: '#34d399', bg: 'rgba(52,211,153,0.12)',  border: 'rgba(52,211,153,0.3)',  glow: 'rgba(52,211,153,0.2)'  },
  { color: '#c084fc', bg: 'rgba(192,132,252,0.12)', border: 'rgba(192,132,252,0.3)', glow: 'rgba(192,132,252,0.2)' },
  { color: '#fb923c', bg: 'rgba(251,146,60,0.12)',  border: 'rgba(251,146,60,0.3)',  glow: 'rgba(251,146,60,0.2)'  },
];

const formatDate = (dateStr) => {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
};

const ScheduleView = ({
  agentResult,
  onConfirm,
  onBack,
  onDelete,
  alreadyConfirmed = false,
  startDate,
  onStartDateChange,   // (newDateStr) => void — re-shifts schedule via hook
}) => {
  const [confirmed, setConfirmed]         = useState(alreadyConfirmed);
  const [notifPerm, setNotifPerm]         = useState(Notification?.permission || 'default');
  const [notifCount, setNotifCount]       = useState(0);
  const [doseEvents, setDoseEvents]       = useState([]);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  // In-app test notification status (replaces alert())
  const [testStatus, setTestStatus]       = useState(null); // null | 'fired' | 'failed'

  // Register SW on mount
  useEffect(() => {
    registerServiceWorker();
    const unsubscribe = onDoseEvent(event => {
      setDoseEvents(prev => [event, ...prev]);
    });
    return unsubscribe;
  }, []);

  // When alreadyConfirmed flips to true (e.g. after auto-load), sync state
  useEffect(() => {
    if (alreadyConfirmed) setConfirmed(true);
  }, [alreadyConfirmed]);

  // When restoring a confirmed session, auto-schedule notifications
  useEffect(() => {
    if (!alreadyConfirmed || !agentResult?.schedule) return;
    const autoSchedule = async () => {
      const perm = Notification?.permission;
      setNotifPerm(perm || 'default');
      if (perm === 'granted') {
        const count = await scheduleNotifications(agentResult.schedule, agentResult.session_id);
        setNotifCount(count);
      }
    };
    autoSchedule();
  }, [alreadyConfirmed, agentResult]);

  if (!agentResult?.schedule) return null;

  // ── Single source of truth — use agentResult.schedule directly ──
  // No local copy; when the parent's reshiftSchedule runs, agentResult.schedule
  // updates and React re-renders this component with the new dates.
  const schedule = agentResult.schedule;
  const { meal_times, total_doses, session_id } = agentResult;

  // Build drug → color map
  const drugNames = [...new Set(schedule.map(d => d.drug_name))];
  const drugColorMap = {};
  drugNames.forEach((name, i) => {
    drugColorMap[name] = DRUG_COLORS[i % DRUG_COLORS.length];
  });

  // ── Counts ────────────────────────────────────────────────────
  const now = new Date();
  const actedDoseIds   = new Set(doseEvents.map(e => e.dose_id).filter(Boolean));
  const totalDoses     = total_doses ?? schedule.length;
  const doneCount      = actedDoseIds.size;

  // "Remaining" = not yet acted on (includes past doses not acted on)
  const pendingCount   = schedule.filter(d => !actedDoseIds.has(d.dose_id)).length;

  // "Future" = not acted on AND scheduled time is still in the future
  const futureCount    = schedule.filter(d => {
    if (actedDoseIds.has(d.dose_id)) return false;
    const [yr, mo, dy] = d.date.split('-').map(Number);
    const [hr, mn]     = d.scheduled_time.split(':').map(Number);
    return new Date(yr, mo - 1, dy, hr, mn) > now;
  }).length;

  // Group by date, then slot
  const byDate = {};
  schedule.forEach(dose => {
    if (!byDate[dose.date]) byDate[dose.date] = { breakfast: [], lunch: [], dinner: [] };
    if (byDate[dose.date][dose.slot]) byDate[dose.date][dose.slot].push(dose);
    else byDate[dose.date][dose.slot] = [dose];
  });

  const dates = Object.keys(byDate).sort();
  const slots = ['breakfast', 'lunch', 'dinner'];

  // Current Day 1 date (derived from schedule, not from prop)
  const currentStart = dates[0] || startDate;

  // ── Date change → delegate entirely to parent ─────────────────
  // The parent (useAnalyze.reshiftSchedule) re-derives all dates using date-based
  // diff and calls setAgentResult, which re-renders this component.
  const handleStartDateChange = (e) => {
    const newDate = e.target.value;
    if (!newDate || newDate === currentStart) return;
    onStartDateChange?.(newDate);
  };

  const handleConfirm = async () => {
    setConfirmed(true);
    const perm = await requestNotificationPermission();
    setNotifPerm(perm);
    if (perm === 'granted') {
      const count = await scheduleNotifications(schedule, session_id);
      setNotifCount(count);
    }
    onConfirm?.();
  };

  const handleDeleteConfirm = async () => {
    setShowDeleteModal(false);
    await onDelete?.();
  };

  // ── Test notification ─────────────────────────────────────────
  const handleTestNotification = async () => {
    const perm = await requestNotificationPermission();
    setNotifPerm(perm);
    if (perm !== 'granted') {
      setTestStatus('failed');
      setTimeout(() => setTestStatus(null), 4000);
      return;
    }
    const testDose = {
      dose_id:        'test_dose_' + Date.now(),
      drug_name:      schedule[0]?.drug_name || 'Test Medicine',
      dosage:         schedule[0]?.dosage    || '1 tablet',
      constraint:     schedule[0]?.constraint || 'after food',
      slot:           'breakfast',
      scheduled_time: '08:00',
      date:           new Date().toISOString().split('T')[0],
      day:            1,
      status:         'pending',
    };
    const ok = await fireTestNotification(testDose);
    setTestStatus(ok ? 'fired' : 'failed');
    setTimeout(() => setTestStatus(null), 5000);
  };

  return (
    <div style={{ marginTop: 40, animation: 'fadeInUp 0.5s ease' }}>

      {/* ── Delete Confirmation Modal ────────────────────────── */}
      {showDeleteModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(6px)',
          animation: 'fadeIn 0.2s ease',
        }}>
          <div style={{
            background: 'var(--bg-card)', border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: 24, padding: '32px 36px', maxWidth: 420, width: '90%',
            boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
            animation: 'fadeInUp 0.25s ease',
          }}>
            <div style={{ fontSize: 40, marginBottom: 16, textAlign: 'center' }}>🗑️</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--text-1)', textAlign: 'center', marginBottom: 8 }}>
              Delete Schedule?
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-2)', textAlign: 'center', lineHeight: 1.6, marginBottom: 28 }}>
              This will permanently remove your confirmed medication schedule and cancel all pending notifications. This action cannot be undone.
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={() => setShowDeleteModal(false)}
                style={{
                  flex: 1, padding: '12px', borderRadius: 12,
                  background: 'var(--bg-raised)', border: '1px solid var(--border-2)',
                  color: 'var(--text-2)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                style={{
                  flex: 1, padding: '12px', borderRadius: 12,
                  background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                  border: 'none', color: '#fff', fontSize: 13, fontWeight: 700,
                  cursor: 'pointer', boxShadow: '0 8px 24px rgba(239,68,68,0.35)',
                }}
              >
                🗑️ Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Header ──────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 28, gap: 16, flexWrap: 'wrap',
      }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 8 }}>
            Medication Schedule
          </div>
          <div style={{ fontSize: 24, fontWeight: 900, color: 'var(--text-1)', letterSpacing: '-0.03em' }}>
            Your {dates.length}-Day Treatment Plan
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ padding: '8px 16px', borderRadius: 10, background: 'rgba(255,51,136,0.1)', border: '1px solid rgba(255,51,136,0.2)', fontSize: 12, fontWeight: 700, color: '#ff77aa' }}>
            💊 {pendingCount} Pending
          </div>
          {doneCount > 0 && (
            <div style={{ padding: '8px 16px', borderRadius: 10, background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', fontSize: 12, fontWeight: 700, color: '#34d399' }}>
              ✅ {doneCount} Completed
            </div>
          )}
          <div style={{ padding: '8px 16px', borderRadius: 10, background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.2)', fontSize: 12, fontWeight: 700, color: '#93c5fd' }}>
            💉 {drugNames.length} Medication{drugNames.length !== 1 ? 's' : ''}
          </div>
          {/* Delete button — only shown once confirmed */}
          {confirmed && (
            <button
              onClick={() => setShowDeleteModal(true)}
              title="Delete schedule"
              style={{
                padding: '8px 16px', borderRadius: 10,
                background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
                fontSize: 12, fontWeight: 700, color: '#f87171',
                cursor: 'pointer', transition: 'all 0.2s',
                display: 'flex', alignItems: 'center', gap: 6,
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.18)'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.5)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.08)'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.2)'; }}
            >
              🗑️ Delete
            </button>
          )}
        </div>
      </div>

      {/* ── Real-time Start Date Editor ──────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '14px 20px', borderRadius: 14, marginBottom: 20,
        background: 'rgba(157,78,221,0.06)', border: '1px solid rgba(157,78,221,0.2)',
        flexWrap: 'wrap',
      }}>
        <div style={{ fontSize: 20 }}>📅</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#c084fc', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Treatment Start Date</div>
          <div style={{ fontSize: 12, color: 'var(--text-3)' }}>Change to shift the entire schedule in real time</div>
        </div>
        <input
          type="date"
          value={currentStart}
          onChange={handleStartDateChange}
          style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(157,78,221,0.35)',
            borderRadius: 10, color: 'var(--text-1)',
            padding: '9px 14px', fontSize: 14, fontWeight: 600,
            cursor: 'pointer', outline: 'none', colorScheme: 'dark',
          }}
        />
      </div>

      {/* ── Drug Legend ──────────────────────────────────────── */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 28,
        padding: '16px 20px', borderRadius: 16,
        background: 'var(--bg-card)', border: '1px solid var(--border)',
      }}>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-3)', alignSelf: 'center', marginRight: 4 }}>Medications:</span>
        {drugNames.map(name => {
          const c = drugColorMap[name];
          return (
            <div key={name} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '6px 14px', borderRadius: 100,
              background: c.bg, border: `1px solid ${c.border}`,
            }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: c.color, boxShadow: `0 0 6px ${c.color}` }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: c.color }}>{name}</span>
            </div>
          );
        })}
      </div>

      {/* ── Meal Times Bar ───────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 28 }}>
        {slots.filter(s => meal_times?.[s]).map(slot => {
          const cfg = SLOT_CONFIG[slot];
          return (
            <div key={slot} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '14px 18px', borderRadius: 14,
              background: cfg.bg, border: `1px solid ${cfg.border}`,
            }}>
              <span style={{ fontSize: 20 }}>{cfg.emoji}</span>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: cfg.color }}>{cfg.label}</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-1)' }}>{meal_times[slot]}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Daily Schedule Table ─────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 36 }}>
        {dates.map((date, dayIdx) => {
          const daySched    = byDate[date];
          const totalForDay = slots.reduce((acc, s) => acc + (daySched[s]?.length || 0), 0);
          const dayDoses    = slots.flatMap(s => daySched[s] || []);
          const doneForDay  = dayDoses.filter(d => actedDoseIds.has(d.dose_id)).length;
          const allDone     = doneForDay > 0 && doneForDay === totalForDay;
          const someDone    = doneForDay > 0 && doneForDay < totalForDay;

          return (
            <div key={date} style={{
              background: 'var(--bg-card)',
              backdropFilter: 'blur(16px)',
              border: `1px solid ${allDone ? 'rgba(16,185,129,0.25)' : 'var(--border)'}`,
              borderRadius: 20, overflow: 'hidden',
              animation: `fadeInUp 0.4s ease ${dayIdx * 0.06}s both`,
              transition: 'border-color 0.3s, box-shadow 0.3s',
              opacity: allDone ? 0.8 : 1,
            }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = allDone ? 'rgba(16,185,129,0.4)' : 'rgba(255,51,136,0.3)'; e.currentTarget.style.boxShadow = '0 8px 32px rgba(255,51,136,0.1)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = allDone ? 'rgba(16,185,129,0.25)' : 'var(--border)'; e.currentTarget.style.boxShadow = 'none'; }}
            >
              {/* Day Header */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '14px 20px',
                background: allDone ? 'rgba(16,185,129,0.06)' : 'rgba(0,0,0,0.25)',
                borderBottom: '1px solid var(--border)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                    background: allDone ? 'rgba(16,185,129,0.15)' : 'linear-gradient(135deg, rgba(255,51,136,0.2), rgba(255,119,170,0.1))',
                    border: `1px solid ${allDone ? 'rgba(16,185,129,0.3)' : 'rgba(255,51,136,0.2)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 13, fontWeight: 900,
                    color: allDone ? '#10b981' : 'var(--accent)',
                  }}>
                    {allDone ? '✓' : dayIdx + 1}
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-1)', letterSpacing: '-0.01em' }}>
                      Day {dayIdx + 1} — {formatDate(date)}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>
                      {doneForDay > 0 ? `${doneForDay}/${totalForDay} doses done` : `${totalForDay} dose${totalForDay !== 1 ? 's' : ''} scheduled`}
                    </div>
                  </div>
                </div>
                <div style={{
                  padding: '4px 12px', borderRadius: 8, fontSize: 11, fontWeight: 700,
                  ...(allDone
                    ? { background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', color: '#34d399' }
                    : someDone
                    ? { background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', color: '#fbbf24' }
                    : { background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', color: '#34d399' }
                  ),
                }}>
                  {allDone ? '✅ All Done' : someDone ? `⏳ In Progress` : 'All Pending'}
                </div>
              </div>

              {/* Time Slots */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 1, background: 'var(--border)' }}>
                {slots.map(slot => {
                  const cfg   = SLOT_CONFIG[slot];
                  const doses = daySched[slot] || [];
                  if (doses.length === 0 && !meal_times?.[slot]) return null;
                  return (
                    <div key={slot} style={{ background: 'var(--bg)', padding: '16px 18px', minHeight: 80 }}>
                      {/* Slot header */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                        <span style={{ fontSize: 14 }}>{cfg.emoji}</span>
                        <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: cfg.color }}>{cfg.label}</span>
                        <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 600, color: 'var(--text-3)', fontFamily: 'var(--font-mono, monospace)' }}>
                          {meal_times?.[slot] || '—'}
                        </span>
                      </div>
                      {/* Dose pills */}
                      {doses.length === 0 ? (
                        <div style={{ fontSize: 12, color: 'var(--text-3)', fontStyle: 'italic', opacity: 0.5 }}>No doses</div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {doses.map(dose => {
                            const dc        = drugColorMap[dose.drug_name];
                            const done      = actedDoseIds.has(dose.dose_id);
                            const doseEvent = doseEvents.find(e => e.dose_id === dose.dose_id);
                            const isMissed  = doseEvent?.status === 'missed';

                            return (
                              <div key={dose.dose_id} style={{
                                display: 'flex', alignItems: 'center', gap: 10,
                                padding: '8px 12px', borderRadius: 10,
                                background: done
                                  ? (isMissed ? 'rgba(239,68,68,0.05)' : 'rgba(16,185,129,0.05)')
                                  : dc.bg,
                                border: `1px solid ${done
                                  ? (isMissed ? 'rgba(239,68,68,0.2)' : 'rgba(16,185,129,0.2)')
                                  : dc.border}`,
                                transition: 'all 0.3s',
                                opacity: done ? 0.5 : 1,
                                filter: done ? 'grayscale(0.5)' : 'none',
                              }}
                                onMouseEnter={e => !done && (e.currentTarget.style.transform = 'translateX(4px)')}
                                onMouseLeave={e => !done && (e.currentTarget.style.transform = 'translateX(0)')}
                              >
                                <div style={{
                                  width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                                  background: done ? (isMissed ? '#ef4444' : '#10b981') : dc.color,
                                  boxShadow: done ? 'none' : `0 0 5px ${dc.color}`,
                                }} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{
                                    fontSize: 12, fontWeight: 700,
                                    color: done ? 'var(--text-3)' : dc.color,
                                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                    textDecoration: done ? 'line-through' : 'none',
                                  }}>{dose.drug_name}</div>
                                  <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 1 }}>
                                    {dose.dosage && `${dose.dosage} · `}{dose.constraint}
                                  </div>
                                </div>
                                {done && (
                                  <div style={{
                                    fontSize: 10, fontWeight: 700, padding: '2px 8px',
                                    borderRadius: 6, flexShrink: 0,
                                    background: isMissed ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)',
                                    color: isMissed ? '#f87171' : '#34d399',
                                  }}>
                                    {isMissed ? '❌ Missed' : '✅ Taken'}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Session ID */}
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <span style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'monospace' }}>
          Session: {session_id}
        </span>
      </div>

      {/* ── Confirm / Back ───────────────────────────────────── */}
      {!confirmed ? (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, flexWrap: 'wrap',
          padding: '28px 32px', borderRadius: 20,
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          animation: 'fadeInUp 0.5s ease 0.3s both',
        }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-1)', marginBottom: 4 }}>Confirm this schedule?</div>
            <div style={{ fontSize: 13, color: 'var(--text-2)' }}>Review all doses above, then confirm to activate your plan.</div>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <button onClick={onBack} style={{
              padding: '12px 22px', borderRadius: 12,
              background: 'var(--bg-raised)', border: '1px solid var(--border-2)',
              color: 'var(--text-2)', fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s',
            }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.18)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-2)'}
            >
              ← Back
            </button>
            <button onClick={handleConfirm} style={{
              padding: '12px 28px', borderRadius: 12,
              background: 'linear-gradient(135deg, #ff3388, #ff77aa)',
              border: 'none', color: '#fff', fontSize: 13, fontWeight: 700,
              cursor: 'pointer', transition: 'all 0.3s',
              boxShadow: '0 8px 24px rgba(255,51,136,0.3)',
              display: 'flex', alignItems: 'center', gap: 8,
            }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 12px 32px rgba(255,51,136,0.45)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(255,51,136,0.3)'; }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              Confirm Schedule
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, animation: 'fadeInUp 0.4s ease' }}>
          {/* Green confirmed banner */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 16,
            padding: '24px 28px', borderRadius: 20,
            background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)',
          }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(16,185,129,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981', flexShrink: 0 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#10b981', marginBottom: 3 }}>Schedule Confirmed! 🎉</div>
              <div style={{ fontSize: 13, color: 'var(--text-2)' }}>
                Your {dates.length}-day plan is active
                {' · '}{pendingCount} doses remaining of {totalDoses}
                {futureCount < pendingCount && (
                  <span style={{ color: 'var(--text-3)', marginLeft: 4 }}>
                    ({futureCount} upcoming)
                  </span>
                )}
              </div>
            </div>
            {/* Notification badge */}
            <div style={{
              padding: '8px 14px', borderRadius: 10, flexShrink: 0,
              ...(notifPerm === 'granted'
                ? { background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)', color: '#34d399' }
                : { background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', color: '#fbbf24' }
              ),
              fontSize: 12, fontWeight: 700, textAlign: 'center',
            }}>
              {notifPerm === 'granted'
                ? `🔔 ${futureCount} upcoming reminders`
                : notifPerm === 'denied'
                ? '🔕 Notifications blocked'
                : '🔕 No notifications'
              }
            </div>
          </div>

          {/* iOS install hint */}
          {/iphone|ipad|ipod/i.test(navigator.userAgent) && (
            <div style={{
              padding: '14px 18px', borderRadius: 14,
              background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.2)',
              fontSize: 13, color: '#93c5fd', lineHeight: 1.6,
            }}>
              📱 <strong>iPhone tip:</strong> Tap <strong>Share → Add to Home Screen</strong> to get notifications when the app is in the background.
            </div>
          )}

          {/* Notification permission request (if not granted) */}
          {notifPerm !== 'granted' && (
            <div style={{
              padding: '16px 20px', borderRadius: 14,
              background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)',
              display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#fbbf24', marginBottom: 3 }}>🔔 Enable Notifications</div>
                <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
                  {notifPerm === 'denied'
                    ? 'Notifications are blocked. Go to browser Settings → Privacy & Security → Site Settings → Notifications → Allow this site.'
                    : 'Allow notifications to get medication reminders on this device.'}
                </div>
              </div>
              {notifPerm !== 'denied' && (
                <button
                  onClick={async () => {
                    const perm = await requestNotificationPermission();
                    setNotifPerm(perm);
                    if (perm === 'granted') {
                      const count = await scheduleNotifications(schedule, session_id);
                      setNotifCount(count);
                    }
                  }}
                  style={{
                    background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)',
                    color: '#fbbf24', padding: '10px 18px', borderRadius: 10,
                    fontSize: 13, fontWeight: 700, cursor: 'pointer', flexShrink: 0,
                  }}
                >
                  Allow Notifications
                </button>
              )}
            </div>
          )}

          {/* Test Notification Button */}
          {notifPerm === 'granted' && (
            <div style={{
              padding: '16px 20px', borderRadius: 14,
              background: 'var(--bg-card)', 
              border: `1px solid ${testStatus === 'failed' ? 'rgba(239,68,68,0.3)' : 'var(--border)'}`,
              display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
              transition: 'all 0.4s ease',
              position: 'relative',
              overflow: 'hidden'
            }}>
              {/* Subtle top border highlight */}
              <div style={{
                position: 'absolute', top: 0, left: 0, right: 0, height: 1,
                background: 'linear-gradient(90deg, rgba(245,158,11,0), rgba(245,158,11,0.5), rgba(245,158,11,0))',
                opacity: testStatus === 'fired' ? 0 : 1, transition: 'opacity 0.4s'
              }} />
              {testStatus === 'fired' && (
                <div style={{
                  position: 'absolute', top: 0, left: 0, right: 0, height: 1,
                  background: 'linear-gradient(90deg, rgba(16,185,129,0), rgba(16,185,129,0.6), rgba(16,185,129,0))',
                  animation: 'fadeIn 0.3s'
                }} />
              )}
              <div style={{
                width: 38, height: 38, borderRadius: 10,
                background: testStatus === 'failed' ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: testStatus === 'failed' ? '#ef4444' : '#fbbf24',
                flexShrink: 0,
                border: `1px solid ${testStatus === 'failed' ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.2)'}`
              }}>
                {testStatus === 'failed' ? '❌' : '🧪'}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{
                  fontSize: 14, fontWeight: 800, marginBottom: 3,
                  color: testStatus === 'failed' ? '#f87171' : 'var(--text-1)',
                }}>
                  {testStatus === 'failed'
                    ? 'Could not send notification'
                    : 'Test your notifications'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
                  {testStatus === 'failed'
                    ? 'Check browser/system settings to ensure notifications are allowed.'
                    : 'Fires a real medication reminder (works on desktop & mobile).'}
                </div>
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {testStatus === 'fired' && (
                  <span style={{
                    fontSize: 12, fontWeight: 700, color: '#34d399',
                    display: 'flex', alignItems: 'center', gap: 4,
                    animation: 'fadeIn 0.3s, slideInRight 0.3s',
                  }}>
                    ✅ Notification sent!
                  </span>
                )}
                <button
                  onClick={handleTestNotification}
                  disabled={testStatus === 'fired'}
                  style={{
                    background: testStatus === 'fired'
                      ? 'rgba(16,185,129,0.1)'
                      : testStatus === 'failed'
                      ? 'rgba(239,68,68,0.1)'
                      : 'rgba(245,158,11,0.1)',
                    border: `1px solid ${testStatus === 'fired' ? 'rgba(16,185,129,0.25)' : testStatus === 'failed' ? 'rgba(239,68,68,0.25)' : 'rgba(245,158,11,0.25)'}`,
                    color: testStatus === 'fired' ? '#10b981' : testStatus === 'failed' ? '#ef4444' : '#fbbf24',
                    padding: '10px 20px', borderRadius: 10, fontSize: 13, fontWeight: 700,
                    cursor: testStatus === 'fired' ? 'default' : 'pointer', flexShrink: 0, transition: 'all 0.2s',
                    boxShadow: testStatus === 'fired' ? 'none' : '0 4px 12px rgba(0,0,0,0.1)',
                  }}
                  onMouseEnter={e => { if (testStatus !== 'fired') e.currentTarget.style.transform = 'translateY(-1px)'; }}
                  onMouseLeave={e => { if (testStatus !== 'fired') e.currentTarget.style.transform = 'translateY(0)'; }}
                >
                  {testStatus === 'fired' ? 'Sent' : '🔔 Fire Now'}
                </button>
              </div>
            </div>
          )}

          {/* Live dose event log */}
          {doseEvents.length > 0 && (
            <div style={{
              borderRadius: 16, overflow: 'hidden',
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              animation: 'fadeInUp 0.35s ease',
            }}>
              <div style={{
                padding: '12px 18px', borderBottom: '1px solid var(--border)',
                background: 'rgba(0,0,0,0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-3)' }}>📋 Dose Activity Log</span>
                <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{doseEvents.length} event{doseEvents.length !== 1 ? 's' : ''}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: 'var(--border)', maxHeight: 280, overflowY: 'auto' }}>
                {doseEvents.map((ev, i) => {
                  const isTaken  = ev.status === 'taken';
                  const isMissed = ev.status === 'missed';
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'var(--bg)' }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14,
                        background: isTaken ? 'rgba(16,185,129,0.1)' : isMissed ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)',
                      }}>
                        {isTaken ? '✅' : isMissed ? '❌' : '⏰'}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.drug_name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>
                          {ev.slot} · {ev.scheduled_time}{ev.actual_time && ev.actual_time !== ev.scheduled_time ? ` → ${ev.actual_time}` : ''}
                        </div>
                      </div>
                      <div style={{
                        fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 6,
                        background: isTaken ? 'rgba(16,185,129,0.1)' : isMissed ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)',
                        color: isTaken ? '#34d399' : isMissed ? '#f87171' : '#fbbf24',
                        textTransform: 'capitalize', flexShrink: 0,
                      }}>
                        {ev.status}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ScheduleView;
