 /* features/classroom/ClassroomTeaser.jsx */
import { useNavigate } from 'react-router-dom';
import { useLayout } from '../../contexts/LayoutContext';
import { SectionTeaser } from '../home/SectionTeaser';

export default function ClassroomTeaser() {
  const navigate = useNavigate();
  const { bootstrap } = useLayout();

  const uiComponents = bootstrap?.ui_components || [];
  const component = uiComponents.find((item) => item.component_key === 'classroom_teaser');
  const imageUrl = component?.properties?.image_url || '/images/classroom-teaser.jpg';

  return (
    <SectionTeaser
      eyebrow="Live Learning"
      title="Find a live room"
      intro="Step into live sessions with verified tutors — ask, discuss, and learn in real time."
      imageUrl={imageUrl}
      imageAlt="Students in a live classroom session"
      ctaLabel="Find a live room"
      onCtaClick={() => navigate('/classroom')}
      imageSide="left"
    />
  );
}
