// pages/dashboard.js
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { storage } from '../utils/storage';
import { sheets } from '../utils/sheetsClient';

export default function Dashboard() {
  const user = storage.getUser();
  const [summary, setSummary] = useState({ total: 0, lastDate: null, topRoutine: null });
  const [resume, setResume] = useState(null);
  const [outbox, setOutbox] = useState([]);
  const [cachedUsers, setCachedUsers] = useState(storage.getCachedUsers() || []);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (!user) { window.location.href = '/'; return; }

    // initial load
    const cached = storage.getCachedUserData(user.name);
    computeSummary(cached);
    setResume(storage.getActiveWorkout(user.name));
    setOutbox(storage.getOutbox(user.name));

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
    <div className="grid fade-in-slow dashboard">
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
        <div className="card kpi kpi--center">
          <span>Total Workouts</span>
          <strong>{summary.total}</strong>
        </div>

        <div className="card kpi kpi--center">
          <span>Last Workout</span>
          <strong>{summary.lastDate || '—'}</strong>
        </div>
      </div>

      {/* current routine with highlighted value */}
      <div className="card kpi current-routine">
        <span>Current Routine</span>
        <strong>{currentRoutineLabel}</strong>
      </div>

      {/* action buttons (a bit more space so they're easier to reach) */}
      <div className="grid actions" style={{ marginTop: 80, gap: 20 }}>
        {resume && <Link className="action" href="/workout">Resume Workout</Link>}
        <Link className="action" href="/workout">Start a Workout</Link>
        <Link className="action" href="/routine">View Current Routine</Link>
        <Link className="action" href="/progress">Progress</Link>
        <Link className="action" href="/previousWorkouts">Previous Workouts</Link>
      </div>
    </div>
  );
}