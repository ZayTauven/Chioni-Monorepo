'use client';
/*
 * Chioni — /centre/factures/[id] : détail d'une facture.
 *
 * Lignes (libellé + catégorie générique + montant), actions BILLING :
 * - émettre (`issue/`) : fige les montants (brouillon → émise) ;
 * - créer une demande de paiement (`payment-requests/`) → redirige vers la
 *   demande créée (Pont de Confiance).
 * Les erreurs de transition (400 service) s'affichent en alerte.
 */
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PageHead } from '@/components/shell/PageHead';
import { useCenter } from '@/context/CenterContext';
import type { ApiError } from '@/lib/api';
import {
  createPaymentRequest,
  getInvoice,
  getPatient,
  issueInvoice,
} from '@/lib/endpoints/centers';
import {
  GENERIC_CATEGORY_LABELS,
  INVOICE_STATUS_LABELS,
  formatDate,
  formatKmf,
} from '@/lib/labels';
import type { Invoice } from '@/lib/types';
import {
  BILLING_ROLES,
  CardSkeleton,
  DetailItem,
  ErrorAlert,
  IconArrowLeft,
  IconCheck,
  IconSend,
  INVOICE_TONES,
  StatusBadge,
  hasRole,
  toApiError,
  useAsync,
} from './shared';

export function InvoiceDetail({ invoiceId }: { invoiceId: number }) {
  const { centerId, role } = useCenter();
  const router = useRouter();
  const billing = hasRole(role, BILLING_ROLES);

  const invoiceState = useAsync(() => getInvoice(centerId, invoiceId), [centerId, invoiceId]);
  const [fresh, setFresh] = useState<Invoice | null>(null);
  const invoice = fresh ?? invoiceState.data;

  const patient = useAsync(
    () => (invoice ? getPatient(centerId, invoice.patient) : Promise.resolve(null)),
    [centerId, invoice?.patient],
  );

  const [actionError, setActionError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState<'issue' | 'request' | null>(null);

  const doIssue = async () => {
    if (!invoice) return;
    setBusy('issue');
    setActionError(null);
    try {
      setFresh(await issueInvoice(centerId, invoice.id));
    } catch (err) {
      setActionError(toApiError(err));
    } finally {
      setBusy(null);
    }
  };

  const doCreateRequest = async () => {
    if (!invoice) return;
    setBusy('request');
    setActionError(null);
    try {
      const request = await createPaymentRequest(centerId, invoice.id);
      router.push(`/centre/demandes/${request.id}`);
    } catch (err) {
      setActionError(toApiError(err));
      setBusy(null);
    }
  };

  if (invoiceState.loading) {
    return (
      <>
        <PageHead title="Facture" />
        <div className="ax-dash-grid">
          <section className="ax-card ax-col--4"><CardSkeleton lines={5} /></section>
          <section className="ax-card ax-col--8"><CardSkeleton lines={5} /></section>
        </div>
      </>
    );
  }

  if (invoiceState.error || !invoice) {
    return (
      <>
        <PageHead title="Facture" />
        <div className="ax-dash-grid">
          <div className="ax-col--12">
            <ErrorAlert error={invoiceState.error ?? toApiError(null)} onRetry={invoiceState.reload} />
            <p style={{ marginTop: 'var(--ax-space-4)' }}>
              <Link href="/centre/factures" className="ax-btn ax-btn--secondary">
                <IconArrowLeft />
                <span className="ax-btn__label">Retour aux factures</span>
              </Link>
            </p>
          </div>
        </div>
      </>
    );
  }

  const patientName = patient.data
    ? `${patient.data.first_name} ${patient.data.last_name}`.trim()
    : `Patient n° ${invoice.patient}`;

  return (
    <>
      <PageHead
        title={`Facture n° ${invoice.id}`}
        subtitle={`Créée le ${formatDate(invoice.created_at)}`}
        actions={
          <>
            <Link href="/centre/factures" className="ax-btn ax-btn--secondary">
              <IconArrowLeft />
              <span className="ax-btn__label">Retour</span>
            </Link>
            {billing && invoice.status === 'brouillon' && (
              <button type="button" className="ax-btn ax-btn--primary" onClick={() => void doIssue()} disabled={busy !== null}>
                <IconCheck />
                <span className="ax-btn__label">{busy === 'issue' ? 'Émission…' : 'Émettre la facture'}</span>
              </button>
            )}
            {billing && invoice.status === 'emise' && (
              <button type="button" className="ax-btn ax-btn--primary" onClick={() => void doCreateRequest()} disabled={busy !== null}>
                <IconSend />
                <span className="ax-btn__label">{busy === 'request' ? 'Création…' : 'Créer une demande de paiement'}</span>
              </button>
            )}
          </>
        }
      />

      {actionError && (
        <div style={{ marginBottom: 'var(--ax-space-5)' }}>
          <ErrorAlert error={actionError} />
        </div>
      )}

      <div className="ax-dash-grid">
        <section className="ax-card ax-col--4" role="region" aria-label="Informations de la facture">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <h2 className="ax-card__title">Informations</h2>
            </div>
            <StatusBadge tone={INVOICE_TONES[invoice.status]} label={INVOICE_STATUS_LABELS[invoice.status]} />
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}>
            <DetailItem label="Patient">
              <Link href={`/centre/patients/${invoice.patient}`} className="ax-link" style={{ fontWeight: 500 }}>
                {patientName}
              </Link>
            </DetailItem>
            <DetailItem label="Consultation">
              <Link href={`/centre/consultations/${invoice.encounter}`} className="ax-link">
                Consultation n° {invoice.encounter}
              </Link>
            </DetailItem>
            <DetailItem label="Total">
              <b className="ax-num" style={{ fontSize: 'var(--ax-text-lg)', color: 'var(--ax-text-strong)' }}>
                {formatKmf(invoice.total_kmf)}
              </b>
            </DetailItem>
            {invoice.status === 'brouillon' && (
              <p style={{ margin: 0, fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-muted)' }}>
                Brouillon : les montants ne sont pas encore figés. Émettez la facture pour pouvoir créer une demande de paiement.
              </p>
            )}
            {invoice.status === 'emise' && (
              <p style={{ margin: 0, fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-muted)' }}>
                Facture émise : les montants sont figés. Vous pouvez créer une demande de paiement pour le Pont de Confiance.
              </p>
            )}
          </div>
        </section>

        <section className="ax-card ax-col--8" role="region" aria-label="Lignes de la facture">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <h2 className="ax-card__title">Lignes</h2>
              <p className="ax-card__subtitle">Chaque ligne est reliée à un acte réalisé</p>
            </div>
          </div>
          <div className="ax-table-wrap">
            <table className="ax-table">
              <thead className="ax-table__head">
                <tr>
                  <th className="ax-table__th" scope="col">Libellé</th>
                  <th className="ax-table__th" scope="col">Catégorie</th>
                  <th className="ax-table__th ax-table__th--num" scope="col">Montant</th>
                </tr>
              </thead>
              <tbody>
                {invoice.lines.map((line) => (
                  <tr key={line.id} className="ax-table__row">
                    <td className="ax-table__td" style={{ color: 'var(--ax-text-strong)', fontWeight: 500 }}>{line.label}</td>
                    <td className="ax-table__td" style={{ color: 'var(--ax-text-muted)' }}>
                      {GENERIC_CATEGORY_LABELS[line.generic_category]}
                    </td>
                    <td className="ax-table__td ax-table__td--num ax-num" style={{ fontFamily: 'var(--ax-font-mono)' }}>
                      {formatKmf(line.amount_kmf)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="ax-table__foot">
                <tr>
                  <td className="ax-table__td" colSpan={2} style={{ fontWeight: 600, color: 'var(--ax-text-strong)' }}>Total</td>
                  <td className="ax-table__td ax-table__td--num ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontWeight: 700, color: 'var(--ax-text-strong)' }}>
                    {formatKmf(invoice.total_kmf)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      </div>
    </>
  );
}

export default InvoiceDetail;
