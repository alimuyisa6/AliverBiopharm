 /* features/home/TestimonialSlider.jsx */
export function TestimonialSlider({ quotes = [] }) {
  if (!quotes.length) return null;
  return (
    <section className="section reveal">
      <span className="sec-label">Testimonials</span>
      <h2 className="section-title">What Our Students Say</h2>
      <p className="section-subtitle">Real results from learners who transformed how they study.</p>
      <div className="card" style={{ maxWidth: 600, margin: '0 auto', padding: 'var(--space-8)', textAlign: 'center' }}>
        <p style={{ fontSize: 'var(--text-lg)', fontStyle: 'italic', color: 'var(--text-dim)', marginBottom: 'var(--space-4)' }}>
          &ldquo;{quotes[0].text}&rdquo;
        </p>
        <cite style={{ fontWeight: 600, color: 'var(--text-main)' }}>&mdash; {quotes[0].author}</cite>
      </div>
    </section>
  );
}
