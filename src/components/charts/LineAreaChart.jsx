 import { Line } from 'react-chartjs-2';
import { useMemo } from 'react';

export default function LineAreaChart({ data, labels, label, color = '#2563EB', gradientTo = '#7C3AED', fill = true, height = 280 }) {
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

              gradient.addColorStop(0, `${color}35`);
              gradient.addColorStop(0.5, `${color}12`);
              gradient.addColorStop(1, `${color}02`);

              return gradient;
            }
          : 'transparent',
        borderWidth: 3.5,
        pointBackgroundColor: color,
        pointBorderColor: '#FFFFFF',
        pointBorderWidth: 2.5,
        pointRadius: 5,
        pointHoverRadius: 7,
        pointHoverBackgroundColor: gradientTo,
        pointHoverBorderColor: '#FFFFFF',
        pointHoverBorderWidth: 3,
        fill,
        tension: 0.4,
        cubicInterpolationMode: 'monotone',
        spanGaps: true
      }
    ]
  }), [data, labels, label, color, gradientTo, fill]);

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
        backgroundColor: 'rgba(15, 23, 42, 0.9)',
        titleFont: { weight: '700', size: 13 },
        bodyFont: { size: 12 },
        padding: 12,
        cornerRadius: 8,
        displayColors: false,
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
        border: {
          display: false
        },
        ticks: {
          maxRotation: 0,
          autoSkip: true,
          maxTicksLimit: 7,
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
  }), [label]);

  return (
    <div style={{ height, width: '100%' }}>
      <Line data={chartData} options={options} />
    </div>
  );
}
