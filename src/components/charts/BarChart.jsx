import { Bar } from 'react-chartjs-2';
import { useMemo } from 'react';

export default function BarChart({ data, labels, label, color = '#2563EB', height = 220, horizontal = false }) {
  const chartData = useMemo(() => ({
    labels,
    datasets: [
      {
        label,
        data,
        backgroundColor: (context) => {
          const chart = context.chart;
          const { ctx, chartArea } = chart;

          if (!chartArea) return color;

          const gradient = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);

          gradient.addColorStop(0, `${color}20`);
          gradient.addColorStop(1, color);

          return gradient;
        },
        borderColor: color,
        borderWidth: 1,
        borderRadius: 6,
        borderSkipped: false,
        maxBarThickness: 32
      }
    ]
  }), [data, labels, label, color]);

  const options = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: horizontal ? 'y' : 'x',
    plugins: {
      legend: {
        display: false
      }
    },
    scales: {
      x: {
        grid: {
          display: false
        },
        ticks: {
          maxRotation: 0,
          autoSkip: true,
          maxTicksLimit: 7
        }
      },
      y: {
        beginAtZero: true,
        grid: {
          color: 'rgba(100, 116, 139, 0.08)',
          drawBorder: false
        },
        ticks: {
          padding: 8,
          precision: 0
        }
      }
    }
  }), [horizontal]);

  return (
    <div style={{ height }}>
      <Bar data={chartData} options={options} />
    </div>
  );
}
