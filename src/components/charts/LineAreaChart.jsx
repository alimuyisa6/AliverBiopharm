import { Line } from 'react-chartjs-2';
import { useMemo } from 'react';

export default function LineAreaChart({ data, labels, label, color = '#2563EB', fill = true, height = 220 }) {
  const chartData = useMemo(() => ({
    labels,
    datasets: [
      {
        label,
        data,
        borderColor: color,
        backgroundColor: fill
          ? (context) => {
              const chart = context.chart;
              const { ctx, chartArea } = chart;

              if (!chartArea) return `${color}15`;

              const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);

              gradient.addColorStop(0, `${color}30`);
              gradient.addColorStop(1, `${color}00`);

              return gradient;
            }
          : `${color}15`,
        borderWidth: 2.5,
        pointBackgroundColor: color,
        pointBorderColor: '#FFFFFF',
        pointBorderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6,
        pointHoverBackgroundColor: color,
        pointHoverBorderColor: '#FFFFFF',
        pointHoverBorderWidth: 3,
        fill,
        tension: 0.4,
        cubicInterpolationMode: 'monotone'
      }
    ]
  }), [data, labels, label, color, fill]);

  const options = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false
    },
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        callbacks: {
          label: (context) => `${context.parsed.y} ${label.toLowerCase()}`
        }
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
  }), [label]);

  return (
    <div style={{ height }}>
      <Line data={chartData} options={options} />
    </div>
  );
}
