// pages/games/snake.js
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

const FOODS = ['steak', 'chicken', 'apple', 'banana', 'cheese', 'cake'];

// --- helpers for HSL parsing + complementary color ---
const parseHsl = (hslStr) => {
  if (!hslStr || typeof hslStr !== 'string') return null;
  const m = hslStr.match(/hsla?\(([^)]+)\)/i);
  if (!m) return null;
  const partsRaw = m[1].trim();
  const parts = partsRaw.split(/[,\/\s]+/).filter(Boolean);
  if (parts.length < 3) return null;
  let h = parseFloat(parts[0]);
  let s = parts[1].includes('%') ? parseFloat(parts[1]) : parseFloat(parts[1]) || 50;
  let l = parts[2].includes('%') ? parseFloat(parts[2]) : parseFloat(parts[2]) || 50;
  if (Number.isNaN(h)) return null;
  h = ((h % 360) + 360) % 360;
  s = Math.max(0, Math.min(100, s));
  l = Math.max(0, Math.min(100, l));
  const a = parts[3] ? parseFloat(parts[3]) : 1;
  return { h, s, l, a: Number.isFinite(a) ? a : 1 };
};
const complementaryHsl = (hslStr) => {
  const p = parseHsl(hslStr);
  if (!p) return null;
  const h = Math.round((p.h + 180) % 360);
  return `hsl(${h} ${p.s}% ${p.l}%)`;
};

export default function SnakeGame() {
  const outerRef = useRef(null);
  const wrapperRef = useRef(null);
  const canvasRef = useRef(null);

  const rafRef = useRef(null);
  const lastTimeRef = useRef(0);

  // runtime mutable state (used by loop + handlers)
  const stateRef = useRef({
    designW: 360,
    designH: 700,
    cols: 18,
    rows: 12,
    tile: 20,
    widthCss: 360,
    heightCss: 700,
    snake: [],
    dir: 'right',
    nextDir: 'right',
    alive: true,
    movesPerSecond: 8,
    moveIntervalMs: 120,
    accMs: 0,
    food: null,
    foodType: FOODS[0],
    score: 0,
    _started: false,
    phase: 'menu',
    best: 0,
    isPseudoFullscreen: false,
    scale: 1
  });

  const pointerStartRef = useRef(null);
  const [phase, setPhase] = useState('menu');
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPseudoFullscreen, setIsPseudoFullscreen] = useState(false);

  // audio helpers
  const audioCtxRef = useRef(null);
  const ensureAudio = () => {
    if (!audioCtxRef.current) {
      try { audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { audioCtxRef.current = null; }
    }
    return audioCtxRef.current;
  };
  const playTick = (vol = 0.03) => {
    const ctx = ensureAudio(); if (!ctx) return;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.value = 900; g.gain.value = vol;
    o.connect(g); g.connect(ctx.destination);
    const now = ctx.currentTime; o.start(now);
    o.frequency.exponentialRampToValueAtTime(1200, now + 0.06);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);
    o.stop(now + 0.11);
  };
  const playEat = (vol = 0.12) => {
    const ctx = ensureAudio(); if (!ctx) return;
    const now = ctx.currentTime;
    const o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain();
    o1.type = 'triangle'; o2.type = 'sine';
    o1.frequency.value = 880; o2.frequency.value = 1320; g.gain.value = vol;
    const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 2400;
    o1.connect(g); o2.connect(g); g.connect(filter); filter.connect(ctx.destination);
    o1.start(now); o2.start(now);
    o1.frequency.exponentialRampToValueAtTime(440, now + 0.12);
    o2.frequency.exponentialRampToValueAtTime(660, now + 0.12);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
    o1.stop(now + 0.18); o2.stop(now + 0.18);
  };
  const playCrash = (vol = 0.16) => {
    const ctx = ensureAudio(); if (!ctx) return;
    const now = ctx.currentTime;
    const o = ctx.createOscillator(), g = ctx.createGain();
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 800;
    o.type = 'triangle'; o.frequency.value = 120;
    o.connect(f); f.connect(g); g.connect(ctx.destination); g.gain.value = vol;
    o.start(now); o.frequency.exponentialRampToValueAtTime(60, now + 0.18);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
    o.stop(now + 0.35);
  };

  // read theme colors
  const getThemeColors = () => {
    try {
      const cs = getComputedStyle(document.documentElement);
      const accent = (cs.getPropertyValue('--accent') || '').trim() || 'hsl(145 60% 45%)';
      const secondary = (cs.getPropertyValue('--secondary') || '').trim() || 'hsl(42 95% 55%)';
      return { accent, secondary };
    } catch (e) {
      return { accent: 'hsl(145 60% 45%)', secondary: 'hsl(42 95% 55%)' };
    }
  };

  // load best from localStorage on mount
  useEffect(() => {
    try {
      const b = parseInt(localStorage.getItem('snake_best') || '0', 10) || 0;
      setBest(b);
      stateRef.current.best = b;
    } catch (e) {
      setBest(0);
      stateRef.current.best = 0;
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrapper = wrapperRef.current;
    const outer = outerRef.current;
    if (!canvas || !wrapper || !outer) return;

    const ctx = canvas.getContext('2d');
    const st = stateRef.current;

    // outer container baseline
    outer.style.width = '100%';
    outer.style.display = 'flex';
    outer.style.justifyContent = 'center';
    outer.style.boxSizing = 'border-box';
    outer.style.padding = '12px';

    // sizing/resizing — improved logic so grid fits height exactly (avoids partial bottom row)
    function resize() {
      const pad = (document.fullscreenElement || document.webkitFullscreenElement || st.isPseudoFullscreen) ? 0 : 8;
      const availW = Math.max(320, window.innerWidth - pad * 2);
      const availH = Math.max(480, window.innerHeight - pad * 2);

      // keep portrait scaling based on designW/designH
      const scale = Math.min(availW / st.designW, availH / st.designH);
      st.scale = scale;

      // initial target sizes
      const targetW = Math.round(st.designW * scale);
      const targetH = Math.round(st.designH * scale);

      // compute tile so grid rows are integer and fill vertically
      const tentativeTile = targetW / st.cols;
      // round rows using targetH / tentativeTile (round, not floor) to avoid fractional last row
      let rows = Math.max(10, Math.round(targetH / tentativeTile));
      if (rows < 10) rows = 10;

      // choose tile such that rows * tile = integer height that fits in available area
      let tile = Math.floor((targetH / rows) * 100) / 100; // keep two decimals
      if (tile < 4) tile = 4;

      // compute final css width/height from tile * cols/rows
      const cssW = Math.round(tile * st.cols);
      const cssH = Math.round(tile * rows);

      st.tile = tile;
      st.rows = rows;
      st.widthCss = cssW;
      st.heightCss = cssH;

      // set canvas dimensions (CSS and backing store)
      const ratio = Math.max(1, window.devicePixelRatio || 1);
      canvas.style.width = cssW + 'px';
      canvas.style.height = cssH + 'px';
      canvas.width = Math.round(cssW * ratio);
      canvas.height = Math.round(cssH * ratio);
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

      // If fullscreen (native or pseudo) center with grid; otherwise keep wrapper sized & centered
      const isFs = !!(document.fullscreenElement || document.webkitFullscreenElement || st.isPseudoFullscreen);
      if (isFs) {
        wrapper.style.position = 'fixed';
        wrapper.style.inset = '0';
        wrapper.style.display = 'grid';
        wrapper.style.placeItems = 'center';
        wrapper.style.justifyContent = 'center';
        wrapper.style.alignItems = 'center';
        wrapper.style.zIndex = '99999';
        wrapper.style.padding = '0';
        overlayBodyOverflow(true);
      } else {
        wrapper.style.position = 'relative';
        wrapper.style.inset = '';
        wrapper.style.display = 'block';
        wrapper.style.width = cssW + 'px';
        wrapper.style.height = cssH + 'px';
        wrapper.style.margin = '0 auto';
        wrapper.style.padding = '0';
        wrapper.style.boxSizing = 'border-box';
        overlayBodyOverflow(false);
      }
    }

    function overlayBodyOverflow(lock) {
      try {
        document.body.style.overflow = lock ? 'hidden' : '';
      } catch (e) {}
    }

    // game initialization helpers
    function resetToMenu() {
      const st = stateRef.current;
      const cx = Math.floor(st.cols / 2);
      const cy = Math.floor(st.rows / 2);
      st.snake = [
        { x: cx - 2, y: cy },
        { x: cx - 1, y: cy },
        { x: cx,     y: cy }
      ];
      st.dir = 'right';
      st.nextDir = 'right';
      st.score = 0;
      st.alive = true;
      st.accMs = 0;
      st._started = false;
      st.phase = 'menu';
      st.best = st.best || (parseInt(localStorage.getItem('snake_best') || '0', 10) || 0);
      spawnFood();
      setScore(0);
      setPhase('menu');
      draw();
    }

    function spawnFood() {
      const st = stateRef.current;
      const occupied = new Set(st.snake.map(p => `${p.x},${p.y}`));
      for (let tries = 0; tries < 400; tries++) {
        const fx = Math.floor(Math.random() * st.cols);
        const fy = Math.floor(Math.random() * st.rows);
        if (!occupied.has(`${fx},${fy}`)) {
          st.food = { x: fx, y: fy };
          st.foodType = FOODS[Math.floor(Math.random() * FOODS.length)];
          return;
        }
      }
      st.food = { x: Math.floor(st.cols/3), y: Math.floor(st.rows/3) };
      st.foodType = FOODS[Math.floor(Math.random() * FOODS.length)];
    }

    function stepLogic() {
      const st = stateRef.current;
      if (!st.alive) return;
      const opposite = (a,b) => (a==='left'&&b==='right') || (a==='right'&&b==='left') || (a==='up'&&b==='down') || (a==='down'&&b==='up');
      if (!opposite(st.nextDir, st.dir)) st.dir = st.nextDir;

      const head = st.snake[st.snake.length - 1];
      let nx = head.x, ny = head.y;
      if (st.dir === 'left') nx = head.x - 1;
      else if (st.dir === 'right') nx = head.x + 1;
      else if (st.dir === 'up') ny = head.y - 1;
      else if (st.dir === 'down') ny = head.y + 1;

      // walls -> die. use integer grid check: die only when beyond last index
      if (nx < 0 || nx >= st.cols || ny < 0 || ny >= st.rows) {
        st.alive = false;
        onDeath();
        return;
      }

      // self collision
      for (let i = 0; i < st.snake.length; i++) {
        if (st.snake[i].x === nx && st.snake[i].y === ny) {
          st.alive = false;
          onDeath();
          return;
        }
      }

      st.snake.push({ x: nx, y: ny });

      // eat?
      if (st.food && st.food.x === nx && st.food.y === ny) {
        st.score++;
        setScore(st.score);
        playEat(0.12);
        spawnFood();
      } else {
        st.snake.shift();
        playTick(0.02);
      }
    }

    function onDeath() {
      const st = stateRef.current;
      st._started = false;
      st.phase = 'dead';
      setPhase('dead');
      playCrash(0.16);
      try {
        const prev = parseInt(localStorage.getItem('snake_best') || '0', 10) || 0;
        if (st.score > prev) {
          localStorage.setItem('snake_best', String(st.score));
          setBest(st.score);
          st.best = st.score;
        } else {
          st.best = prev;
        }
      } catch (e) {}
    }

    // drawing
    function draw() {
      const st = stateRef.current;
      if (!st) return;

      // background (dirt)
      const g = ctx.createLinearGradient(0, 0, 0, st.heightCss);
      g.addColorStop(0, '#d1b08a');
      g.addColorStop(0.7, '#b68a61');
      g.addColorStop(1, '#9b6e45');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, st.widthCss, st.heightCss);

      // compute theme colors & complementary colors for food
      const theme = getThemeColors();
      const foodFill = complementaryHsl(theme.accent) || '#ffffff';
      const foodBorder = complementaryHsl(theme.secondary) || '#000000';

      // food circle
      if (st.food) {
        const fx = st.food.x * st.tile;
        const fy = st.food.y * st.tile;
        const r = Math.max(4, st.tile * 0.38);
        ctx.beginPath();
        ctx.fillStyle = foodFill;
        ctx.arc(fx + st.tile / 2, fy + st.tile / 2, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.lineWidth = Math.max(1, st.tile * 0.06);
        ctx.strokeStyle = foodBorder;
        ctx.stroke();
      }

      // snake (connected, rounded)
      const themeColors = getThemeColors();
      const accent = (parseHsl(themeColors.accent) ? themeColors.accent : '#2ecc71');
      const secondary = (parseHsl(themeColors.secondary) ? themeColors.secondary : '#ffd966');

      if (st.snake.length > 1) {
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        ctx.beginPath();
        const first = st.snake[0];
        ctx.moveTo(first.x * st.tile + st.tile / 2, first.y * st.tile + st.tile / 2);
        for (let i = 1; i < st.snake.length; i++) {
          const p = st.snake[i];
          ctx.lineTo(p.x * st.tile + st.tile / 2, p.y * st.tile + st.tile / 2);
        }

        // outer border stroke
        const borderWidth = Math.max(1, st.tile * 0.1);
        ctx.lineWidth = Math.max(1, st.tile * 0.9 + borderWidth * 1.2);
        ctx.strokeStyle = 'rgba(0,0,0,0.5)';
        ctx.stroke();

        // inner body stroke
        ctx.lineWidth = Math.max(1, st.tile * 0.9);
        ctx.strokeStyle = accent;
        ctx.stroke();
      } else if (st.snake.length === 1) {
        const p = st.snake[0];
        ctx.beginPath();
        ctx.arc(p.x * st.tile + st.tile / 2, p.y * st.tile + st.tile / 2, st.tile / 2, 0, Math.PI * 2);
        ctx.fillStyle = accent;
        ctx.fill();
      }

      // head
      if (st.snake.length) {
        const head = st.snake[st.snake.length - 1];
        const hx = head.x * st.tile + st.tile / 2;
        const hy = head.y * st.tile + st.tile / 2;
        const headR = Math.max((st.tile * 0.52), 6);

        ctx.beginPath();
        ctx.fillStyle = secondary;
        ctx.arc(hx, hy, headR, 0, Math.PI * 2);
        ctx.fill();

        ctx.lineWidth = Math.max(1, st.scale * 1.4);
        ctx.strokeStyle = 'rgba(0,0,0,0.95)';
        ctx.stroke();

        // two eyes
        const eyeOffsetX = Math.max(6, st.tile * 0.16);
        const eyeOffsetY = Math.max(6, st.tile * 0.20);
        const eyeR = Math.max(3, st.tile * 0.08);

        // left eye
        ctx.beginPath();
        ctx.fillStyle = '#fff';
        ctx.arc(hx - eyeOffsetX, hy - eyeOffsetY, eyeR * 1.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.fillStyle = '#000';
        ctx.arc(hx - eyeOffsetX + Math.min(eyeR * 0.4, 2), hy - eyeOffsetY + Math.min(eyeR * 0.15, 1), eyeR * 0.9, 0, Math.PI * 2);
        ctx.fill();

        // right eye
        ctx.beginPath();
        ctx.fillStyle = '#fff';
        ctx.arc(hx + eyeOffsetX, hy - eyeOffsetY, eyeR * 1.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.fillStyle = '#000';
        ctx.arc(hx + eyeOffsetX + Math.min(eyeR * 0.4, 2), hy - eyeOffsetY + Math.min(eyeR * 0.15, 1), eyeR * 0.9, 0, Math.PI * 2);
        ctx.fill();

        // smile
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(0,0,0,0.95)';
        ctx.lineWidth = Math.max(2, st.scale * 1.4);
        const smileW = Math.max(8, st.tile * 0.28);
        ctx.arc(hx - smileW * 0.1, hy + st.tile * 0.06, smileW * 0.6, 0.2 * Math.PI, 0.8 * Math.PI);
        ctx.stroke();
      }

      // score (blocky)
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      const bigSize = Math.max(18, Math.round(28 * st.scale));
      ctx.font = `bold ${bigSize}px "Press Start 2P", monospace`;
      ctx.lineWidth = Math.max(4, Math.round(4 * st.scale));
      ctx.strokeStyle = 'black';
      ctx.strokeText(String(st.score || 0), st.widthCss / 2, Math.round(44 * st.scale));
      ctx.fillStyle = '#fff';
      ctx.fillText(String(st.score || 0), st.widthCss / 2, Math.round(44 * st.scale));

      // overlays
      if (st.phase === 'menu') {
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.font = `${Math.max(10, Math.round(12 * st.scale))}px "Press Start 2P", monospace`;
        ctx.textBaseline = 'middle';
        ctx.fillText('TAP OR SWIPE TO START', st.widthCss / 2, Math.round(st.heightCss / 2));
      } else if (st.phase === 'dead') {
        const cy = st.heightCss / 2;
        const boxW = Math.min(280 * st.scale, st.widthCss - 20);
        const boxH = 140 * st.scale;
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(st.widthCss / 2 - boxW / 2, cy - boxH / 2, boxW, boxH);

        ctx.textBaseline = 'middle';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#fff';
        ctx.font = `bold ${Math.max(14, Math.round(18 * st.scale))}px "Press Start 2P", monospace`;
        ctx.fillText('GAME OVER', st.widthCss / 2, cy - 34 * st.scale);

        ctx.font = `${Math.max(10, Math.round(12 * st.scale))}px "Press Start 2P", monospace`;
        ctx.fillText(`SCORE ${st.score || 0}`, st.widthCss / 2, cy - 6 * st.scale);

        const bestNow = st.best || 0;
        ctx.fillText(`BEST ${bestNow}`, st.widthCss / 2, cy + 18 * st.scale);

        ctx.fillText('TAP TO RESTART', st.widthCss / 2, cy + 44 * st.scale);
      }
    }

    // main loop
    function loop(time) {
      const st = stateRef.current;
      if (!st) return;
      if (!lastTimeRef.current) lastTimeRef.current = time;
      const elapsed = time - lastTimeRef.current;
      lastTimeRef.current = time;
      st.accMs += elapsed;

      if (st.phase === 'playing' && st._started) {
        const interval = st.moveIntervalMs || 120;
        while (st.accMs >= interval) {
          st.accMs -= interval;
          stepLogic();
        }
      }

      draw();
      rafRef.current = requestAnimationFrame(loop);
    }

    // start / restart functions
    function startGame() {
      const st = stateRef.current;
      st._started = true;
      st.accMs = 0;
      st.phase = 'playing';
      setPhase('playing');
      if (!rafRef.current) { lastTimeRef.current = 0; rafRef.current = requestAnimationFrame(loop); }
    }
    function restartFromMenu() {
      resetToMenu();
      startGame();
    }

    function setDirection(d) {
      const st = stateRef.current;
      if (!st) return;
      const opp = (a,b) => (a==='left'&&b==='right')||(a==='right'&&b==='left')||(a==='up'&&b==='down')||(a==='down'&&b==='up');
      if (opp(d, st.dir)) return;
      st.nextDir = d;
      if (st.phase === 'menu') startGame();
    }

    // pointer handlers: start/move/end — prevent accidental scroll while interacting the game
    let moved = false;
    const touchThreshold = 12;

    function onPointerDown(e) {
      if (e.cancelable) e.preventDefault();
      try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
      pointerStartRef.current = { x: e.clientX, y: e.clientY };
      moved = false;
    }
    function onPointerMove(e) {
      if (e.cancelable) e.preventDefault();
      if (!pointerStartRef.current) return;
      const dx = e.clientX - pointerStartRef.current.x;
      const dy = e.clientY - pointerStartRef.current.y;
      if (Math.abs(dx) > touchThreshold || Math.abs(dy) > touchThreshold) moved = true;
    }
    function onPointerUp(e) {
      if (e.cancelable) e.preventDefault();
      try { canvas.releasePointerCapture(e.pointerId); } catch (_) {}
      const st = stateRef.current;
      if (!pointerStartRef.current) { moved = false; return; }
      const dx = e.clientX - pointerStartRef.current.x;
      const dy = e.clientY - pointerStartRef.current.y;
      const absX = Math.abs(dx), absY = Math.abs(dy);
      if (moved && (absX > touchThreshold || absY > touchThreshold)) {
        if (absX > absY) {
          if (dx > 0) setDirection('right');
          else setDirection('left');
        } else {
          if (dy > 0) setDirection('down');
          else setDirection('up');
        }
      } else {
        if (st.phase === 'menu') startGame();
        else if (st.phase === 'dead') restartFromMenu();
      }
      pointerStartRef.current = null;
      moved = false;
    }

    function onKey(e) {
      const code = e.code || e.key;
      if (code === 'ArrowLeft' || code === 'KeyA') setDirection('left');
      else if (code === 'ArrowRight' || code === 'KeyD') setDirection('right');
      else if (code === 'ArrowUp' || code === 'KeyW') setDirection('up');
      else if (code === 'ArrowDown' || code === 'KeyS') setDirection('down');
      else if (code === 'Space') {
        const st = stateRef.current;
        if (st.phase === 'menu') startGame();
        else if (st.phase === 'dead') restartFromMenu();
      } else if (code === 'KeyF') toggleFullscreenUI();
      else if (code === 'Escape') exitFullscreenUI();
    }

    // Fullscreen toggles (native or pseudo)
    async function toggleFullscreenUI() {
      try {
        const wrapper = wrapperRef.current;
        if (!document.fullscreenElement && !document.webkitFullscreenElement && !stateRef.current.isPseudoFullscreen) {
          if (wrapper.requestFullscreen) {
            await wrapper.requestFullscreen();
            setIsFullscreen(true);
            stateRef.current.isPseudoFullscreen = false;
            overlayBodyOverflow(true);
          } else if (wrapper.webkitRequestFullscreen) {
            await wrapper.webkitRequestFullscreen();
            setIsFullscreen(true);
            stateRef.current.isPseudoFullscreen = false;
            overlayBodyOverflow(true);
          } else {
            stateRef.current.isPseudoFullscreen = true;
            setIsPseudoFullscreen(true);
            setIsFullscreen(false);
            overlayBodyOverflow(true);
          }
        } else {
          if (document.exitFullscreen) await document.exitFullscreen();
          else if (document.webkitExitFullscreen) await document.webkitExitFullscreen();
          setIsFullscreen(false);
          setIsPseudoFullscreen(false);
          stateRef.current.isPseudoFullscreen = false;
          overlayBodyOverflow(false);
        }
      } catch (e) {
        // fallback to pseudo fullscreen
        stateRef.current.isPseudoFullscreen = !stateRef.current.isPseudoFullscreen;
        setIsPseudoFullscreen(stateRef.current.isPseudoFullscreen);
        setIsFullscreen(false);
        overlayBodyOverflow(stateRef.current.isPseudoFullscreen);
      }
      // small delay to let browser apply fullscreen and then resize canvas properly
      setTimeout(resize, 60);
    }

    async function exitFullscreenUI() {
      try {
        if (document.exitFullscreen) await document.exitFullscreen();
        else if (document.webkitExitFullscreen) await document.webkitExitFullscreen();
      } catch (e) {}
      stateRef.current.isPseudoFullscreen = false;
      setIsPseudoFullscreen(false);
      setIsFullscreen(false);
      overlayBodyOverflow(false);
      setTimeout(resize, 60);
    }

    function onFullscreenChange() {
      const fs = !!(document.fullscreenElement || document.webkitFullscreenElement);
      setIsFullscreen(fs);
      if (!fs) {
        stateRef.current.isPseudoFullscreen = false;
        setIsPseudoFullscreen(false);
        overlayBodyOverflow(false);
      } else {
        overlayBodyOverflow(true);
      }
      setTimeout(resize, 60);
    }

    // wire up
    resize();
    resetToMenu();
    if (!rafRef.current) { lastTimeRef.current = 0; rafRef.current = requestAnimationFrame(loop); }

    window.addEventListener('resize', resize);
    window.addEventListener('keydown', onKey);
    document.addEventListener('fullscreenchange', onFullscreenChange);
    document.addEventListener('webkitfullscreenchange', onFullscreenChange);

    canvas.addEventListener('pointerdown', onPointerDown, { passive: false });
    canvas.addEventListener('pointermove', onPointerMove, { passive: false });
    canvas.addEventListener('pointerup', onPointerUp, { passive: false });
    canvas.addEventListener('pointercancel', () => { pointerStartRef.current = null; }, { passive: false });
    canvas.style.touchAction = 'none'; // disables scrolling while interacting the canvas

    return () => {
      if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
      lastTimeRef.current = 0;
      window.removeEventListener('resize', resize);
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', onFullscreenChange);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      overlayBodyOverflow(false);
    };
  }, []);

  // UI-level toggles
  const toggleFullscreenUI = async () => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    try {
      if (!document.fullscreenElement && !document.webkitFullscreenElement && !stateRef.current.isPseudoFullscreen) {
        if (wrapper.requestFullscreen) {
          await wrapper.requestFullscreen();
          setIsFullscreen(true);
          stateRef.current.isPseudoFullscreen = false;
          document.body.style.overflow = 'hidden';
        } else {
          stateRef.current.isPseudoFullscreen = true;
          setIsPseudoFullscreen(true);
          setIsFullscreen(false);
          document.body.style.overflow = 'hidden';
        }
      } else {
        if (document.exitFullscreen) await document.exitFullscreen();
        else if (document.webkitExitFullscreen) await document.webkitExitFullscreen();
        setIsFullscreen(false);
        setIsPseudoFullscreen(false);
        stateRef.current.isPseudoFullscreen = false;
        document.body.style.overflow = '';
      }
      window.dispatchEvent(new Event('resize'));
    } catch (e) {
      stateRef.current.isPseudoFullscreen = true;
      setIsPseudoFullscreen(true);
      setIsFullscreen(false);
      document.body.style.overflow = 'hidden';
      window.dispatchEvent(new Event('resize'));
    }
  };

  const exitFullscreenUI = async () => {
    try {
      if (document.exitFullscreen) await document.exitFullscreen();
      else if (document.webkitExitFullscreen) await document.webkitExitFullscreen();
    } catch (e) {}
    setIsFullscreen(false);
    setIsPseudoFullscreen(false);
    stateRef.current.isPseudoFullscreen = false;
    document.body.style.overflow = '';
    window.dispatchEvent(new Event('resize'));
  };

  // buttons safe-top offset and placement (we push them down enough to be under the phone status area)
  const safeTop = `env(safe-area-inset-top, 0px)`;
  const buttonsTop = `calc(${safeTop} + 50px)`; // already slightly lower; you can adjust further here

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
    <div ref={outerRef} style={{ width: '100%', margin: 0, padding: 12, boxSizing: 'border-box', background: 'transparent' }}>
      <div ref={wrapperRef} style={{ position: 'relative', margin: '0 auto', boxSizing: 'border-box' }}>
        <canvas
          ref={canvasRef}
          style={{
            display: 'block',
            borderRadius: 6,
            boxShadow: '0 10px 24px rgba(0,0,0,0.45)',
            background: 'transparent',
            touchAction: 'none'
          }}
        />

        {/* Back button (inside wrapper) */}
        <div style={{
          position: 'absolute',
          top: buttonsTop,
          left: 10,
          zIndex: 200000,
          display: 'flex',
          gap: 8,
          alignItems: 'center',
          pointerEvents: 'auto'
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

        {/* Fullscreen toggle (inside wrapper) */}
        <div style={{
          position: 'absolute',
          top: buttonsTop,
          right: 10,
          zIndex: 200000,
          display: 'flex',
          gap: 8,
          pointerEvents: 'auto'
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
