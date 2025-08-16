import { useEffect, useState } from 'react';
import Link from 'next/link';
import { storage } from '../utils/storage';
import { sheets } from '../utils/sheetsClient';

export default function Dashboard() {
  const user = storage.getUser();
  const [summary, setSummary] = useState({ total: 0, lastDate: null, topRoutine: null });
  const [resume, setResume] = useState(null);
  const [outbox, setOutbox] = useState([]);

  useEffect(()=>{
    if (!user) { window.location.href = '/'; return; }
    const cached = storage.getCachedUserData(user.name);
    computeSummary(cached);
    setResume(storage.getActiveWorkout(user.name));
    setOutbox(storage.getOutbox(user.name));

    // Try fetch fresh
    sheets.getUserData(user.name).then(rows=>{
      storage.cacheUserData(user.name, rows);
      computeSummary(rows);
    }).catch(()=>{});
  }, []);

  function computeSummary(rows) {
    if (!rows?.length) { setSummary({ total:0, lastDate:null, topRoutine:null }); return; }
    const total = new Set(rows.map(r => r.date)).size;
    const last = rows.map(r=>new Date(r.date)).sort((a,b)=>b-a)[0];
    const routineCount = rows.reduce((m,r)=> (m[r.routine]=(m[r.routine]||0)+1, m), {});
    const topRoutine = Object.entries(routineCount).sort((a,b)=>b[1]-a[1])[0][0];
    setSummary({ total, lastDate: last?.toLocaleDateString?.() || '', topRoutine });
  }

  async function syncOutbox() {
    if (!user) return;
    const pending = storage.getOutbox(user.name);
    if (!pending.length) return;

    // Convert to raw rows for Google Sheets: [User,Routine,Day,Exercise,Weight,Set,Reps,Date]
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

  return (
    <div className="grid fade-in">
      {outbox.length > 0 && (
        <div className="card" style={{border:'1px solid rgba(255,255,255,.08)'}}>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
            <div><strong>Pending Sync:</strong> {outbox.length} entries</div>
            <button className="primary" onClick={syncOutbox}>Sync now</button>
          </div>
        </div>
      )}

      <div className="grid-2">
        <div className="card kpi"><span>Total Workouts</span><strong>{summary.total}</strong></div>
        <div className="card kpi"><span>Last Workout</span><strong>{summary.lastDate || '—'}</strong></div>
      </div>
      <div className="card kpi"><span>Most-used Routine</span><strong>{summary.topRoutine || '—'}</strong></div>

      <div className="grid">
        {resume && (
          <Link className="primary" href="/workout">Resume Workout</Link>
        )}
        <Link className="primary" href="/workout">Start a Workout</Link>
        <Link className="ghost" href="/routine">View Current Routine</Link>
        <Link className="ghost" href="/progress">Progress</Link>
        <Link className="ghost" href="/previousWorkouts">Previous Workouts</Link>
      </div>
    </div>
  );
}
