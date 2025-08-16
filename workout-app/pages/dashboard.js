export default function Dashboard({ navigate }) {
  return (
    <div>
      <h1>Dashboard</h1>
      <div>
        <button onClick={() => navigate("workout")}>Start Workout</button>
        <button onClick={() => navigate("routine")}>View Current Routine</button>
        <button onClick={() => navigate("progress")}>Progress</button>
        <button onClick={() => navigate("previous")}>Previous Workouts</button>
        <button onClick={() => navigate("settings")}>Settings</button>
      </div>
    </div>
  );
}
