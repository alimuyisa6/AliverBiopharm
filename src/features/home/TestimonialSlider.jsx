 import Icon from '../../components/Icon/Icon';

export function TestimonialSlider({ quotes = [] }) {
  if (!quotes.length) return null;

  return (
    <section className="section testimonial-band reveal">
      <span className="sec-label">Testimonials</span>
      <h2 className="section-title">
        What Our<br />Students Say
      </h2>
      <p className="section-subtitle">
        Real results from learners who transformed how they study.
      </p>

      <div className="testimonial-card">
        <Icon name="quote-left" className="testimonial-quote-icon" />
        <p className="testimonial-text">
          {quotes[0].text}
        </p>
        <cite className="testimonial-author">{quotes[0].author}</cite>
      </div>
    </section>
  );
}
