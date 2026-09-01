 /* components/ClassSwitcher/ClassSwitcher.jsx */
import { useState } from 'react';
import { useLayout } from '../../contexts/LayoutContext';
import Icon from '../Icon/Icon';

const COLORS = ['primary', 'secondary', 'accent'];

export default function ClassSwitcher({ className = '' }) {
  const { groups, level, switchClass, switching, activeGroupId } = useLayout();
  const [open, setOpen] = useState(false);

  if (!groups?.length) return null;

  const current = groups.find((group) => group.id === activeGroupId) || groups[0];
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
    <div className={`class-switcher ${className}`.trim()}>
      <button
        className="btn btn-ghost btn-sm"
        onClick={() => setOpen((value) => !value)}
        disabled={switching}
      >
        <Icon name="graduation-cap" />
        <span>{switching ? 'Switching...' : current?.name || 'Select'}</span>
        <Icon name="chevron-down" />
      </button>

      {open && (
        <>
          <div className="mobile-nav-overlay" onClick={() => setOpen(false)} />
          <div className="dropdown-menu">
            <div className="dropdown-item" style={{ fontWeight: 600, pointerEvents: 'none' }}>
              Switch {label}
            </div>
            <div className="dropdown-divider" />

            {groups.map((group, index) => (
              <button
                key={group.id}
                className="dropdown-item"
                onClick={() => handleSelect(group.id)}
                style={{ color: group.id === activeGroupId ? `var(--${COLORS[index % COLORS.length]})` : undefined }}
              >
                <span>{group.name}</span>
                {group.id === activeGroupId && <Icon name="check" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
