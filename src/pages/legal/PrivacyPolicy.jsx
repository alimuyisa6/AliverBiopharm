 import React, { useEffect, useState } from 'react';
import LegalLayout from '../../components/common/LegalLayout';

export default function PrivacyPolicy() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'get_all_site_sections' }),
      credentials: 'include'
    })
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
        <section key={idx}>
          <h2>{section.heading}</h2>
          {section.content.split('\n').map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </section>
      ))}
    </LegalLayout>
  );
}
