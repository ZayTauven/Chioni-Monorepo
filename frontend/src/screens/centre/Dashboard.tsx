'use client';
/*
 * Chioni — /centre : vue d'ensemble du centre (remplace le Healthcare de démo).
 *
 * HONNÊTETÉ ABSOLUE : aucune donnée inventée. Les KPIs sont les `count` réels
 * des listes paginées de l'API ; les listes montrent la première page réelle.
 * Les litiges « ouverts » sont filtrés côté client sur la première page — la
 * carte l'assume explicitement quand il y a plus d'une page.
 */
import Link from 'next/link';
import { PageHead } from '@/components/shell/PageHead';
import { useCenter } from '@/context/CenterContext';
import {
  getCenter,
  listDisputes,
  listEncounters,
  listInvoices,
  listPatients,
  listPaymentRequests,
} from '@/lib/endpoints/centers';
import {
  DISPUTE_STATUS_LABELS,
  ENCOUNTER_STATUS_LABELS,
  KYC_STATUS_LABELS,
  PAYMENT_REQUEST_STATUS_LABELS,
  formatDate,
  formatDateTime,
  formatKmf,
} from '@/lib/labels';
import {
  AvatarChip,
  CardSkeleton,
  DISPUTE_TONES,
  ENCOUNTER_TONES,
  ErrorAlert,
  EmptyState,
  IconChevronRight,
  PAGE_SIZE,
  PAYMENT_REQUEST_TONES,
  StatusBadge,
  patientLabel,
  useAsync,
  usePatientNames,
} from './shared';

const KPI_ICONS = {
  patients: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 7a4 4 0 1 0 8 0a4 4 0 1 0 -8 0" /><path d="M3 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /><path d="M21 21v-2a4 4 0 0 0 -3 -3.85" /></svg>
  ),
  encounters: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 4h-1a2 2 0 0 0 -2 2v3.5h0a5.5 5.5 0 0 0 11 0v-3.5a2 2 0 0 0 -2 -2h-1" /><path d="M8 15a6 6 0 1 0 12 0v-3" /><path d="M11 3v2" /><path d="M6 3v2" /><path d="M20 10m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" /></svg>
  ),
  invoices: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 3v4a1 1 0 0 0 1 1h4" /><path d="M17 21h-10a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2z" /><path d="M9 7l1 0" /><path d="M9 13l6 0" /><path d="M13 17l2 0" /></svg>
  ),
  requests: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19.5 12.572l-7.5 7.428l-7.5 -7.428a5 5 0 1 1 7.5 -6.566a5 5 0 1 1 7.5 6.572" /></svg>
  ),
};

export function Dashboard() {
  const { centerId, center } = useCenter();

  const centerDetail = useAsync(() => getCenter(centerId), [centerId]);
  const patients = useAsync(() => listPatients(centerId, { page: 1 }), [centerId]);
  const encounters = useAsync(() => listEncounters(centerId, 1), [centerId]);
  const invoices = useAsync(() => listInvoices(centerId, 1), [centerId]);
  const requests = useAsync(() => listPaymentRequests(centerId, 1), [centerId]);
  const disputes = useAsync(() => listDisputes(centerId, 1), [centerId]);

  const latestEncounters = (encounters.data?.results ?? []).slice(0, 5);
  const latestRequests = (requests.data?.results ?? []).slice(0, 5);
  const openDisputes = (disputes.data?.results ?? []).filter((d) => d.status === 'ouvert');
  const disputesPartial = (disputes.data?.count ?? 0) > PAGE_SIZE;

  const patientNames = usePatientNames(
    centerId,
    latestEncounters.map((e) => e.patient),
  );

  const kpis = [
    { key: 'patients', label: 'Patients suivis', state: patients, icon: KPI_ICONS.patients, c: 'c1', href: '/centre/patients' },
    { key: 'encounters', label: 'Consultations', state: encounters, icon: KPI_ICONS.encounters, c: 'c2', href: '/centre/consultations' },
    { key: 'invoices', label: 'Factures', state: invoices, icon: KPI_ICONS.invoices, c: 'c3', href: '/centre/factures' },
    { key: 'requests', label: 'Demandes de paiement', state: requests, icon: KPI_ICONS.requests, c: 'c4', href: '/centre/demandes' },
  ] as const;

  return (
    <>
      <PageHead title={center.name} subtitle="Vue d'ensemble de l'activité du centre." />

      {centerDetail.data && centerDetail.data.kyc_status !== 'actif' && (
        <div className="ax-alert ax-alert--warning" role="status" style={{ marginBottom: 'var(--ax-space-5)' }}>
          <div className="ax-alert__content">
            <p className="ax-alert__title">Encaissements en attente de vérification</p>
            <p className="ax-alert__message">
              Statut : {KYC_STATUS_LABELS[centerDetail.data.kyc_status]}. Tant que la vérification du centre par
              l&apos;équipe Chioni n&apos;est pas terminée, les paiements de la diaspora ne peuvent pas être encaissés.
            </p>
          </div>
        </div>
      )}

      <div className="ax-dash-grid">
        {kpis.map((k) => (
          <Link key={k.key} href={k.href} className="ax-card ax-kpi ax-col--3 ax-card--interactive" style={{ textDecoration: 'none' }} aria-label={k.label}>
            <div className="ax-card__body">
              <div className="ax-kpi__top">
                <span className={`ax-kpi__icon ax-kpi__icon--${k.c}`}>{k.icon}</span>
              </div>
              <div className="ax-kpi__label">{k.label}</div>
              {k.state.loading ? (
                <span className="ax-skeleton ax-skeleton--line ax-skeleton--shimmer" style={{ height: 28, width: 64, display: 'inline-block' }} aria-hidden="true" />
              ) : k.state.error ? (
                <div className="ax-kpi__caption" style={{ color: 'var(--ax-danger-500)' }}>Indisponible</div>
              ) : (
                <div className="ax-kpi__value ax-num">{k.state.data?.count ?? 0}</div>
              )}
            </div>
          </Link>
        ))}

        {/* Dernières demandes de paiement */}
        <section className="ax-card ax-col--6" role="region" aria-label="Dernières demandes de paiement">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <h2 className="ax-card__title">Dernières demandes de paiement</h2>
              <p className="ax-card__subtitle">Pont de Confiance — les plus récentes</p>
            </div>
            <Link className="ax-btn ax-btn--link" href="/centre/demandes">Tout voir</Link>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            {requests.loading ? (
              <CardSkeleton lines={5} />
            ) : requests.error ? (
              <ErrorAlert error={requests.error} onRetry={requests.reload} />
            ) : latestRequests.length === 0 ? (
              <EmptyState
                title="Aucune demande pour l'instant"
                message="Créez une facture depuis une consultation, puis ouvrez une demande de paiement pour la partager avec les proches du patient."
              />
            ) : (
              <ul className="ax-list ax-list--compact">
                {latestRequests.map((r) => (
                  <li key={r.id} className="ax-list__row">
                    <span className="ax-list__content">
                      <Link href={`/centre/demandes/${r.id}`} className="ax-link ax-list__title" style={{ fontWeight: 'var(--ax-weight-medium)' }}>
                        Demande n° {r.id}
                      </Link>
                      <span style={{ display: 'block', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>
                        {formatDate(r.created_at)} · {formatKmf(r.total_kmf)}
                      </span>
                    </span>
                    <span className="ax-list__trailing">
                      <StatusBadge tone={PAYMENT_REQUEST_TONES[r.status]} label={PAYMENT_REQUEST_STATUS_LABELS[r.status]} />
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* Dernières consultations */}
        <section className="ax-card ax-col--6" role="region" aria-label="Dernières consultations">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <h2 className="ax-card__title">Dernières consultations</h2>
              <p className="ax-card__subtitle">Les plus récentes du centre</p>
            </div>
            <Link className="ax-btn ax-btn--link" href="/centre/consultations">Tout voir</Link>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            {encounters.loading ? (
              <CardSkeleton lines={5} />
            ) : encounters.error ? (
              <ErrorAlert error={encounters.error} onRetry={encounters.reload} />
            ) : latestEncounters.length === 0 ? (
              <EmptyState
                title="Aucune consultation enregistrée"
                message="Les consultations créées par l'équipe soignante apparaîtront ici."
              />
            ) : (
              <ul className="ax-list ax-list--compact">
                {latestEncounters.map((e) => (
                  <li key={e.id} className="ax-list__row">
                    <span className="ax-list__leading">
                      <AvatarChip name={patientLabel(patientNames, e.patient)} seed={e.patient} />
                    </span>
                    <span className="ax-list__content">
                      <Link href={`/centre/consultations/${e.id}`} className="ax-link ax-list__title" style={{ fontWeight: 'var(--ax-weight-medium)' }}>
                        {patientLabel(patientNames, e.patient)}
                      </Link>
                      <span style={{ display: 'block', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>
                        {formatDateTime(e.occurred_at)} · {e.practitioner_name}
                      </span>
                    </span>
                    <span className="ax-list__trailing">
                      <StatusBadge tone={ENCOUNTER_TONES[e.status]} label={ENCOUNTER_STATUS_LABELS[e.status]} />
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* Litiges ouverts */}
        <section className="ax-card ax-col--12" role="region" aria-label="Litiges ouverts">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <h2 className="ax-card__title">Litiges ouverts</h2>
              <p className="ax-card__subtitle">
                {disputesPartial
                  ? 'Litiges ouverts parmi les plus récents (première page) — la liste complète est sur la page Litiges.'
                  : 'Contestations en attente de résolution'}
              </p>
            </div>
            <Link className="ax-btn ax-btn--link" href="/centre/litiges">Tout voir</Link>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            {disputes.loading ? (
              <CardSkeleton lines={3} />
            ) : disputes.error ? (
              <ErrorAlert error={disputes.error} onRetry={disputes.reload} />
            ) : openDisputes.length === 0 ? (
              <EmptyState
                title="Aucun litige ouvert"
                message={
                  disputesPartial
                    ? 'Aucun litige ouvert sur la première page — vérifiez la page Litiges pour l’historique complet.'
                    : 'Aucune contestation en cours. C’est bon signe.'
                }
              />
            ) : (
              <ul className="ax-list ax-list--compact">
                {openDisputes.map((d) => (
                  <li key={d.id} className="ax-list__row">
                    <span className="ax-list__content">
                      <Link href="/centre/litiges" className="ax-link ax-list__title" style={{ fontWeight: 'var(--ax-weight-medium)' }}>
                        Litige n° {d.id} — demande n° {d.payment_request}
                      </Link>
                      <span style={{ display: 'block', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>
                        Ouvert le {formatDate(d.created_at)}
                      </span>
                    </span>
                    <span className="ax-list__trailing" style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--ax-space-2)' }}>
                      <StatusBadge tone={DISPUTE_TONES[d.status]} label={DISPUTE_STATUS_LABELS[d.status]} />
                      <IconChevronRight className="" />
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </>
  );
}

export default Dashboard;
