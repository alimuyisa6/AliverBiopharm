// features/home/PricingCards.jsx
import React from 'react';

export function PricingCards({ plans }) {
  return (
    <section id="pricing" className="section alt-bg reveal">
      <span className="sec-label">Membership</span>
      <h2 className="section-title">Find the Plan That Fits Your Goals</h2>
      <p className="section-subtitle">
        Every plan includes full access to our complete resource library, updated regularly with new content.
      </p>
      <div className="grid-3">
        {(plans || []).filter(Boolean).map(plan => (
          <div key={plan.name} className={`card pricing-card ${plan.featured ? 'featured' : ''}`}>
            <h3>{plan.name}</h3>
            <p>{plan.description}</p>
            <div className="price my-3">{plan.price}<span className="price-period">{plan.period}</span></div>
            <ul className="pricing-features">
              {(plan.features || []).filter(Boolean).map(f => (
                <li key={f}><i className="fa-solid fa-check"></i> {f}</li>
              ))}
            </ul>
            <button className="btn-primary mt-4">{plan.cta_text || 'Subscribe'}</button>
          </div>
        ))}
      </div>
    </section>
  );
}
