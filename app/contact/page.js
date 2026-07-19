import Link from 'next/link';
import SiteFooter from '../components/SiteFooter';

export const metadata = {
  title: 'Contact | Stories by Ami',
  description: 'Contact Stories by Ami for account, story, membership, order, or privacy support.'
};

export default function ContactPage() {
  return (
    <main className="policy-page contact-page">
      <div className="policy-shell">
        <header className="policy-header">
          <Link href="/" className="policy-back">← Stories by Ami</Link>
          <span className="platform-kicker">Contact</span>
          <h1>How can we help?</h1>
          <p>Reach out about your account, story, membership, proof, printed book, privacy request, or partnership.</p>
        </header>
        <section className="contact-grid">
          <article>
            <span>Customer support</span>
            <h2>Story, account, or order help</h2>
            <p>Include the email used for your account and an order number when applicable.</p>
            <a href="mailto:support@storiesbyami.com">support@storiesbyami.com</a>
          </article>
          <article>
            <span>General inquiries</span>
            <h2>Press, partnerships, or hello</h2>
            <p>For non-support questions and conversations about Stories by Ami.</p>
            <a href="mailto:hello@storiesbyami.com">hello@storiesbyami.com</a>
          </article>
          <article>
            <span>Ami Studio</span>
            <h2>Custom keepsake projects</h2>
            <p>For premium, done-for-you books and personalized gift projects.</p>
            <a href="mailto:studio@storiesbyami.com">studio@storiesbyami.com</a>
          </article>
        </section>
        <div className="contact-note">
          <strong>For child-photo or privacy requests</strong>
          <p>Use the subject line “Privacy Request” and email support@storiesbyami.com. Do not email additional sensitive information unless we specifically request it.</p>
        </div>
      </div>
      <SiteFooter />
    </main>
  );
}
