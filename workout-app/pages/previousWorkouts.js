export default function PreviousWorkouts({ navigate }) {
  return (
    <div>
      <h1>Previous Workouts</h1>
      <p>This is where the previous workouts list will go.</p>
      <button onClick={() => navigate("dashboard")}>Back to Dashboard</button>
    </div>
  );
}
