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
  { color: '#ff3388', bg: 'rgba(255,51,136,0.12)', border: 'rgba(255,51,136,0.3)', glow: 'rgba(255,51,136,0.2)' },
  { color: '#60a5fa', bg: 'rgba(96,165,250,0.12)',  border: 'rgba(96,165,250,0.3)',  glow: 'rgba(96,165,250,0.2)'  },
  { color: '#34d399', bg: 'rgba(52,211,153,0.12)',  border: 'rgba(52,211,153,0.3)',  glow: 'rgba(52,211,153,0.2)'  },
  { color: '#c084fc', bg: 'rgba(192,132,252,0.12)', border: 'rgba(192,132,252,0.3)', glow: 'rgba(192,132,252,0.2)' },
  { color: '#fb923c', bg: 'rgba(251,146,60,0.12)',  border: 'rgba(251,146,60,0.3)',  glow: 'rgba(251,146,60,0.2)'  },
];

const formatDate = (dateStr) => {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
};

const ScheduleView = ({ agentResult, onConfirm, onBack, alreadyConfirmed = false }) => {
  const [confirmed, setConfirmed]       = useState(alreadyConfirmed);
  const [notifPerm, setNotifPerm]       = useState(Notification?.permission || 'default');
  const [notifCount, setNotifCount]     = useState(0);
  const [doseEvents, setDoseEvents]     = useState([]);

  // Register SW on mount
  useEffect(() => {
    registerServiceWorker();
    // Listen for user tapping the notification (taken/missed)
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
  // and update the count badge (since we skipped handleConfirm)
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

  const { schedule, meal_times, total_doses, session_id } = agentResult;

  // Build drug → color map
  const drugNames = [...new Set(schedule.map(d => d.drug_name))];
  const drugColorMap = {};
  drugNames.forEach((name, i) => {
    drugColorMap[name] = DRUG_COLORS[i % DRUG_COLORS.length];
  });

  // ── Live dose count: total minus already acted-on doses ──────────
  const actedDoseIds  = new Set(doseEvents.map(e => e.dose_id).filter(Boolean));
  const pendingCount  = schedule.filter(d => !actedDoseIds.has(d.dose_id)).length;
  const doneCount     = actedDoseIds.size;
  const displayTotal  = total_doses ?? schedule.length;

  // Group by date, then slot
  const byDate = {};
  schedule.forEach(dose => {
    if (!byDate[dose.date]) byDate[dose.date] = { breakfast: [], lunch: [], dinner: [] };
    if (byDate[dose.date][dose.slot]) byDate[dose.date][dose.slot].push(dose);
    else byDate[dose.date][dose.slot] = [dose];
  });

  const dates = Object.keys(byDate).sort();
  const slots = ['breakfast', 'lunch', 'dinner'];

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

  return (
    <div style={{ marginTop: 40, animation: 'fadeInUp 0.5s ease' }}>
      {/* Header */}
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
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ padding: '8px 16px', borderRadius: 10, background: 'rgba(255,51,136,0.1)', border: '1px solid rgba(255,51,136,0.2)', fontSize: 12, fontWeight: 700, color: '#ff77aa' }}>
            💊 {pendingCount} Remaining
          </div>
          {doneCount > 0 && (
            <div style={{ padding: '8px 16px', borderRadius: 10, background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', fontSize: 12, fontWeight: 700, color: '#34d399' }}>
              ✅ {doneCount} Completed
            </div>
          )}
          <div style={{ padding: '8px 16px', borderRadius: 10, background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.2)', fontSize: 12, fontWeight: 700, color: '#93c5fd' }}>
            💉 {drugNames.length} Medications
          </div>
        </div>
      </div>

      {/* Drug Legend */}
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

      {/* Meal Times Bar */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 28,
      }}>
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

      {/* Daily Schedule Table */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 36 }}>
        {dates.map((date, dayIdx) => {
          const daySched = byDate[date];
          const totalForDay = slots.reduce((acc, s) => acc + (daySched[s]?.length || 0), 0);
          return (
            <div key={date} style={{
              background: 'var(--bg-card)',
              backdropFilter: 'blur(16px)',
              border: '1px solid var(--border)',
              borderRadius: 20,
              overflow: 'hidden',
              animation: `fadeInUp 0.4s ease ${dayIdx * 0.06}s both`,
              transition: 'border-color 0.3s, box-shadow 0.3s',
            }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,51,136,0.3)'; e.currentTarget.style.boxShadow = '0 8px 32px rgba(255,51,136,0.1)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = 'none'; }}
            >
              {/* Day Header */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '14px 20px',
                background: 'rgba(0,0,0,0.25)',
                borderBottom: '1px solid var(--border)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                    background: 'linear-gradient(135deg, rgba(255,51,136,0.2), rgba(255,119,170,0.1))',
                    border: '1px solid rgba(255,51,136,0.2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 13, fontWeight: 900, color: 'var(--accent)',
                  }}>
                    {dayIdx + 1}
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-1)', letterSpacing: '-0.01em' }}>
                      Day {dayIdx + 1} — {formatDate(date)}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>{totalForDay} dose{totalForDay !== 1 ? 's' : ''} scheduled</div>
                  </div>
                </div>
                <div style={{
                  padding: '4px 12px', borderRadius: 8,
                  background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)',
                  fontSize: 11, fontWeight: 700, color: '#34d399',
                }}>
                  All Pending
                </div>
              </div>

              {/* Time Slots */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 1, background: 'var(--border)' }}>
                {slots.map(slot => {
                  const cfg = SLOT_CONFIG[slot];
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
                            const dc = drugColorMap[dose.drug_name];
                            return (
                              <div key={dose.dose_id} style={{
                                display: 'flex', alignItems: 'center', gap: 10,
                                padding: '8px 12px', borderRadius: 10,
                                background: dc.bg, border: `1px solid ${dc.border}`,
                                transition: 'transform 0.2s',
                              }}
                                onMouseEnter={e => e.currentTarget.style.transform = 'translateX(4px)'}
                                onMouseLeave={e => e.currentTarget.style.transform = 'translateX(0)'}
                              >
                                <div style={{ width: 7, height: 7, borderRadius: '50%', background: dc.color, flexShrink: 0, boxShadow: `0 0 5px ${dc.color}` }} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontSize: 12, fontWeight: 700, color: dc.color, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{dose.drug_name}</div>
                                  <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 1 }}>
                                    {dose.dosage && `${dose.dosage} · `}{dose.constraint}
                                  </div>
                                </div>
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

      {/* Confirm / Back */}
      {!confirmed ? (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, flexWrap: 'wrap',
          padding: '28px 32px',
          borderRadius: 20,
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
              color: 'var(--text-2)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              transition: 'all 0.2s',
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
              <div style={{ fontSize: 13, color: 'var(--text-2)' }}>Your {dates.length}-day plan is active · {pendingCount} doses remaining of {displayTotal}</div>
            </div>
            {/* Notification status badge */}
            <div style={{
              padding: '8px 14px', borderRadius: 10, flexShrink: 0,
              ...(notifPerm === 'granted'
                ? { background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)', color: '#34d399' }
                : { background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', color: '#fbbf24' }
              ),
              fontSize: 12, fontWeight: 700, textAlign: 'center',
            }}>
              {notifPerm === 'granted'
                ? `🔔 ${notifCount} reminders set`
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

          {/* Live dose event log (populated when user taps notification) */}
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
                    <div key={i} style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '12px 16px', background: 'var(--bg)',
                    }}>
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
