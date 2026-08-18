'use client';
/*
 * Chioni — /centre/comptabilite/[id] : une pièce comptable (S10, ADR 0023).
 *
 * **Rôles BILLING**, auto-gardé avant tout fetch.
 *
 * Base Vireo : `DocumentPaper` — le module `ecommerce/InvoiceDetails` adapté
 * en S5 et **paramétré par l'émetteur**. Ici l'émetteur est LE CENTRE (son
 * nom, son logo rendu par l'API), et le papier sert enfin sa troisième
 * pièce après la facture d'abonnement, sans une ligne de réécriture.
 *
 * Deux propriétés portent l'écran, et il les dit explicitement :
 *
 * 1. **le snapshot est relu, jamais recalculé** — cette pièce dit aujourd'hui
 *    ce qu'elle disait le jour de sa signature, même si la caisse a bougé.
 *    C'est ce qui la rend utilisable par un comptable ;
 * 2. **des mouvements, pas des soldes** (décision 7) — une contre-passation
 *    apparaît à SA date, avec la référence et la date de l'encaissement
 *    qu'elle corrige. Son `montant_kmf` est **négatif** et reste affiché tel
 *    quel : ni valeur absolue, ni rouge d'erreur. C'est une correction.
 *
 * Le téléchargement passe par `apiDownload` (blob authentifié) : jamais un
 * `<a href>` direct, mêmes règles que les documents patients.
 */
import { useState } from 'react';
import Link from 'next/link';
import { PageHead } from '@/components/shell/PageHead';
import { DocumentPaper, PrintDocumentButton } from '@/components/documents/DocumentPaper';
import { useCenter } from '@/context/CenterContext';
import { downloadAccountingExport, getAccountingExport } from '@/lib/endpoints/accounting';
import {
  ACCOUNTING_COLLECTED_LABEL,
  ACCOUNTING_DOWNLOAD_HINT,
  ACCOUNTING_DOWNLOAD_LABEL,
  ACCOUNTING_FROZEN_NOTICE,
  ACCOUNTING_ISSUER_QUALIFIER,
  ACCOUNTING_MOVEMENTS_NOTICE,
  ACCOUNTING_MOVEMENT_HEADER,
  ACCOUNTING_NET_LABEL,
  ACCOUNTING_RECIPIENT_NAME,
  ACCOUNTING_RECIPIENT_QUALIFIER,
  ACCOUNTING_REVERSED_HINT,
  ACCOUNTING_REVERSED_LABEL,
  ACCOUNTING_TITLE,
  DOC_AMOUNT_HEADER,
  DOC_ISSUER_LABEL,
  DOC_KIND_STATEMENT,
  DOC_PRINT_LABEL,
  DOC_RECIPIENT_LABEL,
  MOVEMENT_TYPE_LABELS,
  accountingPeriodLabel,
  formatDateTime,
  formatKmf,
  movementSubLine,
} from '@/lib/labels';
import {
  BILLING_ROLES,
  CardSkeleton,
  EmptyState,
  ErrorAlert,
  IconArrowLeft,
  IconDownload,
  hasRole,
  toApiError,
  useAsync,
} from './shared';
import type { ApiError } from '@/lib/api';

export function AccountingExportDetail({ exportId }: { exportId: number }) {
  const { centerId, center, roles } = useCenter();
  const billing = hasRole(roles, BILLING_ROLES);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<ApiError | null>(null);

  const piece = useAsync(
    () => (billing ? getAccountingExport(centerId, exportId) : Promise.resolve(null)),
    [centerId, exportId, billing],
  );

  if (!billing) {
    return (
      <>
        <PageHead title={ACCOUNTING_TITLE} />
        <div className="ax-dash-grid">
          <section className="ax-card ax-col--12">
            <EmptyState
              title="Réservé aux rôles de facturation"
              message="Les relevés de caisse sont accessibles au directeur, à la secrétaire et au caissier."
            />
          </section>
        </div>
      </>
    );
  }

  if (piece.loading) {
    return (
      <>
        <PageHead title={ACCOUNTING_TITLE} />
        <div className="ax-dash-grid">
          <section className="ax-card ax-col--12">
            <CardSkeleton lines={8} />
          </section>
        </div>
      </>
    );
  }

  if (piece.error || !piece.data) {
    return (
      <>
        <PageHead title={ACCOUNTING_TITLE} />
        <div className="ax-dash-grid">
          <div className="ax-col--12">
            {piece.error ? (
              <ErrorAlert error={piece.error} onRetry={piece.reload} />
            ) : (
              <EmptyState title="Relevé introuvable" message="Ce relevé n’existe pas dans ce centre." />
            )}
          </div>
        </div>
      </>
    );
  }

  const doc = piece.data;

  const download = async () => {
    setDownloading(true);
    setDownloadError(null);
    try {
      await downloadAccountingExport(centerId, doc.id, doc.number);
    } catch (err) {
      /* L'échec est rendu DANS la carte qui porte le bouton — jamais muet
         (correctif UX care S3 sur le téléchargement des documents). */
      setDownloadError(toApiError(err));
    } finally {
      setDownloading(false);
    }
  };

  return (
    <>
      <PageHead
        title={`Relevé ${doc.number}`}
        subtitle={`Caisse ${accountingPeriodLabel(doc.period_start, doc.period_end)} — figé le ${formatDateTime(doc.created_at)}.`}
        actions={
          <div className="ax-cluster ax-print-hide" style={{ gap: 'var(--ax-space-2)' }}>
            <Link href="/centre/comptabilite" className="ax-btn ax-btn--ghost ax-btn--sm">
              <IconArrowLeft />
              <span className="ax-btn__label">Tous les relevés</span>
            </Link>
            <PrintDocumentButton label={DOC_PRINT_LABEL} />
          </div>
        }
      />

      <div className="ax-dash-grid">
        <div className="ax-col--8">
          <DocumentPaper
            markId={`accounting-export-${doc.id}`}
            kind={DOC_KIND_STATEMENT}
            number={doc.number}
            issuerLabel={DOC_ISSUER_LABEL}
            recipientLabel={DOC_RECIPIENT_LABEL}
            issuer={{
              name: center.name,
              qualifier: ACCOUNTING_ISSUER_QUALIFIER,
              logo: center.logo,
              lines: [center.city].filter(Boolean),
            }}
            recipient={{
              name: ACCOUNTING_RECIPIENT_NAME,
              qualifier: ACCOUNTING_RECIPIENT_QUALIFIER,
            }}
            meta={[
              { label: 'Période', value: accountingPeriodLabel(doc.period_start, doc.period_end) },
              { label: 'Généré le', value: formatDateTime(doc.created_at) },
              /* SV — « un humain signe la photo » : la pièce nomme qui l'a
                 générée. Le tiret couvre le compte sans nom renseigné. */
              { label: 'Générée par', value: doc.generated_by_display || '—' },
              { label: 'Mouvements', value: doc.line_count },
            ]}
            lineHeaders={{ label: ACCOUNTING_MOVEMENT_HEADER, amount: DOC_AMOUNT_HEADER }}
            emptyLines="Aucun mouvement de caisse sur cette période. Le relevé le dit, et c’est une information comptable à part entière."
            lines={doc.lines.map((line, index) => ({
              key: `${line.type}-${line.reference}-${index}`,
              label: `${MOVEMENT_TYPE_LABELS[line.type]} ${line.reference}`,
              sub: movementSubLine(line),
              /* Le montant d'une contre-passation est NÉGATIF et le reste :
                 c'est ce qui permet à un tableur de retrouver le net en
                 sommant la colonne, et à un comptable de lire la correction
                 pour ce qu'elle est. */
              amount: formatKmf(line.montant_kmf),
            }))}
            totals={[
              { label: ACCOUNTING_COLLECTED_LABEL, value: formatKmf(doc.total_collected_kmf) },
              {
                label: ACCOUNTING_REVERSED_LABEL,
                value: formatKmf(doc.total_reversed_kmf),
                tone: 'muted',
                hint: ACCOUNTING_REVERSED_HINT,
              },
              {
                label: ACCOUNTING_NET_LABEL,
                value: formatKmf(doc.net_kmf),
                highlight: true,
              },
            ]}
            notesLabel="Comment lire ce relevé"
            notes={
              <>
                {ACCOUNTING_MOVEMENTS_NOTICE}
                <br />
                {ACCOUNTING_FROZEN_NOTICE}
              </>
            }
          />
        </div>

        {/* Rail droit — composé ici, jamais porté par le papier. */}
        <aside
          className="ax-col--4 ax-print-hide"
          style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-5)' }}
        >
          <section className="ax-card" role="region" aria-label="Télécharger le relevé">
            <div className="ax-card__header">
              <div className="ax-card__titles">
                <h2 className="ax-card__title">Pour votre comptable</h2>
                <p className="ax-card__subtitle">{ACCOUNTING_DOWNLOAD_HINT}</p>
              </div>
            </div>
            <div
              className="ax-card__body"
              style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-3)' }}
            >
              {downloadError && <ErrorAlert error={downloadError} />}
              <button
                type="button"
                className="ax-btn ax-btn--primary"
                onClick={() => void download()}
                disabled={downloading}
                aria-busy={downloading}
              >
                <IconDownload />
                <span className="ax-btn__label">
                  {downloading ? 'Préparation…' : ACCOUNTING_DOWNLOAD_LABEL}
                </span>
              </button>
            </div>
          </section>
        </aside>
      </div>
    </>
  );
}

export default AccountingExportDetail;
