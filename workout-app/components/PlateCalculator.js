import { useState } from 'react';

export default function PlateCalculator() {
  const [total, setTotal] = useState(45);
  const barWeights = [45, 35, 15];
  const plates = [45, 25, 10, 5, 2.5];

  const addPlate = (weight) => setTotal(prev => prev + weight * 2);
  const removePlate = (weight) => setTotal(prev => Math.max(45, prev - weight * 2));

  return (
    <div className="calculator">
      <h3>Plate Calculator</h3>
      <p>Total: {total} lbs</p>
      <div className="bar-buttons">
        {barWeights.map(w => (
          <button key={w} onClick={() => setTotal(w)}>Set Bar {w} lbs</button>
        ))}
      </div>
      <div className="plate-buttons">
        {plates.map(p => (
          <button
            key={p}
            onClick={() => addPlate(p)}
            onDoubleClick={() => removePlate(p)}
          >
            {p} lbs
          </button>
        ))}
      </div>
    </div>
  );
}
