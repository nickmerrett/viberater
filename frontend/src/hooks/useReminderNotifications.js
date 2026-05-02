import { useEffect, useCallback } from 'react';

const NOTIFIED_KEY = 'viberater_notified_reminders';

function getNotified() {
  try {
    return new Set(JSON.parse(localStorage.getItem(NOTIFIED_KEY) || '[]'));
  } catch {
    return new Set();
  }
}

function markNotified(id) {
  const notified = getNotified();
  notified.add(id);
  // Prune to last 200 to avoid unbounded growth
  const arr = [...notified].slice(-200);
  localStorage.setItem(NOTIFIED_KEY, JSON.stringify(arr));
}

export function useReminderNotifications(reminders) {
  const requestPermission = useCallback(async () => {
    if (!('Notification' in window)) return 'denied';
    if (Notification.permission === 'default') {
      return Notification.requestPermission();
    }
    return Notification.permission;
  }, []);

  const checkAndNotify = useCallback((reminders) => {
    if (Notification.permission !== 'granted') return;
    const today = new Date().toISOString().split('T')[0];
    const notified = getNotified();

    reminders
      .filter(r => !r.completed && r.due_date && r.due_date <= today && !notified.has(r.id))
      .forEach(r => {
        const overdue = r.due_date < today;
        new Notification(overdue ? `Overdue: ${r.title}` : `Due today: ${r.title}`, {
          body: r.note || (overdue ? `Was due ${r.due_date}` : 'Due today'),
          icon: '/icon.svg',
          tag: r.id,
        });
        markNotified(r.id);
      });
  }, []);

  // Check on mount and whenever reminders change
  useEffect(() => {
    if (reminders?.length) checkAndNotify(reminders);
  }, [reminders, checkAndNotify]);

  // Re-check when window regains focus
  useEffect(() => {
    const onFocus = () => {
      if (reminders?.length) checkAndNotify(reminders);
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [reminders, checkAndNotify]);

  return { requestPermission, permission: typeof Notification !== 'undefined' ? Notification.permission : 'denied' };
}
