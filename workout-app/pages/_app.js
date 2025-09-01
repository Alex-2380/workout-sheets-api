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

  // IMPORTANT: while NOT mounted, render a single simple placeholder both on server and client.
  // This prevents any server/client markup mismatch.
  if (!mounted) {
    return (
      <>
        <Head>
          <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no" />
          <meta name="theme-color" content="var(--accent)" />
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
        <meta name="theme-color" content="var(--accent)" />
        <link rel="manifest" href="/manifest.json" />
        <title>MaxLift</title>
      </Head>

      {user && <Header onToggleTools={() => setToolsOpen(true)} />}

      <div className="container" style={{ paddingTop: 8 }}>
        <Component {...pageProps} />
        <div className="footer-space" />
      </div>

      {user && <ToolsSheet open={toolsOpen} onClose={() => setToolsOpen(false)} />}
    </>
  );
}