 import { useEffect, useState } from 'react';
import { getRequest } from '../../api/client';

export default function QuizWeakAreas({ user, onRecommend }) {
  const [weak, setWeak] = useState(null);
  useEffect(() => {
    if (!user) return;
    getRequest('interactions', 'weak-areas').then(setWeak).catch(() => {});
  }, [user]);
  if (!weak || !weak.weak_topics.length) return null;
  return (
    <div className="weak-areas-card">
      <i className="fa-solid fa-lightbulb"></i>
      <div>
        <h4>Focus Areas</h4>
        <ul>{weak.weak_topics.map(t => <li key={t}>{t}</li>)}</ul>
        {weak.recommended_block && (
          <button onClick={() => onRecommend(weak.recommended_block.topic, weak.recommended_block.block)}>
            Continue → {weak.recommended_block.topic} Block {weak.recommended_block.block}
          </button>
        )}
      </div>
    </div>
  );
}
