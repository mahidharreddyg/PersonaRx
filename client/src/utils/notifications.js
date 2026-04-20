/**
 * notifications.js — Notification Manager
 *
 * Handles:
 *  1. Service Worker registration
 *  2. Notification permission request
 *  3. Sending the medication schedule to the SW for timed firing
 *  4. Listening for DOSE_EVENT messages back from SW (to update UI state)
 */

let _swRegistration = null;
let _doseEventListeners = [];

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

// ── Schedule all notifications for a confirmed medication plan ───
export async function scheduleNotifications(schedule, sessionId) {
  if (!_swRegistration) {
    console.warn('[Notifications] SW not registered yet, calling registerServiceWorker first.');
    await registerServiceWorker();
  }

  const sw = _swRegistration?.active || (await navigator.serviceWorker.ready).active;
  if (!sw) {
    console.error('[Notifications] No active Service Worker found.');
    return false;
  }

  // Only pass pending, future doses
  const now = new Date();
  const futureDoses = schedule.filter(dose => {
    const [year, month, day] = dose.date.split('-').map(Number);
    const [hour, minute]     = dose.scheduled_time.split(':').map(Number);
    const doseTime = new Date(year, month - 1, day, hour, minute);
    return doseTime > now && dose.status === 'pending';
  });

  sw.postMessage({
    type:    'SCHEDULE_NOTIFICATIONS',
    payload: { doses: futureDoses, sessionId },
  });

  console.log(`[Notifications] Scheduled ${futureDoses.length} future dose notifications.`);
  return futureDoses.length;
};

// ── Cancel all pending notifications ────────────────────────────
export async function cancelNotifications() {
  const sw = _swRegistration?.active || (await navigator.serviceWorker.ready).active;
  if (sw) sw.postMessage({ type: 'CANCEL_NOTIFICATIONS' });

  // Also clear any already-shown notifications
  if (_swRegistration) {
    const shown = await _swRegistration.getNotifications();
    shown.forEach(n => n.close());
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
export async function fireTestNotification() {
  const perm = await requestNotificationPermission();
  if (perm !== 'granted') return;

  const sw = _swRegistration?.active || (await navigator.serviceWorker.ready).active;
  if (!sw) return;

  new Notification('💊 PrescriptAI Test', {
    body: 'Notifications are working! You will be reminded for each dose.',
    icon: '/favicon.png',
  });
}
