import { useState } from 'react';

export default function OneRepMaxCalculator() {
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');
  const [max, setMax] = useState(null);

  const calculate1RM = () => {
    const w = parseFloat(weight);
    const r = parseInt(reps);
    if (!w || !r) return;
    setMax(Math.round(w * (1 + r / 30)));
  };

  return (
    <div className="calculator">
      <h3>One Rep Max Calculator</h3>
      <input placeholder="Weight" value={weight} onChange={e => setWeight(e.target.value)} />
      <input placeholder="Reps" value={reps} onChange={e => setReps(e.target.value)} />
      <button onClick={calculate1RM}>Calculate 1RM</button>
      {max && <p>Estimated 1RM: {max} lbs</p>}
    </div>
  );
}
