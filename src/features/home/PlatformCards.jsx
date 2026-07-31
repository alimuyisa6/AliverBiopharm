 /* features/home/PlatformCards.jsx */
import { useLayout } from '../../contexts/LayoutContext';
import { useNavigate } from 'react-router-dom';
import Icon from '../../components/Icon/Icon';

export function PlatformCards() {
  const { groups } = useLayout();
  const navigate = useNavigate();
  if (!groups?.length) return null;

  return (
    <section className="section reveal">
      <span className="sec-label">Platforms</span>
      <h2 className="section-title">Explore Our Platforms</h2>
      <p className="section-subtitle">Choose your path and start learning today.</p>
      <div className="grid grid-cols-3">
        {groups.map((group) => (
          <button
            key={group.id}
            className="card card-clickable"
            onClick={() => navigate(`/level/${group.level_id}/group/${group.id}`)}
          >
            <div className="card-image-placeholder">
              <Icon name={group.icon || 'book-open'} />
            </div>
            <div className="card-body">
              <h3 className="card-title">{group.name}</h3>
              <p className="card-text">{group.description || 'Comprehensive learning resources tailored for you.'}</p>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
