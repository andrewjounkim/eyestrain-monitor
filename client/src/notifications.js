// Notification groundwork: ask for permission (only after explaining why, and
// only when the user clicks), and send a test notification through the service
// worker. Real alert logic comes in a later phase.

export function setupNotifications(els) {
  const supported = 'Notification' in window && 'serviceWorker' in navigator;

  function render() {
    if (!supported) {
      els.notifyEnable.disabled = true;
      els.notifyTest.disabled = true;
      els.notifyStatus.textContent = 'This browser doesn’t support notifications from web apps.';
      return;
    }
    const permission = Notification.permission; // 'default' | 'granted' | 'denied'
    els.notifyEnable.hidden = permission === 'granted';
    els.notifyEnable.disabled = permission === 'denied';
    els.notifyTest.disabled = permission !== 'granted';
    els.notifyStatus.textContent = {
      default: 'Notifications are off. Click “Enable notifications” and then “Allow”.',
      granted: 'Notifications are on.',
      // Once denied, a site can't ask again; only the user can undo it.
      denied:
        'Notifications are blocked. To turn them on: click the icon left of the address bar ' +
        '(or ⋮ → App info in the installed app) → Site settings → Notifications → Allow, then reload. ' +
        'On macOS also check System Settings → Notifications → Google Chrome.',
    }[permission];
  }

  els.notifyEnable.addEventListener('click', async () => {
    await Notification.requestPermission();
    render();
  });

  els.notifyTest.addEventListener('click', async () => {
    try {
      const registration = await serviceWorkerReady();
      // Why registration.showNotification() instead of `new Notification()`:
      // the notification then belongs to the service worker, so its click is
      // handled in sw.js (focus/open the app window) even if this page is
      // minimized, hidden or closed. `new Notification()` is tied to this page
      // and isn't allowed at all in some contexts (e.g. Android).
      await registration.showNotification('Time for a quick eye break', {
        body: 'Test notification. Click to return to Eye Strain Monitor.',
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        tag: 'test', // same tag replaces the previous notification instead of stacking
        data: { url: '/?app' }, // read by the notificationclick handler in sw.js (?app skips the intro)
      });
      els.notifyStatus.textContent = 'Test sent. Switch to another window, then click it.';
    } catch (err) {
      els.notifyStatus.textContent = `Couldn’t show a notification: ${err.message}`;
    }
  });

  // sw.js posts this after focusing our window from a notification click.
  if (supported) {
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data?.type === 'notification-clicked') {
        els.notifyStatus.textContent = `Opened from notification “${event.data.tag}” at ${new Date().toLocaleTimeString()}.`;
      }
    });
  }

  render();
}

// navigator.serviceWorker.ready never resolves if no service worker gets
// registered, so give up after a few seconds with a useful message.
function serviceWorkerReady(timeoutMs = 5000) {
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('the service worker isn’t running. Reload the page and try again.')), timeoutMs),
    ),
  ]);
}
