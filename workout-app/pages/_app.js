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

  useEffect(() => {
    // Only run client-side.
    setMounted(true);

    // theme apply
    setTheme(getTheme());

    // register SW
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }

    // keep theme updated (reads from localStorage if user toggles settings)
    const t = setInterval(() => {
      setTheme(getTheme());
    }, 500);

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

  // Measure header height and expose as CSS var so all sheets / floating controls can use it
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const setHeaderHeight = () => {
      const el = document.querySelector('.toolbar');
      const h = el ? Math.ceil(el.getBoundingClientRect().height) : 0;
      document.documentElement.style.setProperty('--header-height', `${h}px`);
    };

    setHeaderHeight();
    const onResize = () => setHeaderHeight();
    window.addEventListener('resize', onResize);

    // header may mount/unmount dynamically — watch for DOM changes (keeps var updated)
    const mo = new MutationObserver(setHeaderHeight);
    mo.observe(document.body, { childList: true, subtree: true });

    return () => {
      window.removeEventListener('resize', onResize);
      mo.disconnect();
    };
  }, [mounted, user]);

  // IMPORTANT: while NOT mounted, render a single simple placeholder both on server and client.
  // This prevents any server/client markup mismatch.
  if (!mounted) {
    return (
      <>
        <Head>
          <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no" />
          {/* Different theme-color for light/dark (helps status bar color when added to Home Screen) */}
          <meta name="theme-color" content="#0b0b0e" media="(prefers-color-scheme: dark)" />
          <meta name="theme-color" content="#c5c5c7" media="(prefers-color-scheme: light)" />
          <link rel="manifest" href="/manifest.json" />
          <title>MaxLift</title>
        </Head>

        <div className="container" style={{ paddingTop: 8 }}>
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

  // mounted: render actual app. Header and Tools only rendered if a user is present.
  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no" />
        {/* Different theme-color for light/dark (helps status bar color when added to Home Screen) */}
        <meta name="theme-color" content="#0b0b0e" media="(prefers-color-scheme: dark)" />
        <meta name="theme-color" content="#c5c5c7" media="(prefers-color-scheme: light)" />
        <link rel="manifest" href="/manifest.json" />
        <title>MaxLift</title>
      </Head>

      {user && <Header onToggleTools={() => setToolsOpen(true)} />}

      {/* Use header height variable so content sits directly under header with consistent spacing */}
      <div
        className="container"
        style={{
          paddingTop: user ? 'calc(var(--header-height, 56px) + 8px)' : 8
        }}
      >
        <Component {...pageProps} />
        <div className="footer-space" />
      </div>

      {user && <ToolsSheet open={toolsOpen} onClose={() => setToolsOpen(false)} />}
    </>
  );
}
