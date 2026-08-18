import { Doughnut } from 'react-chartjs-2';
import { useMemo } from 'react';

export default function DonutChart({ data, labels, colors, centerLabel = '', centerValue = '', height = 220 }) {
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
        borderRadius: 4,
        spacing: 2
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
          padding: 12,
          usePointStyle: true,
          pointStyle: 'circle',
          font: {
            size: 11,
            weight: '500'
          }
        }
      },
      tooltip: {
        callbacks: {
          label: (context) => `${context.label}: ${context.parsed} (${Math.round((context.parsed / data.reduce((a, b) => a + b, 0)) * 100)}%)`
        }
      }
    }
  }), [data]);

  return (
    <div className="recall-donut-wrapper" style={{ height }}>
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
