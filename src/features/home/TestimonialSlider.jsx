 /* features/home/TestimonialSlider.jsx */
import Icon from '../../components/Icon/Icon';

export function TestimonialSlider({ quotes = [] }) {
  if (!quotes.length) return null;

  return (
    <section className="section">
      <div className="section-head">
        <div className="section-head-left">
          <span className="eyebrow">Testimonials</span>
          <h2>What our students say</h2>
        </div>
      </div>
      <div className="testimonial-flat">
        <blockquote>{quotes[0].text}</blockquote>
        <cite>{quotes[0].author}</cite>
      </div>
    </section>
  );
}
