import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import NavBar from '../components/NavBar';
import RoutineCard from '../components/RoutineCard';

export default function Dashboard({ theme, toggleTheme }) {
  const router = useRouter();
  const [routines, setRoutines] = useState([]);
  const user = localStorage.getItem('user');

  useEffect(() => {
    if (!user) router.push('/');
    fetch('/api/sheets?tab=Routines')
      .then(res => res.json())
      .then(data => setRoutines(data))
      .catch(err => console.error(err));
  }, []);

  return (
    <div className="container">
      <h1>Dashboard</h1>
      <button onClick={toggleTheme}>Toggle Theme</button>
      {routines.map((routine, i) => (
        <RoutineCard key={i} routine={routine} />
      ))}
      <NavBar />
    </div>
  );
}
