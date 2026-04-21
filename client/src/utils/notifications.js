/**
 * notifications.js — Notification Manager v2
 *
 * Desktop (Chrome/Arc/Firefox) strategy:
 *  - SW setTimeout is unreliable on desktop (SW gets killed when tab is idle).
 *  - We use an IN-PAGE setInterval that polls every 30s and fires native
 *    Notification() directly from the page when the tab is open.
 *  - The SW handles notifications when the app is in the background (mobile PWA).
 *  - Both paths share the same schedule array stored in module scope.
 *
 * Mobile PWA (iOS/Android):
 *  - Still delegates to the SW via postMessage for background delivery.
 */

let _swRegistration = null;
let _doseEventListeners = [];

// In-page dose schedule for the desktop fallback timer
let _inPageSchedule = [];
let _inPageSessionId = null;
let _inPageTimerHandle = null;
const _firedDoseIds = new Set();

// ── Register the Service Worker ──────────────────────────────────
export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    console.warn('[Notifications] Service Workers not supported on this browser.');
    return false;
  }

  try {
    _swRegistration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    console.log('[Notifications] Service Worker registered:', _swRegistration.scope);

    // Listen for messages coming back FROM the SW (e.g., DOSE_EVENT after tap)
    navigator.serviceWorker.addEventListener('message', event => {
      const { type, payload } = event.data || {};
      if (type === 'DOSE_EVENT') {
        _doseEventListeners.forEach(cb => cb(payload));
      }
    });

    return true;
  } catch (err) {
    console.error('[Notifications] SW registration failed:', err);
    return false;
  }
}

// ── Request permission ───────────────────────────────────────────
export async function requestNotificationPermission() {
  if (!('Notification' in window)) {
    return 'denied'; // browser doesn't support it
  }
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied')  return 'denied';

  const result = await Notification.requestPermission();
  return result; // 'granted' | 'denied' | 'default'
}

// ── In-page polling timer (desktop fallback) ─────────────────────
function startInPageTimer(schedule, sessionId) {
  if (_inPageTimerHandle) clearInterval(_inPageTimerHandle);
  _inPageSchedule = schedule;
  _inPageSessionId = sessionId;

  const checkAndFire = () => {
    if (Notification.permission !== 'granted') return;
    const now = new Date();
    _inPageSchedule.forEach(dose => {
      if (_firedDoseIds.has(dose.dose_id)) return;
      if (dose.status !== 'pending') return;
      
      const [year, month, day] = dose.date.split('-').map(Number);
      const [hour, minute]     = dose.scheduled_time.split(':').map(Number);
      
      // Target is exactly the 0th second of that minute
      const doseTime = new Date(year, month - 1, day, hour, minute, 0, 0);
      const diffMs = doseTime.getTime() - now.getTime();
      
      // Fire exactly when the time hits (diffMs <= 0) and don't fire if over 2 mins late
      if (diffMs <= 0 && diffMs > -120_000) {
        _firedDoseIds.add(dose.dose_id);
        fireInPageNotification(dose, sessionId);
      }
    });
  };

  // Run immediately + poll every 10 seconds for exact timing
  checkAndFire();
  _inPageTimerHandle = setInterval(checkAndFire, 10_000);
}

function stopInPageTimer() {
  if (_inPageTimerHandle) {
    clearInterval(_inPageTimerHandle);
    _inPageTimerHandle = null;
  }
  _firedDoseIds.clear();
}

function fireInPageNotification(dose, sessionId) {
  const slotEmoji = { breakfast: '🌅', lunch: '☀️', dinner: '🌙' }[dose.slot] || '💊';
  const title = `${slotEmoji} Medication Reminder`;
  const body  = `Time to take ${dose.drug_name}${dose.dosage ? ` · ${dose.dosage}` : ''}${dose.constraint ? `\n(${dose.constraint})` : ''}`;

  // Build a native Notification from the page context
  const n = new Notification(title, {
    body,
    tag:     dose.dose_id,
    icon:    '/favicon.svg',
    badge:   '/favicon.svg',
    requireInteraction: true,   // stays until user dismisses on desktop
  });

  n.onclick = () => {
    n.close();
    window.focus();
    const now = new Date();
    const actualTime = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
    const eventPayload = {
      session_id:     sessionId,
      dose_id:        dose.dose_id,
      drug_name:      dose.drug_name,
      day:            dose.day,
      slot:           dose.slot,
      scheduled_time: dose.scheduled_time,
      status:         'taken',
      actual_time:    actualTime,
      source:         'user',
      timestamp:      now.toISOString(),
    };
    _doseEventListeners.forEach(cb => cb(eventPayload));
    // Best-effort log to backend
    fetch('/api/log-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(eventPayload),
    }).catch(() => {});
  };

  // Auto-log as missed after 5 minutes if not clicked
  setTimeout(() => {
    if (!n) return;
    const now = new Date();
    const eventPayload = {
      session_id:     sessionId,
      dose_id:        dose.dose_id,
      drug_name:      dose.drug_name,
      day:            dose.day,
      slot:           dose.slot,
      scheduled_time: dose.scheduled_time,
      status:         'missed',
      actual_time:    null,
      source:         'auto',
      timestamp:      now.toISOString(),
    };
    // Don't broadcast to UI for auto-missed; just log silently
    fetch('/api/log-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(eventPayload),
    }).catch(() => {});
  }, 5 * 60_000);
}

// ── Schedule all notifications for a confirmed medication plan ───
export async function scheduleNotifications(schedule, sessionId) {
  // Register SW if not yet done
  if (!_swRegistration) {
    await registerServiceWorker();
  }

  // Only pass pending, future doses
  const now = new Date();
  const futureDoses = schedule.filter(dose => {
    const [year, month, day] = dose.date.split('-').map(Number);
    const [hour, minute]     = dose.scheduled_time.split(':').map(Number);
    const doseTime = new Date(year, month - 1, day, hour, minute);
    return doseTime > now && dose.status === 'pending';
  });

  // ── Desktop fallback: in-page polling timer ──────────────────
  // Always start in-page timer when tab is visible (works on Arc/Chrome/Firefox)
  startInPageTimer(futureDoses, sessionId);

  // ── Also post to SW for background / PWA / mobile support ───
  try {
    const sw = _swRegistration?.active || (await navigator.serviceWorker.ready).active;
    if (sw) {
      sw.postMessage({
        type:    'SCHEDULE_NOTIFICATIONS',
        payload: { doses: futureDoses, sessionId },
      });
      console.log(`[Notifications] SW notified with ${futureDoses.length} future doses.`);
    }
  } catch (err) {
    console.warn('[Notifications] Could not post to SW:', err.message);
  }

  console.log(`[Notifications] In-page timer started for ${futureDoses.length} future doses.`);
  return futureDoses.length;
}

// ── Cancel all pending notifications ────────────────────────────
export async function cancelNotifications() {
  stopInPageTimer();

  try {
    const sw = _swRegistration?.active || (await navigator.serviceWorker.ready).active;
    if (sw) sw.postMessage({ type: 'CANCEL_NOTIFICATIONS' });
  } catch (_) {}

  // Also clear any already-shown notifications
  if (_swRegistration) {
    try {
      const shown = await _swRegistration.getNotifications();
      shown.forEach(n => n.close());
    } catch (_) {}
  }
}

// ── Subscribe to dose events (notification taps from user) ───────
export function onDoseEvent(callback) {
  _doseEventListeners.push(callback);
  return () => {
    _doseEventListeners = _doseEventListeners.filter(cb => cb !== callback);
  };
}

// ── Convenience: fire a test notification immediately ────────────
// Returns true if notification was shown, false otherwise
export async function fireTestNotification(dose) {
  const perm = await requestNotificationPermission();
  if (perm !== 'granted') return false;

  const testDose = dose || {
    dose_id:        'test_dose_' + Date.now(),
    drug_name:      'Test Medicine',
    dosage:         '1 tablet',
    constraint:     'after food',
    slot:           'breakfast',
    scheduled_time: '08:00',
    date:           new Date().toISOString().split('T')[0],
    day:            1,
    status:         'pending',
  };

  // Format for a cleaner, premium OS notification look
  const slotEmoji = { breakfast: '🌅', lunch: '☀️', dinner: '🌙' }[testDose.slot] || '💊';
  const title = `${slotEmoji} Time for ${testDose.drug_name}`;
  
  // Clean, single-line dot-separated payload if possible
  const details = [];
  if (testDose.dosage) details.push(testDose.dosage);
  if (testDose.constraint) details.push(testDose.constraint);
  const body = details.join(' • ') || `Scheduled for ${testDose.scheduled_time}`;

  // ── Primary: SW registration.showNotification ────────────────
  // This appears as a persistent system notification on all platforms.
  try {
    const reg = _swRegistration || (await navigator.serviceWorker.ready);
    await reg.showNotification(title, {
      body,
      tag:     testDose.dose_id,
      // Removed SVG icon as it renders poorly natively on macOS
      badge:   '/favicon.svg',
      vibrate: [200, 100, 200],
      requireInteraction: true,
      data: {
        dose_id:        testDose.dose_id,
        drug_name:      testDose.drug_name,
        day:            testDose.day,
        slot:           testDose.slot,
        scheduled_time: testDose.scheduled_time,
        sessionId:      'test_session',
      },
      actions: [
        { action: 'taken', title: '✅ Taken' },
        { action: 'missed', title: '❌ Missed' },
      ],
    });
    console.log('[Notifications] Test notification shown via SW registration.');
    return true;
  } catch (swErr) {
    console.warn('[Notifications] SW showNotification failed, falling back to Notification():', swErr.message);
  }

  // ── Fallback: page Notification() (desktop, no SW) ───────────
  try {
    const n = new Notification(title, {
      body,
      tag:  testDose.dose_id,
      requireInteraction: true,
    });
    n.onclick = () => { n.close(); window.focus(); };
    console.log('[Notifications] Test notification shown via page Notification().');
    return true;
  } catch (pageErr) {
    console.error('[Notifications] page Notification() also failed:', pageErr.message);
    return false;
  }
}

