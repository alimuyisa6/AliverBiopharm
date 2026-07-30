import { useState } from 'react';
import { useLayout } from '../contexts/LayoutContext';

const LEVEL_ACCENT = {
  'O-Level': 'switcher-olevel',
  'A-Level': 'switcher-alevel',
  'Pharmacy': 'switcher-pharmacy'
};

const ITEM_COLORS = ['cyan', 'magenta', 'blue', 'green', 'purple', 'orange'];

export default function ClassSwitcher() {
  const { groups, user, level, switchClass, switching, activeGroupId } = useLayout();
  const [open, setOpen] = useState(false);

  if (!user?.profile || !groups?.length) return null;

  const track = user.profile.track;
  const isPharmacy = track === 'Pharmacy';
  const label = level?.group_label || (isPharmacy ? 'Programme' : 'Class');
  const accentClass = LEVEL_ACCENT[track] || 'switcher-olevel';
  const current = groups.find(g => g.id === activeGroupId) || groups[0];

  async function handleSelect(groupId) {
    if (groupId === activeGroupId) { setOpen(false); return; }
    setOpen(false);
    await switchClass(groupId);
  }

  return (
    <div className={`class-switcher ${accentClass}`}>
      <button
        type="button"
        className="class-switcher-trigger"
        onClick={() => setOpen(o => !o)}
        disabled={switching}
        aria-expanded={open}
      >
        <i className="fa-solid fa-graduation-cap class-switcher-trigger-icon"></i>
        <span className="class-switcher-trigger-text">
          <span className="class-switcher-trigger-label">{label}</span>
          <span className="class-switcher-trigger-value">{switching ? 'Switching...' : (current?.name || 'Select')}</span>
        </span>
        <i className="fa-solid fa-chevron-down class-switcher-caret"></i>
      </button>

      {open && (
        <>
          <div className="class-switcher-backdrop" onClick={() => setOpen(false)} />
          <div className="class-switcher-menu">
            <div className="class-switcher-menu-header">
              <span>Switch {label}</span>
              <button type="button" className="class-switcher-close" onClick={() => setOpen(false)}>
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
            <div className="class-switcher-cards">
              {groups.map((g, idx) => {
                const color = ITEM_COLORS[idx % ITEM_COLORS.length];
                const isActive = g.id === activeGroupId;
                return (
                  <button
                    key={g.id}
                    type="button"
                    className={`class-switcher-card cs-${color}${isActive ? ' cs-active' : ''}`}
                    onClick={() => handleSelect(g.id)}
                  >
                    <span className="class-switcher-card-bar"></span>
                    <span className="class-switcher-card-name">{g.name}</span>
                    {isActive && <i className="fa-solid fa-circle-check class-switcher-card-check"></i>}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
} 
