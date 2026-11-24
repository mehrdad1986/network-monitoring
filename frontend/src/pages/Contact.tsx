import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import './Contact.css';

const recipient = process.env.REACT_APP_CONTACT_EMAIL || '';

export function Contact() {
  const [status, setStatus] = useState('');

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const message = String(form.get('message') || '').trim();
    if (!message) {
      setStatus('Write a message before sending.');
      return;
    }
    if (!recipient) {
      setStatus('Contact delivery is not configured on this server yet.');
      return;
    }
    const lines = [
      `Name: ${String(form.get('name') || '').trim()}`,
      `Family name: ${String(form.get('familyName') || '').trim()}`,
      `Email: ${String(form.get('email') || '').trim()}`,
      `Phone: ${String(form.get('phone') || '').trim()}`,
      '',
      message,
    ];
    window.location.href = `mailto:${encodeURIComponent(recipient)}?subject=${encodeURIComponent('Message from NetMon')}&body=${encodeURIComponent(lines.join('\n'))}`;
    setStatus('Your email app opened with the message. Send it there to deliver it.');
  };

  return (
    <div className="contact-standalone" data-page="Contact">
      <main className="contact-page">
        <header className="contact-header">
          <div><span className="contact-eyebrow">NETMON</span><h1>Contact</h1><p>Send us a message. Your contact details are optional.</p></div>
          <Link className="contact-back" to="/dashboard" aria-label="Back to dashboard" title="Back to dashboard">
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 12H5m7 7-7-7 7-7" /></svg>
          </Link>
        </header>
        <form className="contact-form" onSubmit={submit}>
          <div className="contact-fields">
            <label>Name<input name="name" autoComplete="given-name" /></label>
            <label>Family name<input name="familyName" autoComplete="family-name" /></label>
            <label>Email address<input name="email" type="email" autoComplete="email" /></label>
            <label>Phone number<input name="phone" type="tel" autoComplete="tel" /></label>
          </div>
          <label className="contact-message-label" htmlFor="contact-message">Message</label>
          <textarea id="contact-message" name="message" className="contact-message" required placeholder="Write your message here…" />
          <div className="contact-submit-row">
            <button type="submit" className="contact-submit">Send message</button>
            <p role="status" aria-live="polite">{status}</p>
          </div>
        </form>
      </main>
    </div>
  );
}
