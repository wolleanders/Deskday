// modules/onboardingUI.js
// Handles the UI flow for first-startup onboarding

import { isFirstStartup, getOnboardingStep, nextOnboardingStep, getOnboardingChoices, applyOnboardingChoices, completeOnboarding } from './onboarding.js';

let currentStep = null;

/**
 * Handle auth state changes during onboarding
 * Called when user successfully logs in during the login step
 */
export async function handleAuthChangeInOnboarding(user) {
  if (!isFirstStartup() || !user) {
    console.log('[onboardingUI] handleAuthChangeInOnboarding skipped - isFirstStartup:', isFirstStartup(), 'user:', !!user);
    return;
  }
  
  const step = getOnboardingStep();
  console.log('[onboardingUI] auth change detected, current step:', step, 'user:', user.email);
  
  // If we're on the login step and user logged in, advance to theme
  if (step === 'login') {
    console.log('[onboardingUI] user logged in during login step, advancing to theme');
    nextOnboardingStep({ loginChoice: 'google' });
    const shown = await showStep('theme');
    console.log('[onboardingUI] theme step shown:', shown);
  } else {
    console.log('[onboardingUI] not on login step, skipping auto-advance');
  }
}

export async function startOnboarding() {
  if (!isFirstStartup()) return false;
  
  currentStep = getOnboardingStep();
  if (!currentStep) return false;
  
  console.log('[onboardingUI] starting flow, step:', currentStep);
  return await showStep(currentStep);
}

async function showStep(step) {
  console.log('[onboardingUI] showing step:', step);
  
  // Fade out all onboarding overlays
  const allOverlays = document.querySelectorAll('.onboarding:not(.hidden)');
  
  // Fade out existing overlays (without hiding)
  for (const el of allOverlays) {
    el.style.opacity = '0';
    el.style.transition = 'opacity 0.3s ease';
  }
  
  // Wait for fade out
  await new Promise(r => setTimeout(r, 300));
  
  // Now hide and reset
  document.querySelectorAll('.onboarding').forEach(el => {
    el.classList.add('hidden');
    el.style.opacity = '1';
    el.style.transition = '';
  });
  
  switch(step) {
    case 'login':
      return showLoginStep();
    case 'theme':
      return showThemeStep();
    case 'autostart':
      return showAutostartStep();
    case 'format':
      return showFormatStep();
    case 'see':
      // SEE is handled separately in main renderer, skip here
      console.log('[onboardingUI] SEE step handled by renderer');
      return false;
    default:
      console.log('[onboardingUI] onboarding complete');
      return false;
  }
}

function showLoginStep() {
  const overlay = document.getElementById('onboardingLogin');
  if (!overlay) return false;
  
  overlay.classList.remove('hidden');
  
  const loginBtn = document.getElementById('onboardingLoginNow');
  const localBtn = document.getElementById('onboardingLoginLater');
  
  if (loginBtn) {
    loginBtn.onclick = async () => {
      console.log('[onboardingUI] user chose: log in now');
      try {
        loginBtn.disabled = true;
        await window.auth?.signInWithGoogle?.();
        // auth change will trigger next step
      } catch (err) {
        console.error('[onboardingUI] login failed:', err);
        loginBtn.disabled = false;
      }
    };
  }
  
  if (localBtn) {
    localBtn.onclick = async () => {
      console.log('[onboardingUI] user chose: continue locally');
      nextOnboardingStep({ loginChoice: 'local' });
      await showStep('theme');
    };
  }
  
  return true;
}

function showThemeStep() {
  const overlay = document.getElementById('onboardingTheme');
  if (!overlay) return false;
  
  overlay.classList.remove('hidden');
  
  // Ensure dark mode is selected by default
  const darkRadio = document.getElementById('onboardingThemeDark');
  if (darkRadio) darkRadio.checked = true;
  
  // Apply theme immediately when radio button changes
  const themeDarkRadio = document.getElementById('onboardingThemeDark');
  const themeLightRadio = document.getElementById('onboardingThemeLight');
  
  if (themeDarkRadio) {
    themeDarkRadio.addEventListener('change', (e) => {
      if (e.target.checked) {
        console.log('[onboardingUI] user selecting theme: dark');
        applyOnboardingChoices({ theme: 'dark' });
        nextOnboardingStep({ theme: 'dark' });
      }
    });
  }
  
  if (themeLightRadio) {
    themeLightRadio.addEventListener('change', (e) => {
      if (e.target.checked) {
        console.log('[onboardingUI] user selecting theme: light');
        applyOnboardingChoices({ theme: 'light' });
        nextOnboardingStep({ theme: 'light' });
      }
    });
  }
  
  const nextBtn = document.getElementById('onboardingThemeNext');
  if (nextBtn) {
    nextBtn.onclick = async () => {
      const selected = darkRadio?.checked ? 'dark' : 'light';
      console.log('[onboardingUI] user confirmed theme:', selected);
      
      // Theme already applied via radio change listener, just advance
      await showStep('autostart');
    };
  }
  
  return true;
}

function showAutostartStep() {
  const overlay = document.getElementById('onboardingAutostart');
  if (!overlay) return false;
  
  overlay.classList.remove('hidden');
  
  const yesBtn = document.getElementById('onboardingAutostartYes');
  const noBtn = document.getElementById('onboardingAutostartNo');
  
  if (yesBtn) {
    yesBtn.onclick = async () => {
      console.log('[onboardingUI] user chose: autostart yes');
      applyOnboardingChoices({ autostart: true });
      nextOnboardingStep({ autostart: true });
      await showStep('format');
    };
  }
  
  if (noBtn) {
    noBtn.onclick = async () => {
      console.log('[onboardingUI] user chose: autostart no');
      applyOnboardingChoices({ autostart: false });
      nextOnboardingStep({ autostart: false });
      await showStep('format');
    };
  }
  
  return true;
}

function showFormatStep() {
  const overlay = document.getElementById('onboardingFormat');
  if (!overlay) return false;
  
  overlay.classList.remove('hidden');
  
  // Ensure 24h is selected by default
  const format24hRadio = document.getElementById('onboardingFormat24h');
  if (format24hRadio) format24hRadio.checked = true;
  
  // Apply format immediately when radio button changes
  const format24h = document.getElementById('onboardingFormat24h');
  const format12h = document.getElementById('onboardingFormat12h');
  
  if (format24h) {
    format24h.addEventListener('change', (e) => {
      if (e.target.checked) {
        console.log('[onboardingUI] user selecting format: 24h');
        applyOnboardingChoices({ hour12: false });
        nextOnboardingStep({ hour12: false });
      }
    });
  }
  
  if (format12h) {
    format12h.addEventListener('change', (e) => {
      if (e.target.checked) {
        console.log('[onboardingUI] user selecting format: 12h');
        applyOnboardingChoices({ hour12: true });
        nextOnboardingStep({ hour12: true });
      }
    });
  }
  
  const nextBtn = document.getElementById('onboardingFormatNext');
  if (nextBtn) {
    nextBtn.onclick = () => {
      const selected = format24h?.checked ? '24h' : '12h';
      const hour12 = selected === '12h';
      console.log('[onboardingUI] user chose format:', selected);
      
      const choices = nextOnboardingStep({ hour12 });
      applyOnboardingChoices(getOnboardingChoices());
      
      // Next step is SEE, which the renderer handles
      console.log('[onboardingUI] moving to SEE step');
      skipToSeeStep();
    };
  }
  
  return true;
}

function skipToSeeStep() {
  // Hide all onboarding
  document.querySelectorAll('.onboarding').forEach(el => el.classList.add('hidden'));
  
  // Trigger SEE overlay (handled by renderer's onboarding flow)
  const seeOverlay = document.getElementById('seeOverlay');
  const seeClose = document.getElementById('seeClose');
  if (seeOverlay) {
    seeOverlay.classList.remove('hidden');
    // Hide close button during onboarding
    if (seeClose) {
      seeClose.classList.add('hidden-during-onboarding');
    }
    const input = document.getElementById('seeStart');
    if (input) input.focus();
  }
  
  nextOnboardingStep({ seeShown: true });
}

export function finishOnboarding() {
  console.log('[onboardingUI] completing onboarding');
  completeOnboarding();
  
  // Hide all overlays
  document.querySelectorAll('.onboarding').forEach(el => el.classList.add('hidden'));
  const seeOverlay = document.getElementById('seeOverlay');
  const seeClose = document.getElementById('seeClose');
  if (seeOverlay) seeOverlay.classList.add('hidden');
  // Show close button again after onboarding
  if (seeClose) {
    seeClose.classList.remove('hidden-during-onboarding');
  }
}

export function isOnboardingActive() {
  return isFirstStartup() && getOnboardingStep() !== null;
}
