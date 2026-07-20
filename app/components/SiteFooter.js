import Link from 'next/link';

export default function SiteFooter() {
  return (
    <footer className="site-trust-footer">
      <div className="site-trust-footer-inner">
        <div className="footer-brand-block">
          <Link href="/" className="footer-brand">AMI</Link>
          <p>Personalized digital and printed stories made from their world.</p>
        </div>
        <nav className="footer-links" aria-label="Policies and support">
          <Link href="/membership">Membership</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/refunds">Refunds</Link>
          <Link href="/shipping">Shipping</Link>
          <Link href="/contact">Contact</Link>
        </nav>
        <div className="footer-contact-block">
          <a href="mailto:support@storiesbyami.com">support@storiesbyami.com</a>
          <small>© {new Date().getFullYear()} Stories by Ami</small>
        </div>
      </div>
    </footer>
  );
}
