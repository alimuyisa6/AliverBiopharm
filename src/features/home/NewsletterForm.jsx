 /* features/home/NewsletterForm.jsx */
import Button from '../../components/Button/Button';
import Input from '../../components/Input/Input';

export function NewsletterForm({ email, status, onChange, onSubmit }) {
  return (
    <section className="section">
      <div className="section-head">
        <div className="section-head-left">
          <span className="eyebrow">Updates</span>
          <h2>Never miss a resource</h2>
        </div>
      </div>
      <form onSubmit={onSubmit} className="newsletter-form-row">
        <Input
          type="email"
          placeholder="Enter your email"
          value={email}
          onChange={onChange}
          required
        />
        <Button type="submit" icon="paper-plane">Subscribe</Button>
      </form>
      {status && (
        <p className={`form-status ${status.success ? 'success' : 'error'}`}>
          {status.message}
        </p>
      )}
    </section>
  );
}
