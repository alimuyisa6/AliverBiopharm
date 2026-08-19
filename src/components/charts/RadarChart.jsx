 import { Radar } from 'react-chartjs-2';
import { useMemo } from 'react';

export default function RadarChart({ data, labels, label, color = '#2563EB', height = 300 }) {
  const chartData = useMemo(() => ({
    labels,
    datasets: [
      {
        label,
        data,
        borderColor: color,
        backgroundColor: `${color}20`,
        borderWidth: 2.5,
        pointBackgroundColor: color,
        pointBorderColor: '#FFFFFF',
        pointBorderWidth: 2,
        pointRadius: 5,
        pointHoverRadius: 7,
        pointHoverBackgroundColor: color,
        pointHoverBorderColor: '#FFFFFF',
        pointHoverBorderWidth: 3
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
          color: 'rgba(100, 116, 139, 0.12)',
          circular: true
        },
        angleLines: {
          color: 'rgba(100, 116, 139, 0.12)'
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
      },
      tooltip: {
        backgroundColor: 'rgba(15, 23, 42, 0.9)',
        titleFont: { weight: '700', size: 13 },
        bodyFont: { size: 12 },
        padding: 12,
        cornerRadius: 8,
        displayColors: false
      }
    }
  }), []);

  return (
    <div style={{ height, width: '100%' }}>
      <Radar data={chartData} options={options} />
    </div>
  );
}
