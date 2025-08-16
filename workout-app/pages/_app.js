import { useEffect, useState } from 'react';
import Head from 'next/head';
import '../styles/globals.css';
import { getTheme, setTheme, availableAccents } from '../utils/theme';
import Link from 'next/link';

function Header({ onToggleTools }) {
  return (
    <div className="toolbar">
      <div className="container" style={{paddingTop: 10}}>
        <div style={{display:'flex', alignItems:'center', justifyContent:'space-between'}}>
          <div className="h2" style={{margin:0}}>LiftLog</div>
          <div style={{display:'flex', gap:8}}>
            <button className="tool-chip" onClick={onToggleTools}>Tools</button>
            <Link href="/settings" className="tool-chip">Settings</Link>
          </div>
        </div>
      </div>
      <div className="tools">
        <Link href="/dashboard" className="tool-chip">Dashboard</Link>
        <Link href="/workout" className="tool-chip">Start Workout</Link>
        <Link href="/routine" className="tool-chip">Routine</Link>
        <Link href="/progress" className="tool-chip">Progress</Link>
        <Link href="/previousWorkouts" className="tool-chip">Previous</Link>
      </div>
    </div>
  );
}

function ToolsSheet({ open, onClose }) {
  const [tab, setTab] = useState('1rm');

  return (
    <div style={{
      position:'fixed', inset:0, display: open ? 'flex' : 'none',
      background:'rgba(0,0,0,.5)', backdropFilter:'blur(3px)', zIndex:60,
      alignItems:'flex-end'
    }}>
      <div className="card" style={{
        borderTopLeftRadius:24, borderTopRightRadius:24, borderBottomLeftRadius:0, borderBottomRightRadius:0,
        width:'100%', maxWidth:860, margin:'0 auto', paddingBottom:24
      }}>
        <div style={{display:'flex', gap:8, marginBottom:12}}>
          <button className="ghost" onClick={()=>setTab('1rm')}>1RM Calculator</button>
          <button className="ghost" onClick={()=>setTab('plates')}>Weight Calculator</button>
          <button className="ghost" onClick={()=>setTab('timer')}>Rest Timer</button>
          <div style={{flex:1}} />
          <button className="ghost" onClick={onClose}>Close</button>
        </div>

        {tab === '1rm' && <OneRepMaxCalculator />}
        {tab === 'plates' && <PlateCalculator />}
        {tab === 'timer' && <RestTimer />}
      </div>
    </div>
  );
}

function OneRepMaxCalculator() {
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');
  const [table, setTable] = useState([]);

  function epley(w, r) { return w * (1 + r/30); } // 1RM estimate

  function calc() {
    const w = parseFloat(weight||'0');
    const r = parseInt(reps||'0', 10);
    if (!w || !r) return;
    const one = epley(w, r);
    const out = [];
    for (let i=1;i<=10;i++){
      const est = Math.round(one / (1 + i/30));
      out.push({ reps: i, weight: est });
    }
    setTable(out);
    drawChart(out);
  }

  function drawChart(data){
    const canvas = document.getElementById('orm_chart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width = canvas.clientWidth;
    const h = canvas.height = 160;

    ctx.clearRect(0,0,w,h);
    const max = Math.max(...data.map(d=>d.weight), 1);
    const pad = 24;
    ctx.strokeStyle = 'rgba(255,255,255,.15)';
    ctx.beginPath(); ctx.moveTo(pad, pad); ctx.lineTo(pad, h-pad); ctx.lineTo(w-pad, h-pad); ctx.stroke();

    ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#ff7a00';
    ctx.lineWidth = 2;
    ctx.beginPath();
    data.forEach((d,i)=>{
      const x = pad + (i/(data.length-1))*(w-2*pad);
      const y = h-pad - (d.weight/max)*(h-2*pad);
      if (i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
    });
    ctx.stroke();

    ctx.fillStyle = ctx.strokeStyle;
    data.forEach((d,i)=>{
      const x = pad + (i/(data.length-1))*(w-2*pad);
      const y = h-pad - (d.weight/max)*(h-2*pad);
      ctx.beginPath(); ctx.arc(x,y,3,0,Math.PI*2); ctx.fill();
    });
  }

  useEffect(()=>{ if (table.length) drawChart(table); }, [table]);

  return (
    <div className="grid">
      <div className="grid-2">
        <input placeholder="Weight" inputMode="decimal" value={weight} onChange={e=>setWeight(e.target.value)} />
        <input placeholder="Reps" inputMode="numeric" value={reps} onChange={e=>setReps(e.target.value)} />
      </div>
      <button className="primary" onClick={calc}>Calculate 1–10 Rep Table</button>
      <div className="card">
        <canvas id="orm_chart" style={{width:'100%', height:160}} />
        <div className="divider" />
        <div className="grid" style={{gridTemplateColumns:'repeat(5,1fr)'}}>
          {table.map(row => (
            <div key={row.reps} className="kpi">
              <div>{row.reps}×</div>
              <strong>{row.weight}</strong>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PlateCalculator() {
  const [bar, setBar] = useState(45);
  const plates = [45,25,10,5,2.5];
  const [counts, setCounts] = useState({});

  function tap(p) {
    setCounts(c => ({...c, [p]: (c[p]||0)+1}));
  }
  function doubleTap(p) {
    setCounts(c => ({...c, [p]: Math.max(0,(c[p]||0)-1)}));
  }
  const eachSide = plates.reduce((sum,p)=>sum + p*(counts[p]||0), 0);
  const total = bar + 2*eachSide;

  return (
    <div className="grid">
      <div className="grid-2">
        <select value={bar} onChange={e=>setBar(parseFloat(e.target.value))}>
          <option value={45}>Bar 45 lb</option>
          <option value={35}>Bar 35 lb</option>
          <option value={15}>Bar 15 lb</option>
        </select>
        <div className="kpi"><span>Total</span><strong>{total} lb</strong></div>
      </div>
      <div style={{display:'flex', gap:8, flexWrap:'wrap'}}>
        {plates.map(p=>(
          <div key={p}
            className="card"
            onClick={()=>tap(p)}
            onDoubleClick={()=>doubleTap(p)}
            style={{cursor:'pointer', minWidth:100}}>
            <div className="h2" style={{margin:0}}>{p} lb</div>
            <div className="muted">Per side</div>
            <div className="divider" />
            <div>Count: <strong>{counts[p]||0}</strong></div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RestTimer() {
  const [sec, setSec] = useState(120);
  const [left, setLeft] = useState(0);
  const [running, setRunning] = useState(false);

  useEffect(()=>{
    if (!running) return;
    const t = setInterval(()=> setLeft(x=> {
      if (x<=1) { clearInterval(t); setRunning(false); return 0; }
      return x-1;
    }), 1000);
    return ()=>clearInterval(t);
  }, [running]);

  const mins = Math.floor(left/60).toString().padStart(2,'0');
  const secs = (left%60).toString().padStart(2,'0');

  return (
    <div className="grid">
      <div className="grid-2">
        <div className="kpi"><span>Preset</span>
          <strong>{Math.floor(sec/60)}:{(sec%60).toString().padStart(2,'0')}</strong>
        </div>
        <div className="grid-2">
          <button className="ghost" onClick={()=>setSec(s=>Math.max(0,s-30))}>- 30s</button>
          <button className="ghost" onClick={()=>setSec(s=>s+30)}>+ 30s</button>
        </div>
      </div>
      <div className="kpi"><span>Time Left</span><strong>{mins}:{secs}</strong></div>
      <div style={{display:'flex', gap:8}}>
        <button className="primary" onClick={()=>{setLeft(sec); setRunning(true);}}>Start</button>
        <button className="ghost" onClick={()=>{setRunning(false); setLeft(0);}}>Reset</button>
      </div>
    </div>
  );
}

export default function App({ Component, pageProps }) {
  const [toolsOpen, setToolsOpen] = useState(false);

  // Apply theme from storage + register SW
  useEffect(()=>{
    const { mode, accent } = getTheme();
    setTheme({ mode, accent });

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(()=>{});
    }
  }, []);

  // Keep accent color reactive if user changes it elsewhere
  useEffect(()=>{
    const t = setInterval(()=>{
      const { mode, accent } = getTheme();
      setTheme({ mode, accent });
    }, 500);
    return ()=>clearInterval(t);
  }, []);

  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no" />
        <meta name="theme-color" content="var(--accent)" />
        <link rel="manifest" href="/manifest.json" />
        <title>LiftLog</title>
      </Head>
      <Header onToggleTools={()=>setToolsOpen(true)} />
      <div className="container" style={{paddingTop: 8}}>
        <Component {...pageProps} />
        <div className="footer-space" />
      </div>
      <ToolsSheet open={toolsOpen} onClose={()=>setToolsOpen(false)} />
    </>
  );
}
