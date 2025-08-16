// pages/progress.js
import { useState, useEffect } from "react";
import ProgressChart from "../components/ProgressChart";

export default function Progress() {
  const [theme, setTheme] = useState("dark");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedTheme = localStorage.getItem("theme");
    if (storedTheme) setTheme(storedTheme);
    setLoading(false);
  }, []);

  if (loading) return <div>Loading...</div>;

  return (
    <div className={theme === "dark" ? "dark-theme" : "light-theme"}>
      <h1>Progress</h1>
      <ProgressChart />
    </div>
  );
}
