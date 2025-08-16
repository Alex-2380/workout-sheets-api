import { useState, useEffect } from "react";
import { useRouter } from "next/router";

export default function Login() {
  const [username, setUsername] = useState("");
  const router = useRouter();

  useEffect(() => {
    const savedUser = localStorage.getItem("username");
    if (savedUser) {
      router.push("/dashboard");
    }
  }, []);

  const handleLogin = () => {
    if (!username.trim()) return;
    localStorage.setItem("username", username.trim());
    router.push("/dashboard");
  };

  return (
    <div className="h-screen flex items-center justify-center bg-gray-900 text-white">
      <div className="p-6 bg-gray-800 rounded-2xl shadow-lg w-80">
        <h1 className="text-xl font-bold mb-4 text-center">Workout Tracker</h1>
        <input
          type="text"
          placeholder="Enter username"
          className="w-full p-2 mb-4 rounded bg-gray-700 text-white focus:outline-none"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <button
          onClick={handleLogin}
          className="w-full bg-blue-500 hover:bg-blue-600 p-2 rounded font-semibold"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
