import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend } from 'chart.js';
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

export default function ProgressChart({ data }) {
  const chartData = {
    labels: data.map(d => d.Date),
    datasets: [
      {
        label: 'Weight',
        data: data.map(d => d.Weight),
        borderColor: '#FF9500',
        backgroundColor: 'rgba(255,149,0,0.3)',
        tension: 0.3
      }
    ]
  };

  const options = {
    responsive: true,
    plugins: {
      legend: { display: false }
    }
  };

  return <Line data={chartData} options={options} />;
}
