// pages/settings.js
import { useEffect, useState, useRef } from 'react';
import { storage } from '../utils/storage';
import { getTheme, setTheme } from '../utils/theme';
import { sheets } from '../utils/sheetsClient';

// Convert HEX to true HSL
const hexToHsl = (hex) => {
  if (!hex || !hex.startsWith('#')) return null;
  let r = 0, g = 0, b = 0;
  if (hex.length === 4) {
    r = parseInt(hex[1] + hex[1], 16);
    g = parseInt(hex[2] + hex[2], 16);
    b = parseInt(hex[3] + hex[3], 16);
  } else if (hex.length === 7) {
    r = parseInt(hex.slice(1, 3), 16);
    g = parseInt(hex.slice(3, 5), 16);
    b = parseInt(hex.slice(5, 7), 16);
  } else {
    return null;
  }
  r /= 255; g /= 255; b /= 255;

  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
      default: break;
    }
    h /= 6;
  }

  return `hsl(${Math.round(h * 360)}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%)`;
};

const hueFromHsl = (str) => {
  const m = String(str).match(/hsl\(\s*([+-]?\d+(?:\.\d+)?)/i);
  return m ? parseInt(m[1], 10) : 0;
};

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const parseHsl = (str) => {
  if (!str) return null;
  const m = String(str).match(/hsl\(\s*([+-]?\d+(?:\.\d+)?)\D+([+-]?\d+(?:\.\d+)?)%\D+([+-]?\d+(?:\.\d+)?)%/i);
  if (!m) return null;
  return {
    h: clamp(Math.round(Number(m[1])), 0, 360),
    s: clamp(Math.round(Number(m[2])), 0, 100),
    l: clamp(Math.round(Number(m[3])), 0, 100),
  };
};

export default function Settings() {
  const user = storage.getUser();

  useEffect(() => {
    if (!user) { window.location.href = '/'; }
  }, [user]);

  const initial = getTheme() || {};
  const initialAccent = initial.accent?.startsWith('hsl')
    ? initial.accent
    : (initial.accent && hexToHsl(initial.accent)) || 'hsl(160, 100%, 50%)';
  const initialSecondary = initial.secondary?.startsWith('hsl')
    ? initial.secondary
    : (initial.secondary && hexToHsl(initial.secondary)) || 'hsl(40, 100%, 50%)';

  const [mode, setMode] = useState(initial.mode || 'dark');
  const [accent, setAccent] = useState(initialAccent);
  const [secondary, setSecondary] = useState(initialSecondary);

  // Refs for hue sliders
  const barPrimaryRef = useRef(null);
  const barSecondaryRef = useRef(null);
  const sliderPrimaryRef = useRef(null);
  const sliderSecondaryRef = useRef(null);

  // Refs for shade sliders
  const shadeBarPrimaryRef = useRef(null);
  const shadeBarSecondaryRef = useRef(null);
  const shadeSliderPrimaryRef = useRef(null);
  const shadeSliderSecondaryRef = useRef(null);

  useEffect(() => {
    // On mode change keep saturation at 100 but preserve any user lightness
    const normalize = (val) => {
      if (!val) return val;
      let hsl = String(val).trim();
      if (hsl.startsWith('#')) {
        const conv = hexToHsl(hsl);
        if (!conv) return val;
        hsl = conv;
      }
      const parsed = parseHsl(hsl);
      if (!parsed) return hsl;
      const h = parsed.h;
      const s = 100; // keep saturation full
      const l = typeof parsed.l === 'number' ? parsed.l : (mode === 'light' ? 40 : 50);
      return `hsl(${h}, ${s}%, ${l}%)`;
    };

    setAccent(prev => {
      const out = normalize(prev);
      return out === prev ? prev : out;
    });
    setSecondary(prev => {
      const out = normalize(prev);
      return out === prev ? prev : out;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', mode);
    document.documentElement.style.setProperty('--accent', accent);
    document.documentElement.style.setProperty('--secondary', secondary);
    setTheme({ mode, accent, secondary });
  }, [mode, accent, secondary]);

  // Hue move (keeps current L if present, forces S=100)
  const handleMove = (barEl, setter, clientX) => {
    if (!barEl) return;
    const rect = barEl.getBoundingClientRect();
    const x = clamp(clientX - rect.left, 0, rect.width);
    const hue = Math.round((x / rect.width) * 360);

    let current = null;
    if (setter === setAccent) current = accent;
    else if (setter === setSecondary) current = secondary;

    if (current && typeof current === 'string' && current.startsWith('#')) {
      const conv = hexToHsl(current);
      if (conv) current = conv;
    }

    const parsed = parseHsl(current || '');
    let s = parsed?.s ?? 100;
    let l = parsed?.l ?? (mode === 'light' ? 40 : 50);

    s = 100; // keep saturation consistent

    setter(`hsl(${hue}, ${s}%, ${l}%)`);
  };

  const makeHandlers = (barRef, setter) => ({
    onMouseDown: (e) => handleMove(barRef.current, setter, e.clientX),
    onMouseMove: (e) => { if (e.buttons === 1) handleMove(barRef.current, setter, e.clientX); },
    onTouchStart: (e) => handleMove(barRef.current, setter, e.touches[0].clientX),
    onTouchMove: (e) => handleMove(barRef.current, setter, e.touches[0].clientX),
  });

  // Shade move (controls lightness L, keeps H and S)
  const handleShadeMove = (barEl, setter, clientX) => {
    if (!barEl) return;
    const rect = barEl.getBoundingClientRect();
    const x = clamp(clientX - rect.left, 0, rect.width);
    const l = Math.round((x / rect.width) * 100);

    let current = null;
    if (setter === setAccent) current = accent;
    else if (setter === setSecondary) current = secondary;

    if (current && typeof current === 'string' && current.startsWith('#')) {
      const conv = hexToHsl(current);
      if (conv) current = conv;
    }

    const parsed = parseHsl(current || '');
    const h = parsed?.h ?? (setter === setAccent ? hueFromHsl(accent) : hueFromHsl(secondary));
    const s = parsed?.s ?? 100;

    setter(`hsl(${h}, ${s}%, ${l}%)`);
  };

  const makeShadeHandlers = (barRef, setter) => ({
    onMouseDown: (e) => handleShadeMove(barRef.current, setter, e.clientX),
    onMouseMove: (e) => { if (e.buttons === 1) handleShadeMove(barRef.current, setter, e.clientX); },
    onTouchStart: (e) => handleShadeMove(barRef.current, setter, e.touches[0].clientX),
    onTouchMove: (e) => handleShadeMove(barRef.current, setter, e.touches[0].clientX),
  });

  const posFromHue = (h) => `${(clamp(h, 0, 360) / 360) * 100}%`;
  const posFromLightness = (l) => `${clamp(l, 0, 100)}%`;

  const parsedAccent = parseHsl(accent) || { h: hueFromHsl(accent), s: 100, l: 50 };
  const parsedSecondary = parseHsl(secondary) || { h: hueFromHsl(secondary), s: 100, l: 50 };

  const primaryLeft = posFromHue(parsedAccent.h);
  const secondaryLeft = posFromHue(parsedSecondary.h);
  const primaryShadeLeft = posFromLightness(parsedAccent.l);
  const secondaryShadeLeft = posFromLightness(parsedSecondary.l);

  const primaryHandlers = makeHandlers(barPrimaryRef, setAccent);
  const secondaryHandlers = makeHandlers(barSecondaryRef, setSecondary);
  const shadePrimaryHandlers = makeShadeHandlers(shadeBarPrimaryRef, setAccent);
  const shadeSecondaryHandlers = makeShadeHandlers(shadeBarSecondaryRef, setSecondary);

  // shade backgrounds: darker -> mid -> lighter for the current hue/sat
  const primaryShadeBackground = `linear-gradient(to right, hsl(${parsedAccent.h}, ${parsedAccent.s}%, 5%), hsl(${parsedAccent.h}, ${parsedAccent.s}%, 50%), hsl(${parsedAccent.h}, ${parsedAccent.s}%, 95%))`;
  const secondaryShadeBackground = `linear-gradient(to right, hsl(${parsedSecondary.h}, ${parsedSecondary.s}%, 5%), hsl(${parsedSecondary.h}, ${parsedSecondary.s}%, 50%), hsl(${parsedSecondary.h}, ${parsedSecondary.s}%, 95%))`;

  return (
    <div className="grid fade-in" style={{ maxWidth: '560px', margin: '0 auto' }}>
      <div className="card">
        <div className="h2">Theme</div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <button
            className="ghost"
            onClick={() => setMode('dark')}
            style={{ borderColor: mode === 'dark' ? 'var(--accent)' : undefined }}
          >
            Dark
          </button>
          <button
            className="ghost"
            onClick={() => setMode('light')}
            style={{ borderColor: mode === 'light' ? 'var(--accent)' : undefined }}
          >
            Light
          </button>
        </div>

        {/* Primary (Hue) */}
        <div style={{ marginTop: 8, marginBottom: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="text-accent" style={{ fontWeight: 700 }}>Primary (Accent)</div>
        </div>
        <div
          className="color-bar-container"
          ref={barPrimaryRef}
          {...primaryHandlers}
        >
          <div className="color-slider" ref={sliderPrimaryRef} style={{ left: primaryLeft }} />
        </div>

        {/* Primary (Shade) */}
        <div style={{ marginTop: 12, marginBottom: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        </div>
        <div
          className="color-bar-container"
          ref={shadeBarPrimaryRef}
          {...shadePrimaryHandlers}
          style={{ background: primaryShadeBackground }}
        >
          <div className="color-slider shade" ref={shadeSliderPrimaryRef} style={{ left: primaryShadeLeft }} />
        </div>

        {/* Secondary (Hue) */}
        <div style={{ marginTop: 16, marginBottom: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="text-secondary" style={{ fontWeight: 700 }}>Secondary</div>
        </div>
        <div
          className="color-bar-container"
          ref={barSecondaryRef}
          {...secondaryHandlers}
        >
          <div className="color-slider secondary" ref={sliderSecondaryRef} style={{ left: secondaryLeft }} />
        </div>

        {/* Secondary (Shade) */}
        <div style={{ marginTop: 12, marginBottom: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        </div>
        <div
          className="color-bar-container"
          ref={shadeBarSecondaryRef}
          {...shadeSecondaryHandlers}
          style={{ background: secondaryShadeBackground }}
        >
          <div className="color-slider shade secondary" ref={shadeSliderSecondaryRef} style={{ left: secondaryShadeLeft }} />
        </div>
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <div className="h2">Account</div>
        <div className="grid">
          <div className="kpi">
            <span>Current User</span>
            <strong>{user?.name || '—'}</strong>
          </div>
          <button
            className="ghost"
            onClick={() => {
              storage.clearUser();
              window.location.href = '/';
            }}
          >
            Log Out
          </button>
        </div>
      </div>
    </div>
  );
}
