/* features/tutor-marketplace/TutorMarketplaceTeaser.jsx */
import { useNavigate } from 'react-router-dom';
import { useLayout } from '../../contexts/LayoutContext';
import { SectionTeaser } from '../home/SectionTeaser';

export default function TutorMarketplaceTeaser() {
  const navigate = useNavigate();
  const { bootstrap } = useLayout();

  const uiComponents = bootstrap?.ui_components || [];
  const component = uiComponents.find((item) => item.component_key === 'tutor_marketplace_teaser');
  const imageUrl = component?.properties?.image_url || '/images/tutor-marketplace-teaser.jpg';

  return (
    <SectionTeaser
      eyebrow="Tutor Marketplace"
      title="Find your tutor"
      intro="Search qualified tutors by subject, level and availability, and connect directly for one-to-one help."
      imageUrl={imageUrl}
      imageAlt="A tutor helping a student"
      ctaLabel="Find your tutor"
      onCtaClick={() => navigate('/tutors')}
      imageSide="right"
    />
  );
}
