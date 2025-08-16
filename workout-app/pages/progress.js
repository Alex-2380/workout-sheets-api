import { useEffect, useMemo, useState } from 'react';
import { storage } from '../utils/storage';
import { sheets } from '../utils/sheetsClient';

const ranges = [
  { key: 'all', label: 'All Time', days: 10000 },
  { key: '1m', label: '1 Month', days: 30 },
  { key: '3m', label: '3 Months', days: 90 },
  { key: '6m', label: '6 Months', days: 180 },
  { key: '1y', label: '1 Year', days: 365 },
];

export default function Progress() {
  const user = storage.getUser();
  const [data, setData] = useState([]);
  const [exercise, setExercise] = useState('');
  const [rng, setRng] = useState('3m');
  const [mode, setMode] = useState('1rm'); // '1rm' or 'weight'

  useEffect(()=>{
    if (!user) { window.location.href = '/'; return; }
    const cached = storage.getCachedUserData(user.name);
    setData(cached);
    sheets.getUserData(user.name).then(rows => {
      storage.cacheUserData(user.name, rows); setData(rows);
    }).catch(()=>{});
  }, []);

  const exerciseList = useMemo(()=>{
    return Array.from(new Set(data.map(r=>r.exercise))).sort();
  }, [data]);

  useEffect(()=>{ if (!exercise && exerciseList.length) setExercise(exerciseList[0]); }, [exerciseList]);

  const filtered = useMemo(()=>{
    const days = ranges.find(r=>r.key===rng)?.days || 365;
    const cutoff = Date.now() - days*86400000;
    return data.filter(r => r.exercise===exercise && new Date(r.date).getTime() >= cutoff)
               .sort((a,b)=> new Date(a.date)-new Date(b.date));
  }, [data, exercise, rng]);

  const points = useMemo(()=>{
    if (mode === '1rm') {
      const calc = (w, reps) => w*(1 + reps/30);
      return filtered.map(r=>({ t: new Date(r.date), v: Math.round(calc(r.weight, r.reps)) }));
    } else {
      return filtered.map(r=>({ t: new Date(r.date), v: r.weight }));
    }
  }, [filtered, mode]);

  useEffect(()=>{
    draw(points, mode);
  }, [points, mode]);

  function draw(pts, mode) {
    const canvas = document.getElementById('progress_canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width = canvas.clientWidth;
    const h = canvas.height = 180;
    ctx.clearRect(0,0,w,h);
    if (!pts.length) return;

    const pad = 28;
    const xs = pts.map(p=>p.t.getTime());
    const ys = pts.map(p=>p.v);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);

    function xTo(px){ return pad + ((px-minX)/(maxX-minX||1))*(w-2*pad); }
    function yTo(py){ return h-pad - ((py-minY)/(maxY-minY||1))*(h-2*pad); }

    // axes
    ctx.strokeStyle = 'rgba(255,255,255,.15)';
    ctx.beginPath(); ctx.moveTo(pad, pad); ctx.lineTo(pad, h-pad); ctx.lineTo(w-pad, h-pad); ctx.stroke();

    // line
    ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#ff7a00';
    ctx.lineWidth = 2;
    ctx.beginPath();
    pts.forEach((p,i)=>{ const x=xTo(p.t.getTime()), y=yTo(p.v); if(i===0)ctx.moveTo(x,y); else ctx.lineTo(x,y); });
    ctx.stroke();

    // points
    ctx.fillStyle = ctx.strokeStyle;
    pts.forEach(p => { const x=xTo(p.t.getTime()), y=yTo(p.v); ctx.beginPath(); ctx.arc(x,y,3,0,Math.PI*2); ctx.fill(); });

    // label
    ctx.fillStyle = 'rgba(255,255,255,.7)';
    ctx.font = '12px system-ui';
    ctx.fillText(mode==='1rm' ? 'Estimated 1RM' : 'Weight', pad, pad-8);
  }

  const current = points[points.length-1]?.v || 0;
  const best = Math.max(0, ...points.map(p=>p.v));

  return (
    <div className="grid fade-in">
      <div className="card">
        <div className="h2">Progress</div>
        <div className="grid-2">
          <select value={exercise} onChange={e=>setExercise(e.target.value)}>
            {exerciseList.map(ex => <option key={ex} value={ex}>{ex}</option>)}
          </select>
          <select value={rng} onChange={e=>setRng(e.target.value)}>
            {ranges.map(r=> <option key={r.key} value={r.key}>{r.label}</option>)}
          </select>
        </div>
        <div style={{display:'flex', gap:8, marginTop:8}}>
          <button className="ghost" onClick={()=>setMode('1rm')}>1RM</button>
          <button className="ghost" onClick={()=>setMode('weight')}>Weight</button>
        </div>
      </div>

      <div className="card">
        <canvas id="progress_canvas" style={{width:'100%', height:180}} />
        <div className="divider" />
        <div className="grid-2">
          <div className="kpi"><span>Current</span><strong>{Math.round(current)}</strong></div>
          <div className="kpi"><span>All-Time Best</span><strong>{Math.round(best)}</strong></div>
        </div>
      </div>
    </div>
  );
}
