// modules/onboarding.js
// Manages first-startup onboarding flow with user preferences setup

const ONBOARDING_KEY = 'deskday.onboarding.v1';

/**
 * Check if this is the first startup (no hours set, no local data)
 */
export function isFirstStartup() {
  try {
    // If hours are not set, it's first startup
    const hours = localStorage.getItem('deskday.hours.v1');
    return !hours;
  } catch (e) {
    return true;
  }
}

/**
 * Get current onboarding step (or null if completed)
 * Steps: 'login' -> 'theme' -> 'autostart' -> 'format' -> 'see' -> null (done)
 */
export function getOnboardingStep() {
  try {
    const state = JSON.parse(localStorage.getItem(ONBOARDING_KEY) || '{}');
    return state.currentStep || (isFirstStartup() ? 'login' : null);
  } catch (e) {
    return isFirstStartup() ? 'login' : null;
  }
}

/**
 * Move to the next onboarding step
 */
export function nextOnboardingStep(choices = {}) {
  try {
    const state = JSON.parse(localStorage.getItem(ONBOARDING_KEY) || '{}');
    state.currentStep = state.currentStep || (isFirstStartup() ? 'login' : null);
    state.choices = state.choices || {};
    // merge new choices
    Object.assign(state.choices, choices || {});

    const steps = ['login', 'theme', 'autostart', 'format', 'see'];
    const currentIdx = steps.indexOf(state.currentStep || 'login');
    const nextStep = (currentIdx >= 0 && currentIdx < steps.length - 1) ? steps[currentIdx + 1] : null;

    state.currentStep = nextStep;
    localStorage.setItem(ONBOARDING_KEY, JSON.stringify(state));

    console.log('[onboarding] moved to step:', nextStep);
    return nextStep;
  } catch (e) {
    console.error('[onboarding] nextOnboardingStep failed', e);
    return null;
  }
}

/**
 * Skip onboarding (user wants to proceed without all choices)
 */
export function skipOnboarding() {
  try {
    localStorage.removeItem(ONBOARDING_KEY);
    console.log('[onboarding] skipped');
  } catch (e) {
    console.error('[onboarding] skipOnboarding failed', e);
  }
}

/**
 * Get all onboarding choices made so far
 */
export function getOnboardingChoices() {
  try {
    const state = JSON.parse(localStorage.getItem(ONBOARDING_KEY) || '{}');
    return state.choices || {};
  } catch (e) {
    return {};
  }
}

/**
 * Apply onboarding choices to settings
 */
export function applyOnboardingChoices(choices = {}) {
  if (!choices) choices = getOnboardingChoices();
  
  try {
    // Build settings patch that will be saved to tt.settings
    const settingsPatch = {};
    
    // Apply theme choice
    if (choices.theme === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
      settingsPatch.theme = 'light';
    } else if (choices.theme === 'dark') {
      document.documentElement.removeAttribute('data-theme');
      settingsPatch.theme = 'dark';
    }
    
    // Apply time format choice
    if (choices.hour12 !== undefined) {
      settingsPatch.hour12 = !!choices.hour12;
    }
    
    // Apply autostart choice
    if (choices.autostart !== undefined) {
      settingsPatch.autostart = !!choices.autostart;
      window.appApi?.setAutostart?.(choices.autostart);
    }
    
    // Apply alwaysOnTop choice if provided
    if (choices.alwaysOnTop !== undefined) {
      settingsPatch.alwaysOnTop = !!choices.alwaysOnTop;
    }
    
    // Save to settings using the correct key (tt.settings)
    if (Object.keys(settingsPatch).length > 0) {
      const currentSettings = JSON.parse(localStorage.getItem('tt.settings') || '{}');
      const newSettings = { ...currentSettings, ...settingsPatch };
      localStorage.setItem('tt.settings', JSON.stringify(newSettings));
      console.log('[onboarding] saved choices to tt.settings:', settingsPatch);
    }
    
    console.log('[onboarding] applied choices:', choices);
  } catch (e) {
    console.warn('[onboarding] applyOnboardingChoices failed', e);
  }
}

/**
 * Complete onboarding
 */
export function completeOnboarding() {
  try {
    localStorage.removeItem(ONBOARDING_KEY);
    console.log('[onboarding] completed');
  } catch (e) {
    console.error('[onboarding] completeOnboarding failed', e);
  }
}
