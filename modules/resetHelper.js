// modules/resetHelper.js
// Helper to reset app data for testing

/**
 * Reset all local app data
 * Clears localStorage of all Deskday keys
 */
export function resetLocalData() {
  const keys = [
    'deskday.hours.v1',
    'deskday.theme.v1',
    'deskday.hour12.v1',
    'deskday.collapse.v1',
    'deskday.onboarding.v1',
    'tt.theme',
    'STORE_KEY',
    'HOURS_KEY',
    'META_KEY',
    'ENTRY_META_KEY',
    'PERSISTENT_LOGIN_KEY',
    'PERSISTENT_LOGIN_REFRESH_EXPIRY'
  ];

  try {
    keys.forEach(key => {
      localStorage.removeItem(key);
      console.log(`[resetHelper] cleared localStorage.${key}`);
    });
    console.log('[resetHelper] all local data cleared');
    return true;
  } catch (e) {
    console.error('[resetHelper] resetLocalData failed:', e);
    return false;
  }
}

/**
 * Reset cloud data (Firestore) - requires user confirmation
 * Deletes user's Firestore document
 */
export async function resetCloudData() {
  try {
    const user = window.auth?.getCurrentUser?.();
    if (!user) {
      console.warn('[resetHelper] no user logged in, cannot reset cloud data');
      return false;
    }

    // Require explicit confirmation in console
    const confirmed = window.confirm(
      `Delete all Firestore data for user ${user.email}?\n\nThis cannot be undone!`
    );
    if (!confirmed) {
      console.log('[resetHelper] cloud reset cancelled');
      return false;
    }

    // Call cloud API to delete
    if (window.appApi?.deleteCloudData) {
      await window.appApi.deleteCloudData(user.uid);
      console.log('[resetHelper] cloud data deleted');
      return true;
    } else {
      console.warn('[resetHelper] appApi.deleteCloudData not available');
      return false;
    }
  } catch (e) {
    console.error('[resetHelper] resetCloudData failed:', e);
    return false;
  }
}

/**
 * Full app reset: local + prompt for cloud
 * Then reload the app to show fresh onboarding
 */
export async function resetAppFull() {
  try {
    console.log('[resetHelper] starting full app reset...');

    // Reset local data FIRST - this must happen before any other logic
    const localCleared = resetLocalData();
    if (!localCleared) {
      console.error('[resetHelper] failed to clear local data');
      return;
    }

    // Verify hours were cleared
    const hoursStillThere = localStorage.getItem('deskday.hours.v1');
    console.log('[resetHelper] hours after clear:', hoursStillThere ? 'STILL PRESENT (ERROR!)' : 'cleared ✓');

    // Try to reset cloud data (with confirmation)
    const user = window.auth?.getCurrentUser?.();
    if (user) {
      const resetCloud = window.confirm(
        `Also reset cloud data for ${user.email}?\n(Click "Cancel" to keep cloud data)`
      );
      if (resetCloud) {
        await resetCloudData();
      }
    }

    console.log('[resetHelper] reset complete, reloading app...');
    // Give localStorage time to persist, then reload
    await new Promise(r => setTimeout(r, 100));
    window.location.reload();
  } catch (e) {
    console.error('[resetHelper] resetAppFull failed:', e);
  }
}

/**
 * Install keyboard shortcut (Ctrl+Shift+R) for reset
 */
export function installResetShortcut() {
  try {
    document.addEventListener('keydown', (e) => {
      // Ctrl+Shift+R (or Cmd+Shift+R on Mac)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.code === 'KeyR') {
        e.preventDefault();
        console.log('[resetHelper] reset shortcut triggered');
        resetAppFull();
      }
    });
    console.log('[resetHelper] reset shortcut installed (Ctrl+Shift+R)');
  } catch (e) {
    console.error('[resetHelper] installResetShortcut failed:', e);
  }
}

// Expose to window for console debugging
window.deskdayReset = {
  local: resetLocalData,
  cloud: resetCloudData,
  full: resetAppFull
};

console.log('[resetHelper] available: window.deskdayReset.local() / .cloud() / .full()');
