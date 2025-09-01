// utils/theme.js

const STORAGE_KEY = 'll_theme';

// Your palette can stay if you use it elsewhere:
const ACCENTS = ['#ff7a00', '#ff5bb5', '#ffd400', '#3ea6ff', '#22c55e'];

// Align defaults with your CSS defaults:
// - Primary (accent): blue
// - Secondary: red
const DEFAULTS = {
  mode: 'dark',
  accent: '#0066ff',            // OK to be hex or hsl
  secondary: 'hsl(0, 100%, 50%)'
};

function readCssVar(name) {
  if (typeof document === 'undefined') return undefined;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || undefined;
}

export function getTheme() {
  // SSR-safe defaults
  if (typeof window === 'undefined') {
    return { ...DEFAULTS };
  }

  let stored = {};
  try {
    stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    stored = {};
  }

  // If old saves don’t have secondary, try CSS var before falling back
  return {
    mode: stored.mode || DEFAULTS.mode,
    accent: stored.accent || readCssVar('--accent') || DEFAULTS.accent,
    secondary: stored.secondary || readCssVar('--secondary') || DEFAULTS.secondary,
  };
}

export function setTheme({ mode, accent, secondary }) {
  if (typeof document === 'undefined') return;

  // Read current so we can merge partial updates
  const current = getTheme();
  const next = {
    mode: mode || current.mode,
    accent: accent || current.accent,
    secondary: secondary || current.secondary,
  };

  // Apply to DOM
  const root = document.documentElement;
  root.setAttribute('data-theme', next.mode);
  root.style.setProperty('--accent', next.accent);
  root.style.setProperty('--secondary', next.secondary);

  // Persist
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }
}

// Optional helper: call this once on app boot (e.g., in _app.js useEffect)
// to ensure the saved theme is applied immediately.
export function ensureThemeApplied() {
  if (typeof document === 'undefined') return;
  const t = getTheme();
  const root = document.documentElement;
  root.setAttribute('data-theme', t.mode);
  root.style.setProperty('--accent', t.accent);
  root.style.setProperty('--secondary', t.secondary);
}

export function availableAccents() {
  return ACCENTS;
}