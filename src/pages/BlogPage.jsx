/* pages/BlogPage.jsx */
import { useState, useEffect } from 'react';
import { useLayout } from '../contexts/LayoutContext';
import { getSections } from '../api/sections';
import { BlogGrid } from '../features/home/BlogGrid';

export default function BlogPage() {
  const { level } = useLayout();
  const [sections, setSections] = useState({});

  useEffect(() => {
    if (level?.id) {
      getSections(level.id).then(setSections).catch(() => {});
    }
  }, [level]);

  return (
    <div className="section">
      <span className="sec-label">Blog</span>
      <h1 className="section-title">Study Tips &amp; Updates</h1>
      <p className="section-subtitle">Guides, announcements, and study strategies from the AliverBiopharm team.</p>
      <BlogGrid posts={sections?.blog?.posts || []} />
    </div>
  );
}
