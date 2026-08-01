 /* features/contact/ContactSection.jsx */
import Icon from '../../components/Icon/Icon';
import Input from '../../components/Input/Input';
import Textarea from '../../components/Textarea/Textarea';
import Button from '../../components/Button/Button';

export function ContactSection({ contactForm, contactStatus, contactInfo = [], onChange, onSubmit }) {
  return (
    <section className="section reveal">
      <span className="sec-label">Support</span>
      <h2 className="section-title">We're Here to Help</h2>
      <p className="section-subtitle">Got a question? Our team will get back to you within 24 hours.</p>
      <div className="grid grid-cols-2" style={{ alignItems: 'start' }}>
        <form onSubmit={onSubmit}>
          <div className="card card-blue form-card">
            <Input
              label="Full Name"
              value={contactForm.name}
              onChange={(e) => onChange({ ...contactForm, name: e.target.value })}
              required
              icon="user"
            />
            <Input
              label="Email Address"
              type="email"
              value={contactForm.email}
              onChange={(e) => onChange({ ...contactForm, email: e.target.value })}
              required
              icon="envelope"
            />
            <Input
              label="Subject"
              value={contactForm.subject}
              onChange={(e) => onChange({ ...contactForm, subject: e.target.value })}
              required
            />
            <Textarea
              label="Message"
              value={contactForm.message}
              onChange={(e) => onChange({ ...contactForm, message: e.target.value })}
              rows={4}
              required
            />
            <Button type="submit" icon="paper-plane">Send Message</Button>
            {contactStatus && (
              <p className={`form-status ${contactStatus.success ? 'success' : 'error'}`}>
                {contactStatus.message}
              </p>
            )}
          </div>
        </form>
        <div className="card card-teal form-card">
          <h3 className="form-card-heading">
            <Icon name="headset" className="icon" />
            Contact Info
          </h3>
          {contactInfo.map((info) => (
            <div key={info.label} className="contact-info-row">
              <span className="contact-info-icon">
                <Icon name={info.icon || 'circle-info'} />
              </span>
              <div>
                <div className="contact-info-label">{info.label}</div>
                <a href={info.href} className="contact-info-value">{info.value}</a>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
