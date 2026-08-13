/*
 * Chioni — placeholder for patient/guardian routes not yet built.
 * Server component (no hooks): a single sober card, simple words.
 */

export function LitePlaceholder({ title, message }: { title: string; message?: string }) {
  return (
    <section className="ax-card" role="region" aria-label={title}>
      <div className="ax-card__body" style={{ textAlign: 'center', padding: 'var(--ax-space-8) var(--ax-space-4)' }}>
        <h2 className="ax-card__title" style={{ marginBottom: 'var(--ax-space-2)' }}>{title}</h2>
        <p style={{ margin: 0, color: 'var(--ax-text-muted)' }}>
          {message ?? 'Bientôt disponible. Merci de votre patience.'}
        </p>
      </div>
    </section>
  );
}

export default LitePlaceholder;
