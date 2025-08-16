export default function Routine({ navigate }) {
  return (
    <div>
      <h1>Current Routine</h1>
      <p>This is where the routine overview will go.</p>
      <button onClick={() => navigate("dashboard")}>Back to Dashboard</button>
    </div>
  );
}
