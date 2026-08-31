 // src/pages/Resources.jsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLayout } from '../contexts/LayoutContext';
import { getSections } from '../api/sections';
import ResourcesView from '../features/resources/ResourcesView';

export default function Resources() {
  const { user } = useAuth();
  const { level } = useLayout();
  const navigate = useNavigate();

  const [sections, setSections] = useState({});

  useEffect(() => {
    if (level?.id) {
      getSections(level.id).then(setSections).catch(() => {});
    }
  }, [level]);

  return (
    <ResourcesView
      sections={sections}
      user={user}
      navigate={navigate}
    />
  );
}
