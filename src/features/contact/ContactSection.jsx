// features/contact/ContactSection.jsx
import React from 'react';

export function ContactSection({ contactForm, contactStatus, contactInfo, onChange, onSubmit }) {
  return (
    <section id="contact" className="section alt-bg reveal">
      <span className="sec-label">Support</span>
      <h2 className="section-title">We're Here to Help</h2>
      <p className="section-subtitle">
        Got a question or need guidance? Reach out and our team will get back to you within 24 hours.
      </p>
      <div className="grid-2">
        <form id="contact-form" onSubmit={onSubmit} className="contact-form">
          <div><label className="f-label">FULL NAME</label><input type="text" className="f-input" value={contactForm.name} onChange={e => onChange({ ...contactForm, name: e.target.value })} required /></div>
          <div><label className="f-label">EMAIL ADDRESS</label><input type="email" className="f-input" value={contactForm.email} onChange={e => onChange({ ...contactForm, email: e.target.value })} required /></div>
          <div><label className="f-label">SUBJECT</label><input type="text" className="f-input" value={contactForm.subject} onChange={e => onChange({ ...contactForm, subject: e.target.value })} required /></div>
          <div><label className="f-label">MESSAGE</label><textarea className="f-input" rows={4} value={contactForm.message} onChange={e => onChange({ ...contactForm, message: e.target.value })} required></textarea></div>
          <button type="submit" className="f-btn"><i className="fa-solid fa-paper-plane"></i> Send Message</button>
          {contactStatus && <div className={`contact-status ${contactStatus.success ? 'contact-status-success' : 'contact-status-error'}`}>{contactStatus.message}</div>}
        </form>
        <aside className="contact-info-card" id="contact-info-card">
          <div className="contact-info-header">
            <i className="fa-solid fa-headset contact-headset-icon"></i>
            <h3 className="contact-info-title">24/7 Support</h3>
          </div>
          {(contactInfo || []).filter(Boolean).map(info => (
            <div key={info.label} className="contact-info-row">
              <div className="contact-icon"><i className={info.icon}></i></div>
              <div>
                <div className="contact-info-label">{info.label}</div>
                <a href={info.href} className="contact-info-value">{info.value}</a>
              </div>
            </div>
          ))}
        </aside>
      </div>
    </section>
  );
}
