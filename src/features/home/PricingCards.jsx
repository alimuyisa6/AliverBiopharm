 /* features/home/PricingCards.jsx */
export function PricingCards({ plans }) {
  if (!plans || !Array.isArray(plans)) return null;

  return (
    <section className="section">
      <div className="section-head">
        <div className="section-head-left">
          <span className="eyebrow">Membership</span>
          <h2>Find the plan that fits your goals</h2>
        </div>
      </div>
      <div className="pricing-grid">
        {plans.filter(Boolean).map(plan => (
          <div key={plan.name} className="pricing-card">
            <h3>{plan.name}</h3>
            <p>{plan.description}</p>
            <div className="price">{plan.price}<span className="price-period">{plan.period}</span></div>
            <ul>
              {(plan.features || []).filter(Boolean).map(f => <li key={f}>{f}</li>)}
            </ul>
            <button className="btn btn-primary pricing-cta-btn">{plan.cta_text || 'Subscribe'}</button>
          </div>
        ))}
      </div>
    </section>
  );
}
