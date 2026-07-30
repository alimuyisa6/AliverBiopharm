/* components/ClassSwitcher/ClassSwitcher.jsx */
import { useState } from 'react';
import { useLayout } from '../../contexts/LayoutContext';
import Icon from '../Icon/Icon';

const COLORS = ['primary', 'secondary', 'accent'];

export default function ClassSwitcher() {
  const { groups, user, level, switchClass, switching, activeGroupId } = useLayout();
  const [open, setOpen] = useState(false);

  if (!user?.profile || !groups?.length) return null;

  const current = groups.find((g) => g.id === activeGroupId) || groups[0];
  const label = level?.group_label || 'Class';

  const handleSelect = async (groupId) => {
    if (groupId === activeGroupId) {
      setOpen(false);
      return;
    }
    setOpen(false);
    await switchClass(groupId);
  };

  return (
    <div className="class-switcher">
      <button
        className="btn btn-ghost btn-sm"
        onClick={() => setOpen((o) => !o)}
        disabled={switching}
      >
        <Icon name="graduation-cap" />
        <span>{switching ? 'Switching...' : current?.name || 'Select'}</span>
        <Icon name="chevron-down" />
      </button>

      {open && (
        <>
          <div className="mobile-nav-overlay" onClick={() => setOpen(false)} />
          <div className="dropdown-menu" style={{ position: 'absolute', top: '100%', left: 0 }}>
            <div className="dropdown-item" style={{ fontWeight: 600, pointerEvents: 'none' }}>
              Switch {label}
            </div>
            <div className="dropdown-divider" />
            {groups.map((g, idx) => (
              <button
                key={g.id}
                className="dropdown-item"
                onClick={() => handleSelect(g.id)}
                style={{ color: g.id === activeGroupId ? `var(--${COLORS[idx % COLORS.length]})` : undefined }}
              >
                <span>{g.name}</span>
                {g.id === activeGroupId && <Icon name="check" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
} 
