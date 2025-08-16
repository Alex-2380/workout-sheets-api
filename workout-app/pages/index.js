import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';

export default function Login({ theme, toggleTheme }) {
  const router = useRouter();
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState('');

  useEffect(() => {
    fetch('/api/sheets?tab=Users')
      .then(res => res.json())
      .then(data => setUsers(data))
      .catch(err => console.error(err));
  }, []);

  const handleLogin = () => {
    if (!selectedUser) return alert('Select a user');
    localStorage.setItem('user', selectedUser);
    router.push('/dashboard');
  };

  return (
    <div className="container">
      <h1>Welcome to Workout App</h1>
      <select onChange={e => setSelectedUser(e.target.value)} value={selectedUser}>
        <option value="">Select User</option>
        {users.map((user, i) => (
          <option key={i} value={user.Users}>{user.Users}</option>
        ))}
      </select>
      <button onClick={handleLogin}>Login</button>
      <button onClick={toggleTheme}>Toggle Theme</button>
    </div>
  );
}
