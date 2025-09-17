// pages/games/snake.js
import Link from 'next/link';

export default function SnakeGame() {
  return (
    <div className="grid dashboard">
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div className="h2" style={{ margin: 0 }}>Snake — Workout</div>
            <div style={{ color: 'var(--muted)', marginTop: 6 }}>Placeholder page for Snake (workout theme).</div>
          </div>
          <div>
            <Link href="/secret-games" className="tool-chip">Back</Link>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 20 }}>
        <div className="card">
          <div style={{ fontSize: 14 }}>This is a placeholder. Replace this UI with your Snake implementation.</div>
        </div>
      </div>
    </div>
  );
}
