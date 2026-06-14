 import { useEffect, useState } from 'react';
import { getRequest } from '../../api/client';

export default function QuizLearningPath({ level }) {
  const [paths, setPaths] = useState([]);
  useEffect(() => {
    getRequest('interactions', 'learning-paths', { level }).then(setPaths).catch(() => {});
  }, [level]);
  if (!paths.length) return null;
  return (
    <div className="learning-path">
      <h3>Your Learning Path</h3>
      <div className="path-nodes">
        {paths.map((p, idx) => (
          <div key={p.id} className={`path-node ${p.completed ? 'completed' : ''}`}>
            <i className={`fa-solid ${p.icon}`}></i>
            <span>{p.topic_name}</span>
            {idx < paths.length - 1 && <i className="fa-solid fa-arrow-down"></i>}
          </div>
        ))}
      </div>
    </div>
  );
}
