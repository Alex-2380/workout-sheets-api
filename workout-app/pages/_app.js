// pages/_app.js
import React, { useEffect, useState } from 'react';
import Head from 'next/head';
import '../styles/globals.css';
import dynamic from 'next/dynamic';
import { storage } from '../utils/storage';

const Header = dynamic(() => import('../components/Header'), { ssr: false });
const ToolsSheet = dynamic(() => import('../components/ToolsSheet'), { ssr: false });

export default function App({ Component, pageProps }) {
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState(null);
  const [toolsOpen, setToolsOpen] = useState(false);

  useEffect(() => {
    setMounted(true);

    // Set body background to match CSS variable --bg
    const root = document.documentElement;
    const bg = getComputedStyle(root).getPropertyValue('--bg').trim();
    document.body.style.backgroundColor = bg;

    // initial user
    setUser(storage.getUser());

    const onUserChanged = () => setUser(storage.getUser());
    window.addEventListener('ll:user:changed', onUserChanged);

    return () => {
      window.removeEventListener('ll:user:changed', onUserChanged);
    };
  }, []);

  if (!mounted) {
    return (
      <>
        <Head>
          <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no" />
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

  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no" />
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
