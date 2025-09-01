// pages/_app.js
import React, { useEffect, useState } from 'react';
import Head from 'next/head';
import '../styles/globals.css';
import { getTheme, setTheme } from '../utils/theme';
import dynamic from 'next/dynamic';
import { storage } from '../utils/storage';

// Client-only: Header and ToolsSheet are never server-rendered
const Header = dynamic(() => import('../components/Header'), { ssr: false });
const ToolsSheet = dynamic(() => import('../components/ToolsSheet'), { ssr: false });

export default function App({ Component, pageProps }) {
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState(null);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [bgColor, setBgColor] = useState('#0b0b0e'); // default dark mode

  useEffect(() => {
    setMounted(true);

    // Apply current theme immediately
    const currentTheme = getTheme();
    setTheme(currentTheme);

    // Update bgColor to match theme variable
    const root = document.documentElement;
    const computedBg = getComputedStyle(root).getPropertyValue('--bg').trim() || '#0b0b0e';
    setBgColor(computedBg);
    document.body.style.backgroundColor = computedBg;

    // Theme updater interval (for localStorage toggles)
    const t = setInterval(() => {
      setTheme(getTheme());
      const computedBg = getComputedStyle(root).getPropertyValue('--bg').trim() || '#0b0b0e';
      setBgColor(computedBg);
      document.body.style.backgroundColor = computedBg;
    }, 500);

    // register SW
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }

    // initial user
    setUser(storage.getUser());

    // listen for user changes (storage.setUser() will emit event)
    const onUserChanged = () => setUser(storage.getUser());
    window.addEventListener('ll:user:changed', onUserChanged);

    return () => {
      clearInterval(t);
      window.removeEventListener('ll:user:changed', onUserChanged);
    };
  }, []);

  // IMPORTANT: render placeholder while not mounted
  if (!mounted) {
    return (
      <>
        <Head>
          <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no" />
          <meta name="theme-color" content="var(--accent)" />
          <link rel="manifest" href="/manifest.json" />
          <title>MaxLift</title>
        </Head>

        <div className="container" style={{ paddingTop: 8, backgroundColor: bgColor }}>
          <div className="grid fade-in">
            <div className="card">
              <div className="h1">Loading…</div>
            </div>
          </div>
          <div className="footer-space" />
        </div>
      </>
    );
  }

  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no" />
        <meta name="theme-color" content="var(--accent)" />
        <link rel="manifest" href="/manifest.json" />
        <title>MaxLift</title>
      </Head>

      {user && <Header onToggleTools={() => setToolsOpen(true)} />}

      <div className="container" style={{ paddingTop: 8, backgroundColor: bgColor }}>
        <Component {...pageProps} />
        <div className="footer-space" />
      </div>

      {user && <ToolsSheet open={toolsOpen} onClose={() => setToolsOpen(false)} />}
    </>
  );
}
