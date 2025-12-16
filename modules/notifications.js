// modules/notifications.js
const MOD = 'notifications.js';
console.time(`[load] ${MOD}`);

let notificationTicker = null;
let lastNotifiedHour = -1;

export function initNotifications() {
  console.log('[notifications] initializing hourly notifications');
  scheduleHourlyNotification();
}

export function stopNotifications() {
  if (notificationTicker) {
    clearInterval(notificationTicker);
    clearTimeout(notificationTicker);
    notificationTicker = null;
  }
}

export function testNotification() {
  const now = new Date();
  const currentHour = now.getHours();
  const hourKey = String(currentHour).padStart(2, '0');
  const entries = JSON.parse(localStorage.getItem('deskday.entries.v1') || '{}');
  const hourText = entries[hourKey]?.trim();

  if (hourText) {
    showNotification(currentHour, hourText);
    console.log(`[notifications] test notification sent for hour ${hourKey}`);
  } else {
    console.warn(`[notifications] no entry for current hour ${hourKey}, cannot test`);
  }
}

function scheduleHourlyNotification() {
  // Fire at the top of each hour
  const now = new Date();
  const minutesUntilHour = 60 - now.getMinutes();
  const secondsUntilHour = 60 - now.getSeconds();
  const msUntilHour = (minutesUntilHour * 60 + secondsUntilHour) * 1000;

  notificationTicker = setTimeout(() => {
    checkAndNotify();
    // After first notification, set interval for every hour
    notificationTicker = setInterval(checkAndNotify, 3600000); // 1 hour
  }, msUntilHour);

  console.log(`[notifications] scheduled next check in ${Math.round(msUntilHour / 1000)}s`);
}

function checkAndNotify() {
  const now = new Date();
  const currentHour = now.getHours();

  // Prevent duplicate notifications within the same hour
  if (currentHour === lastNotifiedHour) {
    return;
  }

  // Get current hour's entry
  const hourKey = String(currentHour).padStart(2, '0');
  const entries = JSON.parse(localStorage.getItem('deskday.entries.v1') || '{}');
  const hourText = entries[hourKey]?.trim();

  if (hourText) {
    showNotification(currentHour, hourText);
    lastNotifiedHour = currentHour;
  }
}

function showNotification(hour, text) {
  const title = `Hour ${String(hour).padStart(2, '0')}`;
  const summary = text.length > 80 ? text.substring(0, 77) + '...' : text;

  try {
    if ('Notification' in window) {
      // Request permission if not granted
      if (Notification.permission === 'granted') {
        new Notification(title, {
          body: summary,
          icon: '/assets/icons/app.ico',
          tag: 'deskday-hour',
          requireInteraction: false
        });
        console.log(`[notifications] showed notification for hour ${hour}`);
      } else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then(permission => {
          if (permission === 'granted') {
            new Notification(title, {
              body: summary,
              icon: '/assets/icons/app.ico',
              tag: 'deskday-hour',
              requireInteraction: false
            });
          }
        });
      }
    }
  } catch (e) {
    console.warn('[notifications] failed to show notification:', e);
  }
}

console.log(`[load] ${MOD} ready (exports: initNotifications,stopNotifications,testNotification)`);
console.timeEnd(`[load] ${MOD}`);
