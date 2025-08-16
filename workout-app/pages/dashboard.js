// pages/dashboard.js
import { useState, useEffect } from "react";

export default function Dashboard() {
  const [theme, setTheme] = useState("dark"); // default dark theme
  const [loading, setLoading] = useState(true); // wait until browser runs

  useEffect(() => {
    // Only runs in browser
    const storedTheme = localStorage.getItem("theme");
    if (storedTheme) setTheme(storedTheme);
    setLoading(false);
  }, []);

  if (loading) return <div>Loading...</div>;

  return (
    <div className={theme === "dark" ? "dark-theme" : "light-theme"}>
      <h1>Dashboard</h1>
      <div>
        <button onClick={() => alert("Start Workout")}>Start Workout</button>
        <button onClick={() => alert("View Routine")}>View Current Routine</button>
        <button onClick={() => alert("Progress")}>Progress</button>
        <button onClick={() => alert("Previous Workouts")}>Previous Workouts</button>
        <button onClick={() => alert("Settings")}>Settings</button>
      </div>
    </div>
  );
}
