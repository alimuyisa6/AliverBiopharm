/* features/quiz/QuizChallenges.jsx */
import { useEffect, useState } from 'react';
import { getRequest } from '../../api/client';
import Icon from '../../components/Icon/Icon';
import ProgressBar from '../../components/ProgressBar/ProgressBar';

export default function QuizChallenges({ user, level, class_name }) {
  const [challenge, setChallenge] = useState(null);

  useEffect(() => {
    if (!user) return;

    getRequest('interactions', 'daily-challenge').then(setChallenge).catch(() => {});
  }, [user]);

  if (!challenge || !challenge.title) return null;

  const levelName = level?.display_name || level?.id || '';
  const classLabel = class_name || '';

  return (
    <div className="card card-amber quiz-challenge-card">
      <Icon name="rocket" className="quiz-challenge-icon" />

      <div className="quiz-challenge-body">
        <h4 className="quiz-challenge-title">
          {challenge.title}
          {levelName && <span className="quiz-challenge-sublabel"> — {levelName}{classLabel ? ` · ${classLabel}` : ''}</span>}
        </h4>

        <p className="quiz-challenge-reward">{challenge.reward_xp} XP reward</p>
        <ProgressBar value={challenge.progress} max={challenge.target} variant="warm" />
      </div>

      <div className="quiz-challenge-status">
        {challenge.completed ? (
          <Icon name="circle-check" className="icon-complete" />
        ) : (
          <span className="progress-label">{challenge.progress}/{challenge.target}</span>
        )}
      </div>
    </div>
  );
} 
