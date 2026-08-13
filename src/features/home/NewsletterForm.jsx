/* features/home/NewsletterForm.jsx */
import Button from '../../components/Button/Button';
import Input from '../../components/Input/Input';

export function NewsletterForm({ email, status, onChange, onSubmit }) {
  return (
    <section className="section reveal">
      <span className="sec-label">Updates</span>
      <h2 className="section-title">
        Never Miss<br />a Resource
      </h2>
      <p className="section-subtitle">
        Weekly study tips, new content alerts, and platform news straight to your inbox.
      </p>

      <div className="card card-violet newsletter-card">
        <form onSubmit={onSubmit} className="newsletter-form-row">
          <Input
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={onChange}
            required
            className="newsletter-input"
          />
          <Button type="submit" icon="paper-plane">Subscribe</Button>
        </form>

        {status && (
          <p className={`form-status newsletter-status ${status.success ? 'success' : 'error'}`}>
            {status.message}
          </p>
        )}
      </div>
    </section>
  );
} 
