import Link from 'next/link';
import SiteFooter from './SiteFooter';

export default function PolicyPage({ kicker, title, intro, children }) {
  return (
    <main className="policy-page">
      <div className="policy-shell">
        <header className="policy-header">
          <Link href="/" className="policy-back">← Back to AMI</Link>
          <span className="platform-kicker">{kicker}</span>
          <h1>{title}</h1>
          {intro && <p>{intro}</p>}
          <small>Last updated July 19, 2026</small>
        </header>
        <article className="policy-card">{children}</article>
      </div>
      <SiteFooter />
    </main>
  );
}
