import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import ExerciseCard from '../components/ExerciseCard';
import WorkoutSummaryPopup from '../components/WorkoutSummaryPopup';

export default function Workout({ theme }) {
  const router = useRouter();
  const [exercises, setExercises] = useState([]);
  const [showSummary, setShowSummary] = useState(false);
  const user = localStorage.getItem('user');

  useEffect(() => {
    if (!user) router.push('/');
    fetch(`/api/sheets?tab=Data(${user})`)
      .then(res => res.json())
      .then(data => setExercises(data))
      .catch(err => console.error(err));
  }, []);

  return (
    <div className="container">
      <h1>Workout</h1>
      {exercises.map((ex, i) => (
        <ExerciseCard key={i} exercise={ex} />
      ))}
      <button onClick={() => setShowSummary(true)}>Finish Workout</button>
      {showSummary && <WorkoutSummaryPopup onClose={() => setShowSummary(false)} />}
    </div>
  );
}
