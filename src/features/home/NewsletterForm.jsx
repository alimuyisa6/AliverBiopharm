 /* features/home/NewsletterForm.jsx */
import Button from '../../components/Button/Button';
import Input from '../../components/Input/Input';

export function NewsletterForm({ email, status, onChange, onSubmit }) {
  return (
    <section className="section reveal">
      <span className="sec-label">Updates</span>
      <h2 className="section-title">Never Miss a Resource</h2>
      <p className="section-subtitle">Weekly study tips, new content alerts, and platform news straight to your inbox.</p>
      <form onSubmit={onSubmit} style={{ maxWidth: 480, margin: '0 auto', display: 'flex', gap: 'var(--space-3)' }}>
        <Input
          type="email"
          placeholder="Enter your email"
          value={email}
          onChange={onChange}
          required
          style={{ flex: 1 }}
        />
        <Button type="submit" icon="paper-plane">Subscribe</Button>
      </form>
      {status && (
        <p style={{
          textAlign: 'center', marginTop: 'var(--space-3)', fontSize: 'var(--text-sm)',
          color: status.success ? 'var(--success)' : 'var(--error)',
        }}>
          {status.message}
        </p>
      )}
    </section>
  );
}
