// pages/progress.js
import { useEffect, useMemo, useRef, useState } from 'react';
import { storage } from '../utils/storage';
import { sheets } from '../utils/sheetsClient';

const RANGES = [
  { key: 'all', label: 'All Time', days: 10000 },
  { key: '1m', label: '1 Month', days: 30 },
  { key: '3m', label: '3 Months', days: 90 },
  { key: '6m', label: '6 Months', days: 180 },
  { key: '1y', label: '1 Year', days: 365 },
];

const FIXED_EXERCISES = [
  'BENCH PRESS',
  'SQUAT',
  'DEADLIFT',
  'BARBELL SHOULDER PRESS'
];

function calc1RM(weight, reps) {
  const w = Number(weight) || 0;
  const r = Number(reps) || 0;
  if (!w || !r) return 0;
  return Math.round(w * (1 + r / 30));
}

function shortDate(d) {
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const yy = String(d.getFullYear()).slice(-2);
  return `${m}/${day}/${yy}`;
}
function monthYearLabel(d) {
  return d.toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
}
function monthLabel(d) {
  return d.toLocaleDateString(undefined, { month: 'short' });
}
function monthDayLabel(d) {
  return d.toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' });
}
function niceStep(span) {
  if (span <= 0) return 1;
  const exp = Math.pow(10, Math.floor(Math.log10(span)));
  const f = span / exp;
  if (f <= 1.0) return exp;
  if (f <= 2.0) return 2 * exp;
  if (f <= 5.0) return 5 * exp;
  return 10 * exp;
}

export default function Progress() {
  const user = storage.getUser();
  const [rows, setRows] = useState([]);
  const [exerciseList, setExerciseList] = useState([]);
  const [dynamicInput, setDynamicInput] = useState('');
  const [dynamicName, setDynamicName] = useState('');
  const [dynamicConfig, setDynamicConfig] = useState({ mode: '1rm', range: 'all' });

  // fixed cards config (mode & range) and collapsed state
  const [fixedConfigs, setFixedConfigs] = useState(() =>
    FIXED_EXERCISES.map(e => ({ exercise: e, mode: '1rm', range: 'all', expanded: false }))
  );

// pinned charts: array of { id, exercise, config: {mode, range}, expanded }
// Normalizes stored data so missing fields default to range: 'all' and expanded: false
const [pinnedCharts, setPinnedCharts] = useState(() => {
  try {
    const fromStorage = (storage && typeof storage.getPinnedCharts === 'function')
      ? storage.getPinnedCharts(user?.name)
      : null;
if (Array.isArray(fromStorage)) {
  // normalize and override defaults
  return fromStorage.map(p => ({
    id: p.id || `${(p.exercise||'pin').replace(/\s+/g,'_')}_${Date.now()}`,
    exercise: p.exercise || '',
    config: {
      mode: '1rm',
      range: 'all' // always default to All Time on load
    },
    expanded: false // always start collapsed
  }));
}
  } catch (e) {}
  try {
    const raw = localStorage.getItem(`pinnedCharts_${user?.name || 'anon'}`);
    const parsed = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed)) {
      return parsed.map(p => ({
        id: p.id || `${(p.exercise||'pin').replace(/\s+/g,'_')}_${Date.now()}`,
        exercise: p.exercise || '',
        config: {
          mode: '1rm',
          range: 'all'
        },
        expanded: false
      }));
    }
    return [];
  } catch (e) {
    return [];
  }
});

  // canvas refs & point caches
  const canvasRefs = useRef({});
  const canvasPoints = useRef({}); // key -> pixel points list

  // hovered (temporary) or selected (persistent) point
  const [hoveredPoint, setHoveredPoint] = useState(null); // { key, meta }
  const [selectedPoint, setSelectedPoint] = useState(null); // { key, meta }

  useEffect(() => {
    if (!user) { window.location.href = '/'; return; }
    const cached = storage.getCachedUserData(user.name) || [];
    setRows(cached);
    sheets.getUserData(user.name)
      .then(r => { storage.cacheUserData(user.name, r); setRows(r); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const list = Array.from(new Set((rows || []).map(r => r.exercise))).sort((a,b) => a?.localeCompare?.(b) ?? 0);
    setExerciseList(list);
  }, [rows]);

  function canonicalExercise(name) {
    if (!name) return '';
    const found = (exerciseList || []).find(e => e.toLowerCase() === name.toLowerCase());
    return found || name;
  }

  // persist pinned charts (helper wrapper that tries storage util then localStorage)
  function persistPinnedCharts(charts) {
    try {
      if (storage && typeof storage.savePinnedCharts === 'function') {
        storage.savePinnedCharts(user.name, charts);
        return;
      }
    } catch (e) {}
    try {
      localStorage.setItem(`pinnedCharts_${user?.name || 'anon'}`, JSON.stringify(charts));
    } catch (e) {}
  }

  // add a pin
// add a pin (ensures defaults for config and collapsed state)
function pinChart(exercise, config = {}) {
  if (!exercise) return;
  const id = `${exercise.replace(/\s+/g,'_')}_${Date.now()}`;
  const cfg = {
    mode: config.mode || '1rm',
    range: config.range || 'all'
  };
  const newPinned = [...pinnedCharts, { id, exercise, config: cfg, expanded: false }];
  setPinnedCharts(newPinned);
  persistPinnedCharts(newPinned);
}

  // remove a pin by id (asks caller to confirm if needed)
  function unpinChart(id) {
    const newPinned = pinnedCharts.filter(p => p.id !== id);
    setPinnedCharts(newPinned);
    persistPinnedCharts(newPinned);
    // cleanup canvas refs/points for removed id key (optional)
    const key = `pinned_${id}`;
    delete canvasRefs.current[key];
    delete canvasPoints.current[key];
  }

  // toggle pin for currently generated dynamic chart
  function togglePinDynamic() {
    if (!dynamicName) return;
    // check if exact same exercise+config already exists
    const match = pinnedCharts.find(p =>
      p.exercise === dynamicName &&
      p.config?.mode === dynamicConfig.mode &&
      p.config?.range === dynamicConfig.range
    );
    if (match) {
      if (confirm(`Unpin "${dynamicName}" (${dynamicConfig.range} / ${dynamicConfig.mode})?`)) {
        unpinChart(match.id);
      }
    } else {
      pinChart(dynamicName, dynamicConfig);
    }
  }

  // update pinned chart config (e.g., when user changes range/mode on a pinned card)
  function updatePinnedConfig(id, patch) {
    setPinnedCharts(prev => {
      const out = prev.map(p => p.id === id ? { ...p, config: { ...p.config, ...patch } } : p);
      persistPinnedCharts(out);
      return out;
    });
  }

  // toggle pinned expanded
  function togglePinnedExpanded(id, val) {
    setPinnedCharts(prev => {
      const out = prev.map(p => p.id === id ? { ...p, expanded: typeof val === 'boolean' ? val : !p.expanded } : p);
      persistPinnedCharts(out);
      return out;
    });
  }

  // --------------------------
  // point-limiting helper (keeps representative points and preserves peaks)
  // --------------------------
  function downsampleTimeSeries(pts, maxPts) {
    if (!Array.isArray(pts) || pts.length <= maxPts) return pts.slice();
    const reserve = 2;
    const bins = Math.max(3, maxPts - reserve);
    const binSize = Math.ceil(pts.length / bins);
    const picks = [];
    for (let i = 0; i < pts.length; i += binSize) {
      const slice = pts.slice(i, i + binSize);
      let best = slice[0];
      for (let s of slice) { if ((s.v || 0) > (best.v || 0)) best = s; }
      picks.push(best);
    }
    const last = pts[pts.length - 1];
    if (!picks.some(p => p.t && p.t.getTime() === last.t.getTime())) picks.push(last);
    let overallMax = pts[0];
    for (let p of pts) { if ((p.v || 0) > (overallMax.v || 0)) overallMax = p; }
    if (!picks.some(p => p.t && p.t.getTime() === overallMax.t.getTime())) picks.push(overallMax);
    picks.sort((a,b) => a.t - b.t);
    if (picks.length <= maxPts) return picks;
    const out = [];
    const step = Math.ceil(picks.length / maxPts);
    for (let i = 0; i < picks.length; i += step) out.push(picks[i]);
    if (out[out.length-1].t.getTime() !== picks[picks.length-1].t.getTime()) out.push(picks[picks.length-1]);
    return out.slice(0, maxPts);
  }

  // --------------------------
  // pointsForExercise
  // --------------------------
  function pointsForExercise(exName, rangeKey, mode) {
    if (!exName) return [];
    const canonical = canonicalExercise(exName);
    const rowsFor = (rows || []).filter(r => r && String(r.exercise).toLowerCase() === String(canonical).toLowerCase())
      .map(r => ({ ...r, ts: new Date(r.date).getTime() }))
      .sort((a,b) => a.ts - b.ts);

    if (!rowsFor.length) return [];

    const days = RANGES.find(rr => rr.key === rangeKey)?.days || 365;
    if (days >= 10000) {
      if (mode === 'weight') {
        return rowsFor.map(r => ({ reps: Number(r.reps) || 0, weight: Number(r.weight) || 0, raw: r }));
      }
      return rowsFor.map(r => ({ t: new Date(r.ts), v: calc1RM(r.weight, r.reps), raw: r }));
    }

    const lastTs = rowsFor[rowsFor.length - 1].ts;
    const cutoff = lastTs - days * 86400000;
    const filtered = rowsFor.filter(r => r.ts >= cutoff && r.ts <= lastTs);
    const useRows = filtered.length ? filtered : rowsFor.slice(Math.max(0, rowsFor.length - 20));

    if (mode === 'weight') {
      return useRows.map(r => ({ reps: Number(r.reps) || 0, weight: Number(r.weight) || 0, raw: r }));
    }
    return useRows.map(r => ({ t: new Date(r.ts), v: calc1RM(r.weight, r.reps), raw: r }));
  }

  // --------------------------
  // drawChart (uses downsampleTimeSeries for time-series)
  // --------------------------
  function drawChart(key, canvasEl, pts, mode = '1rm', height = 160) {
    if (!canvasEl || !(canvasEl instanceof HTMLCanvasElement)) {
      canvasPoints.current[key] = [];
      return;
    }

    const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#4f8cff';
    const secondary = getComputedStyle(document.documentElement).getPropertyValue('--secondary').trim() || '#ff6b6b';
    const muted = getComputedStyle(document.documentElement).getPropertyValue('--muted').trim() || '#a8acb8';

    canvasEl.style.width = '100%';
    canvasEl.style.height = `${height}px`;
    const clientW = Math.max(300, Math.round(canvasEl.clientWidth || 300));
    const cssH = height;
    const dpr = window.devicePixelRatio || 1;

    canvasEl.width = Math.floor(clientW * dpr);
    canvasEl.height = Math.floor(cssH * dpr);

    const ctx = canvasEl.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(1,0,0,1,0,0);
    ctx.scale(dpr, dpr);
    ctx.clearRect(0,0,clientW,cssH);

    if (!pts || !pts.length) {
      ctx.fillStyle = muted;
      ctx.font = '13px system-ui';
      ctx.fillText('No data', 12, 28);
      canvasPoints.current[key] = [];
      return;
    }

    const padLeft = 30;
    const padRight = 20;
    const padTop = 22;
    const padBottom = 28;
    const plotW = clientW - padLeft - padRight;
    const plotH = cssH - padTop - padBottom;

    if (mode !== 'weight') {
      const approx = Math.max(24, Math.floor(plotW / 6));
      const maxPts = Math.min(80, Math.max(24, approx));
      let sample = pts;
      if (pts.length > maxPts) sample = downsampleTimeSeries(pts, maxPts);

      const xs = sample.map(p => p.t.getTime());
      const ys = sample.map(p => p.v);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      let minY = Math.min(...ys);
      let maxY = Math.max(...ys);
      if (minY === maxY) { minY = Math.max(0, minY - 5); maxY = maxY + 5; }
      const spanY = maxY - minY;
      const rawStep = spanY / 4;
      let step = niceStep(rawStep); if (step <= 0) step = 1;
      const yMinTick = Math.floor(minY / step) * step;
      const yMaxTick = Math.ceil(maxY / step) * step;
      minY = yMinTick; maxY = yMaxTick;

      const xTo = (time) => padLeft + ((time - minX) / (maxX - minX || 1)) * plotW;
      const yTo = (val) => padTop + (plotH - ((val - minY) / (maxY - minY || 1)) * plotH);

      ctx.strokeStyle = muted;
      ctx.lineWidth = .2;
      ctx.font = '12px system-ui';
      ctx.fillStyle = muted;
      for (let y = minY; y <= maxY + 0.0001; y += step) {
        const yy = yTo(y);
        ctx.beginPath(); ctx.moveTo(padLeft, yy); ctx.lineTo(clientW - padRight, yy); ctx.stroke();
        ctx.fillText(String(y), 6, yy + 4);
      }

      const daysSpan = Math.max(1, Math.round((maxX - minX) / 86400000));
      const maxTicks = 6;
      const tickCount = Math.min(maxTicks, Math.max(2, Math.ceil(daysSpan / 15)));
      const tickDates = [];
      if (minX === maxX) {
        tickDates.push(new Date(minX));
      } else {
        for (let i = 0; i < tickCount; i++) {
          const t = new Date(minX + (i / (tickCount - 1)) * (maxX - minX));
          tickDates.push(t);
        }
      }

      ctx.textAlign = 'center'; ctx.fillStyle = muted; ctx.font = '11px system-ui';
      tickDates.forEach(d => {
        const x = xTo(d.getTime());
        let label;
        if (daysSpan <= 92) label = monthDayLabel(d);
        else if (daysSpan <= 400) label = monthLabel(d);
        else label = monthYearLabel(d);
        const clampedX = Math.max(padLeft, Math.min(clientW - padRight, x));
        ctx.fillText(label, clampedX, cssH - 8);
      });
      ctx.textAlign = 'start';

      ctx.strokeStyle = secondary; ctx.lineWidth = 2; ctx.beginPath();
      sample.forEach((p,i)=>{ const x=xTo(p.t.getTime()), y=yTo(p.v); if(i===0)ctx.moveTo(x,y); else ctx.lineTo(x,y); });
      ctx.stroke();

      ctx.fillStyle = accent;
      const radius = 3;
      const pixelPoints = sample.map((p) => {
        const x = xTo(p.t.getTime());
        const y = yTo(p.v);
        ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI*2); ctx.fill();
        return { x, y, meta: p };
      });
      canvasPoints.current[key] = pixelPoints;
      return;
    }

    // weight scatter mode
    const repsArr = pts.map(p => Number(p.reps || p.raw?.reps) || 0);
    const wArr = pts.map(p => Number(p.weight || p.raw?.weight) || 0);
    if (!repsArr.length) { canvasPoints.current[key] = []; return; }
    let minR = Math.min(...repsArr), maxR = Math.max(...repsArr);
    let minW = Math.min(...wArr), maxW = Math.max(...wArr);
    if (minR === maxR) { minR = Math.max(0, minR - 1); maxR = maxR + 1; }
    if (minW === maxW) { minW = Math.max(0, minW - 5); maxW = maxW + 5; }

    const xTo = (rep) => padLeft + ((rep - minR) / (maxR - minR || 1)) * plotW;
    const yTo = (weight) => padTop + (plotH - ((weight - minW) / (maxW - minW || 1)) * plotH);

    ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = 1; ctx.fillStyle = muted; ctx.font = '12px system-ui';
    const repSteps = Math.max(3, Math.min(8, Math.ceil((maxR - minR) / 1)));
    for (let i = 0; i <= repSteps; i++) {
      const rep = minR + (i / repSteps) * (maxR - minR);
      const x = xTo(rep);
      ctx.beginPath(); ctx.moveTo(x, padTop - 6); ctx.lineTo(x, padTop + plotH + 6); ctx.stroke();
      ctx.fillText(String(Math.round(rep)), x - 8, cssH - 8);
    }

    const wSpan = maxW - minW;
    const wStep = niceStep(wSpan / 4);
    for (let w = Math.floor(minW); w <= Math.ceil(maxW + 0.0001); w += Math.max(1, wStep)) {
      const y = yTo(w);
      ctx.beginPath(); ctx.moveTo(padLeft, y); ctx.lineTo(clientW - padRight, y); ctx.stroke();
      ctx.fillText(String(Math.round(w)), 6, y + 4);
    }

    ctx.fillStyle = secondary;
    const radius = 4;
    const pixelPoints = pts.map(p => {
      const rep = Number(p.reps || p.raw?.reps) || 0;
      const weight = Number(p.weight || p.raw?.weight) || 0;
      const x = xTo(rep);
      const y = yTo(weight);
      ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fill();
      return { x, y, meta: p };
    });

    canvasPoints.current[key] = pixelPoints;
  }

  // redraw charts when source data or configs change (handles dynamic, fixed, pinned)
  useEffect(() => {
    // dynamic
    if (dynamicName) {
      const key = 'dynamic';
      const canvas = canvasRefs.current[key];
      const pts = pointsForExercise(dynamicName, dynamicConfig.range, dynamicConfig.mode);
      drawChart(key, canvas, pts, dynamicConfig.mode, 200);
    } else {
      const key = 'dynamic';
      const canvas = canvasRefs.current[key];
      if (canvas && canvas.getContext) {
        const ctx = canvas.getContext('2d'); if (ctx) ctx.clearRect(0,0,canvas.width||0, canvas.height||0);
      }
      canvasPoints.current['dynamic'] = [];
    }

    // fixed
    fixedConfigs.forEach((cfg, idx) => {
      const key = `fixed_${idx}`;
      const canvas = canvasRefs.current[key];
      const pts = pointsForExercise(cfg.exercise, cfg.range, cfg.mode);
      drawChart(key, canvas, pts, cfg.mode, 160);
    });

    // pinned
    pinnedCharts.forEach((p) => {
      const key = `pinned_${p.id}`;
      const canvas = canvasRefs.current[key];
      const pts = pointsForExercise(p.exercise, p.config.range, p.config.mode);
      drawChart(key, canvas, pts, p.config.mode, 160);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, fixedConfigs, dynamicName, dynamicConfig, pinnedCharts]);

  // pointer handlers: hover sets hoveredPoint for top-right label, click toggles persistent selection
  useEffect(() => {
    const handlers = [];
    Object.keys(canvasRefs.current || {}).forEach(key => {
      const canvas = canvasRefs.current[key];
      if (!canvas || !(canvas instanceof HTMLCanvasElement)) return;

      const onMove = (ev) => {
        const rect = canvas.getBoundingClientRect();
        const px = ev.clientX - rect.left;
        const py = ev.clientY - rect.top;
        const pts = canvasPoints.current[key] || [];
        if (!pts.length) { setHoveredPoint(h => (h && h.key === key ? null : h)); return; }
        let best = null; let bestDist = Infinity;
        for (let i=0;i<pts.length;i++){
          const p = pts[i];
          const d = Math.hypot(p.x - px, p.y - py);
          if (d < bestDist) { bestDist = d; best = p; }
        }
        const TH = 12;
        if (best && bestDist <= TH) {
          setHoveredPoint({ key, meta: best.meta });
        } else {
          setHoveredPoint(h => (h && h.key === key ? null : h));
        }
      };

      const onLeave = () => {
        setHoveredPoint(h => (h && h.key === key ? null : h));
      };

      const onDown = (ev) => {
        const rect = canvas.getBoundingClientRect();
        const px = ev.clientX - rect.left;
        const py = ev.clientY - rect.top;
        const pts = canvasPoints.current[key] || [];
        if (!pts.length) {
          if (selectedPoint && selectedPoint.key === key) setSelectedPoint(null);
          return;
        }
        let best = null; let bestDist = Infinity;
        for (let i=0;i<pts.length;i++){
          const p = pts[i];
          const d = Math.hypot(p.x - px, p.y - py);
          if (d < bestDist) { bestDist = d; best = p; }
        }
        const TH = 14;
        if (best && bestDist <= TH) {
          if (selectedPoint && selectedPoint.key === key && selectedPoint.meta === best.meta) {
            setSelectedPoint(null);
          } else {
            setSelectedPoint({ key, meta: best.meta });
          }
        } else {
          if (selectedPoint && selectedPoint.key === key) setSelectedPoint(null);
        }
      };

      canvas.addEventListener('pointermove', onMove);
      canvas.addEventListener('pointerleave', onLeave);
      canvas.addEventListener('pointerdown', onDown);
      handlers.push(() => {
        canvas.removeEventListener('pointermove', onMove);
        canvas.removeEventListener('pointerleave', onLeave);
        canvas.removeEventListener('pointerdown', onDown);
      });
    });

    return () => handlers.forEach(h => h());
    // NOTE: include dynamicName/dynamicConfig/pinnedCharts so canvases get listeners when created/changed
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, fixedConfigs, dynamicName, dynamicConfig, pinnedCharts, selectedPoint]);

  function updateFixedConfig(i, patch) {
    setFixedConfigs(prev => prev.map((p, idx) => idx === i ? { ...p, ...patch } : p));
  }

  // IMPORTANT: summary ALWAYS uses ALL-TIME data now
  function summaryFor(cfg) {
    const ptsAll = pointsForExercise(cfg.exercise, 'all', cfg.mode);
    if (!ptsAll.length) return { current: 0, best: 0, extra: {} };
    if (cfg.mode === 'weight') {
      let heaviest = ptsAll[0], mostReps = ptsAll[0];
      ptsAll.forEach(p => {
        const w = Number(p.weight || p.raw?.weight) || 0;
        const r = Number(p.reps || p.raw?.reps) || 0;
        if (w > (Number(heaviest.weight || heaviest.raw?.weight) || 0)) heaviest = p;
        if (r > (Number(mostReps.reps || mostReps.raw?.reps) || 0)) mostReps = p;
      });
      const last = ptsAll[ptsAll.length - 1];
      return {
        current: Math.round(Number(last.weight || last.raw?.weight) || 0),
        best: Math.round(Number(heaviest.weight || heaviest.raw?.weight) || 0),
        extra: { heaviest, mostReps }
      };
    }
    const last = ptsAll[ptsAll.length - 1];
    const current = Math.round(last.v || 0);
    const best = Math.round(Math.max(...ptsAll.map(p => p.v || 0)));
    return { current, best, extra: {} };
  }

  // rendering
  // showMeta helpers for dynamic area
  const dynamicShowMeta = (selectedPoint && selectedPoint.key === 'dynamic') ? selectedPoint.meta
    : (hoveredPoint && hoveredPoint.key === 'dynamic' ? hoveredPoint.meta : null);

  // helper to determine if dynamic chart is pinned (same exercise+config)
  const dynamicIsPinned = pinnedCharts.some(p =>
    p.exercise === dynamicName &&
    p.config?.mode === dynamicConfig.mode &&
    p.config?.range === dynamicConfig.range
  );

  return (
    <div
      className="grid fade-in"
      style={{
        gap: 10,
        overflowX: 'hidden',
        paddingLeft: 1,
        paddingRight: 1,
        paddingTop: 10,
        boxSizing: 'border-box',
        width: '100%',
        maxWidth: '100vw'
      }}
    >
      {/* Dynamic generator */}
      <div
        className="card"
        style={{
          padding: 10,
          boxSizing: 'border-box',
          width: '100%',
          maxWidth: 960,
          margin: '0 auto',
          overflow: 'hidden',
          position: 'relative' // allow absolute meta box inside
        }}
      >
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div style={{ fontSize: 18, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Generate Chart</div>
        </div>

        <div style={{ display:'flex', gap:8, marginTop:10, alignItems:'center' }}>
          <input
            placeholder="Exercise name..."
            value={dynamicInput}
            onChange={e => setDynamicInput(e.target.value)}
            list="ex-list-main"
            style={{ flex:1, padding:'8px 10px', borderRadius:8, border:'1px solid var(--input-border)', background:'var(--input-bg)', color:'var(--text)' }}
          />
          <datalist id="ex-list-main">{exerciseList.map(e => <option key={e} value={e} />)}</datalist>
        </div>

        {/* Generate/Clear under the input */}
        <div style={{ display:'flex', gap:8, marginTop:8 }}>
          <button className="primary" onClick={() => {
            const name = canonicalExercise(dynamicInput || '');
            if (!name) return;
            setDynamicName(name);
          }} style={{ flex: 1 }}>Generate</button>
          <button className="ghost" onClick={() => { setDynamicName(''); setDynamicInput(''); }} style={{ flex: 1 }}>Clear</button>
        </div>

{/* Dynamic chart block */}
<div style={{ marginTop: 12 }}>
  {dynamicName ? (
    <>
      {/* Title on its own line */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{
          fontWeight: 700,
          fontSize: 16,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          flex: 1,
          minWidth: 0
        }}>
          {dynamicName}
        </div>

        {/* star control — fixed-size area that won't be pushed */}
        <div style={{ flexShrink: 0 }}>
          <button
            className="ghost"
            onClick={togglePinDynamic}
            title={dynamicIsPinned ? 'Unpin chart' : 'Pin chart'}
            style={{
              borderColor: dynamicIsPinned ? 'var(--accent)' : undefined,
              fontWeight: 700,
              padding: '6px 10px',
              borderRadius: 8,
              fontSize: 18,
              lineHeight: 1,
              minWidth: 44,
              textAlign: 'center',
            }}
          >
            {dynamicIsPinned ? '★' : '☆'}
          </button>
        </div>
      </div>

      {/* Controls row: range selector on left, mode buttons on right (below the title) */}
      <div style={{
        marginTop: 8,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
          <select
            value={dynamicConfig.range}
            onChange={e => setDynamicConfig(c => ({ ...c, range: e.target.value }))}
            style={{ padding: '6px 8px', borderRadius: 8 }}
          >
            {RANGES.map(r => <option key={r.key} value={r.key}>{r.label}</option>)}
          </select>

        <div style={{ display: 'flex', gap: 6 }}>
          <button
            className="ghost"
            onClick={() => setDynamicConfig(c => ({ ...c, mode: '1rm' }))}
            style={{ borderColor: dynamicConfig.mode === '1rm' ? 'var(--accent)' : undefined }}
          >
            1RM
          </button>
          <button
            className="ghost"
            onClick={() => setDynamicConfig(c => ({ ...c, mode: 'weight' }))}
            style={{ borderColor: dynamicConfig.mode === 'weight' ? 'var(--accent)' : undefined }}
          >
            Weight
          </button>
        </div>

        {/* Top-right persistent label — same functionality as fixed cards */}
        {dynamicShowMeta && (
          <div style={{
            position: 'absolute', right: 10, top: 140,
            background: 'var(--panel)', border: '1px solid var(--card-border)', padding: '8px 10px',
            borderRadius: 10, zIndex: 20, minWidth: 160, textAlign:'left'
          }}>
            <div style={{ color: 'var(--muted)', fontSize: 12 }}>{shortDate(new Date(dynamicShowMeta.raw?.date || dynamicShowMeta.t || Date.now()))}</div>
            <div style={{ fontWeight: 800, color: 'var(--secondary)', fontSize: 15, marginTop: 6 }}>
              {dynamicConfig.mode === 'weight'
                ? `${Math.round(dynamicShowMeta.weight || dynamicShowMeta.raw?.weight || 0)} lb × ${Math.round(dynamicShowMeta.reps || dynamicShowMeta.raw?.reps || 0)}`
                : `${Math.round(dynamicShowMeta.v || calc1RM(dynamicShowMeta.raw?.weight, dynamicShowMeta.raw?.reps) || 0)} est 1RM`}
            </div>
            {dynamicConfig.mode !== 'weight' && (dynamicShowMeta.raw?.weight || dynamicShowMeta.raw?.reps) && (
              <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 6 }}>
                {Math.round(dynamicShowMeta.raw?.weight || 0)} lb × {String(dynamicShowMeta.raw?.reps || '')}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Chart (container positioned relative so the meta popup can be absolute inside it) */}
      <div style={{ position: 'relative', marginTop: 10 }}>
        <canvas
          ref={el => { canvasRefs.current['dynamic'] = el; }}
          style={{ width: '100%', maxWidth: '100%', height: 200, display: 'block', boxSizing: 'border-box' }}
        />
      </div>

      {/* bottom stats (current / all-time best) */}
      <div style={{ display:'flex', gap:16, marginTop:10, justifyContent:'center' }}>
        <div style={{ width:'50%', textAlign:'center' }}>
          <div style={{ color:'var(--accent)', fontWeight:700 }}>Current</div>
          <div style={{ color:'var(--text)', fontWeight:800, fontSize:18 }}>
            {(() => {
              const ptsAll = pointsForExercise(dynamicName, 'all', dynamicConfig.mode);
              if (!ptsAll.length) return 0;
              if (dynamicConfig.mode === 'weight') return Math.round(ptsAll[ptsAll.length-1].weight || ptsAll[ptsAll.length-1].raw?.weight || 0);
              return Math.round(ptsAll[ptsAll.length-1].v || 0);
            })()}
          </div>
        </div>
        <div style={{ width:'50%', textAlign:'center' }}>
          <div style={{ color:'var(--accent)', fontWeight:700 }}>All-time Best</div>
          <div style={{ color:'var(--text)', fontWeight:800, fontSize:18 }}>
            {(() => {
              const ptsAll = pointsForExercise(dynamicName, 'all', dynamicConfig.mode);
              if (!ptsAll.length) return 0;
              if (dynamicConfig.mode === 'weight') {
                return Math.round(Math.max(...ptsAll.map(p => Number(p.weight || p.raw?.weight || 0))));
              }
              return Math.round(Math.max(...ptsAll.map(p => p.v || 0)));
            })()}
          </div>
        </div>
      </div>
    </>
  ) : (
    <div style={{ color:'var(--muted)', padding:'1px 6px' }}>
    </div>
  )}
</div>
      </div>

      {/* Fixed collapsible cards */}
      {fixedConfigs.map((cfg, idx) => {
        const key = `fixed_${idx}`;
        const sum = summaryFor(cfg);
        const isExpanded = !!cfg.expanded;
        const showMeta = (selectedPoint && selectedPoint.key === key) ? selectedPoint.meta : (hoveredPoint && hoveredPoint.key === key ? hoveredPoint.meta : null);

        return (
          <div
            key={key}
            className="card"
            style={{
              padding: 10,
              boxSizing: 'border-box',
              width: '100%',
              maxWidth: 960,
              margin: '2px auto',
              position: 'relative',
              overflow: 'hidden'
            }}
          >
            <div style={{ display:'flex', flexDirection:'column' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8 }}>
                <button
                  onClick={() => updateFixedConfig(idx, { expanded: !cfg.expanded })}
                  style={{
                    background:'transparent',
                    border:'none',
                    fontWeight:600,
                    fontSize:16,
                    textAlign:'left',
                    flex:1,
                    cursor:'pointer',
                    whiteSpace:'nowrap',
                    overflow:'hidden',
                    textOverflow:'ellipsis',
                    minWidth: 0
                  }}
                >
                  {cfg.exercise}
                </button>
              </div>

              {/* NOTE: controls (range + mode) now show only when expanded */}
            </div>

            {/* expanded area contains controls + chart + bottom stats */}
            {isExpanded && (
              <>
                <div style={{ marginTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <select value={cfg.range} onChange={e => updateFixedConfig(idx, { range: e.target.value })} style={{ padding: '6px 8px', borderRadius:8 }}>
                      {RANGES.map(r => <option key={r.key} value={r.key}>{r.label}</option>)}
                    </select>
                  </div>

                  <div style={{ display:'flex', gap:6 }}>
                    <button className="ghost" onClick={() => updateFixedConfig(idx, { mode: '1rm' })} style={{ borderColor: cfg.mode === '1rm' ? 'var(--accent)' : undefined }}>1RM</button>
                    <button className="ghost" onClick={() => updateFixedConfig(idx, { mode: 'weight' })} style={{ borderColor: cfg.mode === 'weight' ? 'var(--accent)' : undefined }}>Weight</button>
                  </div>
                </div>

                <div style={{ marginTop: 10 }}>
                  <canvas
                    ref={el => { canvasRefs.current[key] = el; }}
                    style={{ width: '100%', maxWidth: '100%', height: 160, display: 'block', boxSizing: 'border-box' }}
                  />
                </div>

                {/* bottom stats split left/right */}
                <div style={{ display: 'flex', marginTop: 10 }}>
                  <div style={{ flex: 1, display:'flex', justifyContent:'center' }}>
                    <div style={{ textAlign:'center' }}>
                      <div style={{ color:'var(--accent)', fontWeight:700 }}>{cfg.mode === 'weight' ? 'Heaviest' : 'Current 1RM'}</div>
                      <div style={{ color:'var(--text)', fontWeight:800, fontSize:16 }}>
                        {cfg.mode === 'weight'
                          ? (sum.extra?.heaviest ? `${Math.round(sum.extra.heaviest.weight || sum.extra.heaviest.raw?.weight || 0)} lb × ${Math.round(sum.extra.heaviest.reps || sum.extra.heaviest.raw?.reps || 0)}` : '—')
                          : (sum.current || 0)}
                      </div>
                    </div>
                  </div>

                  <div style={{ flex: 1, display:'flex', justifyContent:'center' }}>
                    <div style={{ textAlign:'center' }}>
                      <div style={{ color:'var(--accent)', fontWeight:700 }}>{cfg.mode === 'weight' ? 'Most reps' : 'All-time 1RM'}</div>
                      <div style={{ color:'var(--text)', fontWeight:800, fontSize:16 }}>
                        {cfg.mode === 'weight'
                          ? (sum.extra?.mostReps ? `${Math.round(sum.extra.mostReps.reps || sum.extra.mostReps.raw?.reps || 0)} × ${Math.round(sum.extra.mostReps.weight || sum.extra.mostReps.raw?.weight || 0)} lb` : '—')
                          : (sum.best || 0)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Top-right persistent label — appears on hover or click */}
                {showMeta && (
                  <div style={{
                    position: 'absolute', right: 10, top: 10,
                    background: 'var(--panel)', border: '1px solid var(--card-border)', padding: '8px 10px',
                    borderRadius: 10, zIndex: 20, minWidth: 160, textAlign:'left'
                  }}>
                    <div style={{ color: 'var(--muted)', fontSize: 12 }}>{shortDate(new Date(showMeta.raw?.date || showMeta.t || Date.now()))}</div>
                    <div style={{ fontWeight: 800, color: 'var(--secondary)', fontSize: 15, marginTop: 6 }}>
                      {cfg.mode === 'weight'
                        ? `${Math.round(showMeta.weight || showMeta.raw?.weight || 0)} lb × ${Math.round(showMeta.reps || showMeta.raw?.reps || 0)}`
                        : `${Math.round(showMeta.v || calc1RM(showMeta.raw?.weight, showMeta.raw?.reps) || 0)} est 1RM`}
                    </div>
                    {cfg.mode !== 'weight' && (showMeta.raw?.weight || showMeta.raw?.reps) && (
                      <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 6 }}>
                        {Math.round(showMeta.raw?.weight || 0)} lb × {String(showMeta.raw?.reps || '')}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        );
      })}

      {/* Pinned charts section */}
      {pinnedCharts.length > 0 && (
        <div style={{ width: '100%', maxWidth: 960, marginTop: -12, boxSizing: 'border-box' }}>


          {pinnedCharts.map((p) => {
            const key = `pinned_${p.id}`;
            // synthesize a cfg object for summaryFor (uses all-time)
            const cfg = { exercise: p.exercise, mode: p.config.mode, range: p.config.range, expanded: !!p.expanded };
            const sum = summaryFor(cfg);
            const isExpanded = !!p.expanded;
            const showMeta = (selectedPoint && selectedPoint.key === key) ? selectedPoint.meta : (hoveredPoint && hoveredPoint.key === key ? hoveredPoint.meta : null);

            return (
              <div
                key={key}
                className="card"
                style={{
                  padding: 10,
                  boxSizing: 'border-box',
                  width: '100%',
                  minWidth: 0,
                  maxWidth: '91vw',
                  margin: '15px auto', // same spacing as fixed cards
                  position: 'relative',
                  overflow: 'hidden'
                }}
              >
                <div style={{ display:'flex', flexDirection:'column' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                      <button
                        onClick={() => togglePinnedExpanded(p.id)}
                        style={{
                          background:'transparent',
                          border:'none',
                          fontWeight:600,
                          fontSize:16,
                          textAlign:'left',
                          flex:1,
                          cursor:'pointer',
                          whiteSpace:'nowrap',
                          overflow:'hidden',
                          textOverflow:'ellipsis',
                          minWidth: 0
                        }}
                      >
                        {p.exercise}
                      </button>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                      {/* Unpin star (confirm) */}
                      <button
                        className="ghost"
                        onClick={() => {
                          if (confirm(`Unpin "${p.exercise}"?`)) unpinChart(p.id);
                        }}
                        title="Unpin"
                        style={{ fontSize: 16, padding: '0px 0px', borderRadius: 8, minWidth: 30 }}
                      >
                        ★
                      </button>
                    </div>
                  </div>
                </div>

                {/* expanded area contains controls + chart + bottom stats */}
                {isExpanded && (
                  <>
                    <div style={{ marginTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <select value={p.config.range} onChange={e => updatePinnedConfig(p.id, { range: e.target.value })} style={{ padding: '6px 8px', borderRadius:8 }}>
                          {RANGES.map(r => <option key={r.key} value={r.key}>{r.label}</option>)}
                        </select>
                      </div>

                      <div style={{ display:'flex', gap:6 }}>
                        <button className="ghost" onClick={() => updatePinnedConfig(p.id, { mode: '1rm' })} style={{ borderColor: p.config.mode === '1rm' ? 'var(--accent)' : undefined }}>1RM</button>
                        <button className="ghost" onClick={() => updatePinnedConfig(p.id, { mode: 'weight' })} style={{ borderColor: p.config.mode === 'weight' ? 'var(--accent)' : undefined }}>Weight</button>
                      </div>
                    </div>

                    <div style={{ marginTop: 10 }}>
                      <canvas
                        ref={el => { canvasRefs.current[key] = el; }}
                        style={{ width: '100%', maxWidth: '100%', height: 160, display: 'block', boxSizing: 'border-box' }}
                      />
                    </div>

                    {/* bottom stats split left/right */}
                    <div style={{ display: 'flex', marginTop: 10 }}>
                      <div style={{ flex: 1, display:'flex', justifyContent:'center' }}>
                        <div style={{ textAlign:'center' }}>
                          <div style={{ color:'var(--accent)', fontWeight:700 }}>{p.config.mode === 'weight' ? 'Heaviest' : 'Current 1RM'}</div>
                          <div style={{ color:'var(--text)', fontWeight:800, fontSize:16 }}>
                            {p.config.mode === 'weight'
                              ? (sum.extra?.heaviest ? `${Math.round(sum.extra.heaviest.weight || sum.extra.heaviest.raw?.weight || 0)} lb × ${Math.round(sum.extra.heaviest.reps || sum.extra.heaviest.raw?.reps || 0)}` : '—')
                              : (sum.current || 0)}
                          </div>
                        </div>
                      </div>

                      <div style={{ flex: 1, display:'flex', justifyContent:'center' }}>
                        <div style={{ textAlign:'center' }}>
                          <div style={{ color:'var(--accent)', fontWeight:700 }}>{p.config.mode === 'weight' ? 'Most reps' : 'All-time 1RM'}</div>
                          <div style={{ color:'var(--text)', fontWeight:800, fontSize:16 }}>
                            {p.config.mode === 'weight'
                              ? (sum.extra?.mostReps ? `${Math.round(sum.extra.mostReps.reps || sum.extra.mostReps.raw?.reps || 0)} × ${Math.round(sum.extra.mostReps.weight || sum.extra.mostReps.raw?.weight || 0)} lb` : '—')
                              : (sum.best || 0)}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Top-right persistent label — appears on hover or click */}
                    {showMeta && (
                      <div style={{
                        position: 'absolute', right: 10, top: 10,
                        background: 'var(--panel)', border: '1px solid var(--card-border)', padding: '8px 10px',
                        borderRadius: 10, zIndex: 20, minWidth: 160, textAlign:'left'
                      }}>
                        <div style={{ color: 'var(--muted)', fontSize: 12 }}>{shortDate(new Date(showMeta.raw?.date || showMeta.t || Date.now()))}</div>
                        <div style={{ fontWeight: 800, color: 'var(--secondary)', fontSize: 15, marginTop: 6 }}>
                          {p.config.mode === 'weight'
                            ? `${Math.round(showMeta.weight || showMeta.raw?.weight || 0)} lb × ${Math.round(showMeta.reps || showMeta.raw?.reps || 0)}`
                            : `${Math.round(showMeta.v || calc1RM(showMeta.raw?.weight, showMeta.raw?.reps) || 0)} est 1RM`}
                        </div>
                        {p.config.mode !== 'weight' && (showMeta.raw?.weight || showMeta.raw?.reps) && (
                          <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 6 }}>
                            {Math.round(showMeta.raw?.weight || 0)} lb × {String(showMeta.raw?.reps || '')}
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
