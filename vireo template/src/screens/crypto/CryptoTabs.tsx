'use client';
/*
 * Vireo Next.js — shared crypto sub-nav (the .ax-tabs pill row that appears at
 * the top of every crypto page). Faithful to the reference markup; `active`
 * selects the current tab. Uses next/link for real cross-page navigation.
 */
import Link from 'next/link';

const TABS: { slug: string; label: string }[] = [
  { slug: 'crypto/wallet', label: 'Wallet' },
  { slug: 'crypto/exchange', label: 'Exchange' },
  { slug: 'crypto/buy-sell', label: 'Buy & Sell' },
  { slug: 'crypto/marketcap', label: 'Marketcap' },
  { slug: 'crypto/transactions', label: 'Transactions' },
];

export function CryptoTabs({ active }: { active: string }) {
  return (
    <nav className="ax-tabs ax-tabs--pill" aria-label="Crypto sections" style={{ marginBottom: 'var(--ax-space-5)' }}>
      <div className="ax-tabs__list" role="tablist">
        {TABS.map((t) => {
          const isActive = t.slug === active;
          return (
            <Link
              key={t.slug}
              className={`ax-tabs__tab${isActive ? ' is-active' : ''}`}
              role="tab"
              aria-selected={isActive ? true : undefined}
              aria-current={isActive ? 'page' : undefined}
              href={`/${t.slug}`}
            >
              {t.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export default CryptoTabs;
