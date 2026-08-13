/*
 * Chioni — shell footer (adapted from the Vireo footer).
 * Server component (no interactivity).
 */
import Link from 'next/link';

export function Footer() {
  return (
    <footer className="ax-footer">
      <div className="ax-footer__left">
        <span className="ax-footer__copy">© 2026 Chioni</span>
        <span className="ax-footer__sep" aria-hidden="true">·</span>
        <span className="ax-footer__version ax-mono">v0.1.0</span>
      </div>
      <nav className="ax-footer__links" aria-label="Pied de page">
        <Link className="ax-footer__link" href="/">À propos</Link>
      </nav>
    </footer>
  );
}

export default Footer;
