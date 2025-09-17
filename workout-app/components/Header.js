// components/Header.js
import React, { useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';

export default function Header({ onToggleTools }) {
  const router = useRouter();

  // secret activation config
  const SECRET_TAP_COUNT = 5;
  const SECRET_WINDOW_MS = 1600; // time window for multi-tap
  const LONG_PRESS_MS = 700; // ms to trigger long-press

  const tapRef = useRef({ count: 0, timer: null });
  const longPressTimerRef = useRef(null);

  const triggerSecret = () => {
    // Reset counters and navigate
    if (tapRef.current.timer) {
      clearTimeout(tapRef.current.timer);
      tapRef.current.timer = null;
    }
    tapRef.current.count = 0;
    // push to the hidden games dashboard
    router.push('/secret-games');
  };

  const handleLogoClick = (e) => {
    // increment tap count and start/reset timer
    tapRef.current.count = (tapRef.current.count || 0) + 1;
    if (!tapRef.current.timer) {
      tapRef.current.timer = setTimeout(() => {
        tapRef.current.count = 0;
        tapRef.current.timer = null;
      }, SECRET_WINDOW_MS);
    }
    if (tapRef.current.count >= SECRET_TAP_COUNT) {
      triggerSecret();
    }
  };

  const handleMouseDown = (e) => {
    // start long-press timer
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = setTimeout(() => {
      triggerSecret();
      longPressTimerRef.current = null;
    }, LONG_PRESS_MS);
  };

  const handleMouseUp = () => {
    // cancel long-press if released early
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleKeyDown = (e) => {
    // make Enter / Space activate the same as clicking (keeps accessible)
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleLogoClick();
    }
  };

  useEffect(() => {
    return () => {
      // cleanup timers on unmount
      if (tapRef.current.timer) clearTimeout(tapRef.current.timer);
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    };
  }, []);

  return (
    <div className="toolbar">
      <div className="container" style={{ paddingTop: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {/* Logo / Title — visually unchanged, but also acts as a hidden trigger */}
          <div
            className="h2"
            style={{ margin: 0, cursor: 'default', userSelect: 'none' }}
            role="button"
            tabIndex={0}
            aria-label="MaxLift — app title (tap 5× or long-press to open hidden games)"
            onClick={handleLogoClick}
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchStart={(e) => { handleMouseDown(e); }}
            onTouchEnd={() => { handleMouseUp(); }}
            onKeyDown={handleKeyDown}
          >
            MaxLift
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button className="tool-chip" onClick={onToggleTools}>Tools</button>
            <Link href="/settings" className="tool-chip">Settings</Link>
            <Link href="/dashboard" className="tool-chip">Dashboard</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
