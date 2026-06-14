import { useEffect, useState } from 'react';
import { getRequest } from '../../api/client';

export default function QuizChallenges({ user }) {
  const [challenge, setChallenge] = useState(null);
  useEffect(() => {
    if (!user) return;
    getRequest('quiz', 'daily-challenge').then(setChallenge).catch(()=>{});
  }, [user]);
  if (!challenge) return null;
  const percent = (challenge.progress / challenge.target) * 100;
  return (
    <div className="daily-challenge-card">
      <i className="fa-solid fa-bolt"></i>
      <div><h4>{challenge.title}</h4><p>{challenge.reward_xp} XP</p></div>
      <div className="challenge-progress"><div style={{width:`${percent}%`}}></div></div>
      {challenge.completed ? <i className="fa-solid fa-check-circle"></i> : <span>{challenge.progress}/{challenge.target}</span>}
    </div>
  );
}
