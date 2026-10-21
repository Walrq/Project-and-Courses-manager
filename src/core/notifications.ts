/**
 * Utilities for Browser Notifications and Daily Reminders.
 */

export function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function getNotificationPermission(): NotificationPermission {
  if (!isNotificationSupported()) return 'denied';
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!isNotificationSupported()) return 'denied';
  return Notification.requestPermission();
}

export function sendDailyPartNotification(partTitle: string, projectName: string): boolean {
  if (!isNotificationSupported() || Notification.permission !== 'granted') {
    return false;
  }

  try {
    new Notification(`Progress Den — Ready for Today's Work`, {
      body: `"${partTitle}" in ${projectName} is waiting for you!`,
      icon: '/icons/icon-192.png',
      tag: 'projectpilot-daily-reminder',
    });
    return true;
  } catch (err) {
    console.warn('Failed to dispatch notification:', err);
    return false;
  }
}

/**
 * Checks whether a reminder should trigger today at or after the scheduled time.
 * @param reminderTime "HH:MM" 24h format (e.g. "09:00")
 * @param lastNotifiedDate "YYYY-MM-DD"
 * @param currentDate Date object (defaults to new Date())
 */
export function shouldTriggerReminder(
  reminderTime: string = '09:00',
  lastNotifiedDate?: string | null,
  currentDate: Date = new Date()
): boolean {
  const currentHours = currentDate.getHours();
  const currentMinutes = currentDate.getMinutes();

  const [targetHours, targetMinutes] = reminderTime.split(':').map(Number);
  if (isNaN(targetHours) || isNaN(targetMinutes)) return false;

  const currentTotalMinutes = currentHours * 60 + currentMinutes;
  const targetTotalMinutes = targetHours * 60 + targetMinutes;

  // Format today's date YYYY-MM-DD
  const year = currentDate.getFullYear();
  const month = String(currentDate.getMonth() + 1).padStart(2, '0');
  const day = String(currentDate.getDate()).padStart(2, '0');
  const todayStr = `${year}-${month}-${day}`;

  // If already notified today, do not trigger again
  if (lastNotifiedDate === todayStr) {
    return false;
  }

  // Trigger if current time is at or past target time
  return currentTotalMinutes >= targetTotalMinutes;
}
