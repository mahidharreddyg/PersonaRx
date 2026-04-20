// ================================================================
// sw.js — PrescriptAI Service Worker
// Handles:
//   1. Timed medication notifications (scheduled via postMessage)
//   2. Notification click → "taken" or "missed" action
//   3. Posts the event log back to /api/log-event
// ================================================================

const STORE_KEY = 'prescript_pending_doses';

// ── Install & Activate ──────────────────────────────────────────
self.addEventListener('install',  () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

// ── Receive schedule from the app ───────────────────────────────
self.addEventListener('message', event => {
  const { type, payload } = event.data || {};

  if (type === 'SCHEDULE_NOTIFICATIONS') {
    // Store the dose schedule and start the timer loop
    storeSchedule(payload.doses, payload.sessionId);
    startTimer();
  }

  if (type === 'CANCEL_NOTIFICATIONS') {
    clearAllTimers();
  }
});

// ── In-memory timer handles ──────────────────────────────────────
const timerHandles = [];

function clearAllTimers() {
  timerHandles.forEach(t => clearTimeout(t));
  timerHandles.length = 0;
}

// Store pending doses in the SW's own cache (IndexedDB-lite via CacheStorage not available)
// We use the SW global scope instead (lost on SW restart, so we also use the message channel)
let _pendingDoses = [];
let _sessionId = null;

function storeSchedule(doses, sessionId) {
  _pendingDoses = doses;
  _sessionId = sessionId;
}

function startTimer() {
  clearAllTimers();

  _pendingDoses.forEach(dose => {
    const now = new Date();

    // Build the target datetime from dose.date + dose.scheduled_time
    const [year, month, day]  = dose.date.split('-').map(Number);
    const [hour, minute]      = dose.scheduled_time.split(':').map(Number);
    const target = new Date(year, month - 1, day, hour, minute, 0, 0);

    const msUntil = target.getTime() - now.getTime();
    if (msUntil < 0) return; // already past

    const handle = setTimeout(() => {
      fireNotification(dose);
    }, msUntil);

    timerHandles.push(handle);
  });
}

// ── Fire the notification ────────────────────────────────────────
function fireNotification(dose) {
  const slotEmoji = { breakfast: '🌅', lunch: '☀️', dinner: '🌙' }[dose.slot] || '💊';
  const title     = `${slotEmoji} Medication Reminder`;
  const body      = `Time to take ${dose.drug_name}${dose.dosage ? ` · ${dose.dosage}` : ''}\n${dose.constraint ? `(${dose.constraint})` : ''}`;

  self.registration.showNotification(title, {
    body,
    tag:     dose.dose_id,             // prevent duplicate notifications
    renotify: true,
    icon:    '/favicon.png',
    badge:   '/favicon.png',
    vibrate: [200, 100, 200],
    data: {
      dose_id:        dose.dose_id,
      drug_name:      dose.drug_name,
      day:            dose.day,
      slot:           dose.slot,
      scheduled_time: dose.scheduled_time,
      sessionId:      _sessionId,
    },
    // Action buttons — shown on Android + desktop; iOS shows notification only
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

  // Default to "taken" if user just taps the notification (no action button)
  const status = action === 'missed' ? 'missed' : 'taken';

  // Build the event payload matching the agent's log-event schema
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
    // POST the event to our Node backend (which forwards to the agent)
    fetch('/api/log-event', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(eventPayload),
    }).then(() => {
      // Open/focus the app window
      return self.clients.matchAll({ type: 'window', includeUncontrolled: true })
        .then(clients => {
          // Notify the app about the event (so UI can update)
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
