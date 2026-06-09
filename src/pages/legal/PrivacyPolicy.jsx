import React, { useEffect, useState } from 'react';
import LegalLayout from '../../components/common/LegalLayout';

export default function PrivacyPolicy() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api?action=get_all_site_sections', { credentials: 'include' })
      .then(res => res.json())
      .then(json => {
        setData(json.data?.privacy);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ textAlign: 'center', padding: '4rem' }}>Loading privacy policy...</div>;
  if (!data) return <div style={{ textAlign: 'center', padding: '4rem' }}>Privacy policy not found.</div>;

  return (
    <LegalLayout title={data.title} lastUpdated={data.last_updated}>
      {data.sections?.map((section, idx) => (
        <section key={idx} style={{ borderBottom: '1px solid var(--clr-border-glow)', paddingBottom: '1.5rem' }}>
          <h2 style={{ fontSize: 'var(--text-h3)', marginBottom: '1rem', color: 'var(--clr-magenta)', fontFamily: 'var(--font-display)' }}>
            {section.heading}
          </h2>
          <div style={{ lineHeight: 'var(--lh-relaxed)', color: 'var(--clr-text-dim)' }}>
            {section.content.split('\n').map((p, i) => (
              <p key={i} style={{ marginBottom: '0.75rem' }}>{p}</p>
            ))}
          </div>
        </section>
      ))}
      <div style={{ marginTop: '3rem', paddingTop: '2rem', borderTop: '1px solid var(--clr-border-glow)', fontSize: 'var(--text-sm)', color: 'var(--clr-text-muted)' }}>
        © {new Date().getFullYear()} YourStudyApp. All rights reserved.
      </div>
    </LegalLayout>
  );
}
