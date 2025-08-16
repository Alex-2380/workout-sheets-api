import { useEffect, useState } from "react";
import { useRouter } from "next/router";

export default function Workout() {
  const [exercises, setExercises] = useState([
    { name: "Bench Press", sets: "", reps: "", weight: "" },
    { name: "Squat", sets: "", reps: "", weight: "" },
    { name: "Deadlift", sets: "", reps: "", weight: "" }
  ]);
  const router = useRouter();

  useEffect(() => {
    const saved = localStorage.getItem("activeWorkout");
    if (saved) {
      setExercises(JSON.parse(saved));
    }
  }, []);

  const updateExercise = (i, field, value) => {
    const updated = [...exercises];
    updated[i][field] = value;
    setExercises(updated);
    localStorage.setItem("activeWorkout", JSON.stringify(updated));
  };

  const finishWorkout = () => {
    // TODO: send to Google Sheets API
    localStorage.removeItem("activeWorkout");
    router.push("/dashboard");
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <h1 className="text-2xl font-bold mb-6">Active Workout</h1>
      <div className="space-y-4">
        {exercises.map((ex, i) => (
          <div key={i} className="p-4 bg-gray-800 rounded-xl">
            <h2 className="font-semibold">{ex.name}</h2>
            <div className="grid grid-cols-3 gap-2 mt-2">
              <input
                type="number"
                placeholder="Sets"
                value={ex.sets}
                onChange={(e) => updateExercise(i, "sets", e.target.value)}
                className="p-2 rounded bg-gray-700 text-white"
              />
              <input
                type="number"
                placeholder="Reps"
                value={ex.reps}
                onChange={(e) => updateExercise(i, "reps", e.target.value)}
                className="p-2 rounded bg-gray-700 text-white"
              />
              <input
                type="number"
                placeholder="Weight"
                value={ex.weight}
                onChange={(e) => updateExercise(i, "weight", e.target.value)}
                className="p-2 rounded bg-gray-700 text-white"
              />
            </div>
          </div>
        ))}
      </div>
      <button
        onClick={finishWorkout}
        className="mt-6 w-full bg-blue-500 hover:bg-blue-600 p-3 rounded-xl font-semibold"
      >
        Finish & Save
      </button>
    </div>
  );
}
