// pages/games/flappy.js
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

/**
 * Flappy (updated)
 *
 * - Ground stripes only move while playing.
 * - Stripes move same direction & speed as pipes.
 * - On collision: pipes & stripes freeze, bird drops straight down under gravity.
 * - Keeps fullscreen / pseudo-fullscreen fallback and controls.
 */

export default function FlappyGame() {
  const wrapperRef = useRef(null);
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const lastTimeRef = useRef(0);
  const stateRef = useRef(null);
  const phaseRef = useRef('menu'); // 'menu' | 'playing' | 'dying' | 'dead'
  const deadPopupTimerRef = useRef(null);
  const timeoutIdsRef = useRef([]);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const bestRef = useRef(0);
  const [gamePhase, setGamePhase] = useState('menu');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPseudoFullscreen, setIsPseudoFullscreen] = useState(false);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);

  useEffect(() => { bestRef.current = best; }, [best]);

  // Initialize mutable game state
  useEffect(() => {
    stateRef.current = {
      widthCss: 320,
      heightCss: 568,
      scale: 1,
      gravity: 0.28,
      flapStrength: -7.0,
      birdX: 68,
      birdY: 0,
      birdVy: 0,
      birdSize: 24,
      pipes: [],
      pipeWidthBase: 52,
      pipeGapBase: 140,
      pipeSpeedBase: 2.2,
      pipeSpeed: 2.2,
      spawnIntervalFrames: 90,
      spawnTimerFrames: 0,
      ticks: 0,
      groundOffset: 0,
      score: 0,
      deadTimerStarted: false
    };
  }, []);

  useEffect(() => {
    try {
      const b = parseInt(localStorage.getItem('flappy_best') || '0', 10) || 0;
      setBest(b);
    } catch (e) {}
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrapper = wrapperRef.current;
    if (!canvas || !wrapper) return;
    const ctx = canvas.getContext('2d');

    const clearPendingTimeouts = () => {
      timeoutIdsRef.current.forEach((id) => clearTimeout(id));
      timeoutIdsRef.current = [];
      if (deadPopupTimerRef.current) {
        clearTimeout(deadPopupTimerRef.current);
        deadPopupTimerRef.current = null;
      }
    };

    function resize() {
      const maxWidth = 520;
      const cssWidth = Math.min(wrapper.clientWidth || 320, maxWidth);
      const ASPECT = 568 / 320;
      const cssHeight = Math.round(cssWidth * ASPECT);
      const ratio = Math.max(1, window.devicePixelRatio || 1);

      canvas.style.width = cssWidth + 'px';
      canvas.style.height = cssHeight + 'px';
      canvas.width = Math.round(cssWidth * ratio);
      canvas.height = Math.round(cssHeight * ratio);

      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

      const st = stateRef.current;
      const s = cssWidth / 320;
      st.widthCss = cssWidth;
      st.heightCss = cssHeight;
      st.scale = s;
      st.pipeWidth = Math.max(44, Math.round(st.pipeWidthBase * s));
      st.pipeGap = Math.max(96, Math.round(st.pipeGapBase * s));
      st.pipeSpeed = Math.max(1.2, st.pipeSpeedBase * s);
      st.birdSize = Math.max(18, Math.round(24 * s));
      st.birdX = Math.max(48, Math.round(68 * s));
      if (!st.birdY) st.birdY = Math.round(cssHeight / 2);

      canvas.style.touchAction = 'pan-y';
      canvas.style.userSelect = 'none';
      canvas.style.webkitUserSelect = 'none';
    }

    function resetToMenu() {
      const st = stateRef.current;
      st.pipes = [];
      st.ticks = 0;
      st.birdVy = 0;
      st.birdY = Math.round(st.heightCss / 2);
      st.spawnTimerFrames = 0;
      st.groundOffset = 0;
      st.score = 0;
      st.deadTimerStarted = false;
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
      const margin = Math.round(40 * st.scale);
      const usable = Math.max(20, st.heightCss - margin * 2 - st.pipeGap);
      const topH = Math.round(margin + Math.random() * usable);
      st.pipes.push({ x, topHeight: topH, width: w, passed: false });
    }

    function flap() {
      const st = stateRef.current;
      st.birdVy = st.flapStrength;
    }

    function beginDeathCountdownIfNeeded() {
      const st = stateRef.current;
      if (st.deadTimerStarted) return;
      st.deadTimerStarted = true;
      const DEAD_POPUP_DELAY = 700;
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

    function draw() {
      const st = stateRef.current;
      ctx.clearRect(0, 0, st.widthCss, st.heightCss);

      // sky gradient
      const skyTop = '#70c5ce';
      const skyBottom = '#5dc0d1';
      const g = ctx.createLinearGradient(0, 0, 0, st.heightCss);
      g.addColorStop(0, skyTop);
      g.addColorStop(1, skyBottom);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, st.widthCss, st.heightCss);

      // pipes
      for (let i = 0; i < st.pipes.length; i++) {
        const p = st.pipes[i];
        ctx.fillStyle = '#2ecc71';
        ctx.fillRect(p.x, 0, p.width, p.topHeight);
        ctx.fillRect(p.x, p.topHeight + st.pipeGap, p.width, st.heightCss - (p.topHeight + st.pipeGap));
        ctx.strokeStyle = '#157a3b';
        ctx.lineWidth = 2;
        ctx.strokeRect(p.x, 0, p.width, p.topHeight);
        ctx.strokeRect(p.x, p.topHeight + st.pipeGap, p.width, st.heightCss - (p.topHeight + st.pipeGap));
      }

      // ground + moving diagonal stripes (clip)
      const groundH = Math.max(30 * st.scale, 28 * st.scale);
      const groundY = st.heightCss - groundH;
      ctx.fillStyle = '#ded895';
      ctx.fillRect(0, groundY, st.widthCss, groundH);
      ctx.fillStyle = '#c9b97a';
      ctx.fillRect(0, groundY, st.widthCss, 4);

      ctx.save();
      ctx.beginPath();
      ctx.rect(0, groundY, st.widthCss, groundH);
      ctx.clip();

      // stripes - draw using st.groundOffset (which is only updated while playing)
      ctx.strokeStyle = 'rgba(0,0,0,0.06)';
      ctx.lineWidth = Math.max(2, 2 * st.scale);
      const spacing = 24 * st.scale;
      // offset can be any number; wrap to [0, spacing)
      const offset = ((st.groundOffset % spacing) + spacing) % spacing;
      for (let x = -groundH - spacing; x < st.widthCss + groundH + spacing; x += spacing) {
        ctx.beginPath();
        ctx.moveTo(x + offset, groundY);
        ctx.lineTo(x + offset + groundH, groundY + groundH);
        ctx.stroke();
      }
      ctx.restore();

      // bird
      const bx = st.birdX;
      const by = st.birdY;
      const r = st.birdSize / 2;
      ctx.save();
      ctx.translate(bx, by);
      const rot = Math.max(-0.9, Math.min(0.8, st.birdVy / 10));
      ctx.rotate(rot);
      ctx.fillStyle = '#FFD966';
      ctx.beginPath();
      ctx.ellipse(0, 0, r, r * 0.85, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f39c12';
      ctx.beginPath();
      ctx.moveTo(r * 0.6, 0);
      ctx.lineTo(r * 1.05, -r * 0.25);
      ctx.lineTo(r * 1.05, r * 0.25);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#222';
      ctx.beginPath();
      ctx.arc(-r * 0.15, -r * 0.25, Math.max(2, r * 0.16), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // score large
      ctx.fillStyle = '#fff';
      ctx.font = `bold ${Math.max(22, Math.round(32 * st.scale))}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(String(st.score || 0), st.widthCss / 2, Math.round(44 * st.scale));

      // contextual text
      ctx.textAlign = 'center';
      ctx.font = `${Math.max(12, Math.round(14 * st.scale))}px sans-serif`;
      if (phaseRef.current === 'menu') {
        ctx.fillStyle = 'rgba(255,255,255,0.95)';
        ctx.fillText('Click / tap / Space to flap', st.widthCss / 2, Math.round(st.heightCss / 2 - 8 * st.scale));
        ctx.fillText('Get the bird through the pipes', st.widthCss / 2, Math.round(st.heightCss / 2 + 14 * st.scale));
      } else if (phaseRef.current === 'dying') {
        // intentionally show nothing — let bird fall to ground and then popup will come after delay
      } else if (phaseRef.current === 'dead') {
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        const boxW = Math.min(260 * st.scale, st.widthCss - 20);
        const boxH = 120 * st.scale;
        ctx.fillRect(st.widthCss / 2 - boxW / 2, st.heightCss / 2 - boxH / 2, boxW, boxH);
        ctx.fillStyle = '#fff';
        ctx.font = `bold ${Math.max(18, Math.round(20 * st.scale))}px sans-serif`;
        ctx.fillText('Game Over', st.widthCss / 2, Math.round(st.heightCss / 2 - 20 * st.scale));
        ctx.font = `${Math.max(14, Math.round(16 * st.scale))}px sans-serif`;
        ctx.fillText(`Score: ${st.score || 0}`, st.widthCss / 2, Math.round(st.heightCss / 2 - 2 * st.scale));
        ctx.fillText(`Best: ${bestRef.current}`, st.widthCss / 2, Math.round(st.heightCss / 2 + 20 * st.scale));
        ctx.font = `${Math.max(12, Math.round(13 * st.scale))}px sans-serif`;
        ctx.fillText('Click / tap to retry', st.widthCss / 2, Math.round(st.heightCss / 2 + 44 * st.scale));
      }
    }

    function step(time) {
      const st = stateRef.current;
      if (!st) return;
      if (!lastTimeRef.current) lastTimeRef.current = time;
      const elapsedMs = time - lastTimeRef.current;
      lastTimeRef.current = time;
      let dt = Math.min(4, Math.max(0.5, elapsedMs / (1000 / 60)));
      st.ticks += dt;

      // Update only while playing:
      if (phaseRef.current === 'playing') {
        // Move ground stripes at SAME rate as pipes (leftwards)
        const spacing = 24 * st.scale;
        st.groundOffset = st.groundOffset - st.pipeSpeed * dt;
        // normalise
        st.groundOffset = ((st.groundOffset % spacing) + spacing) % spacing;

        // spawn
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
          }
          if (p.x + p.width < -50) st.pipes.splice(i, 1);
        }

        // top clamp
        const half = st.birdSize / 2;
        if (st.birdY - half <= 0) {
          st.birdY = half + 0.5;
          st.birdVy = 0;
        }

        // pipe collision check (only while playing)
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
            // On collision: freeze world, let bird drop straight down
            phaseRef.current = 'dying';
            setGamePhase('dying');
            // zero horizontal movement is implicit - pipes stop moving because we only update them in 'playing'
            // ensure vertical velocity is non-negative so bird only falls
            st.birdVy = Math.max(0, st.birdVy);
            break;
          }
        }

        // ground collision while playing: when bird hits ground, begin death popup
        const groundYPlaying = st.heightCss - Math.max(30 * st.scale, 28 * st.scale);
        const halfSize = st.birdSize / 2;
        if (st.birdY + halfSize >= groundYPlaying) {
          st.birdY = groundYPlaying - halfSize;
          beginDeathCountdownIfNeeded();
          // transition to dying if needed (in case hitting ground without pipe collision)
          if (phaseRef.current === 'playing') {
            phaseRef.current = 'dying';
            setGamePhase('dying');
          }
        }
      } else if (phaseRef.current === 'dying') {
        // while dying: DON'T move pipes or ground; only update bird physics so it drops straight down
        st.birdVy += st.gravity * dt;
        st.birdY += st.birdVy * dt;

        const groundY = st.heightCss - Math.max(30 * st.scale, 28 * st.scale);
        const halfSize = st.birdSize / 2;
        if (st.birdY + halfSize >= groundY) {
          st.birdY = groundY - halfSize;
          // start death popup countdown if not started
          beginDeathCountdownIfNeeded();
        }
      }

      // render
      draw();
      rafRef.current = requestAnimationFrame(step);
    }

    // pointer handler (click/tap)
    let lastPointer = 0;
    function onPointerDown(e) {
      const now = performance.now();
      if (now - lastPointer < 60) return;
      lastPointer = now;

      const st = stateRef.current;
      if (st.deadTimerStarted && phaseRef.current !== 'dead') {
        // block rapid taps while death popup is pending
        return;
      }

      if (phaseRef.current === 'menu') {
        // start playing
        st.pipes = [];
        st.spawnTimerFrames = 0;
        st.ticks = 0;
        st.birdVy = 0;
        st.score = 0;
        setScore(0);
        setGamePhase('playing');
        phaseRef.current = 'playing';
        if (!rafRef.current) {
          lastTimeRef.current = 0;
          rafRef.current = requestAnimationFrame(step);
        }
        flap();
        return;
      }

      if (phaseRef.current === 'playing') {
        flap();
        return;
      }

      if (phaseRef.current === 'dying') {
        // ignore taps while bird is falling to ground
        return;
      }

      if (phaseRef.current === 'dead') {
        // restart
        st.pipes = [];
        st.spawnTimerFrames = 0;
        st.ticks = 0;
        st.birdVy = 0;
        st.birdY = Math.round(st.heightCss / 2);
        st.score = 0;
        st.deadTimerStarted = false;
        setScore(0);
        setGamePhase('playing');
        phaseRef.current = 'playing';
        if (!rafRef.current) {
          lastTimeRef.current = 0;
          rafRef.current = requestAnimationFrame(step);
        }
        flap();
        return;
      }
    }

    // keyboard
    function keyDownHandler(e) {
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault?.();
        const st = stateRef.current;
        if (phaseRef.current === 'menu') {
          st.pipes = [];
          st.spawnTimerFrames = 0;
          st.ticks = 0;
          st.birdVy = 0;
          st.score = 0;
          setScore(0);
          setGamePhase('playing');
          phaseRef.current = 'playing';
          if (!rafRef.current) {
            lastTimeRef.current = 0;
            rafRef.current = requestAnimationFrame(step);
          }
          flap();
        } else if (phaseRef.current === 'playing') {
          flap();
        } else if (phaseRef.current === 'dead') {
          st.pipes = [];
          st.spawnTimerFrames = 0;
          st.ticks = 0;
          st.birdVy = 0;
          st.birdY = Math.round(st.heightCss / 2);
          st.score = 0;
          st.deadTimerStarted = false;
          setScore(0);
          setGamePhase('playing');
          phaseRef.current = 'playing';
          if (!rafRef.current) {
            lastTimeRef.current = 0;
            rafRef.current = requestAnimationFrame(step);
          }
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
    }

    async function exitFullscreen() {
      try {
        if (document.fullscreenElement || document.webkitFullscreenElement) {
          if (document.exitFullscreen) await document.exitFullscreen();
          else if (document.webkitExitFullscreen) await document.webkitExitFullscreen();
        }
      } catch (e) {}
      setIsFullscreen(false);
      setIsPseudoFullscreen(false);
      document.body.style.overflow = '';
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
    }

    // start
    resize();
    resetToMenu();
    if (!rafRef.current) {
      lastTimeRef.current = 0;
      rafRef.current = requestAnimationFrame(step);
    }

    window.addEventListener('resize', resize);
    window.addEventListener('keydown', keyDownHandler);
    document.addEventListener('fullscreenchange', onFullscreenChange);
    document.addEventListener('webkitfullscreenchange', onFullscreenChange);

    canvas.addEventListener('pointerdown', onPointerDown, { passive: true });
    canvas.addEventListener('contextmenu', (ev) => ev.preventDefault());

    // cleanup
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
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
  }, []);

  // UI fullscreen helpers (button)
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
    <div className="grid dashboard" style={{ alignItems: 'flex-start' }}>
      <div className="card" style={{ width: '100%', boxSizing: 'border-box', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link href="/secret-games" className="tool-chip">Back</Link>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="tool-chip" onClick={toggleFullscreenUI}>
            {(isFullscreen || isPseudoFullscreen) ? 'Exit Fullscreen' : 'Fullscreen'}
          </button>
        </div>
      </div>

      <div style={{ marginTop: 12, width: '100%', maxWidth: 520, marginLeft: 'auto', marginRight: 'auto' }}>
        <div
          ref={wrapperRef}
          style={{
            width: '100%',
            margin: '0 auto',
            position: 'relative',
            ...pseudoFsStyle
          }}
        >
          <canvas
            ref={canvasRef}
            style={{
              display: 'block',
              width: '100%',
              height: 'auto',
              borderRadius: 10,
              boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
              background: 'transparent'
            }}
          />

          {(isFullscreen || isPseudoFullscreen) && (
            <div style={{
              position: 'absolute',
              top: 10,
              left: 10,
              display: 'flex',
              gap: 8,
              alignItems: 'center',
              zIndex: 200000,
            }}>
              <button
                title="Settings"
                onClick={() => setShowSettingsMenu((s) => !s)}
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  color: 'white',
                  padding: '6px 8px',
                  borderRadius: 8,
                  fontSize: 16,
                  cursor: 'pointer'
                }}
              >
                ⚙
              </button>

              {showSettingsMenu && (
                <div style={{
                  background: 'rgba(0,0,0,0.6)',
                  color: 'white',
                  padding: 8,
                  borderRadius: 8,
                  boxShadow: '0 10px 30px rgba(0,0,0,0.4)'
                }}>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="ghost" onClick={() => { exitFullscreenUI(); setShowSettingsMenu(false); }}>Exit Fullscreen</button>
                    <button className="ghost" onClick={() => { setShowSettingsMenu(false); }}>Close</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700 }}>Score: {score}</div>
            <div style={{ color: 'var(--muted)', fontSize: 13 }}>Best: {best}</div>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="primary"
              onClick={() => {
                const st = stateRef.current;
                if (!st) return;
                st.pipes = [];
                st.ticks = 0;
                st.birdVy = 0;
                st.birdY = Math.round(st.heightCss / 2);
                st.spawnTimerFrames = 0;
                st.score = 0;
                st.groundOffset = 0;
                st.deadTimerStarted = false;
                setScore(0);
                setGamePhase('menu');
                phaseRef.current = 'menu';
              }}
            >
              Reset
            </button>

            <button
              className="ghost"
              onClick={() => {
                const st = stateRef.current;
                if (!st) return;
                if (phaseRef.current === 'menu') {
                  st.pipes = [];
                  st.spawnTimerFrames = 0;
                  st.ticks = 0;
                  st.birdVy = 0;
                  st.score = 0;
                  setScore(0);
                  setGamePhase('playing');
                  phaseRef.current = 'playing';
                  st.birdVy = st.flapStrength;
                } else if (phaseRef.current === 'dead') {
                  st.pipes = [];
                  st.spawnTimerFrames = 0;
                  st.ticks = 0;
                  st.birdVy = 0;
                  st.birdY = Math.round(st.heightCss / 2);
                  st.score = 0;
                  st.deadTimerStarted = false;
                  setScore(0);
                  setGamePhase('playing');
                  phaseRef.current = 'playing';
                  st.birdVy = st.flapStrength;
                } else {
                  st.birdVy = st.flapStrength;
                }
              }}
            >
              Flap
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
