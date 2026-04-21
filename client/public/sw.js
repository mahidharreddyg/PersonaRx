// ================================================================
// sw.js — PrescriptAI Service Worker v2
// Handles:
//   1. Timed medication notifications (scheduled via postMessage)
//   2. Notification click → "taken" or "missed" action
//   3. Posts the event log back to /api/log-event
//
// Desktop note: SW is only used for background notifications.
// The main page runs its own in-page timer for when the tab is open.
// ================================================================

const STORE_KEY = 'prescript_pending_doses';

// ── Install & Activate ──────────────────────────────────────────
self.addEventListener('install',  () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

// ── In-memory schedule ──────────────────────────────────────────
let _pendingDoses = [];
let _sessionId    = null;
let _firedIds     = new Set();
let _intervalId   = null;

// ── Receive schedule from the app ───────────────────────────────
self.addEventListener('message', event => {
  const { type, payload } = event.data || {};

  if (type === 'SCHEDULE_NOTIFICATIONS') {
    _pendingDoses = payload.doses || [];
    _sessionId    = payload.sessionId;
    _firedIds     = new Set();
    startPollingTimer();
  }

  if (type === 'CANCEL_NOTIFICATIONS') {
    stopPollingTimer();
    _pendingDoses = [];
    _firedIds     = new Set();
  }

  // For testing: fire a notification immediately
  if (type === 'FIRE_TEST') {
    fireNotification(payload.dose);
  }
});

// ── Polling timer — avoids the "SW killed on desktop" problem ───
function startPollingTimer() {
  if (_intervalId) return; // already running
  checkAndFire(); // run immediately
  _intervalId = setInterval(checkAndFire, 10_000); // exactly on time, poll every 10 seconds
}

function stopPollingTimer() {
  if (_intervalId) {
    clearInterval(_intervalId);
    _intervalId = null;
  }
}

function checkAndFire() {
  const now = new Date();
  _pendingDoses.forEach(dose => {
    if (_firedIds.has(dose.dose_id)) return;
    const [year, month, day] = dose.date.split('-').map(Number);
    const [hour, minute]     = dose.scheduled_time.split(':').map(Number);
    // Target is exactly the 0th second of that minute
    const target = new Date(year, month - 1, day, hour, minute, 0, 0);
    const diffMs = target.getTime() - now.getTime();
    
    // Fire exactly when the time hits (diffMs <= 0) and don't fire if over 2 mins late
    if (diffMs <= 0 && diffMs > -120_000) {
      _firedIds.add(dose.dose_id);
      fireNotification(dose);
    }
  });

  // Stop polling when all doses are fired or past
  const hasFutureDoses = _pendingDoses.some(dose => {
    if (_firedIds.has(dose.dose_id)) return false;
    const [year, month, day] = dose.date.split('-').map(Number);
    const [hour, minute]     = dose.scheduled_time.split(':').map(Number);
    const target = new Date(year, month - 1, day, hour, minute, 0, 0);
    return target.getTime() > now.getTime();
  });
  if (!hasFutureDoses) stopPollingTimer();
}

// ── Fire the notification ────────────────────────────────────────
function fireNotification(dose) {
  const slotEmoji = { breakfast: '🌅', lunch: '☀️', dinner: '🌙' }[dose.slot] || '💊';
  const title     = `${slotEmoji} Time for ${dose.drug_name}`;
  
  const details = [];
  if (dose.dosage) details.push(dose.dosage);
  if (dose.constraint) details.push(dose.constraint);
  const body = details.join(' • ') || `Scheduled for ${dose.scheduled_time}`;

  self.registration.showNotification(title, {
    body,
    tag:      dose.dose_id,
    renotify: true,
    badge:    '/favicon.svg',
    vibrate:  [200, 100, 200],
    requireInteraction: true,
    data: {
      dose_id:        dose.dose_id,
      drug_name:      dose.drug_name,
      day:            dose.day,
      slot:           dose.slot,
      scheduled_time: dose.scheduled_time,
      sessionId:      _sessionId,
    },
    // Action buttons — shown on Android; Desktop Chrome may not show them
    actions: [
      { action: 'taken', title: '✅ Taken' },
      { action: 'missed', title: '❌ Missed' },
    ],
  });
}

// ── Handle notification click (action buttons OR tap) ───────────
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const dose     = event.notification.data;
  const action   = event.action; // 'taken' | 'missed' | '' (just tapped)
  const now      = new Date();
  const actualTime = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;

  const status = action === 'missed' ? 'missed' : 'taken';

  const eventPayload = {
    session_id:     dose.sessionId,
    dose_id:        dose.dose_id,
    drug_name:      dose.drug_name,
    day:            dose.day,
    slot:           dose.slot,
    scheduled_time: dose.scheduled_time,
    status,
    actual_time:    status === 'taken' ? actualTime : null,
    source:         'user',
    timestamp:      now.toISOString(),
  };

  event.waitUntil(
    fetch('/api/log-event', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(eventPayload),
    }).then(() => {
      return self.clients.matchAll({ type: 'window', includeUncontrolled: true })
        .then(clients => {
          clients.forEach(client => {
            client.postMessage({ type: 'DOSE_EVENT', payload: eventPayload });
          });
          if (clients.length > 0) return clients[0].focus();
          return self.clients.openWindow('/');
        });
    }).catch(err => {
      console.error('[SW] Failed to log event:', err);
    })
  );
});
