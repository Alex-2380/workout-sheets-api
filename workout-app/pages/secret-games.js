// pages/secret-games.js
import Link from 'next/link';

export default function SecretGames() {
  return (
    <div className="grid dashboard">
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <div>
            <div className="h1 title-accent" style={{ margin: 0, color: 'var(--secondary)'}}>Games</div>
           
          </div>

        </div>
      </div>

      <div style={{ marginTop: 40 }} className="grid-2">
        <Link href="/games/flappy" className="action">Flappy</Link>
        <Link href="/games/snake" className="action">Snake</Link>
      </div>


    </div>
  );
}
