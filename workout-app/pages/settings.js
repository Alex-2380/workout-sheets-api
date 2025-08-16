export default function Settings({ navigate, theme, setTheme }) {
  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
    if (typeof localStorage !== "undefined") localStorage.setItem("theme", newTheme);
  };

  return (
    <div>
      <h1>Settings</h1>
      <p>Toggle theme and user preferences here.</p>
      <button onClick={toggleTheme}>Toggle Theme</button>
      <button onClick={() => navigate("dashboard")}>Back to Dashboard</button>
    </div>
  );
}
