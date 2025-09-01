// components/Header.js
import React from 'react';
import Link from 'next/link';

export default function Header({ onToggleTools }) {
  return (
    <div className="toolbar">
      <div className="container" style={{ paddingTop: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="h2" style={{ margin: 0 }}>MaxLift</div>
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