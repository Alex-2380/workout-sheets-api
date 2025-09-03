// pages/workout.js
import { useEffect, useMemo, useRef, useState } from 'react';
import { storage } from '../utils/storage';
import { sheets } from '../utils/sheetsClient';

function groupRoutineByDay(rows, routineName) {
  const pick = rows.filter(r => r.routine === routineName);
  const map = {};
  pick.forEach(r => {
    map[r.day] = map[r.day] || [];
    map[r.day].push(r);
  });
  return map;
}

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

// only allow 0-9
const sanitizeInt = (v) => (v ?? '').replace(/\D/g, '');

// block scientific-notation/decimal keys on desktop
const blockBadKeys = (e) => {
  if (['e', 'E', '+', '-', '.'].includes(e.key)) e.preventDefault();
};

function isZeroish(v) {
  if (v === null || v === undefined) return true;
  const s = String(v).trim();
  if (!s) return true;
  const n = Number(s);
  return Number.isFinite(n) ? n === 0 : false;
}

function parseRowTime(row, idx) {
  // Try several common fields; fall back to row order if parsing fails
  const raw = row?.date ?? row?.Date ?? row?.timestamp ?? row?.time ?? row?.savedAt ?? row?.createdAt;
  if (raw) {
    const t = Date.parse(raw);
    if (!Number.isNaN(t)) return t;
    const n = Number(raw);
    if (Number.isFinite(n)) {
      if (n > 1e12) return n;       // ms
      if (n > 1e9) return n * 1000; // seconds
    }
  }
  // Fallback: later rows win
  return idx;
}

function formatTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

const toNum = (v) => {
  const n = parseFloat(String(v).replace(/[^\d.\-]/g, ''));
  return Number.isNaN(n) ? 0 : n;
};
const toInt = (v) => {
  const n = parseInt(String(v).replace(/[^\d\-]/g, ''), 10);
  return Number.isNaN(n) ? 0 : n;
};
const oneRepMax = (weight, reps) => {
  const w = toNum(weight);
  const r = toInt(reps);
  if (w <= 0 || r <= 0) return 0;
  return w * (1 + (r / 30)); // Epley approximation
};

// ---- tiny toast helper (no dependencies) ----
function showToast(message, { variant = 'success', duration = 1800 } = {}) {
  // container
  let root = document.getElementById('toast-root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'toast-root';
    Object.assign(root.style, {
      position: 'fixed',
      left: '50%',
      bottom: '20px',
      transform: 'translateX(-50%)',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      zIndex: '9999',
      pointerEvents: 'none'
    });
    document.body.appendChild(root);
  }

  const el = document.createElement('div');
  const isError = variant === 'error';
  Object.assign(el.style, {
    pointerEvents: 'auto',
    padding: '10px 14px',
    borderRadius: '10px',
    background: 'rgba(0,0,0,0.84)',
    color: 'var(--text, #fff)',
    border: `1px solid ${isError ? 'var(--secondary)' : 'var(--accent)'}`,
    boxShadow: '0 6px 20px rgba(0,0,0,0.35)',
    fontSize: '14px',
    fontWeight: 600,
    letterSpacing: '.2px',
    backdropFilter: 'saturate(1.2) blur(4px)',
    transform: 'translateY(12px) scale(.96)',
    opacity: '0'
  });
  el.textContent = message;
  root.appendChild(el);

  // animate in
  el.animate(
    [{ opacity: 0, transform: 'translateY(12px) scale(.96)' }, { opacity: 1, transform: 'translateY(0) scale(1)' }],
    { duration: 180, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'forwards' }
  );

  // animate out after duration
  setTimeout(() => {
    el.animate(
      [{ opacity: 1, transform: 'translateY(0) scale(1)' }, { opacity: 0, transform: 'translateY(-4px) scale(.98)' }],
      { duration: 220, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' }
    ).onfinish = () => el.remove();
  }, duration);
}

// ---- prettier confetti: accent + secondary, slower, more spread ----
function confetti() {
  const count = 90; // a bit more pieces
  const H = window.innerHeight;
  const W = window.innerWidth;
  const rand = (min, max) => Math.random() * (max - min) + min;

  for (let i = 0; i < count; i++) {
    const piece = document.createElement('div');
    piece.style.position = 'fixed';
    piece.style.zIndex = '9998';
    piece.style.top = '-14px';
    // spread across width with a little clustering variance
    const cluster = Math.random() < 0.35 ? rand(30, 70) : rand(0, 100);
    piece.style.left = `${cluster}%`;

    // varied sizes/shapes
    const w = rand(6, 12);
    const h = rand(10, 18);
    piece.style.width = `${w}px`;
    piece.style.height = `${h}px`;
    piece.style.borderRadius = Math.random() < 0.35 ? '50% 20% / 30% 70%' : '2px';

    // color mix: accent, secondary, or a gradient of both
    const stylePick = Math.random();
    if (stylePick < 0.4) {
      piece.style.background = 'var(--accent)';
    } else if (stylePick < 0.8) {
      piece.style.background = 'var(--secondary)';
    } else {
      piece.style.background = 'linear-gradient(45deg, var(--accent), var(--secondary))';
    }
    piece.style.opacity = '0.95';
    piece.style.willChange = 'transform, opacity';

    document.body.appendChild(piece);

    const driftX = rand(-W * 0.18, W * 0.18); // more horizontal spread
    const fall = H + rand(80, 180);
    const rotStart = rand(0, 360);
    const rotEnd = rotStart + rand(540, 1260); // big spins
    const duration = rand(2400, 4200); // slower
    const delay = rand(0, 400);

    piece.animate(
      [
        { transform: `translate3d(0,0,0) rotate(${rotStart}deg)`, opacity: 1 },
        { transform: `translate3d(${driftX}px, ${fall}px, 0) rotate(${rotEnd}deg)`, opacity: 0.1 }
      ],
      { duration, delay, easing: 'cubic-bezier(.25,.8,.25,1)', fill: 'forwards' }
    ).onfinish = () => piece.remove();
  }
}

export default function WorkoutPage() {
  const user = storage.getUser();
  const [users, setUsers] = useState(storage.getCachedUsers());
  const me = users.find(u => u.name === user?.name);
  const [routines, setRoutines] = useState(storage.getCachedRoutines());
  const byDay = useMemo(() => groupRoutineByDay(routines, me?.routine || ''), [routines, me?.routine]);
  const [day, setDay] = useState(Object.keys(byDay)[0] || '1');

  const [active, setActive] = useState(() => user ? storage.getActiveWorkout(user.name) : null);
  const [history, setHistory] = useState([]);

  // Summary modal state
  const [showSummary, setShowSummary] = useState(false);
  const [summaryRows, setSummaryRows] = useState([]); // 2D array for POSTing
  const [summaryDisplay, setSummaryDisplay] = useState([]); // pretty objects for UI
  const [achievements, setAchievements] = useState([]);
  const [elapsedAtFinish, setElapsedAtFinish] = useState(0);

  // Timer
  const timerRef = useRef(null);
  const [elapsed, setElapsed] = useState(0);

  // Sheet refs for top-focus and single scroll
  const sheetCardRef = useRef(null);
  const sheetHeaderRef = useRef(null);
  const sheetBodyRef = useRef(null);

  useEffect(() => {
    if (!user) { window.location.href = '/'; return; }

    sheets.getUsers().then(list => { storage.cacheUsers(list); setUsers(list); }).catch(() => {});
    sheets.getRoutines().then(rows => { storage.cacheRoutines(rows); setRoutines(rows); }).catch(() => {});
    sheets.getUserData(user.name)
      .then(rows => { storage.cacheUserData(user.name, rows); setHistory(rows); })
      .catch(() => { setHistory(storage.getCachedUserData(user.name)); });
  }, []);

  // Manage timer when active changes
  useEffect(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }

    if (active && active.startedAt) {
      const startMs = new Date(active.startedAt).getTime();
      const initial = Math.floor((Date.now() - startMs) / 1000);
      setElapsed(initial >= 0 ? initial : 0);

      timerRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startMs) / 1000));
      }, 1000);
    } else {
      setElapsed(0);
    }

    return () => {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    };
  }, [active]);

  function initializeWorkout(selectedDay) {
    const sets = [];
    (byDay[selectedDay] || []).forEach(ex => {
      for (let s = 1; s <= (ex.sets || 0); s++) {
        sets.push({ exercise: ex.exercise, set: s, weight: '', reps: '', notes: '' });
      }
    });
    const w = { routine: me?.routine || '', day: selectedDay, startedAt: new Date().toISOString(), sets };
    setActive(w);
    storage.setActiveWorkout(user.name, w);
  }

  function updateSet(globalIdx, patch) {
    if (!active) return;
    const w = { ...active, sets: active.sets.map((s, i) => i === globalIdx ? { ...s, ...patch } : s) };
    setActive(w);
    storage.setActiveWorkout(user.name, w);
  }

  // Build summary (rows for saving + pretty display + achievements)
// Build summary (rows for saving + pretty display + achievements)
function buildSummary() {
  if (!active) return { rowsForPost: [], pretty: [], achievements: [] };
  const dateStr = new Date().toLocaleString();

  // Only include sets with either reps or weight provided
  const filledSets = active.sets.filter(s => String(s.reps).trim() || String(s.weight).trim());

  const rowsForPost = filledSets.map(s => [
    user.name,
    active.routine,
    active.day,
    s.exercise,
    toNum(s.weight),
    s.set,
    String(s.reps ?? '').trim(),
    dateStr
  ]);

  // Pretty display grouped by exercise
  const prettyMap = {};
  filledSets.forEach(s => {
    (prettyMap[s.exercise] = prettyMap[s.exercise] || []).push({
      set: s.set,
      weight: s.weight,
      reps: s.reps
    });
  });

  // Use the exercise encounter order from the active workout
  const exerciseOrder = Array.from(new Set(active.sets.map(s => s.exercise)));
  const pretty = exerciseOrder
    .filter(ex => prettyMap[ex])
    .map(ex => ({
      exercise: ex,
      sets: prettyMap[ex].sort((a,b)=>a.set-b.set)
    }));

  // ---------------- Achievements logic ----------------
  // We'll compute historical maxima (weight, 1RM, reps) and compare to current
  const ach = [];
  const prevAllMaxWeight = {};
  const prevAllMax1RM = {};
  const prevAllMaxReps = {};

  // Build history aggregates
  (history || []).forEach(r => {
    const ex = r?.exercise;
    if (!ex) return;
    const w = toNum(r.weight);
    const repsNum = toInt(r.reps);
    const rm = oneRepMax(r.weight, r.reps);

    prevAllMaxWeight[ex] = Math.max(prevAllMaxWeight[ex] || 0, w);
    prevAllMax1RM[ex] = Math.max(prevAllMax1RM[ex] || 0, rm);
    prevAllMaxReps[ex] = Math.max(prevAllMaxReps[ex] || 0, repsNum);
  });

  // Current workout aggregates (per exercise)
  const currMaxWeight = {};
  const currMax1RM = {};
  const currMaxReps = {};
  filledSets.forEach(s => {
    const ex = s.exercise;
    if (!ex) return;
    const w = toNum(s.weight);
    const repsNum = toInt(s.reps);
    const rm = oneRepMax(s.weight, s.reps);

    currMaxWeight[ex] = Math.max(currMaxWeight[ex] || 0, w);
    currMax1RM[ex] = Math.max(currMax1RM[ex] || 0, rm);
    currMaxReps[ex] = Math.max(currMaxReps[ex] || 0, repsNum);
  });

  // Evaluate achievements in the order of the workout for nicer UX
  exerciseOrder.forEach(ex => {
    const cw = currMaxWeight[ex] || 0;
    const pw = prevAllMaxWeight[ex] || 0;

    // Weight PR
    if (cw > pw) {
      ach.push(`New all-time max weight on ${ex}: ${cw} (prev ${pw || 0})`);
    }

    // New most reps ever (NEW: counts regardless of weight)
    const cr = currMaxReps[ex] || 0;
    const prReps = prevAllMaxReps[ex] || 0;
    if (cr > prReps) {
      ach.push(`New most reps ever on ${ex}: ${cr} reps (prev ${prReps || 0})`);
    }

    // 1RM PR (keep for non-bodyweight progress)
    const cr1 = Math.round(currMax1RM[ex] || 0);
    const pr1 = Math.round(prevAllMax1RM[ex] || 0);
    if (cr1 > pr1) {
      ach.push(`New all-time 1RM on ${ex}: ${cr1} (prev ${pr1 || 0})`);
    }
  });

  // dedupe and limit
  const uniq = Array.from(new Set(ach)).slice(0, 8);
  return { rowsForPost, pretty, achievements: uniq };
}

  function openSummary() {
    if (!active) return;

    const anyFilled = active.sets.some(s => String(s.reps).trim() || String(s.weight).trim());
    if (!anyFilled) {
      alert('No set entries to review yet.');
      return;
    }

    setElapsedAtFinish(elapsed);
    const { rowsForPost, pretty, achievements } = buildSummary();
    setSummaryRows(rowsForPost);
    setSummaryDisplay(pretty);
    setAchievements(achievements);
    setShowSummary(true);
  }

  // Save to sheet (with offline outbox fallback)
  async function confirmSave() {
    if (!active) return;
    if (!summaryRows.length) { setShowSummary(false); return; }

    const ok = await sheets.appendWorkoutRows(user.name, summaryRows);
    if (!ok) {
      summaryRows.forEach(r => {
        const [u, routine, day, exercise, weight, set, reps, date] = r;
        storage.pushOutbox(user.name, { user: u, routine, day, exercise, weight, set, reps, date });
      });
    }

    try { confetti(); } catch {}
    // toast feedback (online/offline)
    if (ok) {
      showToast('Workout saved! 💪', { variant: 'success', duration: 1600 });
    } else {
      showToast('Saved offline — will sync when online', { variant: 'error', duration: 1900 });
    }

    storage.clearActiveWorkout(user.name);
    setActive(null);
    setShowSummary(false);

    // give the animation + toast a moment to play before navigating
    setTimeout(() => { window.location.href = '/dashboard'; }, 1800);
  }

  function cancelWorkout() {
    if (!user) return;
    storage.clearActiveWorkout(user.name);
    setActive(null);
  }

  const exercises = byDay[day] || [];

  // Map of last saved results by exercise:set, from history
const lastByExercise = useMemo(() => {
  const now = Date.now();

  // Build two indexes:
  // - latestAny:   latest entry for exercise:set across ALL routines/days
  // - latestSame:  latest entry for exercise:set for THIS routine & THIS day
  const latestAny = {};
  const latestSame = {};

  (history || []).forEach((r, idx) => {
    const ex = r?.exercise;
    const setNum = Number(r?.set) || 0;
    if (!ex || !setNum) return;

    const key = `${ex}:${setNum}`;
    const t = parseRowTime(r, idx);

    // Any routine/day
    if (!latestAny[key] || t > latestAny[key]._t) {
      latestAny[key] = { ...r, _t: t };
    }

    // Same routine & day as the current screen
    if (r?.routine === me?.routine && String(r?.day) === String(day)) {
      if (!latestSame[key] || t > latestSame[key]._t) {
        latestSame[key] = { ...r, _t: t };
      }
    }
  });

  // Decide what we surface per exercise:set
  const out = {};
  const keys = new Set([...Object.keys(latestAny), ...Object.keys(latestSame)]);

  keys.forEach((key) => {
    const base = latestSame[key];       // default (same routine/day)
    const any  = latestAny[key];        // fallback (any routine/day)
    const baseBlank = !base || (isZeroish(base.weight) && isZeroish(base.reps));

    if (baseBlank) {
      // If base is blank/zero, try the most recent anywhere (non-blank)
      if (any && !(isZeroish(any.weight) && isZeroish(any.reps))) {
        out[key] = any;
      } else {
        // Nothing usable anywhere
        // (leave undefined so your UI shows "—")
      }
      return;
    }

    // base has data; check age
    const tooOld = (now - (base?._t || 0)) > THIRTY_DAYS_MS;
    if (tooOld && any && any._t > (base?._t || 0) && !(isZeroish(any.weight) && isZeroish(any.reps))) {
      out[key] = any;  // prefer the newer cross-routine result
    } else {
      out[key] = base; // stick with default
    }
  });

  return out;
}, [history, me?.routine, day]);

  // helpers for copying
  const findGlobalIndex = (exercise, setNum) => {
    if (!active) return -1;
    return active.sets.findIndex(s => s.exercise === exercise && s.set === setNum);
  };

  const copyFromPreviousSet = (exercise, setNum) => {
    const prevIndex = findGlobalIndex(exercise, setNum - 1);
    const targetIndex = findGlobalIndex(exercise, setNum);
    if (prevIndex === -1 || targetIndex === -1) return false;
    const prev = active.sets[prevIndex];
    updateSet(targetIndex, { weight: prev.weight, reps: prev.reps });
    return true;
  };

  const copyFromLastWorkout = (exercise, setNum) => {
    const key = `${exercise}:${setNum}`;
    const prev = lastByExercise[key];
    const targetIndex = findGlobalIndex(exercise, setNum);
    if (!prev || targetIndex === -1) return false;
    updateSet(targetIndex, { weight: prev.weight ? String(prev.weight) : '', reps: prev.reps ? String(prev.reps) : '' });
    return true;
  };

  const handleSetLabelClick = (exercise, setNum) => {
    if (!active) return;
    if (setNum > 1 && copyFromPreviousSet(exercise, setNum)) return;
    if (copyFromLastWorkout(exercise, setNum)) return;
  };

  // When summary opens: lock background scroll, jump to top, focus header
  useEffect(() => {
    if (!showSummary) {
      // restore
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
      return;
    }

    // lock page scroll
    const prevBody = document.body.style.overflow;
    const prevHtml = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    // Wait a tick for DOM paint, then scroll the sheet-body to top & focus header
    const id = setTimeout(() => {
      try {
        if (sheetBodyRef.current) sheetBodyRef.current.scrollTop = 0;
        if (sheetHeaderRef.current) sheetHeaderRef.current.focus();
      } catch (e) {}
    }, 60);

    return () => {
      clearTimeout(id);
      document.body.style.overflow = prevBody;
      document.documentElement.style.overflow = prevHtml;
    };
  }, [showSummary]);

  return (
    <div className="grid fade-in">
      <div className="card">
        {/* Header: show current routine (accent color) */}
        <div className="h2" style={{ marginBottom: 8, color: 'var(--accent)' }}>{me?.routine || 'Workout'}</div>

        {/* Running timer only visible when workout has started */}
        {active && active.startedAt && (
          <div style={{ marginBottom: 8, color: 'var(--muted)', fontSize: 13 }}>
            Elapsed:&nbsp;<strong style={{ color: 'var(--text)' }}>{formatTime(elapsed)}</strong>
          </div>
        )}

        <div className="grid-2" style={{ marginTop: 8, alignItems: 'center' }}>
          <div className="kpi"><span>Day</span></div>
          <select value={day} onChange={e => { setDay(e.target.value); setActive(null); }}>
            {Object.keys(byDay).map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>

        {!active && (
          <button className="primary" style={{ marginTop: 12 }} onClick={() => initializeWorkout(day)}>
            Start Workout
          </button>
        )}
        {active && (
          <div className="grid" style={{ marginTop: 12 }}>
            <button className="secondary" onClick={cancelWorkout}>Cancel Workout</button>
          </div>
        )}
      </div>

      {/* Active workout sets */}
      {active && (byDay[day] || []).map(ex => (
        <div className="card" key={ex.exercise}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <div>
              <div className="h2" style={{ margin: 0 }}>{ex.exercise}</div>
              {/* target reps (preserve secondary color) */}
              <div className="target-reps" style={{ marginTop: 6 }}>
                Target: {ex.sets} × {ex.targetReps || '—'}
              </div>
            </div>
          </div>

          <div className="divider" />

          {active.sets.filter(s => s.exercise === ex.exercise).map((s) => {
            const globalIndex = findGlobalIndex(ex.exercise, s.set);
            const prev = lastByExercise[`${ex.exercise}:${s.set}`];
            return (
              <div className="row sets-area" key={`${ex.exercise}-${s.set}`} style={{ marginBottom: 8 }}>
                <div
                  className="kpi copy-area"
                  onClick={() => handleSetLabelClick(ex.exercise, s.set)}
                  title={s.set === 1 ? 'Tap to copy last workout set 1' : 'Tap to copy previous set in this workout'}
                  role="button"
                >
                  <span className="set-label" style={{ userSelect: 'none' }}>
                    Set {s.set}
                  </span>
                  <span className="prev-data" style={{ marginLeft: 8 }}>
                    {prev ? `${prev.weight}×${prev.reps}` : '—'}
                  </span>
                </div>

<input
  className="set-input"
  type="text"                 // full control, no 'e', '-', '.'
  inputMode="numeric"         // mobile numeric keypad
  pattern="[0-9]*"
  placeholder="Weight"
  value={s.weight}
  onKeyDown={blockBadKeys}
  onChange={e => {
    const clean = sanitizeInt(e.target.value);
    updateSet(globalIndex, { weight: clean });
  }}
  onPaste={e => {
    const text = e.clipboardData?.getData('text') ?? '';
    e.preventDefault();
    updateSet(globalIndex, { weight: sanitizeInt(text) });
  }}
/>

<input
  className="set-input"
  type="text"
  inputMode="numeric"
  pattern="[0-9]*"
  placeholder="Reps"
  value={s.reps}
  onKeyDown={blockBadKeys}
  onChange={e => {
    const clean = sanitizeInt(e.target.value);
    updateSet(globalIndex, { reps: clean });
  }}
  onPaste={e => {
    const text = e.clipboardData?.getData('text') ?? '';
    e.preventDefault();
    updateSet(globalIndex, { reps: sanitizeInt(text) });
  }}
/>
              </div>
            );
          })}
        </div>
      ))}

      {active && (
        <div className="grid" style={{ marginTop: 4 }}>
          <button className="primary" onClick={openSummary}>Finish Workout</button>
        </div>
      )}

      {/* Summary bottom sheet (single scroll, touches bottom) */}
      {showSummary && (
        <div className="sheet-overlay" onClick={() => setShowSummary(false)}>
          <div
            className="sheet-card slide-up"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Review workout"
            ref={sheetCardRef}
          >
            {/* Header / focus anchor */}
            <div
              ref={sheetHeaderRef}
              tabIndex={-1}
              style={{ outline: 'none', marginBottom: 8 }}
            >
              <div className="h2" style={{ marginBottom: 6, color: 'var(--accent)' }}>Workout summary</div>
            </div>

            {/* The single scrollable body */}
            <div className="sheet-body" ref={sheetBodyRef}>
              {/* KPIs - labels muted, values strong */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <div className="kpi" style={{ padding: '8px 10px' }}>
                  <span style={{ color: 'var(--muted)' }}>Elapsed</span>
                  <strong style={{ marginLeft: 8 }}>{formatTime(elapsedAtFinish)}</strong>
                </div>
                <div className="kpi" style={{ padding: '8px 10px' }}>
                  <span style={{ color: 'var(--muted)' }}>Day</span>
                  <strong style={{ marginLeft: 8 }}>{active?.day || '—'}</strong>
                </div>
              </div>

              {/* Exercises & Sets Summary */}
              {summaryDisplay.map(block => (
                <div key={block.exercise} className="card" style={{ padding: 12, marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div className="h2" style={{ margin: 0 }}>{block.exercise}</div>
                  </div>

                  <div className="divider" />

                  <div className="grid" style={{ gap: 8 }}>
                    {block.sets.map(s => (
                      <div key={s.set} className="row" style={{ gridTemplateColumns: '1fr 1fr 1fr', alignItems: 'center' }}>
                        <div className="set-label">Set {s.set}</div>
                        <div><strong className="value-secondary">{s.weight || '—'}</strong> <span className="muted">weight</span></div>
                        <div><strong className="value-secondary">{s.reps || '—'}</strong> <span className="muted">reps</span></div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {/* Achievements inside the same scroll */}
              {achievements.length > 0 && (
                <div className="card achievements" style={{ padding: 12, marginBottom: 8, paddingbottom: 20 }}>
                  <div className="h2" style={{ margin: 0 }}>Achievements</div>
                  <div className="divider" />
                  <ul className="clean-list" style={{ marginTop: 4 }}>
                    {achievements.map((a, i) => <li key={i}>🏆 {a}</li>)}
                  </ul>
                </div>
              )}
            </div>

            {/* Sticky action bar: stays visible while the sheet-body scrolls */}
            <div className="modal-actions">
              <button className="ghost" onClick={() => setShowSummary(false)}>Close</button>
              <button className="primary" onClick={confirmSave}>Finish & Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
