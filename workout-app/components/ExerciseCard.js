import { useState } from 'react';

export default function ExerciseCard({ exercise }) {
  const [setsData, setSetsData] = useState(
    Array.from({ length: exercise.Sets }, () => ({ weight: '', reps: '' }))
  );

  const handleChange = (index, field, value) => {
    const copy = [...setsData];
    copy[index][field] = value;
    setSetsData(copy);
  };

  return (
    <div className="card">
      <h3>{exercise.Exercise}</h3>
      {setsData.map((set, i) => (
        <div key={i}>
          <input placeholder="Weight" value={set.weight} onChange={e => handleChange(i, 'weight', e.target.value)} />
          <input placeholder="Reps" value={set.reps} onChange={e => handleChange(i, 'reps', e.target.value)} />
        </div>
      ))}
    </div>
  );
}
