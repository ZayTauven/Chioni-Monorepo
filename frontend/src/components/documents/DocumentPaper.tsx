'use client';
/*
 * Chioni — le PAPIER : facture ou reçu, imprimable, paramétré par son ÉMETTEUR.
 *
 * Base Vireo : `ecommerce/InvoiceDetails.tsx` du template (papier à en-tête,
 * bandeau parties « émis par / émis à », bandeau de méta, table des lignes,
 * bloc de totaux, notes, et sa feuille de style d'impression inline). Adapté,
 * jamais recodé : mêmes classes `ax-*`, même structure DOM, mêmes tokens.
 *
 * Ce qui change par rapport au template, et pourquoi :
 *
 * 1. **L'émetteur est une PROP, pas « Vireo Inc. » en dur.** Chioni émet les
 *    factures d'abonnement ; un centre de santé émet les factures de ses
 *    patients et ses reçus. Le composant ne sait pas lequel : il reçoit une
 *    identité, un logo et une série de numérotation. Les factures patient et
 *    les reçus « R- » / « G- » s'y brancheront sans réécriture.
 * 2. **Le logo suit l'émetteur** : URL absolue rendue par l'API
 *    (`HealthCenter.logo`) pour un centre, marque `ChioniMark` pour Chioni,
 *    initiales en repli quand il n'y en a pas. Aucune URL n'est construite à
 *    la main.
 * 3. **Ni quantité, ni TVA, ni remise.** Le template facture du commerce ; ici
 *    une ligne est un acte ou une période d'abonnement, en francs comoriens
 *    ENTIERS. Les colonnes qui n'ont pas de sens ont été retirées plutôt que
 *    remplies de tirets.
 * 4. **Aucune action inventée.** Le template propose « Marquer comme payée »,
 *    « Envoyer », « Éditer » — trois gestes qui n'existent pas sur ce papier
 *    (une facture d'abonnement est en lecture seule côté centre, et côté
 *    plateforme les gestes vivent dans leurs propres cartes, motivés et
 *    modalisés). Ne reste que « Imprimer », qui est une vraie fonction du
 *    navigateur. « Télécharger » n'est PAS repris : il n'existe aucun PDF côté
 *    backend (hors périmètre S5), et un bouton qui mentirait vaut moins que
 *    pas de bouton.
 * 5. Le rail droit du template (carte de paiement + timeline) n'est pas dans
 *    le papier : c'est à l'écran appelant de le composer, avec ses propres
 *    données réelles. Le papier reste le papier.
 *
 * Neutre par construction : aucun contexte, aucun appel API, aucun `useCenter`
 * — c'est ce qui permet aux quatre espaces de s'en servir.
 */
import type { ReactNode } from 'react';
import { ChioniMark } from './ChioniMark';

/* ── l'émetteur et le destinataire ── */

export interface DocumentParty {
  /** Raison sociale ou nom du centre — jamais un nom de patient inventé. */
  name: string;
  /** Qualité, sous le nom : « Éditeur de Chioni », « Centre de santé ». */
  qualifier?: string;
  /**
   * URL ABSOLUE rendue par l'API (`HealthCenter.logo`), ou `null`. Jamais une
   * URL construite côté client, jamais un chemin `/media/` deviné.
   */
  logo?: string | null;
  /** `true` = émetteur Chioni : la marque du produit remplace le logo. */
  useChioniMark?: boolean;
  /** Lignes de coordonnées, déjà mises en forme par l'appelant. */
  lines?: string[];
}

export interface DocumentMetaItem {
  label: string;
  value: ReactNode;
}

/** Une ligne du document : un acte facturé, ou une période d'abonnement. */
export interface DocumentLine {
  key: string | number;
  label: string;
  /** Précision sous le libellé (période, catégorie générique, référence). */
  sub?: string;
  /** Montant DÉJÀ formaté par `formatKmf` — le papier ne calcule rien. */
  amount: string;
}

export interface DocumentTotal {
  label: string;
  /** Montant déjà formaté. */
  value: string;
  tone?: 'default' | 'muted' | 'success' | 'danger';
  /** La ligne mise en avant : le solde restant. Une seule par document. */
  highlight?: boolean;
  /** Précision sous la ligne (« dont frais », « déjà reçu »). */
  hint?: string;
}

function partyMark(party: DocumentParty, gradientId: string) {
  if (party.useChioniMark) return <ChioniMark gradientId={gradientId} size={40} />;
  if (party.logo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- URL média de l'API, aucun loader Next configuré
      <img
        src={party.logo}
        alt=""
        width={40}
        height={40}
        style={{
          width: 40,
          height: 40,
          borderRadius: 'var(--ax-radius-sm)',
          objectFit: 'cover',
          flex: '0 0 auto',
        }}
      />
    );
  }
  const initials =
    party.name
      .trim()
      .split(/\s+/)
      .map((w) => w[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() || '?';
  return (
    <span
      className="ax-avatar ax-avatar--md ax-avatar--squircle"
      style={{ background: 'var(--ax-surface-subtle)', color: 'var(--ax-text-muted)', fontWeight: 600 }}
      aria-hidden="true"
    >
      {initials}
    </span>
  );
}

function Party({ label, party, mark }: { label: string; party: DocumentParty; mark?: ReactNode }) {
  return (
    <div>
      <div className="ax-label" style={{ marginBottom: 'var(--ax-space-2)' }}>
        {label}
      </div>
      <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)', flexWrap: 'nowrap', alignItems: 'center' }}>
        {mark}
        <div>
          <div style={{ fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)' }}>
            {party.name}
          </div>
          {party.qualifier && (
            <div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-muted)' }}>
              {party.qualifier}
            </div>
          )}
        </div>
      </div>
      {party.lines && party.lines.length > 0 && (
        <address
          style={{
            fontStyle: 'normal',
            color: 'var(--ax-text-muted)',
            fontSize: 'var(--ax-text-sm)',
            lineHeight: 1.7,
            marginTop: 4,
          }}
        >
          {party.lines.map((line) => (
            <span key={line} style={{ display: 'block' }}>
              {line}
            </span>
          ))}
        </address>
      )}
    </div>
  );
}

const TOTAL_COLORS: Record<NonNullable<DocumentTotal['tone']>, string> = {
  default: 'var(--ax-text)',
  muted: 'var(--ax-text-muted)',
  success: 'var(--ax-success-700)',
  danger: 'var(--ax-danger-700)',
};

export interface DocumentPaperProps {
  /** Le mot en gros : « Facture », « Reçu ». */
  kind: string;
  /** Le numéro de la série de l'émetteur (« A-000001 », « G-000001 »). */
  number: string;
  /** Badge d'état, composé par l'appelant (tons du socle). */
  statusBadge?: ReactNode;
  issuer: DocumentParty;
  recipient: DocumentParty;
  issuerLabel?: string;
  recipientLabel?: string;
  meta: DocumentMetaItem[];
  lines: DocumentLine[];
  /** En-têtes de la table — le libellé de la colonne montant est réglable. */
  lineHeaders?: { label: string; amount: string };
  /** Phrase rendue à la place de la table quand il n'y a aucune ligne. */
  emptyLines?: string;
  totals: DocumentTotal[];
  notes?: ReactNode;
  notesLabel?: string;
  paymentDetails?: ReactNode;
  paymentDetailsLabel?: string;
  /**
   * Mention barrant le papier (« ANNULÉE ») : un document annulé qui aurait
   * exactement l'apparence d'un document valide est un piège à l'impression.
   */
  voidedLabel?: string;
  /** Suffixe des ids de dégradé — unique par papier monté dans la page. */
  markId?: string;
}

/**
 * Le bouton d'impression — `window.print()`, sans dépendance ni promesse de
 * PDF. Il se masque lui-même à l'impression (`ax-print-hide`).
 */
export function PrintDocumentButton({ label = 'Imprimer' }: { label?: string }) {
  return (
    <button
      type="button"
      className="ax-btn ax-btn--ghost ax-print-hide"
      onClick={() => window.print()}
    >
      <svg
        className="ax-btn__icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M17 17h2a2 2 0 0 0 2 -2v-4a2 2 0 0 0 -2 -2h-14a2 2 0 0 0 -2 2v4a2 2 0 0 0 2 2h2" />
        <path d="M17 9v-4a2 2 0 0 0 -2 -2h-6a2 2 0 0 0 -2 2v4" />
        <path d="M7 13m0 2a2 2 0 0 1 2 -2h6a2 2 0 0 1 2 2v4a2 2 0 0 1 -2 2h-6a2 2 0 0 1 -2 -2z" />
      </svg>
      <span className="ax-btn__label">{label}</span>
    </button>
  );
}

export function DocumentPaper({
  kind,
  number,
  statusBadge,
  issuer,
  recipient,
  issuerLabel = 'Émis par',
  recipientLabel = 'Émis à',
  meta,
  lines,
  lineHeaders = { label: 'Désignation', amount: 'Montant' },
  emptyLines,
  totals,
  notes,
  notesLabel = 'Notes',
  paymentDetails,
  paymentDetailsLabel = 'Règlement',
  voidedLabel,
  markId = 'doc',
}: DocumentPaperProps) {
  return (
    <article className="ax-card ax-doc-paper" role="region" aria-label={`${kind} ${number}`}>
      <div className="ax-card__body" style={{ padding: 'var(--ax-space-8)' }}>
        {/* ── en-tête : marque de l'émetteur à gauche, nature + n° à droite ── */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 'var(--ax-space-6)',
            flexWrap: 'wrap',
            marginBottom: 'var(--ax-space-8)',
          }}
        >
          <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)' }}>
            {partyMark(issuer, `${markId}-issuer`)}
            <div>
              <div
                style={{
                  fontFamily: 'var(--ax-font-display)',
                  fontWeight: 700,
                  fontSize: 'var(--ax-text-lg)',
                  color: 'var(--ax-text-strong)',
                  letterSpacing: '.01em',
                }}
              >
                {issuer.name}
              </div>
              {issuer.qualifier && (
                <div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-muted)' }}>
                  {issuer.qualifier}
                </div>
              )}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div
              style={{
                fontFamily: 'var(--ax-font-display)',
                fontWeight: 700,
                fontSize: 'var(--ax-text-2xl)',
                color: 'var(--ax-text-strong)',
                textTransform: 'uppercase',
                letterSpacing: '.04em',
              }}
            >
              {kind}
            </div>
            <div
              className="ax-num"
              style={{
                fontFamily: 'var(--ax-font-mono)',
                color: 'var(--ax-accent)',
                fontWeight: 'var(--ax-weight-semibold)',
              }}
            >
              {number}
            </div>
            {statusBadge && <div style={{ marginTop: 'var(--ax-space-2)' }}>{statusBadge}</div>}
          </div>
        </div>

        {voidedLabel && (
          <p
            role="status"
            style={{
              margin: '0 0 var(--ax-space-6)',
              padding: 'var(--ax-space-2) var(--ax-space-3)',
              border: '1px solid var(--ax-danger-700)',
              borderRadius: 'var(--ax-radius-sm)',
              color: 'var(--ax-danger-700)',
              fontWeight: 'var(--ax-weight-semibold)',
              letterSpacing: '.08em',
              textTransform: 'uppercase',
              textAlign: 'center',
              fontSize: 'var(--ax-text-sm)',
            }}
          >
            {voidedLabel}
          </p>
        )}

        {/* ── parties ── */}
        <div
          className="ax-doc-parties"
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 'var(--ax-space-6)',
            marginBottom: 'var(--ax-space-7)',
          }}
        >
          {/* L'émetteur porte déjà sa marque dans l'en-tête du papier : pas
              de doublon ici. */}
          <Party label={issuerLabel} party={issuer} />
          {/* SV — le DESTINATAIRE porte son logo quand il en a un (la vraie
              image seulement, jamais des initiales dans ce bandeau : sans
              logo, le nom suffit). Cas d'usage : la facture SaaS côté
              plateforme, dont le destinataire est un centre. */}
          <Party
            label={recipientLabel}
            party={recipient}
            mark={recipient.logo ? partyMark(recipient, `${markId}-recipient`) : undefined}
          />
        </div>

        {/* ── bandeau de méta ── */}
        {meta.length > 0 && (
          <div
            className="ax-doc-meta"
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${Math.min(meta.length, 3)},1fr)`,
              gap: 'var(--ax-space-4)',
              padding: 'var(--ax-space-4)',
              background: 'var(--ax-surface-subtle)',
              borderRadius: 'var(--ax-radius-md)',
              marginBottom: 'var(--ax-space-6)',
            }}
          >
            {meta.map((item) => (
              <div key={item.label}>
                <div
                  style={{
                    fontSize: 'var(--ax-text-2xs)',
                    textTransform: 'uppercase',
                    letterSpacing: '.04em',
                    color: 'var(--ax-text-muted)',
                    marginBottom: 2,
                  }}
                >
                  {item.label}
                </div>
                <div
                  style={{
                    color: 'var(--ax-text-strong)',
                    fontWeight: 'var(--ax-weight-medium)',
                    fontSize: 'var(--ax-text-sm)',
                  }}
                >
                  {item.value}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── lignes ── */}
        {lines.length === 0 ? (
          <p style={{ margin: 0, color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-sm)' }}>
            {emptyLines ?? 'Aucune ligne sur ce document.'}
          </p>
        ) : (
          <div className="ax-table-wrap" tabIndex={0} role="region" aria-label="Tableau" style={{ margin: '0 calc(-1 * var(--ax-space-2))' }}>
            <table className="ax-table">
              <thead className="ax-table__head">
                <tr>
                  <th className="ax-table__th" scope="col">
                    {lineHeaders.label}
                  </th>
                  <th className="ax-table__th ax-table__th--num" scope="col">
                    {lineHeaders.amount}
                  </th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => (
                  <tr key={line.key} className="ax-table__row">
                    <td className="ax-table__td">
                      <div style={{ fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)' }}>
                        {line.label}
                      </div>
                      {line.sub && (
                        <div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-muted)' }}>
                          {line.sub}
                        </div>
                      )}
                    </td>
                    <td
                      className="ax-table__td ax-table__td--num ax-num"
                      style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text-strong)', whiteSpace: 'nowrap' }}
                    >
                      {line.amount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── totaux ── */}
        {totals.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--ax-space-5)' }}>
            <div style={{ width: '100%', maxWidth: 340, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-2)' }}>
              {totals.map((total) =>
                total.highlight ? (
                  <div key={total.label} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <div
                      className="ax-cluster"
                      style={{
                        justifyContent: 'space-between',
                        alignItems: 'baseline',
                        padding: 'var(--ax-space-2) var(--ax-space-3)',
                        background: 'var(--ax-accent-wash)',
                        borderRadius: 'var(--ax-radius-sm)',
                      }}
                    >
                      <span style={{ fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)' }}>
                        {total.label}
                      </span>
                      <span
                        className="ax-num"
                        style={{
                          fontFamily: 'var(--ax-font-mono)',
                          fontWeight: 'var(--ax-weight-semibold)',
                          fontSize: 'var(--ax-text-md)',
                          color: TOTAL_COLORS[total.tone ?? 'default'],
                        }}
                      >
                        {total.value}
                      </span>
                    </div>
                    {total.hint && (
                      <span style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-muted)', textAlign: 'right' }}>
                        {total.hint}
                      </span>
                    )}
                  </div>
                ) : (
                  <div key={total.label} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <div className="ax-cluster" style={{ justifyContent: 'space-between', fontSize: 'var(--ax-text-sm)' }}>
                      <span style={{ color: 'var(--ax-text-muted)' }}>{total.label}</span>
                      <span
                        className="ax-num"
                        style={{ fontFamily: 'var(--ax-font-mono)', color: TOTAL_COLORS[total.tone ?? 'default'] }}
                      >
                        {total.value}
                      </span>
                    </div>
                    {total.hint && (
                      <span style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-muted)', textAlign: 'right' }}>
                        {total.hint}
                      </span>
                    )}
                  </div>
                ),
              )}
            </div>
          </div>
        )}

        {(notes || paymentDetails) && (
          <>
            <hr className="ax-divider" style={{ margin: 'var(--ax-space-6) 0' }} />
            <div
              className="ax-doc-parties"
              style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--ax-space-6)' }}
            >
              {notes && (
                <div>
                  <div className="ax-label" style={{ marginBottom: 'var(--ax-space-2)' }}>
                    {notesLabel}
                  </div>
                  <div style={{ color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-sm)', lineHeight: 1.6 }}>
                    {notes}
                  </div>
                </div>
              )}
              {paymentDetails && (
                <div>
                  <div className="ax-label" style={{ marginBottom: 'var(--ax-space-2)' }}>
                    {paymentDetailsLabel}
                  </div>
                  <div style={{ color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-sm)', lineHeight: 1.7 }}>
                    {paymentDetails}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Responsive + impression — feuille inline reprise du template Vireo,
          renommée sur les classes `ax-doc-*` de ce composant.

          **Correctif UX care S5 — le thème sombre s'imprimait blanc sur blanc.**
          Les couleurs du papier viennent des tokens `--ax-*` ; sous
          `data-theme="dark"`, `--ax-text-strong` est quasi blanc et l'imprimante
          pose du papier blanc : la facture sortait vide. On REDÉFINIT donc la
          palette localement sous `@media print`, sur `.ax-doc-paper` seul —
          tout passant par les tokens, aucune règle ne doit être dupliquée par
          élément. `print-color-adjust: exact` garde les aplats (bandeau de méta,
          ligne du solde) que les navigateurs suppriment par défaut : sur une
          facture, ces aplats portent la hiérarchie de lecture. */}
      <style>{`
        @media (max-width: 640px) {
          .ax-doc-parties, .ax-doc-meta { grid-template-columns: 1fr !important; }
        }
        @media print {
          @page { margin: 12mm; }
          .ax-print-hide, .ax-ambient, .ax-sidebar, .ax-header, .ax-footer, .ax-customizer { display: none !important; }
          .ax-shell, .ax-main, .ax-layout { margin: 0 !important; padding: 0 !important; }
          .ax-dash-grid { display: block !important; }
          .ax-doc-paper {
            --ax-text: #1a1a1a;
            --ax-text-strong: #000;
            --ax-text-muted: #3d3d3d;
            --ax-text-subtle: #4a4a4a;
            --ax-border: #c9c9c9;
            --ax-surface-subtle: #f2f2f4;
            --ax-accent: #1a1a1a;
            --ax-accent-wash: #eeeef1;
            --ax-danger-700: #8a1020;
            --ax-success-700: #14532d;
            color-scheme: light;
            background: #fff !important;
            color: #1a1a1a !important;
            box-shadow: none !important;
            border: none !important;
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
        }
      `}</style>
    </article>
  );
}

export default DocumentPaper;
