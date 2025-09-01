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

// Extract hue from HSL string
const hueFromHsl = (str) => {
  const m = String(str).match(/hsl\(\s*([+-]?\d+(?:\.\d+)?)/i);
  return m ? parseInt(m[1], 10) : 0;
};

// clamp helper
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export default function Settings() {
  const user = storage.getUser();

  // if user not present, kick back to login
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

  // Routines / Users for "Current Routine" selector
  const [users, setUsers] = useState(storage.getCachedUsers());
  const [routines, setRoutines] = useState(storage.getCachedRoutines());
  const me = users.find(u => u.name === user?.name);
  const [selectedRoutine, setSelectedRoutine] = useState(me?.routine || '');

  // Save status UI
  const [savingRoutine, setSavingRoutine] = useState(false);
  const [savedRoutine, setSavedRoutine] = useState(false);
  const [routineError, setRoutineError] = useState('');
  const saveTimeoutRef = useRef(null);

  // Refs for two sliders
  const barPrimaryRef = useRef(null);
  const sliderPrimaryRef = useRef(null);
  const barSecondaryRef = useRef(null);
  const sliderSecondaryRef = useRef(null);

  // When mode toggles, normalize stored accent/secondary immediately
  useEffect(() => {
    const normalize = (val) => {
      if (!val) return val;
      let hsl = String(val).trim();
      if (hsl.startsWith('#')) {
        const conv = hexToHsl(hsl);
        if (!conv) return val;
        hsl = conv;
      }
      const m = hsl.match(/hsl\(\s*([+-]?\d+(?:\.\d+)?)\D+([+-]?\d+(?:\.\d+)?)%\D+([+-]?\d+(?:\.\d+)?)%/i);
      if (!m) return hsl;
      let h = Math.round(Number(m[1]));
      let s = Math.round(Number(m[2]));
      let l = Math.round(Number(m[3]));

      if (mode === 'light') {
        s = 100;
        l = 40;
      } else {
        s = 100;
        l = 50;
      }
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

  // Live-apply theme to :root and persist
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', mode);
    document.documentElement.style.setProperty('--accent', accent);
    document.documentElement.style.setProperty('--secondary', secondary);
    setTheme({ mode, accent, secondary });
  }, [mode, accent, secondary]);

  // Load users & routines (cache first, then refresh from sheets)
  useEffect(() => {
    setUsers(storage.getCachedUsers());
    setRoutines(storage.getCachedRoutines());

    sheets.getUsers()
      .then(list => { storage.cacheUsers(list); setUsers(list); })
      .catch(() => {});

    sheets.getRoutines()
      .then(rows => { storage.cacheRoutines(rows); setRoutines(rows); })
      .catch(() => {});
  }, []);

  // Keep selectedRoutine in sync when cached users refresh
  useEffect(() => {
    const meNow = (users || []).find(u => u.name === user?.name);
    if (meNow && meNow.routine && meNow.routine !== selectedRoutine) {
      setSelectedRoutine(meNow.routine);
    }
    // note: intentionally not depending on selectedRoutine here to avoid loop
  }, [users]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, []);

  // Generic move handler for any bar — preserves S/L and adjusts for light/dark mode
  const handleMove = (barEl, setter, clientX) => {
    if (!barEl) return;
    const rect = barEl.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const hue = Math.round((x / rect.width) * 360);

    // pick current value based on which slider we're moving
    let current = null;
    if (setter === setAccent) current = accent;
    else if (setter === setSecondary) current = secondary;

    // convert hex -> hsl if needed
    if (current && typeof current === 'string' && current.startsWith('#')) {
      const conv = hexToHsl(current);
      if (conv) current = conv;
    }

    // parse existing S/L if available, fallback to sensible defaults
    let s = null, l = null;
    const m = String(current || '').match(/hsl\(\s*([+-]?\d+(?:\.\d+)?)\D+([+-]?\d+(?:\.\d+)?)%\D+([+-]?\d+(?:\.\d+)?)%/i);
    if (m) {
      s = Math.round(Number(m[2]));
      l = Math.round(Number(m[3]));
    } else {
      // sensible defaults depending on mode
      if (mode === 'light') { s = 100; l = 40; }
      else { s = 100; l = 50; }
    }

    // adjust S/L ranges by theme so colors read nicely on each background
    if (mode === 'light') {
      s = 100;
      l = 40;
    } else { // dark
      s = 100;
      l = 50;
    }

    setter(`hsl(${hue}, ${s}%, ${l}%)`);
  };

  // Mouse/touch helpers
  const makeHandlers = (barRef, setter) => ({
    onMouseDown: (e) => handleMove(barRef.current, setter, e.clientX),
    onMouseMove: (e) => { if (e.buttons === 1) handleMove(barRef.current, setter, e.clientX); },
    onTouchStart: (e) => handleMove(barRef.current, setter, e.touches[0].clientX),
    onTouchMove: (e) => handleMove(barRef.current, setter, e.touches[0].clientX),
  });

  const posFromHue = (h) => `${(h / 360) * 100}%`;
  const primaryLeft = posFromHue(hueFromHsl(accent));
  const secondaryLeft = posFromHue(hueFromHsl(secondary));

  const primaryHandlers = makeHandlers(barPrimaryRef, setAccent);
  const secondaryHandlers = makeHandlers(barSecondaryRef, setSecondary);

  // Save / persist selected routine (updates server via sheets client, then cache)
  async function saveRoutine() {
    if (!user) return;
    const routineToSave = selectedRoutine || '';

    // quick guard - nothing to do
    if (routineToSave === (me?.routine || '')) {
      // show a brief saved indicator even if nothing changed, for clarity
      setSavedRoutine(true);
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => setSavedRoutine(false), 1500);
      return;
    }

    setSavingRoutine(true);
    setRoutineError('');
    // optimistic: update local cached users for fast UI update
    try {
      const current = storage.getCachedUsers() || [];
      const updated = current.map(u => u.name === user.name ? { ...u, routine: routineToSave } : u);
      storage.cacheUsers(updated);
      setUsers(updated);
    } catch (err) {
      // ignore cache failure — not critical
    }

    try {
      // call sheets helper if available
      let ok = false;
      if (typeof sheets.setUserRoutine === 'function') {
        ok = await sheets.setUserRoutine(user.name, routineToSave);
      } else {
        // fallback: attempt a PATCH to the /sheets endpoint (some apps implement this)
        const resp = await fetch(`/sheets?tab=Users`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'update',
            keyColumn: 'Users',
            keyValue: user.name,
            set: { 'Current Routine': routineToSave }
          })
        });
        ok = resp.ok;
      }

      if (!ok) {
        throw new Error('Server update failed');
      }

      // on success, try to refresh cached users
      try {
        const list = await sheets.getUsers();
        storage.cacheUsers(list);
        setUsers(list);
      } catch (e) {
        // non-fatal
      }

      setSavedRoutine(true);
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => setSavedRoutine(false), 2000);
    } catch (err) {
      console.warn('setUserRoutine failed; local cache updated only.', err);
      setRoutineError((err && err.message) ? err.message : 'Save failed');
      // keep local optimistic change but show error to user
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => setRoutineError(''), 4000);
    } finally {
      setSavingRoutine(false);
    }
  }

  const changed = selectedRoutine !== (me?.routine || '');

  return (
    <div className="grid fade-in" style={{ maxWidth: '560px', margin: '0 auto' }}>
      <div className="card">
        <div className="h2">Theme</div>

        {/* Dark / Light toggle */}
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

        {/* Primary / Accent picker */}
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

        {/* Secondary picker */}
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
      </div>

      {/* ===== Current Routine moved to its OWN card ===== */}
      <div className="card" style={{ marginTop: 12 }}>
        <div className="h2">Current Routine</div>

        {/* Type-ahead input backed by datalist so users can start typing routines */}
        <input
          placeholder="— select a routine —"
          list="routine-list"
          value={selectedRoutine}
          onChange={e => setSelectedRoutine(e.target.value)}
          onFocus={e => {
            if (selectedRoutine === (me?.routine || '')) {
              setSelectedRoutine('');
            }
          }}
          onBlur={e => {
            if (!e.target.value || String(e.target.value).trim() === '') {
              setSelectedRoutine(me?.routine || '');
            }
          }}
          style={{
            width: '100%',
            marginBottom: 8,
            padding: '8px 10px',
            borderRadius: 8,
            border: '1px solid var(--input-border)',
            background: 'var(--input-bg)',
            color: 'var(--text)',
            boxSizing: 'border-box'
          }}
          aria-label="Select routine"
        />
        <datalist id="routine-list">
          {Array.from(new Set((routines || []).map(r => r.routine)))
            .filter(Boolean)
            .sort((a,b) => a.localeCompare(b))
            .map(name => (
              <option key={name} value={name} />
            ))
          }
        </datalist>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            className="primary"
            onClick={saveRoutine}
            style={{ flex: '0 0 auto' }}
            disabled={!changed || savingRoutine}
          >
            {savingRoutine ? 'Saving…' : 'Update Routine'}
          </button>

          <button
            className="ghost"
            onClick={() => {
              setSelectedRoutine(me?.routine || '');
            }}
            style={{ flex: '0 0 auto' }}
          >
            Reset
          </button>

          {savedRoutine && <div style={{ color: 'var(--success)', fontWeight: 700, marginLeft: 8 }}>Saved ✓</div>}
          {savingRoutine && <div style={{ color: 'var(--muted)', marginLeft: 8 }}>Saving…</div>}
        </div>

        {routineError && <div style={{ color: 'var(--danger)', marginTop: 8 }}>{routineError}</div>}
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