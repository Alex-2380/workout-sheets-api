import { useRouter } from 'next/router';

export default function NavBar() {
  const router = useRouter();
  return (
    <nav style={{ display: 'flex', justifyContent: 'space-around', position: 'fixed', bottom: 0, width: '100%', padding: '12px', backgroundColor: '#222', borderTopLeftRadius: '12px', borderTopRightRadius: '12px' }}>
      <button onClick={() => router.push('/dashboard')}>Dashboard</button>
      <button onClick={() => router.push('/workout')}>Workout</button>
      <button onClick={() => router.push('/progress')}>Progress</button>
      <button onClick={() => router.push('/previous-workouts')}>Previous</button>
      <button onClick={() => router.push('/settings')}>Settings</button>
    </nav>
  );
}
