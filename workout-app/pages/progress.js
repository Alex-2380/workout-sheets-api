import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import ProgressChart from '../components/ProgressChart';

export default function Progress({ theme }) {
  const router = useRouter();
  const [exercise, setExercise] = useState('');
  const [data, setData] = useState([]);
  const user = localStorage.getItem('user');

  useEffect(() => {
    if (!user) router.push('/');
    fetch(`/api/sheets?tab=Data(${user})`)
      .then(res => res.json())
      .then(allData => setData(allData))
      .catch(err => console.error(err));
  }, []);

  const filteredData = data.filter(d => d.Exercise === exercise);

  return (
    <div className="container">
      <h1>Progress</h1>
      <input placeholder="Enter Exercise" value={exercise} onChange={e => setExercise(e.target.value)} />
      {filteredData.length > 0 && <ProgressChart data={filteredData} />}
    </div>
  );
}
