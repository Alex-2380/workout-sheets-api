// pages/previousWorkouts.js
import { useEffect, useMemo, useState } from 'react';
import { storage } from '../utils/storage';
import { sheets } from '../utils/sheetsClient';

export default function PreviousWorkouts() {
  const user = storage.getUser();
  const [rows, setRows] = useState([]);

  useEffect(() => {
    if (!user) { window.location.href = '/'; return; }

    // load cached quickly, then refresh from server
    const cached = storage.getCachedUserData(user.name) || [];
    setRows(cached);

    sheets.getUserData(user.name)
      .then(fetched => {
        storage.cacheUserData(user.name, fetched || []);
        setRows(fetched || []);
      })
      .catch(() => {});
  }, []);

  // Build sessions preserving the original order of rows (no alphabetic sorting)
  const sessions = useMemo(() => {
    if (!rows || !rows.length) return [];

    // Map preserves insertion order
    const map = new Map();

    rows.forEach(r => {
      // key groups a single workout instance: date + routine + day
      const key = `${r.date}|${r.routine}|${r.day}`;
      if (!map.has(key)) {
        map.set(key, { key, date: r.date, routine: r.routine, day: r.day, rows: [] });
      }
      // push rows in the original order they appear in `rows`
      map.get(key).rows.push(r);
    });

    // Convert to array and show newest sessions first
    const arr = Array.from(map.values()).sort((a, b) => new Date(b.date) - new Date(a.date));

    // For each session, build exercises in the order they were encountered (preserve order)
    return arr.map(sess => {
      const exList = [];
      sess.rows.forEach(r => {
        let ex = exList.find(e => e.name === r.exercise);
        if (!ex) {
          ex = { name: r.exercise, sets: [] };
          exList.push(ex);
        }
        // preserve sets in original encounter order
        ex.sets.push({ set: r.set, weight: r.weight, reps: r.reps });
      });
      return { ...sess, exercises: exList };
    });
  }, [rows]);

  const PAGE = 10;
  const [visible, setVisible] = useState(PAGE);
  const [expanded, setExpanded] = useState(new Set());

  const toggleExpand = (key) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const shown = sessions.slice(0, visible);

  const shortDate = (iso) => {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    } catch { return String(iso).split('T')[0]; }
  };

  return (
    <div className="grid fade-in prev-page" style={{ gap: 8 }}>
      <div className="card header-card">
        <div className="h2 page-title" style={{ textAlign: 'center', color: 'var(--accent)', margin: 0 }}>
          Previous Workouts
        </div>
      </div>

      {shown.map(s => {
        const open = expanded.has(s.key);
        return (
          <div className="card session-card" key={s.key} style={{ padding: 0 }}>
            <button
              type="button"
              className="session-header"
              onClick={() => toggleExpand(s.key)}
              aria-expanded={open}
              style={{ width: '100%', border: 'none', background: 'transparent', cursor: 'pointer' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px' }}>
                <div style={{ color: 'var(--text)', fontWeight: 700 }}>{shortDate(s.date)}</div>
                <div style={{ color: 'var(--muted)', fontSize: 14 }}>{s.routine} • Day {s.day}</div>
              </div>
            </button>

            {open && (
              <div className="session-body" style={{ padding: '12px 16px 18px 16px' }}>
                {/* Render *each exercise* as a card — same structure as the workout summary */}
                {s.exercises.map(ex => (
                  <div key={ex.name} className="card" style={{ padding: 12, marginBottom: 8 }}>
                    <div className="h2" style={{ margin: 0 }}>{ex.name}</div>
                    <div className="divider" />
                    <div className="grid" style={{ gap: 8 }}>
                      {ex.sets.map((st, i) => (
                        <div key={i} className="row" style={{ gridTemplateColumns: '1fr 1fr 1fr', alignItems: 'center' }}>
                          <div className="set-label">Set {st.set}</div>
                          <div><strong className="value-secondary">{st.weight ?? '—'}</strong> <span className="muted">Weight</span></div>
                          <div><strong className="value-secondary">{st.reps ?? '—'}</strong> <span className="muted">Reps</span></div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {sessions.length > shown.length && (
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 6 }}>
          <button className="primary" onClick={() => setVisible(v => Math.min(v + PAGE, sessions.length))}>Load 10 more</button>
          <button className="primary" onClick={() => setVisible(sessions.length)}>Load all</button>
        </div>
      )}

      {sessions.length === 0 && (
        <div className="card" style={{ textAlign: 'center' }}>
          <div className="muted">No previous workouts yet.</div>
        </div>
      )}
    </div>
  );
}
