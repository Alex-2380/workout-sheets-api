const ACCENTS = ['#ff7a00', '#ff5bb5', '#ffd400', '#3ea6ff', '#22c55e'];

export function getTheme() {
  if (typeof window === 'undefined') return { mode: 'dark', accent: ACCENTS[0] };
  const stored = JSON.parse(localStorage.getItem('ll_theme') || '{}');
  return {
    mode: stored.mode || 'dark',
    accent: stored.accent || ACCENTS[0]
  };
}

export function setTheme({ mode, accent }) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.setAttribute('data-theme', mode);
  root.style.setProperty('--accent', accent);
  if (typeof window !== 'undefined') {
    localStorage.setItem('ll_theme', JSON.stringify({ mode, accent }));
  }
}

export function availableAccents() {
  return ACCENTS;
}
