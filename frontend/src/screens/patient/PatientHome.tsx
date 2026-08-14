'use client';
/*
 * Chioni — /patient home screen.
 *
 * Priority order is an ethical statement (ADR 0010) : the claimant-
 * confirmation gate first, then paid-but-unacknowledged care to confirm,
 * then two big shortcuts, then the profile card. One primary action per
 * card, short sentences, no jargon.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import {
  acknowledgePaymentRequest,
  getPatientMe,
  listAllGuardians,
  listPaymentRequests,
} from '@/lib/endpoints/patients';
import { formatDate, formatKmf, maskPhone } from '@/lib/labels';
import type { GuardianLinkPatient, PatientMe, PaymentRequestPatient } from '@/lib/types';
import { PendingGuardianCards } from './PendingGuardianCards';
import { ConfirmModal, ErrorAlert, SkeletonCards, SuccessAlert } from './ui';

const CHEVRON = (
  <svg className="pat-shortcut__chevron" viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l6 6l-6 6" /></svg>
);

/** Paid requests waiting for the patient's « care received » confirmation. */
function needsAcknowledgement(req: PaymentRequestPatient): boolean {
  return (
    (req.status === 'payee' || req.status === 'soin_confirme' || req.status === 'cloturee') &&
    req.patient_acknowledged_at === null
  );
}

export function PatientHome() {
  const [profile, setProfile] = useState<PatientMe | null>(null);
  const [pendingLinks, setPendingLinks] = useState<GuardianLinkPatient[]>([]);
  const [toAcknowledge, setToAcknowledge] = useState<PaymentRequestPatient[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<unknown>(null);

  const [acknowledging, setAcknowledging] = useState<PaymentRequestPatient | null>(null);
  const [ackBusy, setAckBusy] = useState(false);
  const [ackError, setAckError] = useState<unknown>(null);
  const [ackSuccess, setAckSuccess] = useState('');

  // Skeletons only on the FIRST load — a refetch after an action must not
  // wipe the screen (and the success message) under the user's eyes.
  const firstLoadRef = useRef(true);

  const load = useCallback(() => {
    if (firstLoadRef.current) setLoading(true);
    setLoadError(null);
    Promise.all([getPatientMe(), listAllGuardians(), listPaymentRequests(1)])
      .then(([me, links, requests]) => {
        setProfile(me);
        setPendingLinks(links.filter((l) => l.status === 'attente_confirmation_titulaire'));
        setToAcknowledge(requests.results.filter(needsAcknowledgement));
        firstLoadRef.current = false;
        setLoading(false);
      })
      .catch((err: unknown) => {
        setLoadError(err);
        setLoading(false);
      });
  }, []);

  useEffect(load, [load]);

  async function acknowledge() {
    if (!acknowledging) return;
    setAckBusy(true);
    setAckError(null);
    try {
      await acknowledgePaymentRequest(acknowledging.id);
      setAcknowledging(null);
      setAckSuccess('Merci. Votre confirmation a bien été enregistrée.');
      load();
    } catch (err) {
      setAckError(err);
    } finally {
      setAckBusy(false);
    }
  }

  if (loading) {
    return <SkeletonCards count={4} />;
  }

  if (loadError != null) {
    return <ErrorAlert error={loadError} onRetry={load} />;
  }

  const firstName = profile?.first_name?.trim() ?? '';

  return (
    <div className="pat-stack">
      <header>
        <h2 className="pat-hello">{firstName ? `Bonjour ${firstName}` : 'Bonjour'}</h2>
        <p className="pat-hello-sub">Voici votre espace santé.</p>
      </header>

      {/* 1 — the claimant-confirmation gate, always first. */}
      <PendingGuardianCards links={pendingLinks} onChanged={load} />

      {/* 2 — paid care waiting for the patient's confirmation. */}
      {ackSuccess && <SuccessAlert message={ackSuccess} />}
      {toAcknowledge.map((req) => (
        <section key={req.id} className="ax-card" role="region" aria-label="Soin à confirmer">
          <div className="ax-card__body pat-gate__body">
            <h3 className="pat-gate__question">Avez-vous bien reçu ce soin&nbsp;?</h3>
            <p className="pat-gate__meta">
              {req.center_name} — {formatKmf(req.total_kmf)}.{' '}
              {req.paid_at
                ? `Payée par un proche le ${formatDate(req.paid_at)}.`
                : `Demande du ${formatDate(req.created_at)}, payée par un proche.`}
            </p>
            <div className="pat-actions">
              <button
                type="button"
                className="ax-btn ax-btn--primary ax-btn--lg ax-btn--block"
                onClick={() => {
                  setAckError(null);
                  setAcknowledging(req);
                }}
              >
                Oui, j&rsquo;ai reçu ce soin
              </button>
              <Link
                href={`/patient/paiements/${req.id}`}
                className="ax-btn ax-btn--ghost ax-btn--lg ax-btn--block"
              >
                Voir le détail
              </Link>
            </div>
          </div>
        </section>
      ))}

      {/* 3 — three big shortcuts. « Mes rendez-vous » (S2) vit ici : la tab
             bar garde ses 4 onglets (contrat du chrome lite). */}
      <section className="ax-card ax-card--interactive">
        <Link href="/patient/carnet" className="ax-card__body pat-shortcut">
          <span className="pat-shortcut__icon" aria-hidden="true"><Icon name="notebook" /></span>
          <span className="pat-shortcut__text">
            <span className="pat-shortcut__title">Mon carnet de santé</span>
            <span className="pat-shortcut__sub">Consultations, ordonnances, ma santé</span>
          </span>
          {CHEVRON}
        </Link>
      </section>
      <section className="ax-card ax-card--interactive">
        <Link href="/patient/rendez-vous" className="ax-card__body pat-shortcut">
          <span className="pat-shortcut__icon" aria-hidden="true"><Icon name="calendar" /></span>
          <span className="pat-shortcut__text">
            <span className="pat-shortcut__title">Mes rendez-vous</span>
            <span className="pat-shortcut__sub">Vos prochains passages au centre</span>
          </span>
          {CHEVRON}
        </Link>
      </section>
      <section className="ax-card ax-card--interactive">
        <Link href="/patient/paiements" className="ax-card__body pat-shortcut">
          <span className="pat-shortcut__icon" aria-hidden="true"><Icon name="cash" /></span>
          <span className="pat-shortcut__text">
            <span className="pat-shortcut__title">Mes paiements</span>
            <span className="pat-shortcut__sub">Demandes de paiement et reçus</span>
          </span>
          {CHEVRON}
        </Link>
      </section>

      {/* 4 — profile card. */}
      {profile && (
        <section className="ax-card" role="region" aria-label="Mes informations">
          <div className="ax-card__body pat-row">
            <div className="pat-row__main">
              <span className="pat-row__title">
                {`${profile.first_name} ${profile.last_name}`.trim() || 'Mon profil'}
              </span>
              <span className="pat-row__meta">
                {[profile.city, profile.phone ? maskPhone(profile.phone) : '']
                  .filter(Boolean)
                  .join(' · ')}
              </span>
            </div>
            <Link href="/patient/profil" className="ax-btn ax-btn--secondary">
              Modifier
            </Link>
          </div>
        </section>
      )}

      <ConfirmModal
        open={acknowledging !== null}
        title="Vous avez bien reçu ce soin ?"
        message="Cela confirme au proche qui a payé que le soin a bien eu lieu."
        confirmLabel="Oui, je confirme"
        busy={ackBusy}
        error={ackError}
        onConfirm={() => void acknowledge()}
        onClose={() => setAcknowledging(null)}
      />
    </div>
  );
}

export default PatientHome;
