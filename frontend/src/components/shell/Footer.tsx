/*
 * Vireo Next.js — Footer (1:1 with partials/footer.html).
 * Server component (no interactivity); uses next/link for nav.
 */
import Link from 'next/link';

export function Footer() {
  return (
    <footer className="ax-footer">
      <div className="ax-footer__left">
        <span className="ax-footer__copy">© 2026 Vireo</span>
        <span className="ax-footer__sep" aria-hidden="true">·</span>
        <span className="ax-footer__version ax-mono">v1.0.0</span>
      </div>
      <nav className="ax-footer__links" aria-label="Footer">
        <Link className="ax-footer__link" href="/pages/landing">About</Link>
        <Link className="ax-footer__link" href="/pages/support">Support</Link>
        <Link className="ax-footer__link" href="/pages/terms">Terms</Link>
        <Link className="ax-footer__link" href="/pages/privacy">Privacy</Link>
      </nav>
    </footer>
  );
}

export default Footer;
