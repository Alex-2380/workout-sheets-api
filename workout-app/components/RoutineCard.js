export default function RoutineCard({ routine }) {
  return (
    <div className="card">
      <h2>{routine.Routine}</h2>
      <p>Day {routine.Day}</p>
      <p>{routine.Exercise} - Sets: {routine.Sets} Reps: {routine['Target Reps']}</p>
    </div>
  );
}
