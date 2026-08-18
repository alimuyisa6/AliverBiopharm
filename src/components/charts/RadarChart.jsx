import { Radar } from 'react-chartjs-2';
import { useMemo } from 'react';

export default function RadarChart({ data, labels, label, color = '#2563EB', height = 260 }) {
  const chartData = useMemo(() => ({
    labels,
    datasets: [
      {
        label,
        data,
        borderColor: color,
        backgroundColor: `${color}20`,
        borderWidth: 2,
        pointBackgroundColor: color,
        pointBorderColor: '#FFFFFF',
        pointBorderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6
      }
    ]
  }), [data, labels, label, color]);

  const options = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      r: {
        beginAtZero: true,
        max: 100,
        grid: {
          color: 'rgba(100, 116, 139, 0.15)',
          circular: true
        },
        angleLines: {
          color: 'rgba(100, 116, 139, 0.15)'
        },
        pointLabels: {
          font: {
            size: 11,
            weight: '500'
          },
          color: '#64748B'
        },
        ticks: {
          display: false,
          stepSize: 20
        }
      }
    },
    plugins: {
      legend: {
        display: false
      }
    }
  }), []);

  return (
    <div style={{ height }}>
      <Radar data={chartData} options={options} />
    </div>
  );
}
