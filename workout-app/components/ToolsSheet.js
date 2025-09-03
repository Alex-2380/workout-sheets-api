// components/ToolsSheet.js
import React, { useEffect, useRef, useState } from 'react';

/* ---------- tiny theme helpers ---------- */
function readThemeVars() {
  const theme = (typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme')) || 'dark';
  const cs = (typeof window !== 'undefined') ? getComputedStyle(document.documentElement) : null;
  return {
    theme,
    accent: cs ? cs.getPropertyValue('--accent').trim() : '#4f8cff',
    secondary: cs ? cs.getPropertyValue('--secondary').trim() : '#ff6b6b',
    text: cs ? cs.getPropertyValue('--text').trim() : '#e9eaee',
    panel: cs ? cs.getPropertyValue('--panel').trim() : '#141419',
    cardBorder: cs ? cs.getPropertyValue('--card-border').trim() : 'rgba(255,255,255,.06)',
    danger: cs ? cs.getPropertyValue('--danger').trim() : '#ef4444',
    textmod: cs ? cs.getPropertyValue('--textmod').trim() : '' // includes your custom var
  };
}

function playBeep(frequency = 440, duration = 300, volume = 0.3) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.frequency.value = frequency;
    oscillator.type = 'sine';

    gainNode.gain.value = volume;

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.start();
    oscillator.stop(ctx.currentTime + duration / 1000);
  } catch (e) {
    console.warn('Beep not supported', e);
  }
}

/* ---------- tiny toast helper (theme-aware) ---------- */
function showToast(message, { duration = 1600, variant = 'info' } = {}) {
  let root = document.getElementById('tools-toast-root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'tools-toast-root';
    Object.assign(root.style, {
      position: 'fixed',
      left: '50%',
      bottom: '20px',
      transform: 'translateX(-50%)',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      zIndex: 999999,
      pointerEvents: 'none'
    });
    document.body.appendChild(root);
  }

  // read current theme vars so toast matches instantly
  const vars = readThemeVars();
  const isLight = vars.theme === 'light';

  // visual choices by theme
  const bg = isLight ? vars.panel : 'rgba(0,0,0,0.82)';
  const txt = vars.text;
  const borderColor = variant === 'error' ? vars.danger : vars.accent;
  const boxShadow = isLight ? '0 8px 24px rgba(10,10,10,0.06)' : '0 8px 30px rgba(0,0,0,0.35)';

  const el = document.createElement('div');
  Object.assign(el.style, {
    pointerEvents: 'auto',
    padding: '10px 14px',
    borderRadius: '10px',
    background: bg,
    color: txt,
    border: `1px solid ${borderColor}`,
    boxShadow,
    fontSize: '13px',
    fontWeight: 700,
    opacity: '0',
    transform: 'translateY(8px) scale(.98)',
    transition: 'opacity .18s ease, transform .18s ease',
    minWidth: '120px',
    textAlign: 'center',
  });
  el.textContent = message;
  root.appendChild(el);

  // animate in
  requestAnimationFrame(() => {
    el.style.opacity = '1';
    el.style.transform = 'translateY(0) scale(1)';
  });

  // remove after duration
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(-6px) scale(.98)';
    setTimeout(() => el.remove(), 220);
  }, duration);
}

/* ---------- 1RM table definitions (unchanged) ---------- */
const PERCENTAGE_ROWS = [
  { pct: 1.00, label: '100%', reps: 1 },
  { pct: 0.95, label: '95%', reps: 2 },
  { pct: 0.93, label: '93%', reps: 3 },
  { pct: 0.90, label: '90%', reps: 4 },
  { pct: 0.87, label: '87%', reps: 5 },
  { pct: 0.85, label: '85%', reps: 6 },
  { pct: 0.83, label: '83%', reps: 7 },
  { pct: 0.80, label: '80%', reps: 8 },
  { pct: 0.77, label: '77%', reps: 9 },
  { pct: 0.75, label: '75%', reps: 10 },
  { pct: 0.73, label: '73%', reps: 11 },
  { pct: 0.70, label: '70%', reps: 12 }
];

function OneRepMaxCalculator() {
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');
  const [rows, setRows] = useState([]);

  const epley = (w, r) => w * (1 + (r / 30));

  function calc() {
    const w = parseFloat(String(weight || '0'));
    const r = parseInt(String(reps || '0'), 10);
    if (!w || !r) {
      setRows([]);
      return;
    }
    const one = epley(w, r);
    const out = PERCENTAGE_ROWS.map(pr => ({
      ...pr,
      computedWeight: Math.round(one * pr.pct)
    }));
    setRows(out);
  }

  function clearCalc() {
    setWeight('');
    setReps('');
    setRows([]);
    // small feedback so user knows it cleared
    showToast('Cleared', { duration: 900 });
  }

  return (
    <div className="grid">
      <div className="grid-2" style={{ gap: 8 }}>
        <input
          placeholder="Weight"
          inputMode="decimal"
          value={weight}
          onChange={e => setWeight(e.target.value)}
          style={{ width: '100%' }}
        />
        <input
          placeholder="Reps"
          inputMode="numeric"
          value={reps}
          onChange={e => setReps(e.target.value)}
          style={{ width: '100%' }}
        />
      </div>

      {/* calculate + clear side-by-side */}
      <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
        <button className="primary" onClick={calc} style={{ flex: 1 }}>Calculate</button>
        <button className="ghost" onClick={clearCalc} style={{ minWidth: 96 }}>Clear</button>
      </div>

      <div className="card" style={{ padding: 8, marginTop: 12 }}>
        {/* header row — only shown after calculation; uses secondary */}
        {rows.length > 0 && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: 8,
            alignItems: 'center',
            padding: '8px',
            borderRadius: 8,
            background: 'var(--secondary)',
            color: '#0b0b0e',
            fontWeight: 800,
            marginBottom: 8,
            textAlign: 'center'
          }}>
            <div>Percentage</div>
            <div>Weight</div>
            <div>Reps</div>
          </div>
        )}

        <div style={{ display: 'grid', gap: 6 }}>
          {rows.length === 0 && (<div style={{ color: 'var(--muted)', padding: '8px 6px' }} />)}
          {rows.map(r => (
            <div key={r.label} style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              gap: 8,
              alignItems: 'center',
              padding: '8px',
              borderRadius: 8,
              background: 'rgba(255,255,255,0.02)',
              textAlign: 'center'
            }}>
              <div style={{ color: 'var(--muted)' }}>{r.label}</div>
              <div style={{ fontWeight: 800 }}>{r.computedWeight} lbs</div>
              <div style={{ color: 'var(--muted)' }}>{r.reps}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------- Plate calculator (unchanged aside from keeping var usage) ---------- */
function PlateCalculator() {
  const [bar, setBar] = useState(45);
  const plates = [45, 25, 10, 5, 2.5];
  const [counts, setCounts] = useState({});
  const pendingTimers = useRef({});

  function incrementPlate(p) { setCounts(prev => ({ ...prev, [p]: (prev[p] || 0) + 1 })); }
  function decrementPlate(p) { setCounts(prev => ({ ...prev, [p]: Math.max(0, (prev[p] || 0) - 1) })); }

  function handlePointerUp(p, e) {
    if (e && e.pointerType === 'mouse' && (e.button ?? 0) !== 0) return;
    const key = String(p);
    if (pendingTimers.current[key]) {
      clearTimeout(pendingTimers.current[key]);
      pendingTimers.current[key] = null;
      decrementPlate(p);
      return;
    }
    pendingTimers.current[key] = setTimeout(() => {
      incrementPlate(p);
      pendingTimers.current[key] = null;
    }, 300);
  }

  function handleKey(p, e) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      incrementPlate(p);
    }
  }

  const gap = 8;
  const widthCalc = `calc((100% - ${gap * (plates.length - 1)}px) / ${plates.length})`;

  const eachSide = plates.reduce((sum, p) => sum + p * (counts[p] || 0), 0);
  const total = bar + 2 * eachSide;

  return (
    <div className="grid">
      <div className="grid-2" style={{ gap: 8 }}>
        <select value={bar} onChange={e => setBar(parseFloat(e.target.value))}>
          <option value={45}>Bar 45</option>
          <option value={35}>Bar 35</option>
          <option value={15}>Bar 15</option>
        </select>
        <div className="kpi"><span>Total</span><strong>{total} lb</strong></div>
      </div>

      <div style={{
        display: 'flex',
        gap,
        paddingTop: 10,
        alignItems: 'stretch',
        justifyContent: 'space-between',
        width: '100%',
        boxSizing: 'border-box',
        flexWrap: 'nowrap'
      }}>
        {plates.map(p => {
          const cnt = counts[p] || 0;
          return (
            <div
              key={p}
              className="card"
              onPointerUp={(e) => handlePointerUp(p, e)}
              onKeyDown={(e) => handleKey(p, e)}
              role="button"
              tabIndex={0}
              aria-label={`Plate ${p}, ${cnt} per side`}
              style={{
                cursor: 'pointer',
                flex: `0 0 ${widthCalc}`,
                maxWidth: widthCalc,
                minHeight: 78,
                borderRadius: 12,
                padding: 12,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                boxSizing: 'border-box',
                background: '#101216',
                border: '1px solid rgba(255,255,255,0.03)',
                color: 'var(--accent)',
              }}
            >
              <div style={{
                position: 'absolute',
                bottom: -12,
                right: -12,
                minWidth: 30,
                height: 30,
                lineHeight: '30px',
                borderRadius: 999,
                fontWeight: 800,
                textAlign: 'center',
                background: 'var(--bg)',
                color: 'var(--secondary)',
                fontSize: 14,
                padding: '0 10px',
                boxShadow: '0 6px 18px rgba(0,0,0,0.35)'
              }}>
                {cnt}
              </div>

              <div className="h2" style={{ margin: 0, fontSize: 25, color: 'var(--accent)' }}>
                {p}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- Rest timer controls (unchanged) ---------- */
function RestTimerControls({ presetSeconds, leftSeconds, running, onAddSeconds, onStart, onPause, onReset }) {
  const presetM = Math.floor(presetSeconds / 60);
  const presetS = (presetSeconds % 60).toString().padStart(2, '0');
  const mins = Math.floor(leftSeconds / 60).toString().padStart(2, '0');
  const secs = (leftSeconds % 60).toString().padStart(2, '0');

  const actionButtonStyle = { minWidth: 120, padding: '10px 14px' };

  return (
    <div className="grid">
      <div className="grid-2" style={{ gap: 8 }}>
        <div className="kpi">
          <span>Preset</span>
          <strong style={{ color: 'var(--muted)' }}>{presetM}:{presetS}</strong>
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="ghost" onClick={() => onAddSeconds(-30)}>- 30s</button>
          <button className="ghost" onClick={() => onAddSeconds(30)}>+ 30s</button>
        </div>
      </div>

      <div className="kpi" style={{ fontSize: 18 }}>
        <span>Time Left</span>
        <strong style={{ fontSize: 20, color: 'var(--secondary)' }}>{mins}:{secs}</strong>
      </div>

      <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 4 }}>
        {!running ? (
          <button className="primary" onClick={onStart} style={actionButtonStyle}>Start</button>
        ) : (
          <button className="ghost" onClick={onPause} style={actionButtonStyle}>Pause</button>
        )}
        <button className="ghost" onClick={onReset} style={actionButtonStyle}>Reset</button>
      </div>
    </div>
  );
}

/* ---------- ToolsSheet main (timer first) ---------- */
export default function ToolsSheet({ open, onClose }) {
  const [tab, setTab] = useState('timer');

  const [presetSeconds, setPresetSeconds] = useState(120);
  const [leftSeconds, setLeftSeconds] = useState(0);
  const [running, setRunning] = useState(false);
  const tickRef = useRef(null);
  const finishedNotifiedRef = useRef(false);
  const cardRef = useRef(null);

  useEffect(() => {
    return () => {
      if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
    };
  }, []);

  useEffect(() => {
    if (running) finishedNotifiedRef.current = false;
  }, [running]);

  // Ensure the sheet is sized to reach the bottom on first paint (iOS PWA often reports viewport metrics late)
  useEffect(() => {
    if (!open) return;
    const el = cardRef.current;
    if (!el) return;

    const topGap = 84; // space to keep above the sheet (tweak if you want it closer/further from top)
    const safety = 2;  // small extra pixels to avoid 1px gaps

    const adjust = () => {
      try {
        const vv = window.visualViewport;
        const vh = (vv && vv.height) ? vv.height : window.innerHeight;

        // Apply explicit height and pin bottom to 0 so it reaches the bottom immediately.
        el.style.height = `${targetHeight}px`;
        el.style.bottom = '0px';

        // Force layout read so the UA commits the change.
        void el.offsetHeight;
      } catch (e) {
        // noop - defensive in case of unexpected environment
      }
    };

    // Run immediately and a couple more times to catch iOS timing races
    adjust();
    const rafId = requestAnimationFrame(adjust);
    const timeoutId = setTimeout(adjust, 160);

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', adjust);
    }
    window.addEventListener('resize', adjust);

    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(timeoutId);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', adjust);
      }
      window.removeEventListener('resize', adjust);

      // Clean up inline styles so CSS fallback works next time
      if (el) {
        el.style.height = '';
        el.style.bottom = '';
      }
    };
  }, [open]);

  useEffect(() => {
    if (running) {
      setLeftSeconds(prev => (prev > 0 ? prev : presetSeconds));
      if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }

      tickRef.current = setInterval(() => {
        setLeftSeconds(prev => {
          if (prev <= 1) {
            if (!finishedNotifiedRef.current) {
              finishedNotifiedRef.current = true;
              showToast('Timer finished!', { duration: 2200, variant: 'info' });
              if (navigator?.vibrate) navigator.vibrate(250);
              playBeep(440, 400, 0.5); // frequency 440Hz, 400ms, medium volume
            }
            if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
            setRunning(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
    }
    return () => { if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; } };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, presetSeconds]);

  function handleAddSeconds(delta) {
    if (running || leftSeconds > 0) {
      setLeftSeconds(prev => Math.max(0, prev + delta));
    } else {
      setPresetSeconds(prev => Math.max(0, prev + delta));
    }
  }

  function handleStart() {
    setLeftSeconds(l => (l <= 0 ? presetSeconds : l));
    finishedNotifiedRef.current = false;
    setRunning(true);
    setTab('timer');
  }
  function handlePause() { setRunning(false); }
  function handleReset() {
    setRunning(false);
    setLeftSeconds(0);
    finishedNotifiedRef.current = false;
  }

  const showFloating = !open && running;

  function overlayClick() {
    if (typeof onClose === 'function') onClose();
  }

  if (!open && !running) return null;

  // read theme vars now so floating mini uses correct text color immediately
  const vars = readThemeVars();
  const isLight = vars.theme === 'light';

  return (
    <>
      {/* floating mini timer — not clickable */}
      {showFloating && (
        <div
          role="presentation"
          aria-hidden
          style={{
            position: 'fixed',
            left: '50%',
            top: 64,
            transform: 'translateX(-50%)',
            zIndex: 999999,
            background: 'var(--secondary)',
            color: 'var(--textmod)', // reverted to use your --textmod variable as requested
            padding: '8px 14px',
            borderRadius: 999,
            boxShadow: isLight ? '0 8px 24px rgba(10,10,10,0.06)' : '0 8px 28px rgba(0,0,0,0.35)',
            fontWeight: 800,
            fontFamily: 'inherit',
            minWidth: 96,
            textAlign: 'center',
            pointerEvents: 'none',
            fontSize: 16
          }}
        >
          <span style={{ fontFamily: 'monospace' }}>
            {String(Math.floor(leftSeconds / 60)).padStart(2, '0')}:{String(leftSeconds % 60).padStart(2, '0')}
          </span>
        </div>
      )}

      {open && (
        <div
          onClick={overlayClick}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 60,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.45)',
            backdropFilter: 'blur(3px)'
          }}
        >
<div
  ref={cardRef}
  onClick={(e) => e.stopPropagation()}
  className="card"
  style={{
    // keep it fixed and flush to bottom by default (JS may later set explicit height)
    position: 'fixed',
    left: 8,
    right: 8,
    bottom: 0, // no negative hack anymore

    // ensure it's above the overlay and other UI
    zIndex: 999999,

    maxWidth: 980,
    margin: '0 auto',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,

    // allow content to avoid the home-indicator / safe area
    paddingBottom: `calc(38px + env(safe-area-inset-bottom, 0px))`,
    paddingTop: 12,
    paddingLeft: 12,
    paddingRight: 12,

    overflow: 'auto',
    boxSizing: 'border-box',
    maxHeight: 'calc(min(100dvh, 100vh) - 110px)',

    // keep scroll smooth on iOS
    WebkitOverflowScrolling: 'touch'
  }}
>

            {/* header tabs */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '0 6px 8px 6px', marginBottom: 6 }}>
              <button
                className="ghost"
                onClick={() => setTab('timer')}
                style={{ flex: 1, borderColor: tab === 'timer' ? 'var(--accent)' : undefined }}
              >
                Timer
              </button>

              <button
                className="ghost"
                onClick={() => setTab('plates')}
                style={{ flex: 1, borderColor: tab === 'plates' ? 'var(--accent)' : undefined }}
              >
                Plates
              </button>

              <button
                className="ghost"
                onClick={() => setTab('1rm')}
                style={{ flex: 1, borderColor: tab === '1rm' ? 'var(--accent)' : undefined }}
              >
                1RM
              </button>
            </div>

            <div style={{ padding: '4px 6px 6px 6px' }}>
              {tab === 'timer' && (
                <RestTimerControls
                  presetSeconds={presetSeconds}
                  leftSeconds={leftSeconds}
                  running={running}
                  onAddSeconds={handleAddSeconds}
                  onStart={handleStart}
                  onPause={handlePause}
                  onReset={handleReset}
                />
              )}
              {tab === 'plates' && <PlateCalculator />}
              {tab === '1rm' && <OneRepMaxCalculator />}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
