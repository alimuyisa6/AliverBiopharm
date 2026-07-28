 import React from 'react';

export function TestimonialSlider({ quotes }) {
  if (!quotes || quotes.length === 0) return null;

  return (
    <section id="testimonials" className="section alt-bg reveal">
      <span className="sec-label">Testimonials</span>
      <h2 className="section-title">What Our Students Say</h2>
      <p className="section-subtitle">
        Real results from learners who transformed how they study Biology and Pharmacy.
      </p>
      <div className="testimonial-slider">
        <blockquote className="testimonial-quote">&ldquo;{quotes[0].text}&rdquo;</blockquote>
        <cite className="testimonial-author">— {quotes[0].author}</cite>
      </div>
    </section>
  );
}
