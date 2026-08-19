 import { Doughnut } from 'react-chartjs-2';
import { useMemo } from 'react';

export default function DonutChart({ data, labels, colors, centerValue = '', centerLabel = '', height = 280 }) {
  const chartData = useMemo(() => ({
    labels,
    datasets: [
      {
        data,
        backgroundColor: colors,
        borderWidth: 3,
        borderColor: '#FFFFFF',
        hoverBorderColor: '#FFFFFF',
        hoverBorderWidth: 4,
        hoverOffset: 8,
        borderRadius: 6,
        spacing: 3
      }
    ]
  }), [data, labels, colors]);

  const options = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    cutout: '72%',
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          padding: 14,
          usePointStyle: true,
          pointStyle: 'circle',
          font: {
            size: 11,
            weight: '500'
          },
          color: '#475569'
        }
      },
      tooltip: {
        backgroundColor: 'rgba(15, 23, 42, 0.9)',
        titleFont: { weight: '700', size: 13 },
        bodyFont: { size: 12 },
        padding: 12,
        cornerRadius: 8,
        callbacks: {
          label: (context) => {
            const total = data.reduce((a, b) => a + b, 0);

            return ` ${context.label}: ${context.parsed} (${Math.round((context.parsed / total) * 100)}%)`;
          }
        }
      }
    }
  }), [data]);

  return (
    <div className="recall-donut-wrapper" style={{ height, width: '100%' }}>
      <Doughnut data={chartData} options={options} />
      {centerValue && (
        <div className="recall-donut-center">
          <span className="recall-donut-value">{centerValue}</span>
          {centerLabel && <span className="recall-donut-label">{centerLabel}</span>}
        </div>
      )}
    </div>
  );
}
