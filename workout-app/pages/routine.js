// pages/routine-view.js  (or replace your existing file/component)
import { useEffect, useMemo, useState } from 'react';
import { storage } from '../utils/storage';
import { sheets } from '../utils/sheetsClient';

export default function RoutineView() {
  const user = storage.getUser();
  const [users, setUsers] = useState(storage.getCachedUsers());
  const me = users.find(u => u.name === user?.name);
  const [routines, setRoutines] = useState(storage.getCachedRoutines());

  useEffect(() => {
    if (!user) { window.location.href = '/'; return; }
    sheets.getUsers().then(list => { storage.cacheUsers(list); setUsers(list); }).catch(() => {});
    sheets.getRoutines().then(rows => { storage.cacheRoutines(rows); setRoutines(rows); }).catch(() => {});
  }, []);

  const byDay = useMemo(() => {
    const pick = routines.filter(r => r.routine === me?.routine);
    const m = {};
    pick.forEach(r => { (m[r.day] = m[r.day] || []).push(r); });
    return m;
  }, [routines, me?.routine]);

  return (
    <div className="grid fade-in routine-page">
      {/* Centered routine NAME in primary color - responsive + word-safe wrapping */}
      <div className="card header-card">
        <div
          className="h1 title-accent routine-name"
          style={{
            margin: 0,
            textAlign: 'center',
            // scale down on small screens, keep readable on large
            fontSize: 'clamp(18px, 6vw, 28px)',
            lineHeight: 1.05,
            whiteSpace: 'normal',
            // prefer wrapping at word boundaries (avoid mid-word breaks)
            overflowWrap: 'normal',
            wordBreak: 'normal',
            hyphens: 'none',
            // ensure long names still truncate nicely if someone uses a single continuous word:
            maxWidth: '100%',
            wordSpacing: '0.02em'
          }}
          title={me?.routine || ''}
        >
          {me?.routine || '—'}
        </div>
      </div>

      {Object.keys(byDay).sort((a, b) => Number(a) - Number(b)).map(d => (
        <div className="card" key={d}>
          <div className="h2 day-title">Day {d}</div>



          <div className="divider" />

          <div className="grid exercises">
            {byDay[d].map(ex => (
              <div className="kpi" key={ex.exercise}>
                <span className="exercise-name">{ex.exercise}</span>
                {/* make BOTH sets × reps muted */}
                <strong className="sr">{ex.sets} × {ex.targetReps || '—'}</strong>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
