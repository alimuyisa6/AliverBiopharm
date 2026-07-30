import { useState } from 'react';
import { useLayout } from '../contexts/LayoutContext';

export default function ClassSwitcher() {
  const { groups, user, switchClass, switching, activeGroupId } = useLayout();
  const [open, setOpen] = useState(false);

  if (!user?.profile || !groups?.length) return null;

  const current = groups.find(g => g.id === activeGroupId) || groups[0];

  async function handleSelect(groupId) {
    if (groupId === activeGroupId) { setOpen(false); return; }
    setOpen(false);
    await switchClass(groupId);
  }

  return (
    <div className="class-switcher">
      <button
        type="button"
        className="class-switcher-trigger"
        onClick={() => setOpen(o => !o)}
        disabled={switching}
        aria-expanded={open}
      >
        <i className="fa-solid fa-graduation-cap"></i>
        <span>{switching ? 'Switching...' : (current?.name || 'Select Class')}</span>
        <i className="fa-solid fa-chevron-down class-switcher-caret"></i>
      </button>
      {open && (
        <div className="class-switcher-menu">
          {groups.map(g => (
            <button
              key={g.id}
              type="button"
              className={`class-switcher-item${g.id === activeGroupId ? ' active' : ''}`}
              onClick={() => handleSelect(g.id)}
            >
              {g.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
