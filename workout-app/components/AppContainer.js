import { useState, useEffect } from "react";
import Dashboard from "../pages/dashboard";
import Workout from "../pages/workout";
import Progress from "../pages/progress";
import Routine from "../pages/routine";
import PreviousWorkouts from "../pages/previousWorkouts";
import Settings from "../pages/settings";

export default function AppContainer() {
  const [currentScreen, setCurrentScreen] = useState("dashboard");
  const [theme, setTheme] = useState("dark");

  useEffect(() => {
    const storedTheme = localStorage.getItem("theme");
    if (storedTheme) setTheme(storedTheme);
  }, []);

  const renderScreen = () => {
    switch (currentScreen) {
      case "dashboard":
        return <Dashboard navigate={setCurrentScreen} />;
      case "workout":
        return <Workout navigate={setCurrentScreen} />;
      case "progress":
        return <Progress navigate={setCurrentScreen} />;
      case "routine":
        return <Routine navigate={setCurrentScreen} />;
      case "previous":
        return <PreviousWorkouts navigate={setCurrentScreen} />;
      case "settings":
        return <Settings navigate={setCurrentScreen} theme={theme} setTheme={setTheme} />;
      default:
        return <Dashboard navigate={setCurrentScreen} />;
    }
  };

  return <div className={theme === "dark" ? "dark-theme screen-container" : "light-theme screen-container"}>{renderScreen()}</div>;
}
