export default function WorkoutSummaryPopup({ onClose }) {
  return (
    <div className="popout">
      <h2>Workout Summary</h2>
      <p>Great job! Your workout is saved.</p>
      <button onClick={onClose}>Close</button>
    </div>
  );
}
