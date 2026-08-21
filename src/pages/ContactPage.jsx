 /* pages/ContactPage.jsx */
import { useState, useEffect, useCallback } from 'react';
import { useLayout } from '../contexts/LayoutContext';
import { getSections } from '../api/sections';
import { submitContact } from '../api/cachedClient';
import { ContactSection } from '../features/contact/ContactSection';

export default function ContactPage() {
  const { level } = useLayout();
  const [sections, setSections] = useState({});
  const [contactForm, setContactForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [contactStatus, setContactStatus] = useState(null);

  useEffect(() => {
    if (level?.id) {
      getSections(level.id).then(setSections).catch(() => {});
    }
  }, [level]);

  const handleContactSubmit = useCallback(async (event) => {
    event.preventDefault();

    if (!contactForm.name || !contactForm.email || !contactForm.message) return;

    try {
      await submitContact(contactForm);
      setContactStatus({ success: true, message: 'Message sent!' });
      setContactForm({ name: '', email: '', subject: '', message: '' });
    } catch (error) {
      setContactStatus({ success: false, message: error.message });
    }
  }, [contactForm]);

  return (
    <div className="section">
      <span className="sec-label">Contact</span>
      <h1 className="section-title">Get in Touch</h1>
      <p className="section-subtitle">Questions, feedback, or partnership inquiries — we'd love to hear from you.</p>
      <ContactSection
        contactForm={contactForm}
        contactStatus={contactStatus}
        contactInfo={sections?.contact?.info || []}
        onChange={setContactForm}
        onSubmit={handleContactSubmit}
      />
    </div>
  );
}
