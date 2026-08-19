 import {
  Chart as ChartJS,
  ArcElement,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  RadialLinearScale,
  Filler,
  Tooltip,
  Legend
} from 'chart.js';

ChartJS.register(
  ArcElement,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  RadialLinearScale,
  Filler,
  Tooltip,
  Legend
);

ChartJS.defaults.font.family = "'Inter', 'Segoe UI', sans-serif";
ChartJS.defaults.font.size = 12;
ChartJS.defaults.color = '#64748B';
ChartJS.defaults.borderColor = 'rgba(100, 116, 139, 0.1)';
ChartJS.defaults.plugins.legend.labels.usePointStyle = true;
ChartJS.defaults.plugins.legend.labels.padding = 16;
ChartJS.defaults.plugins.legend.labels.boxWidth = 8;
ChartJS.defaults.plugins.legend.labels.boxHeight = 8;
ChartJS.defaults.plugins.tooltip.backgroundColor = 'rgba(15, 23, 42, 0.9)';
ChartJS.defaults.plugins.tooltip.padding = 12;
ChartJS.defaults.plugins.tooltip.cornerRadius = 8;
ChartJS.defaults.plugins.tooltip.titleFont = { weight: '600', size: 13 };
ChartJS.defaults.plugins.tooltip.bodyFont = { size: 12 };
ChartJS.defaults.animation.duration = 800;
ChartJS.defaults.animation.easing = 'easeOutQuart';

export default function ChartRegistry() {
  return null;
}
