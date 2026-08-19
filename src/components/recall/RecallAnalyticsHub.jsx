import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import Card from '../Card/Card';
import Icon from '../Icon/Icon';
import Button from '../Button/Button';
import LineAreaChart from '../charts/LineAreaChart';
import DonutChart from '../charts/DonutChart';
import BarChart from '../charts/BarChart';
import RadarChart from '../charts/RadarChart';
import Skeleton from '../Skeleton/Skeleton';
import { getRecallDashboard, getRecallStats } from '../../api/cachedClient';

const GRAPH_TYPES = [
  {
    key: 'weekly_xp',
    title: 'Weekly XP Progress',
    icon: 'chart-line',
    color: '#2563EB',
    gradientTo: '#7C3AED',
    description: 'Track your XP earnings over the last 7 days. This shows your learning momentum and consistency.',
    insight: 'Consistent daily practice leads to steady XP growth. Aim for at least 20 XP per day to maintain your streak.'
  },
  {
    key: 'confidence',
    title: 'Confidence Distribution',
    icon: 'chart-pie',
    color: '#059669',
    description: 'See how well you recall concepts. Excellent means perfect recall, Strong means close, Developing means needs review.',
    insight: 'A healthy mix shows you are challenging yourself. Too many "Easy" ratings may mean the questions are too simple.'
  },
  {
    key: 'topic_mastery',
    title: 'Topic Mastery Radar',
    icon: 'bullseye',
    color: '#7C3AED',
    description: 'Compare your mastery across all biology topics. Each axis represents a topic, and the shape shows your strengths.',
    insight: 'A balanced shape means well-rounded knowledge. If one side is flat, focus more on that topic.'
  },
  {
    key: 'questions_per_topic',
    title: 'Questions per Topic',
    icon: 'chart-bar',
    color: '#0D9488',
    description: 'See how many questions you have answered in each topic. This shows where you spend your study time.',
    insight: 'Make sure your study time is distributed. Over-focusing on one topic may leave gaps elsewhere.'
  }
];

export default function RecallAnalyticsHub() {
  const { user } = useAuth();
  const [activeGraph, setActiveGraph] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    Promise.all([
      getRecallDashboard(),
      getRecallStats()
    ])
      .then(([dash, statsData]) => {
        setStats({
          ...dash,
          ...statsData
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user]);

  if (loading || !stats) {
    return (
      <div className="recall-analytics-hub">
        <Skeleton height={200} />
      </div>
    );
  }

  const topicNames = Object.keys(stats.mastery_topics || {}).slice(0, 6);
  const topicMastery = topicNames.map((topic) => stats.mastery_topics[topic]);

  const confidenceData = [
    stats.excellent_count || 0,
    stats.strong_count || 0,
    stats.developing_count || 0
  ];

  const weeklyXp = [
    stats.daily_activity?.mon || 0,
    stats.daily_activity?.tue || 0,
    stats.daily_activity?.wed || 0,
    stats.daily_activity?.thu || 0,
    stats.daily_activity?.fri || 0,
    stats.daily_activity?.sat || 0,
    stats.daily_activity?.sun || 0
  ];

  const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const activeGraphData = GRAPH_TYPES.find((g) => g.key === activeGraph);

  const renderGraph = () => {
    switch (activeGraph) {
      case 'weekly_xp':
        return (
          <LineAreaChart
            data={weeklyXp}
            labels={dayLabels}
            label="XP"
            color="#2563EB"
            gradientTo="#7C3AED"
            height={380}
          />
        );
      case 'confidence':
        return (
          <DonutChart
            data={confidenceData}
            labels={['Excellent', 'Strong', 'Developing']}
            colors={['#059669', '#2563EB', '#D97706']}
            centerValue={`${stats.accuracy || 0}%`}
            centerLabel="Accuracy"
            height={380}
          />
        );
      case 'topic_mastery':
        return (
          <RadarChart
            data={topicMastery.length ? topicMastery : [0, 0, 0, 0, 0, 0]}
            labels={topicNames.length ? topicNames : ['Biology', 'Cells', 'Plants', 'Insects', 'Kingdoms', 'Classification']}
            label="Mastery"
            color="#7C3AED"
            height={400}
          />
        );
      case 'questions_per_topic':
        return (
          <BarChart
            data={topicMastery.length ? topicMastery : [0, 0, 0, 0, 0, 0]}
            labels={topicNames.length ? topicNames : ['Biology', 'Cells', 'Plants', 'Insects', 'Kingdoms', 'Classification']}
            label="Questions"
            color="#0D9488"
            height={400}
            horizontal={true}
          />
        );
      default:
        return null;
    }
  };

  if (activeGraph && activeGraphData) {
    return (
      <div className="recall-graph-fullpage">
        <Card className="recall-graph-fullpage-card">
          <div className="recall-graph-fullpage-header">
            <div>
              <h3 className="recall-graph-fullpage-title">
                <Icon name={activeGraphData.icon} className="recall-graph-fullpage-icon" />
                {activeGraphData.title}
              </h3>
              <p className="recall-graph-fullpage-desc">{activeGraphData.description}</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setActiveGraph(null)}>
              <Icon name="arrow-left" /> Back to Graphs
            </Button>
          </div>

          <div className="recall-graph-fullpage-area">
            {renderGraph()}
          </div>

          <div className="recall-graph-fullpage-insight">
            <Icon name="lightbulb" className="recall-graph-fullpage-insight-icon" />
            <div>
              <span className="recall-graph-fullpage-insight-label">Insight</span>
              <p className="recall-graph-fullpage-insight-text">{activeGraphData.insight}</p>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="recall-analytics-hub">
      <div className="recall-analytics-header">
        <h3 className="recall-analytics-title">
          <Icon name="chart-line" className="recall-analytics-title-icon" />
          Learning Analytics
        </h3>
        <p className="recall-analytics-subtitle">
          Visualize your progress and identify areas for improvement
        </p>
      </div>

      <div className="recall-analytics-grid">
        {GRAPH_TYPES.map((graph) => (
          <Card key={graph.key} className="recall-analytics-card" onClick={() => setActiveGraph(graph.key)}>
            <div className="recall-analytics-card-body">
              <Icon name={graph.icon} className="recall-analytics-card-icon" style={{ color: graph.color }} />
              <h4 className="recall-analytics-card-title">{graph.title}</h4>
              <p className="recall-analytics-card-desc">{graph.description}</p>
              <Button variant="ghost" size="sm" className="recall-analytics-card-btn">
                View Graph <Icon name="arrow-right" />
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
} 
