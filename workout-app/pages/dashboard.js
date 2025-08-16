import { useRouter } from "next/router";
import { useEffect, useState } from "react";

export default function Dashboard() {
  const router = useRouter();
  const [username, setUsername] = useState("");

  useEffect(() => {
    const savedUser = localStorage.getItem("username");
    if (!savedUser) {
      router.push("/");
    } else {
      setUsername(savedUser);
    }
  }, []);

  return (
    <div className="h-screen flex flex-col items-center justify-center bg-gray-900 text-white">
      <h1 className="text-2xl font-bold mb-6">Welcome, {username}</h1>
      <button
        onClick={() => router.push("/workout")}
        className="bg-green-500 hover:bg-green-600 px-6 py-3 rounded-xl font-semibold"
      >
        Start Workout
      </button>
    </div>
  );
}
