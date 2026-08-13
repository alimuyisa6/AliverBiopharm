 /* features/home/PlatformCards.jsx */
import { useLayout } from '../../contexts/LayoutContext';
import Icon from '../../components/Icon/Icon';

const LEVEL_COLOR_MAP = {
  'o-level': 'blue',
  olevel: 'blue',
  'a-level': 'teal',
  alevel: 'teal',
  pharmacy: 'violet'
};

const FALLBACK_COLORS = ['blue', 'teal', 'violet', 'amber', 'emerald'];

function getCardColor(group, index) {
  const key = group.level_id?.toLowerCase?.() || group.id?.toLowerCase?.();

  return LEVEL_COLOR_MAP[key] || FALLBACK_COLORS[index % FALLBACK_COLORS.length];
}

export function PlatformCards() {
  const { groups, bootstrap } = useLayout();

  if (!groups?.length) return null;

  const uiComponents = bootstrap?.ui_components || [];

  function getImage(groupId) {
    const component = uiComponents.find((item) => item.component_key === `platform_card_${groupId}`);

    return component?.properties?.image_url || null;
  }

  return (
    <section className="section reveal">
      <span className="sec-label">Platforms</span>
      <h2 className="section-title">
        Explore Our<br />Platforms
      </h2>
      <p className="section-subtitle">
        Choose your path and start learning today.
      </p>

      <div className="grid grid-cols-3">
        {groups.map((group, index) => {
          const imageUrl = getImage(group.id);
          const color = getCardColor(group, index);

          return (
            <div key={group.id} className={`card card-${color}`}>
              {imageUrl ? (
                <img src={imageUrl} alt={group.name} className="card-image" loading="lazy" />
              ) : (
                <div className="card-image-placeholder">
                  <Icon name={group.icon === 'dna' ? 'microscope' : group.icon || 'book-open'} />
                </div>
              )}

              <div className="card-body">
                <h3 className="card-title">{group.name}</h3>
                <p className="card-text">{group.description || 'Comprehensive learning resources tailored for you.'}</p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
