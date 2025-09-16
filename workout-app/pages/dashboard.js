// pages/dashboard.js
import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { storage } from '../utils/storage';
import { sheets } from '../utils/sheetsClient';

/**
 * AutoShrinkText
 * - DOES NOT increase font-size (starts from computed font-size)
 * - Shrinks until text fits available width (single line, no wrap)
 * - Cooperates with flex layouts (minWidth:0, flexShrink:1)
 */
function AutoShrinkText({
  children,
  minFontSize = 12,   // px
  maxFontSize = 20,   // px (upper cap; will not exceed computed font-size)
  step = 0.5,         // px decrement per iteration
  style = {},
  className = '',
  ...rest
}) {
  const elRef = useRef(null);
  const rafRef = useRef(null);
  const roRef = useRef(null);

  useEffect(() => {
    const el = elRef.current;
    if (!el) return;

    // Ensure single-line ellipsis behavior and flex shrink cooperation
    el.style.whiteSpace = 'nowrap';
    el.style.overflow = 'hidden';
    el.style.textOverflow = 'ellipsis';
    // don't set width:100% (avoids forcing parent width); instead cooperate with flex
    el.style.maxWidth = '100%';
    el.style.minWidth = '0';       // allows flex children to shrink
    el.style.flexShrink = '1';

    // compute initial font-size (start at computed font-size but don't exceed maxFontSize)
    const cs = window.getComputedStyle(el);
    const computedSize = parseFloat(cs.fontSize || `${maxFontSize}px`) || maxFontSize;
    let startSize = Math.min(maxFontSize, computedSize);

    function adjust() {
      // start at computed size (never enlarge)
      let fs = startSize;
      el.style.fontSize = `${fs}px`;

      // shrink until scrollWidth <= clientWidth or we hit minFontSize
      let iterations = 0;
      while (el.scrollWidth > el.clientWidth && fs > minFontSize && iterations < 300) {
        fs = Math.max(minFontSize, +(fs - step).toFixed(2));
        el.style.fontSize = `${fs}px`;
        iterations += 1;
      }
    }

    // run initially
    rafRef.current = requestAnimationFrame(adjust);

    // Recompute on resize of the element or its parent
    if ('ResizeObserver' in window) {
      roRef.current = new ResizeObserver(() => {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(adjust);
      });
      roRef.current.observe(el);
      if (el.parentElement) roRef.current.observe(el.parentElement);
    }

    // Also respond to window resizes as fallback
    const onWin = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(adjust);
    };
    window.addEventListener('resize', onWin);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (roRef.current) roRef.current.disconnect();
      window.removeEventListener('resize', onWin);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [children, minFontSize, maxFontSize, step]);

  return (
    <strong
      ref={elRef}
      className={className}
      style={{
        fontWeight: 500,
        display: 'inline-block',
        ...style
      }}
      {...rest}
    >
      {children}
    </strong>
  );
}

export default function Dashboard() {
  const user = storage.getUser();
  const [summary, setSummary] = useState({ total: 0, lastDate: null, topRoutine: null });
  const [resume, setResume] = useState(null); // active workout resume
  const [outbox, setOutbox] = useState([]);
  const [cachedUsers, setCachedUsers] = useState(storage.getCachedUsers() || []);
  const [mounted, setMounted] = useState(false);

  // NEW: track whether there's an in-progress routine draft to resume
  const [hasRoutineDraft, setHasRoutineDraft] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (!user) { window.location.href = '/'; return; }

    // initial load
    const cached = storage.getCachedUserData(user.name);
    computeSummary(cached);
    setResume(storage.getActiveWorkout(user.name));
    setOutbox(storage.getOutbox(user.name));

    // check for a builder draft in localStorage
    try {
      setHasRoutineDraft(!!localStorage.getItem('routine_draft'));
    } catch (e) {
      setHasRoutineDraft(false);
    }

    sheets.getUserData(user.name)
      .then(rows => {
        storage.cacheUserData(user.name, rows);
        computeSummary(rows);
      })
      .catch(()=>{});

    sheets.getUsers()
      .then(list => {
        storage.cacheUsers(list);
        setCachedUsers(list);
      })
      .catch(()=>{});

    // listen for storage events (draft created/cleared in other tab)
    const onStorage = (ev) => {
      if (ev.key === 'routine_draft') {
        setHasRoutineDraft(!!ev.newValue);
      }
    };
    window.addEventListener('storage', onStorage);

    return () => {
      window.removeEventListener('storage', onStorage);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function computeSummary(rows) {
    if (!rows?.length) { setSummary({ total:0, lastDate:null, topRoutine:null }); return; }
    const total = new Set(rows.map(r => r.date)).size;
    const last = rows.map(r => new Date(r.date)).sort((a,b)=>b-a)[0];
    const routineCount = rows.reduce((m,r)=> (m[r.routine]=(m[r.routine]||0)+1, m), {});
    const topRoutine = Object.keys(routineCount).length ? Object.entries(routineCount).sort((a,b)=>b[1]-a[1])[0][0] : null;
    setSummary({ total, lastDate: last?.toLocaleDateString?.() || '', topRoutine });
  }

  async function syncOutbox() {
    if (!user) return;
    const pending = storage.getOutbox(user.name);
    if (!pending.length) return;

    const rows = pending.map(r => [r.user, r.routine, r.day, r.exercise, r.weight, r.set, r.reps, r.date]);
    const ok = await sheets.appendWorkoutRows(user.name, rows);
    if (ok) {
      storage.clearOutbox(user.name);
      setOutbox([]);
      alert('Synced to Google Sheets!');
    } else {
      alert('Sync failed (API POST not enabled yet). Data remains safe locally.');
    }
  }

  const findRoutineFromCached = () => {
    try {
      if (!cachedUsers || !user) return null;
      const found = cachedUsers.find(u => u.name === user.name);
      return found?.routine || null;
    } catch {
      return null;
    }
  };

  const currentRoutineLabel = user?.routine || findRoutineFromCached() || summary.topRoutine || '—';

  if (!mounted) return null;

  return (
    <div className="grid dashboard">
      {outbox.length > 0 && (
        <div className="card" style={{border:'1px solid rgba(255,255,255,.08)'}}>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
            <div><strong>Pending Sync:</strong> {outbox.length} entries</div>
            <button className="primary" onClick={syncOutbox}>Sync now</button>
          </div>
        </div>
      )}

      {/* Two stacked & centered KPI cards so they match visually */}
      <div className="grid-2">
        <Link href="/previousWorkouts" className="card kpi kpi--center">
          <span>Total Workouts</span>
          <strong>{summary.total}</strong>
        </Link>

        <div className="card kpi kpi--center">
          <span>Last Workout</span>
          <strong>{summary.lastDate || '—'}</strong>
        </div>
      </div>

      {/* current routine with highlighted value (now shrinks to fit without wrapping) */}
      <Link href="/routine" className="card kpi current-routine" style={{ alignItems: 'center' }}>
        <span>Current Routine</span>
        <AutoShrinkText maxFontSize={20} minFontSize={12} style={{ textAlign: 'right' }}>
          {currentRoutineLabel}
        </AutoShrinkText>
      </Link>

      {/* action buttons (Resume Workout, Start, Progress, Change Routine, Resume Routine Draft) */}
      <div className="grid actions" style={{ marginTop: 80, gap: 20 }}>
        {resume && <Link className="action" href="/workout">Resume Workout</Link>}
        <Link className="action" href="/workout">Start a Workout</Link>
        <Link className="action" href="/progress">Progress</Link>

        {/* NEW: Change Routine page */}
        <Link className="action" href="/change-routine">Change Routine</Link>

      </div>
    </div>
  );
}
