import Link from 'next/link';
import SiteFooter from '../components/SiteFooter';

export default function MembershipPage() {
  return (
    <main className="platform-page membership-page">
      <div className="platform-shell membership-shell">
        <header className="membership-hero">
          <Link href="/" className="membership-back">← Stories by Ami</Link>
          <span className="platform-kicker">Stories for the moments you are living now</span>
          <h1>Two new personalized stories every month.</h1>
          <p>Create one for a real-life moment and one purely for fun. Save every story, read it anywhere, and turn your favorites into printed keepsakes.</p>
        </header>

        <section className="membership-card">
          <div className="membership-price"><span>$</span><strong>9.99</strong><small>/ month</small></div>
          <h2>Ami Membership</h2>
          <ul>
            <li>2 digital story credits each month</li>
            <li>English, Spanish, or bilingual books</li>
            <li>Reader mode and downloadable PDF</li>
            <li>Cloud story library</li>
            <li>3 individual page regenerations per book</li>
            <li>1 cover regeneration per book</li>
            <li>Unused credits roll over up to 4</li>
            <li>$5 off standard hardcover copies</li>
          </ul>
          <button type="button" disabled>Membership checkout coming next</button>
          <small>Stripe billing and server-enforced story credits are the next platform milestone.</small>
        </section>

        <section className="membership-compare">
          <article><span>One-time digital story</span><strong>$12.99</strong><p>A complete personalized story without a subscription.</p></article>
          <article><span>Member hardcover</span><strong>$34.99</strong><p>Standard hardcover member price, plus shipping.</p></article>
          <article><span>Ami Studio</span><strong>From $79</strong><p>Human-created and reviewed premium keepsakes.</p></article>
        </section>
      </div>
      <SiteFooter />
    </main>
  );
}
