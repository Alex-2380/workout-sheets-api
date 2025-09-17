// pages/secret-games.js
import Link from 'next/link';

export default function SecretGames() {
  return (
    <div className="grid dashboard">
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div className="h2" style={{ margin: 0 }}>Secret Games</div>
            <div style={{ color: 'var(--muted)', marginTop: 6 }}>Hidden workout-themed minigames.</div>
          </div>
          <div>
            <Link href="/dashboard" className="tool-chip">Back</Link>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 12 }} className="grid-2">
        <Link href="/games/flappy" className="action">Flappy (Workout)</Link>
        <Link href="/games/snake" className="action">Snake (Workout)</Link>
        <Link href="/games/stack" className="action">Stack (Workout)</Link>
      </div>

      <div style={{ marginTop: 8, color: 'var(--muted)', fontSize: 13 }}>
        These are placeholders — click a tile to load a game page which you can replace with the real game later.
      </div>
    </div>
  );
}
