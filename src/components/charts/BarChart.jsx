 import { Bar } from 'react-chartjs-2';
import { useMemo } from 'react';

export default function BarChart({ data, labels, label, color = '#2563EB', height = 280, horizontal = false }) {
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

          gradient.addColorStop(0, `${color}30`);
          gradient.addColorStop(0.5, `${color}70`);
          gradient.addColorStop(1, color);

          return gradient;
        },
        borderColor: color,
        borderWidth: 1.5,
        borderRadius: 8,
        borderSkipped: false,
        maxBarThickness: 40,
        hoverBackgroundColor: color,
        hoverBorderColor: color
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
      },
      tooltip: {
        backgroundColor: 'rgba(15, 23, 42, 0.9)',
        titleFont: { weight: '700', size: 13 },
        bodyFont: { size: 12 },
        padding: 12,
        cornerRadius: 8,
        displayColors: false
      }
    },
    scales: {
      x: {
        grid: {
          display: false
        },
        border: {
          display: false
        },
        ticks: {
          font: { size: 11, weight: '500' }
        }
      },
      y: {
        beginAtZero: true,
        grid: {
          color: 'rgba(100, 116, 139, 0.08)',
          drawBorder: false
        },
        border: {
          display: false
        },
        ticks: {
          padding: 8,
          precision: 0,
          font: { size: 11, weight: '500' }
        }
      }
    }
  }), [horizontal]);

  return (
    <div style={{ height, width: '100%' }}>
      <Bar data={chartData} options={options} />
    </div>
  );
}
