// pages/dashboard.js
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { storage } from '../utils/storage';
import { sheets } from '../utils/sheetsClient';

/**
 * AutoShrinkText
 * - Shrinks text until it fits a single line; cooperates with flex layouts.
 */
function AutoShrinkText({
  children,
  minFontSize = 12,
  maxFontSize = 20,
  step = 0.5,
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

    el.style.whiteSpace = 'nowrap';
    el.style.overflow = 'hidden';
    el.style.textOverflow = 'ellipsis';
    el.style.maxWidth = '100%';
    el.style.minWidth = '0';
    el.style.flexShrink = '1';

    const cs = window.getComputedStyle(el);
    const computedSize = parseFloat(cs.fontSize || `${maxFontSize}px`) || maxFontSize;
    let startSize = Math.min(maxFontSize, computedSize);

    function adjust() {
      let fs = startSize;
      el.style.fontSize = `${fs}px`;
      let iterations = 0;
      while (el.scrollWidth > el.clientWidth && fs > minFontSize && iterations < 300) {
        fs = Math.max(minFontSize, +(fs - step).toFixed(2));
        el.style.fontSize = `${fs}px`;
        iterations += 1;
      }
    }

    rafRef.current = requestAnimationFrame(adjust);

    if ('ResizeObserver' in window) {
      roRef.current = new ResizeObserver(() => {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(adjust);
      });
      roRef.current.observe(el);
      if (el.parentElement) roRef.current.observe(el.parentElement);
    }

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
  const [summary, setSummary] = useState({
    total: 0,
    lastDate: null,
    lastSession: null,
    topRoutine: null
  });
  const [resume, setResume] = useState(null);
  const [outbox, setOutbox] = useState([]);
  const [cachedUsers, setCachedUsers] = useState(storage.getCachedUsers() || []);
  const [mounted, setMounted] = useState(false);
  const [hasRoutineDraft, setHasRoutineDraft] = useState(false);

  // expanded state for last workout card
  const [lastExpanded, setLastExpanded] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (!user) { window.location.href = '/'; return; }

    const cached = storage.getCachedUserData(user.name) || [];
    computeSummary(cached);
    setResume(storage.getActiveWorkout(user.name));
    setOutbox(storage.getOutbox(user.name));

    try {
      setHasRoutineDraft(!!localStorage.getItem('routine_draft'));
    } catch (e) {
      setHasRoutineDraft(false);
    }

    sheets.getUserData(user.name)
      .then(rows => {
        storage.cacheUserData(user.name, rows || []);
        computeSummary(rows || []);
      })
      .catch(() => {});

    sheets.getUsers()
      .then(list => {
        storage.cacheUsers(list);
        setCachedUsers(list);
      })
      .catch(() => {});

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

  // Helper: short date formatting (e.g., "Oct 5, 2025")
  const shortDate = (iso) => {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return String(iso).split('T')[0];
    }
  };

  // Helper: normalize day label to "Day X" where reasonable
  function formatDayLabel(d) {
    if (d == null) return null;
    const s = String(d).trim();
    if (!s) return null;
    if (/^day\s*/i.test(s)) return s;
    if (/^\d+$/.test(s)) return `Day ${s}`;
    return s;
  }

  // Build summary and sessions, set lastSession to newest session
  function computeSummary(rows) {
    if (!rows?.length) {
      setSummary({ total: 0, lastDate: null, lastSession: null, topRoutine: null });
      return;
    }

    const total = new Set(rows.map(r => r.date)).size;

    const routineCount = rows.reduce((m, r) => ((m[r.routine] = (m[r.routine] || 0) + 1), m), {});
    const topRoutine = Object.keys(routineCount).length
      ? Object.entries(routineCount).sort((a, b) => b[1] - a[1])[0][0]
      : null;

    // group rows into sessions preserving encounter order
    const map = new Map();
    rows.forEach(r => {
      const key = `${r.date}|${r.routine}|${r.day}`;
      if (!map.has(key)) {
        map.set(key, { key, date: r.date, routine: r.routine, day: r.day, rows: [] });
      }
      map.get(key).rows.push(r);
    });

    // convert to array and sort newest first
    const arr = Array.from(map.values()).sort((a, b) => new Date(b.date) - new Date(a.date));

    // build exercises for each session preserving order
    const sessions = arr.map(sess => {
      const exList = [];
      sess.rows.forEach(r => {
        let ex = exList.find(e => e.name === r.exercise);
        if (!ex) {
          ex = { name: r.exercise, sets: [] };
          exList.push(ex);
        }
        ex.sets.push({ set: r.set, weight: r.weight, reps: r.reps });
      });
      return { ...sess, exercises: exList, dayDisplay: formatDayLabel(sess.day) };
    });

    const lastSession = sessions.length ? sessions[0] : null;
    setSummary({ total, lastDate: lastSession ? shortDate(lastSession.date) : null, lastSession, topRoutine });
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
      // refresh summary from cache
      const cached = storage.getCachedUserData(user.name) || [];
      computeSummary(cached);
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

  const lastSession = summary.lastSession;

  return (
    <div className="grid dashboard">
      {outbox.length > 0 && (
        <div className="card" style={{ border: '1px solid rgba(255,255,255,.08)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div><strong>Pending Sync:</strong> {outbox.length} entries</div>
            <button className="primary" onClick={syncOutbox}>Sync now</button>
          </div>
        </div>
      )}

      {/* Two stacked & centered KPI cards so they match visually */}
      <div className="grid-2">
        <Link href="/previousWorkouts" className="card kpi kpi--center" style={{ textDecoration: 'none' }}>
          <span>Total Workouts</span>
          <strong>{summary.total}</strong>
        </Link>

        {/* Last Workout card: header layout updated per your spec.
            NOTE: card uses column flex so header stays pinned and details expand below. */}
        <div
          className="card kpi kpi--center"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'stretch',
            boxSizing: 'border-box',
            overflow: 'hidden'
          }}
        >
          {/* Header: pattern copied from previousWorkouts so padding/flush-left match */}
          <button
            type="button"
            onClick={() => lastSession && setLastExpanded(prev => !prev)}
            aria-expanded={lastExpanded}
            style={{
              width: '100%',
              border: 'none',
              background: 'transparent',
              cursor: lastSession ? 'pointer' : 'default',
              padding: 0,              // padding applied to inner row to match other cards
              textAlign: 'left',
              boxSizing: 'border-box',
              minWidth: 0,
            }}
          >
            {/* inner row (this is where padding is applied — matches previousWorkouts) */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: 0,
                boxSizing: 'border-box',
                width: '100%',
                minWidth: 0
              }}
            >
              {/* Left: label (muted, NOT bold) and flush to the left */}
              <span
                style={{
                  color: 'var(--muted)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  display: 'block',
                  minWidth: 0,
                  flex: '1 1 0'
                }}
              >
                Last Workout
              </span>

              {/* Right: vertical stack: date (bold) above routine · day (muted) */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-end',
                  textAlign: 'right',
                  minWidth: 0,
                  marginLeft: 12,
                  maxWidth: '55%'
                }}
              >
                {lastSession ? (
                  <>
                    <div style={{ color: 'var(--text)', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {shortDate(lastSession.date)}
                    </div>
                    <div style={{ color: 'var(--muted)', fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {lastSession.routine} {lastSession.dayDisplay ? `• ${lastSession.dayDisplay}` : ''}
                    </div>
                  </>
                ) : (
                  <div style={{ color: 'var(--muted)' }}>—</div>
                )}
              </div>
            </div>
          </button>

          {/* Expanded content shown below header — card is column flex so it pushes down only */}
          {lastExpanded && lastSession && (
            <div className="session-body" style={{ boxSizing: 'border-box', width: '100%' }}>
              <div className="divider" />
              {lastSession.exercises.map(ex => (
                <div key={ex.name} className="card" style={{ padding: 12, marginBottom: 8, width: '100%', boxSizing: 'border-box' }}>
                  {/* exercise name - slightly smaller than previous (tuned down a bit) */}
                  <div className="h2" style={{ margin: 0, fontSize: 17 }}>{ex.name}</div>
                  <div className="divider" />
                  <div className="grid" style={{ gap: 8 }}>
                    {ex.sets.map((st, i) => (
                      <div key={i} className="row" style={{ gridTemplateColumns: '1fr 1fr 1fr', alignItems: 'center' }}>
                        <div className="set-label">Set {st.set}</div>

                        {/* weight column: numeric value uses secondary color; label is smaller */}
                        <div>
                          <strong
                            className="value-secondary"
                            style={{
                              color: 'var(--value-secondary, var(--secondary))', // explicit secondary/accent fallback
                              fontSize: 15,
                              display: 'inline-block',
                              minWidth: 36,
                              textAlign: 'right'
                            }}
                          >
                            {st.weight ?? '—'}
                          </strong>
                          <span style={{ marginLeft: 8, fontSize: 15 }} className="muted">Weight</span>
                        </div>

                        {/* reps column: numeric value uses secondary color; label is smaller */}
                        <div>
                          <strong
                            className="value-secondary"
                            style={{
                              color: 'var(--value-secondary, var(--secondary))',
                              fontSize: 15,
                              display: 'inline-block',
                              minWidth: 36,
                              textAlign: 'right'
                            }}
                          >
                            {st.reps ?? '—'}
                          </strong>
                          <span style={{ marginLeft: 8, fontSize: 15 }} className="muted">Reps</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* current routine with highlighted value (shrinks to fit without wrapping) */}
      <Link href="/routine" className="card kpi current-routine" style={{ alignItems: 'center', textDecoration: 'none' }}>
        <span>Current Routine</span>
        <AutoShrinkText maxFontSize={20} minFontSize={12} style={{ textAlign: 'right' }}>
          {currentRoutineLabel}
        </AutoShrinkText>
      </Link>

      {/* action buttons */}
      <div className="grid actions" style={{ marginTop: 80, gap: 20 }}>
        {resume && <Link className="action" href="/workout">Resume Workout</Link>}
        <Link className="action" href="/workout">Start a Workout</Link>
        <Link className="action" href="/progress">Progress</Link>
        <Link className="action" href="/change-routine">Change Routine</Link>
      </div>
    </div>
  );
}
