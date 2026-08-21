 /* pages/FaqPage.jsx */
import { useState, useEffect } from 'react';
import { useLayout } from '../contexts/LayoutContext';
import { getSections } from '../api/sections';
import { FaqAccordion } from '../features/home/FaqAccordion';

export default function FaqPage() {
  const { level } = useLayout();
  const [sections, setSections] = useState({});

  useEffect(() => {
    if (level?.id) {
      getSections(level.id).then(setSections).catch(() => {});
    }
  }, [level]);

  return (
    <div className="section">
      <span className="sec-label">Support</span>
      <h1 className="section-title">Frequently Asked Questions</h1>
      <p className="section-subtitle">Answers to common questions about AliverBiopharm.</p>
      <FaqAccordion items={sections?.faq?.questions || []} />
    </div>
  );
}
