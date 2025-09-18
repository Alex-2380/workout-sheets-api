// pages/games/flappy.js
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

/* ---------- color helpers (robust for hex/rgb/rgba/hsl/hsla/css names) ---------- */

// parse hsl/hsla strings like "hsl(210 50% 40%)" or "hsl(210,50%,40%)" (with optional alpha)
function parseHslString(hsl) {
  if (!hsl) return null;
  const s = String(hsl).trim();
  // support both "hsl(210 50% 40%)" and "hsl(210,50%,40%)" and hsla variants
  const m = s.match(/hsla?\(\s*([0-9.+-]+)(?:deg)?[\s,]+([0-9.]+)%[\s,]+([0-9.]+)%(?:[\s,\/]+([0-9.]+))?/i);
  if (!m) return null;
  const h = ((parseFloat(m[1]) % 360) + 360) % 360;
  const sPct = Math.max(0, Math.min(100, parseFloat(m[2])));
  const lPct = Math.max(0, Math.min(100, parseFloat(m[3])));
  return { h, s: sPct / 100, l: lPct / 100, a: m[4] ? parseFloat(m[4]) : 1 };
}
function hslToRgb(h, s, l) {
  const hh = h / 360;
  if (s === 0) {
    const v = Math.round(l * 255);
    return [v, v, v];
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  function hue2rgb(pv, qv, t) {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return pv + (qv - pv) * 6 * t;
    if (t < 1 / 2) return qv;
    if (t < 2 / 3) return pv + (qv - pv) * (2 / 3 - t) * 6;
    return pv;
  }
  const r = hue2rgb(p, q, hh + 1 / 3);
  const g = hue2rgb(p, q, hh);
  const b = hue2rgb(p, q, hh - 1 / 3);
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

// convert css color string to rgb number triple
function parseColorToRgb(color) {
  if (!color) return [255, 255, 255];
  const s = String(color).trim();

  // hex
  if (s.startsWith('#')) {
    const hex = s.slice(1);
    if (hex.length === 3) {
      return [
        parseInt(hex[0] + hex[0], 16),
        parseInt(hex[1] + hex[1], 16),
        parseInt(hex[2] + hex[2], 16)
      ];
    } else if (hex.length === 6) {
      return [
        parseInt(hex.slice(0, 2), 16),
        parseInt(hex.slice(2, 4), 16),
        parseInt(hex.slice(4, 6), 16)
      ];
    }
  }

  // rgb/rgba
  if (s.startsWith('rgb')) {
    const m = s.match(/rgba?\(\s*([0-9.]+)[,\s]+([0-9.]+)[,\s]+([0-9.]+)/i);
    if (m) return [Number(m[1]), Number(m[2]), Number(m[3])];
  }

  // hsl/hsla
  if (s.startsWith('hsl')) {
    const parsed = parseHslString(s);
    if (parsed) return hslToRgb(parsed.h, parsed.s, parsed.l);
  }

  // fallback: use browser to normalize (handles CSS variable values / named colors)
  if (typeof document !== 'undefined') {
    try {
      const tmp = document.createElement('div');
      tmp.style.color = s;
      tmp.style.display = 'none';
      document.body.appendChild(tmp);
      const cs = getComputedStyle(tmp).color;
      document.body.removeChild(tmp);
      const m = cs.match(/rgba?\(\s*([0-9.]+)[,\s]+([0-9.]+)[,\s]+([0-9.]+)/i);
      if (m) return [Number(m[1]), Number(m[2]), Number(m[3])];
    } catch (e) {
      // ignore
    }
  }

  return [255, 255, 255];
}

function rgbToString(r, g, b) {
  return `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
}

/**
 * lightenColor
 * - If color is HSL/HSLA, increases lightness (L) by `hslAddPct` percent (default +12)
 * - Otherwise converts to RGB and *adds* `rgbAmt` to each channel (default +40)
 * - IMPORTANT: If input is HSL/HSLA we return an HSL(A) string (so HSL inputs remain HSL).
 */
function lightenColor(color, amt = 12) {
  if (!color) return 'rgb(255,255,255)';
  const s = String(color).trim();
  // HSL input: directly increase the L percent and preserve alpha
  if (s.startsWith('hsl')) {
    const parsed = parseHslString(s);
    if (parsed) {
      const addPct = (typeof amt === 'number' && amt >= 0) ? amt : 12;
      const newL = Math.min(100, Math.round(parsed.l * 100 + addPct));
      const sPct = Math.round(parsed.s * 100);
      if (parsed.a !== undefined && parsed.a < 1) {
        return `hsla(${Math.round(parsed.h)} ${sPct}% ${newL}% / ${parsed.a})`;
      }
      return `hsl(${Math.round(parsed.h)} ${sPct}% ${newL}%)`;
    }
  }

  // fallback: rgb/hex conversion and simple additive brighten
  const [r, g, b] = parseColorToRgb(color);
  const add = (typeof amt === 'number' && amt > 0) ? Math.round(amt * (1)) : 40;
  return rgbToString(Math.min(255, r + add), Math.min(255, g + add), Math.min(255, b + add));
}

/* ---------- Flappy component ---------- */
export default function FlappyGame() {
  const outerRef = useRef(null);
  const wrapperRef = useRef(null);
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const lastTimeRef = useRef(0);

  const stateRef = useRef(null);
  const phaseRef = useRef('menu'); // 'menu' | 'playing' | 'dying' | 'dead'
  const deadPopupTimerRef = useRef(null);
  const timeoutIdsRef = useRef([]);

  const audioRef = useRef({ ctx: null });

  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const bestRef = useRef(0);
  const [gamePhase, setGamePhase] = useState('menu');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPseudoFullscreen, setIsPseudoFullscreen] = useState(false);

  // UI button vertical placement
  const [uiButtonsTop, setUiButtonsTop] = useState(44);

  useEffect(() => { bestRef.current = best; }, [best]);

  useEffect(() => {
    stateRef.current = {
      designW: 360,
      designH: 700,
      scale: 1,
      gravity: 0.28,
      flapStrength: -6.6,
      birdX: 68,
      birdY: 0,
      birdVy: 0,
      birdSizeBase: 28,
      pipes: [],
      pipeWidthBase: 56,
      pipeGapBase: 150,
      pipeSpeedBase: 2.6,
      pipeSpeed: 2.6,
      spawnIntervalFrames: 94,
      spawnTimerFrames: 0,
      ticks: 0,
      scrollX: 0,
      groundOffset: 0,
      score: 0,
      deadTimerStarted: false,
      _hitSoundPlayed: false,
      _groundSoundPlayed: false,
      stripeTopBandH: 12,
      stripeSpacing: 28,
      wingFlapTicks: 0,
      wingFlapTicksMax: 30,
      accentColor: '#FFD966',
      secondaryColor: '#f39c12'
    };
  }, []);

  useEffect(() => {
    try { const b = parseInt(localStorage.getItem('flappy_best') || '0', 10) || 0; setBest(b); } catch (e) {}
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrapper = wrapperRef.current;
    const outer = outerRef.current;
    if (!canvas || !wrapper || !outer) return;
    const ctx = canvas.getContext('2d');

    // audio helpers
    function ensureAudio() {
      if (!audioRef.current.ctx && typeof window !== 'undefined') {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (Ctx) audioRef.current.ctx = new Ctx();
      }
    }
    function resumeAudioIfSuspended() {
      try {
        ensureAudio();
        const ctxA = audioRef.current.ctx;
        if (ctxA && ctxA.state === 'suspended') ctxA.resume().catch(() => {});
      } catch (e) {}
    }
    function playFlap() {
      ensureAudio();
      const ctxA = audioRef.current.ctx;
      if (!ctxA) return;
      const now = ctxA.currentTime;
      const o = ctxA.createOscillator();
      const g = ctxA.createGain();
      o.type = 'triangle';
      o.frequency.setValueAtTime(720, now);
      o.frequency.exponentialRampToValueAtTime(1250, now + 0.06);
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(0.5, now + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
      o.connect(g); g.connect(ctxA.destination);
      o.start(now); o.stop(now + 0.18);
    }
    function playCoin() {
      ensureAudio();
      const ctxA = audioRef.current.ctx;
      if (!ctxA) return;
      const now = ctxA.currentTime;
      const o = ctxA.createOscillator();
      const g = ctxA.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(650, now);
      o.frequency.exponentialRampToValueAtTime(1200, now + 0.18);
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(0.7, now + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
      o.connect(g); g.connect(ctxA.destination);
      o.start(now); o.stop(now + 0.3);
    }
    function playThud() {
      ensureAudio();
      const ctxA = audioRef.current.ctx;
      if (!ctxA) return;
      const now = ctxA.currentTime;
      const o = ctxA.createOscillator();
      const g = ctxA.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(140, now);
      o.frequency.exponentialRampToValueAtTime(32, now + 0.22);
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(1.1, now + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);
      o.connect(g); g.connect(ctxA.destination);
      o.start(now); o.stop(now + 0.6);
    }

    function clearPendingTimeouts() {
      timeoutIdsRef.current.forEach((id) => clearTimeout(id));
      timeoutIdsRef.current = [];
      if (deadPopupTimerRef.current) { clearTimeout(deadPopupTimerRef.current); deadPopupTimerRef.current = null; }
    }

    // layout/resizing
    function resize() {
      const st = stateRef.current;
      if (!st) return;
      const designW = st.designW, designH = st.designH;
      const fs = isFullscreen || isPseudoFullscreen;
      const pad = fs ? 0 : 8;
      const availW = Math.max(320, window.innerWidth - pad * 2);
      const availH = Math.max(480, window.innerHeight - pad * 2);
      const scale = Math.min(availW / designW, availH / designH);
      st.scale = scale;

      const cssWidth = Math.round(designW * scale);
      const cssHeight = Math.round(designH * scale);

      canvas.style.width = cssWidth + 'px';
      canvas.style.height = cssHeight + 'px';

      const ratio = Math.max(1, window.devicePixelRatio || 1);
      canvas.width = Math.round(cssWidth * ratio);
      canvas.height = Math.round(cssHeight * ratio);
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

      st.widthCss = cssWidth;
      st.heightCss = cssHeight;

      // derived sizes
      st.pipeWidth = Math.max(40, Math.round(st.pipeWidthBase * scale));
      st.pipeGap = Math.max(110, Math.round(st.pipeGapBase * scale));
      st.pipeSpeed = Math.max(1.2, st.pipeSpeedBase * scale);
      st.birdSize = Math.max(20, Math.round(st.birdSizeBase * scale));
      st.birdX = Math.max(48 * scale, Math.round(68 * scale));
      if (!st.birdY) st.birdY = Math.round(cssHeight / 2);

      st.stripeTopBandH = Math.max(14 * st.scale, 12 * st.scale);
      st.stripeSpacing = Math.max(28 * st.scale, 20 * st.scale);

      // read app css variables for colors
      try {
        const root = getComputedStyle(document.documentElement);
        const acc = root.getPropertyValue('--accent')?.trim();
        const sec = root.getPropertyValue('--secondary')?.trim();
        if (acc) st.accentColor = acc;
        if (sec) st.secondaryColor = sec;
      } catch (e) {}

      // compute UI button top so they align with score baseline
      const scoreY = Math.round(44 * st.scale);
      const buttonHeight = Math.max(26, Math.round(28 * st.scale));
      const uiTop = Math.max(6, scoreY - Math.round(buttonHeight / 2) + Math.round(2 * st.scale));
      setUiButtonsTop(uiTop);

      // wrapper layout behavior
      if (fs) {
        outer.style.display = 'flex';
        outer.style.alignItems = 'center';
        outer.style.justifyContent = 'center';
        outer.style.padding = '0';
        wrapper.style.position = 'fixed';
        wrapper.style.left = '0';
        wrapper.style.top = '0';
        wrapper.style.width = '100vw';
        wrapper.style.height = '100vh';
        wrapper.style.display = 'flex';
        wrapper.style.alignItems = 'center';
        wrapper.style.justifyContent = 'center';
        wrapper.style.padding = '0';
      } else {
        outer.style.display = 'flex';
        outer.style.alignItems = 'flex-start';
        outer.style.justifyContent = 'center';
        outer.style.padding = `${pad}px`;
        wrapper.style.position = 'relative';
        wrapper.style.width = cssWidth + 'px';
        wrapper.style.height = cssHeight + 'px';
        wrapper.style.display = 'block';
        wrapper.style.margin = '8px auto';
        wrapper.style.padding = '0';
      }

      buildStaticBackground();
    }

    // Build static background (sky gradient, clouds, buildings, bushes)
    // Build static background (sky, clouds, buildings, bushes). Draw once per resize
    function buildStaticBackground() {
      const st = stateRef.current;
      try {
        const bg = document.createElement('canvas');
        bg.width = Math.max(1, Math.round(st.widthCss));
        bg.height = Math.max(1, Math.round(st.heightCss));
        const bctx = bg.getContext('2d');

        // Sky (sunset gradient)
        const g = bctx.createLinearGradient(0, 0, 0, st.heightCss);
        g.addColorStop(0, '#2b6cb0');
        g.addColorStop(0.45, '#7b3fa5');
        g.addColorStop(0.75, '#ff8a33');
        g.addColorStop(1, '#ff3b3b');
        bctx.fillStyle = g;
        bctx.fillRect(0, 0, st.widthCss, st.heightCss);

        // Clouds (static)
        const cloudColor = 'rgba(255,255,255,0.9)';
        const clouds = [
          { x: st.widthCss * 0.12, y: st.heightCss * 0.16, s: 0.9 },
          { x: st.widthCss * 0.6, y: st.heightCss * 0.12, s: 1.1 },
          { x: st.widthCss * 0.82, y: st.heightCss * 0.2, s: 0.7 }
        ];
        bctx.fillStyle = cloudColor;
        for (const c of clouds) {
          const cx = c.x, cy = c.y, s = c.s * st.scale;
          bctx.beginPath();
          bctx.ellipse(cx - 18 * s, cy, 26 * s, 18 * s, 0, 0, Math.PI * 2);
          bctx.ellipse(cx + 6 * s, cy - 6 * s, 34 * s, 20 * s, 0, 0, Math.PI * 2);
          bctx.ellipse(cx + 28 * s, cy, 22 * s, 14 * s, 0, 0, Math.PI * 2);
          bctx.fill();
        }

        // ground values used to align buildings & bushes
        const groundH = Math.max(60 * st.scale, 30 * st.scale);
        const groundY = st.heightCss - groundH;

        // Buildings (static silhouettes) — align bottoms to top of ground so bushes cover them
        const buildingColors = ['rgba(20,30,40,0.22)', 'rgba(10,20,30,0.18)', 'rgba(40,20,50,0.14)'];
        let bx = -40 * st.scale;
        while (bx < st.widthCss + 80) {
          // make a main building
          const bw = Math.max(30 * st.scale, 28 * st.scale) * (0.6 + (Math.sin(bx * 0.13) * 0.5 + 0.5) * 1.0);
          const bh = Math.max(36 * st.scale, 80 * st.scale) * (0.9 + (Math.cos(bx * 0.11) * 0.5 + 0.5) * 1.2);
          const color = buildingColors[Math.floor((Math.abs(bx) * 13) % buildingColors.length)];
          bctx.fillStyle = color;
          // align bottom of building to groundY so bushes can cover bottoms
          bctx.fillRect(bx, groundY - bh, bw, bh);

          // subtle window grid occasionally but only on wide buildings
          if (bw > 10 * st.scale) {
            bctx.fillStyle = 'rgba(255,255,255,0.1)';
            for (let wy = groundY - bh + 6; wy < groundY - 6; wy += 10 * st.scale) {
              for (let wx = bx + 6; wx < bx + bw - 6; wx += 12 * st.scale) {
                if (((wx + wy) % 8) > 4) bctx.fillRect(wx, wy, 6 * st.scale, 6 * st.scale);
              }
            }
          }

          // fill small buildings between main ones to avoid gaps
          const gap = Math.max(6 * st.scale, 8 * st.scale) + (Math.abs(Math.sin(bx * 0.07)) * 10 * st.scale);
          // add one or two small buildings deterministically
          const smallCount = 2 + ((Math.abs(Math.floor(bx)) % 2));
          let sx = bx + bw + gap * 0.5;
          for (let s = 0; s < smallCount && sx < bx + bw + gap * 1.8; s++) {
            const sbw = Math.max(20 * st.scale, 14 * st.scale) * (0.7 + ((Math.abs(Math.cos((bx + s) * 0.19))) * 0.8));
            const sbh = Math.max(40 * st.scale, 28 * st.scale) * (0.6 + (Math.abs(Math.sin((bx + s) * 0.13))));
            bctx.fillStyle = buildingColors[(Math.floor((Math.abs(sx) * 7) % buildingColors.length))];
            bctx.fillRect(sx, groundY - sbh, sbw, sbh);
            sx += sbw + 6 * st.scale;
          }

          bx += bw + (10 * st.scale + ((Math.abs(Math.sin(bx * 0.07)) * 30) * st.scale));
        }

        // Bushes (in front of buildings, static) — draw after buildings so they cover bottoms
        const bushY = groundY + Math.max(6 * st.scale, 6 * st.scale);
        bctx.fillStyle = '#3aa24b';
        let ux = -20 * st.scale;
        while (ux < st.widthCss + 40) {
          const r = (14 + (Math.abs(Math.sin(ux * 0.15)) * 12)) * st.scale;
          bctx.beginPath();
          bctx.ellipse(ux + r * 0.6, bushY - r * 0.2, r * 1.4, r, 0, 0, Math.PI * 2);
          bctx.ellipse(ux + r * 1.3, bushY - r * 0.4, r * 1.1, r * 0.9, 0, 0, Math.PI * 2);
          bctx.fill();
          ux += r * 1.6 + (10 * st.scale);
        }

        st.bgCanvas = bg;
      } catch (e) {
        st.bgCanvas = null;
      }
    }

    function resetToMenu() {
      const st = stateRef.current;
      st.pipes = [];
      st.ticks = 0;
      st.birdVy = 0;
      st.birdY = Math.round(st.heightCss / 2);
      st.spawnTimerFrames = 0;
      st.groundOffset = 0;
      st.scrollX = 0;
      st.score = 0;
      st.deadTimerStarted = false;
      st._hitSoundPlayed = false;
      st._groundSoundPlayed = false;
      st.wingFlapTicks = 0;
      clearPendingTimeouts();
      setScore(0);
      setGamePhase('menu');
      phaseRef.current = 'menu';
      draw();
    }

    function spawnPipe() {
      const st = stateRef.current;
      const w = st.pipeWidth;
      const x = st.widthCss + 8;
      const margin = Math.round(28 * st.scale);
      const groundTop = st.heightCss - (st._groundTotalH || Math.max(44 * st.scale, 40 * st.scale)) - (st._groundExtraUp || 0);
      const capH = Math.max(20 * st.scale, 16 * st.scale);
      const maxTop = Math.max(margin, Math.floor(groundTop - margin - st.pipeGap - capH));
      const usable = Math.max(8, maxTop - margin);
      const topH = margin + Math.floor(Math.random() * usable);
      st.pipes.push({ x, topHeight: topH, width: w, passed: false });
    }

    function flap() {
      const st = stateRef.current;
      st.birdVy = st.flapStrength;
      st.wingFlapTicks = st.wingFlapTicksMax;
      playFlap();
    }

    function beginDeathCountdownIfNeeded() {
      const st = stateRef.current;
      if (st.deadTimerStarted) return;
      st.deadTimerStarted = true;
      const DEAD_POPUP_DELAY = 700; // ms
      deadPopupTimerRef.current = setTimeout(() => {
        phaseRef.current = 'dead';
        setGamePhase('dead');
        deadPopupTimerRef.current = null;
        try {
          const cur = st.score || 0;
          const prev = parseInt(localStorage.getItem('flappy_best') || '0', 10) || 0;
          if (cur > prev) {
            localStorage.setItem('flappy_best', String(cur));
            setBest(cur);
          }
        } catch (e) {}
      }, DEAD_POPUP_DELAY);
      timeoutIdsRef.current.push(deadPopupTimerRef.current);
    }

    // PIPE drawing with lip in front
    function drawPipe(p) {
      const st = stateRef.current;
      const gw = p.width;
      const grad = ctx.createLinearGradient(p.x, 0, p.x + gw, 0);
      grad.addColorStop(0, '#62d07d');
      grad.addColorStop(0.45, '#2ecc71');
      grad.addColorStop(1, '#1e8a4b');
      ctx.fillStyle = grad;
      ctx.fillRect(p.x, 0, gw, p.topHeight);
      const y = p.topHeight + st.pipeGap;
      ctx.fillRect(p.x, y, gw, st.heightCss - y);

      // body border
      ctx.strokeStyle = '#0b4f2d';
      ctx.lineWidth = Math.max(1, 1.4 * st.scale);
      ctx.strokeRect(p.x, 0, gw, p.topHeight);
      ctx.strokeRect(p.x, y, gw, st.heightCss - y);

      // thick lip / cap overlapping pipe front (in front visually)
      const capH = Math.max(35 * st.scale, 20 * st.scale);
      const capExtra = Math.max(12 * st.scale, 10 * st.scale);
      const lipGrad = ctx.createLinearGradient(p.x, 0, p.x + gw, 0);
      lipGrad.addColorStop(0, '#2e9448');
      lipGrad.addColorStop(0.5, '#1f8c4e');
      lipGrad.addColorStop(1, '#16623a');

      // top lip
      ctx.fillStyle = lipGrad;
      ctx.fillRect(p.x - capExtra, p.topHeight - capH, gw + capExtra * 2, capH);
      ctx.strokeStyle = '#0b4f2d';
      ctx.lineWidth = Math.max(1, 1.6 * st.scale);
      ctx.strokeRect(p.x - capExtra, p.topHeight - capH, gw + capExtra * 2, capH);

      // bottom lip
      ctx.fillStyle = lipGrad;
      ctx.fillRect(p.x - capExtra, y, gw + capExtra * 2, capH);
      ctx.strokeStyle = '#0b4f2d';
      ctx.lineWidth = Math.max(1, 1.6 * st.scale);
      ctx.strokeRect(p.x - capExtra, y, gw + capExtra * 2, capH);
    }

    // Draw top band with diagonal stripes tied to st.scrollX (stable)
    function drawTopGroundBand(topBandY, topBandH) {
      const st = stateRef.current;
      ctx.fillStyle = '#9fe47f';
      ctx.fillRect(0, topBandY, st.widthCss, topBandH);

      const stripeW = st.stripeSpacing || Math.max(28 * st.scale, 20 * st.scale);
      const slant = Math.round(topBandH * 0.9);
      const dark = '#3a8a42';
      const light = '#9fe47f';

      // USER REQUESTED change: this exact line:
      const rawOffset = st.scrollX || 0;
      const offset = ((rawOffset) + stripeW);

      // start slightly left to cover slanted polygons
      const firstX = -stripeW - slant - offset;
      const maxX = st.widthCss + stripeW + slant;
      // index base aligned to spatial coordinate so parity remains stable
      let index = Math.floor((firstX + offset) / stripeW);

      for (let drawX = firstX; drawX <= maxX; drawX += stripeW) {
        const isDark = (index % 2) === 0;
        ctx.fillStyle = isDark ? dark : light;
        ctx.beginPath();
        ctx.moveTo(drawX, topBandY);
        ctx.lineTo(drawX + stripeW, topBandY);
        ctx.lineTo(drawX + stripeW - slant, topBandY + topBandH);
        ctx.lineTo(drawX - slant, topBandY + topBandH);
        ctx.closePath();
        ctx.fill();
        index++;
      }
    }

    function draw() {
      const st = stateRef.current;
      ctx.clearRect(0, 0, st.widthCss, st.heightCss);

      // static background
      if (st.bgCanvas) ctx.drawImage(st.bgCanvas, 0, 0, st.widthCss, st.heightCss);
      else { ctx.fillStyle = '#87ceeb'; ctx.fillRect(0, 0, st.widthCss, st.heightCss); }

      // pipes behind bird
      for (let i = 0; i < st.pipes.length; i++) drawPipe(st.pipes[i]);

      // ground layout
      const groundTotalH = st._groundTotalH || Math.max(46 * st.scale, 44 * st.scale);
      const topBandH = st._topBandH || st.stripeTopBandH;
      const extraUp = st._groundExtraUp || 0;
      const groundY = st.heightCss - groundTotalH - extraUp;

      // bottom main ground: ensure it covers entire canvas bottom
      ctx.fillStyle = '#ded895';
      const bottomMainTop = groundY + topBandH;
      ctx.fillRect(0, bottomMainTop, st.widthCss, Math.max(0, st.heightCss - bottomMainTop));

      // small off-tone on top of bottom main
      ctx.fillStyle = '#bfb474';
      ctx.fillRect(0, bottomMainTop, st.widthCss, Math.max(2 * st.scale, 2));

      // top band with stripes (synced to st.scrollX)
      const topBandY = groundY;
      drawTopGroundBand(topBandY, topBandH);

      // TOP border (user requested to place on top of top ground band)
      const borderH = Math.max(.7 * st.scale, .7);
      const borderY = Math.max(0, topBandY - borderH);
      ctx.fillStyle = '#0b4f2d';
      ctx.fillRect(0, borderY, st.widthCss, borderH);

      // bird drawing
      const bx = st.birdX;
      const by = st.birdY;
      const r = st.birdSize / 2;
      ctx.save();
      ctx.translate(bx, by);
      const rot = Math.max(-0.9, Math.min(0.9, st.birdVy / 10));
      ctx.rotate(rot);

      // BODY (accent) + outline
      ctx.beginPath();
      ctx.fillStyle = st.accentColor || '#FFD966';
      ctx.ellipse(0, 0, r * 1.05, r * 0.95, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = Math.max(1, 1.6 * st.scale);
      ctx.strokeStyle = '#000';
      ctx.stroke();

      // WING: lighter accent color + flap oscillation (lighter via HSL-aware helper)
      const wingColor = lightenColor(st.accentColor || '#FFD966', 35); // ensure HSL lighten works
      const wingOsc = st.wingFlapTicks ? Math.sin(((st.wingFlapTicks / st.wingFlapTicksMax) * Math.PI * 6)) * 0.6 : 0;
      ctx.save();
      ctx.translate(-r * 0.75, r * 0.02);
      ctx.rotate(-wingOsc * 0.28);
      ctx.fillStyle = wingColor;
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 0.58, r * 0.32, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#000';
      ctx.lineWidth = Math.max(1, 1.2 * st.scale);
      ctx.stroke();
      ctx.restore();

      // EYE (white + pupil)
      ctx.save();
      ctx.translate(r * 0.45, -r * 0.48);
      ctx.fillStyle = '#fff';
      const eyeR = Math.max(7 * st.scale, r * 0.36);
      ctx.beginPath();
      ctx.arc(0, 0, eyeR, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = Math.max(1, 1.6 * st.scale);
      ctx.strokeStyle = '#000';
      ctx.stroke();
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.arc(-eyeR * 0.18, -eyeR * 0.12, Math.max(2 * st.scale, eyeR * 0.34), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // BEAK / LIPS (two ovals)
      ctx.save();
      ctx.translate(r * 0.8, -r * 0.16);
      ctx.fillStyle = st.secondaryColor || '#f39c12';
      ctx.beginPath();
      ctx.ellipse(r * 0.32, r * 0.22, r * 0.62, r * 0.28, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = Math.max(1, 1.2 * st.scale);
      ctx.strokeStyle = '#000';
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(r * 0.32, r * 0.62, r * 0.62, r * 0.28, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      ctx.restore();

      // Score: blocky with heavy stroke
      ctx.textAlign = 'center';
      const bigSize = Math.max(22, Math.round(36 * st.scale));
      ctx.font = `bold ${bigSize}px "Press Start 2P", monospace`;
      ctx.lineWidth = Math.max(6, Math.round(6 * st.scale));
      ctx.strokeStyle = 'black';
      ctx.strokeText(String(st.score || 0), st.widthCss / 2, Math.round(44 * st.scale));
      ctx.fillStyle = 'white';
      ctx.fillText(String(st.score || 0), st.widthCss / 2, Math.round(44 * st.scale));

      // Menu/Dead overlay text
      ctx.font = `${Math.max(10, Math.round(12 * st.scale))}px "Press Start 2P", monospace`;
      if (phaseRef.current === 'menu') {
        const text1 = 'CLICK / TAP / SPACE TO FLAP';
        ctx.fillStyle = 'rgba(255,255,255,0.95)';
        ctx.strokeStyle = 'rgba(0,0,0,0.9)';
        ctx.lineWidth = Math.max(3, Math.round(3 * st.scale));
        ctx.strokeText(text1, st.widthCss / 2, Math.round(st.heightCss / 2 - 8 * st.scale));
        ctx.fillText(text1, st.widthCss / 2, Math.round(st.heightCss / 2 - 8 * st.scale));
      } else if (phaseRef.current === 'dead') {
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        const boxW = Math.min(260 * st.scale, st.widthCss - 20);
        const boxH = 120 * st.scale;
        ctx.fillRect(st.widthCss / 2 - boxW / 2, st.heightCss / 2 - boxH / 2, boxW, boxH);
        ctx.fillStyle = '#fff';
        ctx.font = `bold ${Math.max(16, Math.round(18 * st.scale))}px "Press Start 2P", monospace`;
        ctx.fillText('GAME OVER', st.widthCss / 2, Math.round(st.heightCss / 2 - 20 * st.scale));
        ctx.font = `${Math.max(12, Math.round(13 * st.scale))}px "Press Start 2P", monospace`;
        ctx.fillText(`SCORE ${st.score || 0}`, st.widthCss / 2, Math.round(st.heightCss / 2 - 2 * st.scale));
        ctx.fillText(`BEST ${bestRef.current}`, st.widthCss / 2, Math.round(st.heightCss / 2 + 20 * st.scale));
        ctx.fillText('CLICK / TAP TO RETRY', st.widthCss / 2, Math.round(st.heightCss / 2 + 44 * st.scale));
      }
    }

    // main loop
    function step(time) {
      const st = stateRef.current;
      if (!st) return;
      if (!lastTimeRef.current) lastTimeRef.current = time;
      const elapsedMs = time - lastTimeRef.current;
      lastTimeRef.current = time;
      let dt = Math.min(4, Math.max(0.5, elapsedMs / (1000 / 60)));
      st.ticks += dt;

      if (st.wingFlapTicks && st.wingFlapTicks > 0) st.wingFlapTicks = Math.max(0, st.wingFlapTicks - dt);

      if (phaseRef.current === 'playing') {
        // scrollX increment exactly matches pipe movement (so stripes sync)
        st.scrollX = (st.scrollX + st.pipeSpeed * dt);

        // spawn pipes
        st.spawnTimerFrames = (st.spawnTimerFrames || 0) + dt;
        if (st.spawnTimerFrames >= st.spawnIntervalFrames) {
          st.spawnTimerFrames = 0;
          spawnPipe();
        }

        // bird physics
        st.birdVy += st.gravity * dt;
        st.birdY += st.birdVy * dt;

        // move pipes
        for (let i = st.pipes.length - 1; i >= 0; i--) {
          const p = st.pipes[i];
          p.x -= st.pipeSpeed * dt;
          if (!p.passed && (p.x + p.width) < st.birdX) {
            p.passed = true;
            st.score = (st.score || 0) + 1;
            setScore(st.score);
            playCoin();
          }
          if (p.x + p.width < -300) st.pipes.splice(i, 1);
        }

        // top clamp
        const half = st.birdSize / 2;
        if (st.birdY - half <= 0) { st.birdY = half + 0.5; st.birdVy = 0; }

        // collisions with pipes
        for (let i = 0; i < st.pipes.length; i++) {
          const p = st.pipes[i];
          const bx = st.birdX;
          const by = st.birdY;
          const bw = st.birdSize;
          const bh = st.birdSize;
          const birdLeft = bx - bw / 2;
          const birdRight = bx + bw / 2;
          const birdTop = by - bh / 2;
          const birdBottom = by + bh / 2;

          const topRect = { left: p.x, right: p.x + p.width, top: 0, bottom: p.topHeight };
          const bottomRect = { left: p.x, right: p.x + p.width, top: p.topHeight + st.pipeGap, bottom: st.heightCss };
          const intersects = (r) => !(birdRight < r.left || birdLeft > r.right || birdBottom < r.top || birdTop > r.bottom);
          if (intersects(topRect) || intersects(bottomRect)) {
            phaseRef.current = 'dying';
            setGamePhase('dying');
            st.birdVy = Math.max(0, st.birdVy);
            if (!st._hitSoundPlayed) {
              playThud(); // unified thud
              st._hitSoundPlayed = true;
            }
            break;
          }
        }

        // ground collision while playing
        const groundYPlaying = st.heightCss - (st._groundTotalH || Math.max(46 * st.scale, 44 * st.scale)) - (st._groundExtraUp || 0);
        const halfSize = st.birdSize / 2;
        if (st.birdY + halfSize >= groundYPlaying + (st._topBandH || st.stripeTopBandH)) {
          st.birdY = groundYPlaying + (st._topBandH || st.stripeTopBandH) - halfSize;
          if (!st._groundSoundPlayed) {
            playThud();
            st._groundSoundPlayed = true;
          }
          beginDeathCountdownIfNeeded();
          if (phaseRef.current === 'playing') {
            phaseRef.current = 'dying';
            setGamePhase('dying');
          }
        }
      } else if (phaseRef.current === 'dying') {
        // bird falls; world stops moving horizontally (pipes stop)
        st.birdVy += st.gravity * dt;
        st.birdY += st.birdVy * dt;
        const groundY = st.heightCss - (st._groundTotalH || Math.max(46 * st.scale, 44 * st.scale)) - (st._groundExtraUp || 0);
        const halfSize = st.birdSize / 2;
        if (st.birdY + halfSize >= groundY + (st._topBandH || st.stripeTopBandH)) {
          st.birdY = groundY + (st._topBandH || st.stripeTopBandH) - halfSize;
          beginDeathCountdownIfNeeded();
        }
      }

      draw();
      rafRef.current = requestAnimationFrame(step);
    }

    // pointer handling
    let lastPointer = 0;
    function onPointerDown(e) {
      resumeAudioIfSuspended();
      const now = performance.now();
      if (now - lastPointer < 60) return;
      lastPointer = now;
      const st = stateRef.current;
      if (st.deadTimerStarted && phaseRef.current !== 'dead') return;

      if (phaseRef.current === 'menu') {
        st.pipes = [];
        st.spawnTimerFrames = 0;
        st.ticks = 0;
        st.birdVy = 0;
        st.score = 0;
        st._hitSoundPlayed = false;
        st._groundSoundPlayed = false;
        st.scrollX = 0;
        setScore(0);
        setGamePhase('playing');
        phaseRef.current = 'playing';
        if (!rafRef.current) { lastTimeRef.current = 0; rafRef.current = requestAnimationFrame(step); }
        flap();
        return;
      }

      if (phaseRef.current === 'playing') { flap(); return; }
      if (phaseRef.current === 'dying') return;
      if (phaseRef.current === 'dead') {
        st.pipes = [];
        st.spawnTimerFrames = 0;
        st.ticks = 0;
        st.birdVy = 0;
        st.birdY = Math.round(st.heightCss / 2);
        st.score = 0;
        st.deadTimerStarted = false;
        st._hitSoundPlayed = false;
        st._groundSoundPlayed = false;
        st.wingFlapTicks = st.wingFlapTicksMax;
        st.scrollX = 0;
        setScore(0);
        setGamePhase('playing');
        phaseRef.current = 'playing';
        if (!rafRef.current) { lastTimeRef.current = 0; rafRef.current = requestAnimationFrame(step); }
        flap();
        return;
      }
    }

    function keyDownHandler(e) {
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault?.();
        resumeAudioIfSuspended();
        const st = stateRef.current;
        if (phaseRef.current === 'menu') {
          st.pipes = [];
          st.spawnTimerFrames = 0;
          st.ticks = 0;
          st.birdVy = 0;
          st.score = 0;
          st._hitSoundPlayed = false;
          st._groundSoundPlayed = false;
          st.scrollX = 0;
          setScore(0);
          setGamePhase('playing');
          phaseRef.current = 'playing';
          if (!rafRef.current) { lastTimeRef.current = 0; rafRef.current = requestAnimationFrame(step); }
          flap();
        } else if (phaseRef.current === 'playing') flap();
        else if (phaseRef.current === 'dead') {
          st.pipes = [];
          st.spawnTimerFrames = 0;
          st.ticks = 0;
          st.birdVy = 0;
          st.birdY = Math.round(st.heightCss / 2);
          st.score = 0;
          st.deadTimerStarted = false;
          st._hitSoundPlayed = false;
          st._groundSoundPlayed = false;
          st.wingFlapTicks = st.wingFlapTicksMax;
          st.scrollX = 0;
          setScore(0);
          setGamePhase('playing');
          phaseRef.current = 'playing';
          if (!rafRef.current) { lastTimeRef.current = 0; rafRef.current = requestAnimationFrame(step); }
          flap();
        }
      } else if (e.key === 'r' || e.key === 'R') {
        resetToMenu();
      } else if (e.key === 'f' || e.key === 'F') {
        toggleFullscreen().catch(()=>{});
      } else if (e.key === 'Escape') {
        exitFullscreen().catch(()=>{});
      }
    }

    // fullscreen helpers
    async function toggleFullscreen() {
      try {
        if (!document.fullscreenElement && !document.webkitFullscreenElement) {
          if (wrapper.requestFullscreen) {
            await wrapper.requestFullscreen();
            setIsFullscreen(true);
            setIsPseudoFullscreen(false);
            document.body.style.overflow = 'hidden';
          } else if (wrapper.webkitRequestFullscreen) {
            await wrapper.webkitRequestFullscreen();
            setIsFullscreen(true);
            setIsPseudoFullscreen(false);
            document.body.style.overflow = 'hidden';
          } else {
            setIsPseudoFullscreen(true);
            setIsFullscreen(false);
            document.body.style.overflow = 'hidden';
          }
        } else {
          if (document.exitFullscreen) await document.exitFullscreen();
          else if (document.webkitExitFullscreen) await document.webkitExitFullscreen();
          setIsFullscreen(false);
          setIsPseudoFullscreen(false);
          document.body.style.overflow = '';
        }
      } catch (e) {
        setIsPseudoFullscreen(true);
        setIsFullscreen(false);
        document.body.style.overflow = 'hidden';
      }
      setTimeout(resize, 60);
    }
    async function exitFullscreen() {
      try {
        if (document.exitFullscreen) await document.exitFullscreen();
        else if (document.webkitExitFullscreen) await document.webkitExitFullscreen();
      } catch (e) {}
      setIsFullscreen(false);
      setIsPseudoFullscreen(false);
      document.body.style.overflow = '';
      setTimeout(resize, 60);
    }
    function onFullscreenChange() {
      const fs = !!(document.fullscreenElement || document.webkitFullscreenElement);
      setIsFullscreen(fs);
      if (!fs) {
        setIsPseudoFullscreen(false);
        document.body.style.overflow = '';
      } else {
        document.body.style.overflow = 'hidden';
      }
      setTimeout(resize, 40);
    }

    // init
    resize();
    resetToMenu();
    if (!rafRef.current) { lastTimeRef.current = 0; rafRef.current = requestAnimationFrame(step); }

    window.addEventListener('resize', resize);
    window.addEventListener('keydown', keyDownHandler);
    document.addEventListener('fullscreenchange', onFullscreenChange);
    document.addEventListener('webkitfullscreenchange', onFullscreenChange);
    canvas.addEventListener('pointerdown', onPointerDown, { passive: true });
    canvas.addEventListener('contextmenu', (ev) => ev.preventDefault());

    return () => {
      if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
      lastTimeRef.current = 0;
      window.removeEventListener('resize', resize);
      window.removeEventListener('keydown', keyDownHandler);
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', onFullscreenChange);
      try { canvas.removeEventListener('pointerdown', onPointerDown); } catch (e) {}
      clearPendingTimeouts();
      document.body.style.overflow = '';
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFullscreen, isPseudoFullscreen]);

  // UI fullscreen toggle (button)
  const toggleFullscreenUI = async () => {
    try {
      const wrapper = wrapperRef.current;
      if (!wrapper) return;
      if (!document.fullscreenElement && !document.webkitFullscreenElement && !isPseudoFullscreen) {
        if (wrapper.requestFullscreen) {
          await wrapper.requestFullscreen();
          setIsFullscreen(true);
          setIsPseudoFullscreen(false);
          document.body.style.overflow = 'hidden';
        } else if (wrapper.webkitRequestFullscreen) {
          await wrapper.webkitRequestFullscreen();
          setIsFullscreen(true);
          setIsPseudoFullscreen(false);
          document.body.style.overflow = 'hidden';
        } else {
          setIsPseudoFullscreen(true);
          setIsFullscreen(false);
          document.body.style.overflow = 'hidden';
        }
      } else {
        if (document.exitFullscreen) await document.exitFullscreen();
        else if (document.webkitExitFullscreen) await document.webkitExitFullscreen();
        setIsFullscreen(false);
        setIsPseudoFullscreen(false);
        document.body.style.overflow = '';
      }
      setTimeout(() => { window.dispatchEvent(new Event('resize')); }, 60);
    } catch (e) {
      setIsPseudoFullscreen(true);
      setIsFullscreen(false);
      document.body.style.overflow = 'hidden';
    }
  };

  const exitFullscreenUI = async () => {
    try {
      if (document.exitFullscreen) await document.exitFullscreen();
      else if (document.webkitExitFullscreen) await document.webkitExitFullscreen();
    } catch (e) {}
    setIsFullscreen(false);
    setIsPseudoFullscreen(false);
    document.body.style.overflow = '';
  };

  const safeTop = `env(safe-area-inset-top, 0px)`;
  // add 20px extra when fullscreen/pseudo to move buttons down on mobile as requested
  const extraFsOffset = (isFullscreen || isPseudoFullscreen) ? 20 : 0;
  const buttonsTopStyle = (isFullscreen || isPseudoFullscreen)
    ? `calc(${uiButtonsTop}px + ${safeTop} + ${extraFsOffset}px)`
    : `${uiButtonsTop}px`;

  const pseudoFsStyle = isPseudoFullscreen ? {
    position: 'fixed',
    inset: 0,
    width: '100%',
    height: '100vh',
    zIndex: 99999,
    background: 'black',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  } : {};

  return (
    <div
      ref={outerRef}
      style={{
        width: '100%',
        margin: 0,
        padding: 12,
        boxSizing: 'border-box',
        background: 'transparent',
      }}
    >
      <div
        ref={wrapperRef}
        style={{
          position: 'relative',
          margin: '0 auto',
          boxSizing: 'border-box',
          ...pseudoFsStyle
        }}
      >
        <canvas
          ref={canvasRef}
          style={{
            display: 'block',
            borderRadius: 6,
            boxShadow: '0 10px 24px rgba(0,0,0,0.45)',
            background: 'transparent',
            touchAction: 'manipulation'
          }}
        />

        {/* top-left Back button aligned near the score */}
        <div style={{
          position: 'absolute',
          top: buttonsTopStyle,
          left: 10,
          zIndex: 200000,
          display: 'flex',
          gap: 8,
          alignItems: 'center'
        }}>
          <Link href="/secret-games" legacyBehavior>
            <a style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.06)',
              color: 'white',
              padding: '6px 8px',
              borderRadius: 8,
              fontSize: 14,
              textDecoration: 'none'
            }}>
              ← Back
            </a>
          </Link>
        </div>

        {/* top-right fullscreen toggle aligned near the score */}
        <div style={{
          position: 'absolute',
          top: buttonsTopStyle,
          right: 10,
          zIndex: 200000,
          display: 'flex',
          gap: 8
        }}>
          <button
            onClick={toggleFullscreenUI}
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.06)',
              color: 'white',
              padding: '6px 8px',
              borderRadius: 8,
              fontSize: 14,
              cursor: 'pointer'
            }}
          >
            {(isFullscreen || isPseudoFullscreen) ? 'Exit Fullscreen' : 'Fullscreen'}
          </button>
        </div>
      </div>
    </div>
  );
}
