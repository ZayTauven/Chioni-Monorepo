'use client';
/*
 * Chioni — /tuteur (home of the guardian space).
 *
 * Nassim's landing point. Order of the screen = order of importance:
 * 1. the trust principle (the product IS the trust),
 * 2. payment requests waiting for him (the reason he opens the app),
 * 3. invitations from relatives,
 * 4. a glance at his protégés,
 * 5. his read-only profile.
 *
 * Amount display: KMF only before the quote — we never show a euro
 * equivalent computed client-side (no contractual-looking numbers without
 * a frozen rate). The quote screen is where euros appear.
 */

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import type { ApiError } from '@/lib/api';
import {
  acceptInvitation,
  declineInvitation,
  listInvitations,
  listPaymentRequests,
  listProteges,
} from '@/lib/endpoints/guardian';
import { RELATIONSHIP_LABELS, countryName, formatDate, formatKmf } from '@/lib/labels';
import type { GuardianLinkGuardian, PaymentRequestGuardian } from '@/lib/types';
import { useAuth } from '@/context/AuthContext';
import {
  DeclineInvitationModal,
  EmptyState,
  ErrorAlert,
  HEART_ICON,
  INVOICE_ICON,
  LoadingCard,
  SHIELD_ICON,
  protegeName,
  toDisplayError,
} from './common';

interface HomeData {
  toPay: PaymentRequestGuardian[];
  totalRequests: number;
  invitations: GuardianLinkGuardian[];
  proteges: GuardianLinkGuardian[];
  protegesCount: number;
}

export function TuteurHome() {
  const { me } = useAuth();
  const profile = me?.guardian_profile ?? null;

  const [data, setData] = useState<HomeData | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(true);
  const [acceptingId, setAcceptingId] = useState<number | null>(null);
  const [acceptError, setAcceptError] = useState<ApiError | null>(null);

  const [declineTarget, setDeclineTarget] = useState<GuardianLinkGuardian | null>(null);
  const [declineBusy, setDeclineBusy] = useState(false);
  const [declineError, setDeclineError] = useState<ApiError | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [requests, invitations, proteges] = await Promise.all([
        listPaymentRequests(),
        listInvitations(),
        listProteges(),
      ]);
      setData({
        toPay: requests.results.filter((r) => r.status === 'envoyee'),
        totalRequests: requests.count,
        invitations: invitations.results,
        proteges: proteges.results,
        protegesCount: proteges.count,
      });
    } catch (e) {
      setError(toDisplayError(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onAccept = async (linkId: number) => {
    setAcceptingId(linkId);
    setAcceptError(null);
    try {
      await acceptInvitation(linkId);
      await load();
    } catch (e) {
      setAcceptError(toDisplayError(e));
    } finally {
      setAcceptingId(null);
    }
  };

  const onDecline = async () => {
    if (!declineTarget) return;
    setDeclineBusy(true);
    setDeclineError(null);
    try {
      await declineInvitation(declineTarget.id);
      setDeclineTarget(null);
      await load();
    } catch (e) {
      setDeclineError(toDisplayError(e));
    } finally {
      setDeclineBusy(false);
    }
  };

  return (
    <div className="tuteur-screen">
      {/* 1 — the promise, always visible on home */}
      <div className="tuteur-trust" role="note">
        <span className="tuteur-trust__icon">{SHIELD_ICON}</span>
        <div>
          <p className="tuteur-trust__title">
            Vous payez le centre de santé, jamais un intermédiaire.
          </p>
          <p className="tuteur-trust__text">
            Chaque paiement va directement au centre qui soigne votre proche, avec un reçu à chaque
            fois.
          </p>
        </div>
      </div>

      {loading && <LoadingCard />}
      {!loading && error && <ErrorAlert error={error} onRetry={() => void load()} />}

      {!loading && !error && data && (
        <>
          {/* 2 — requests waiting for payment */}
          <section aria-label="Demandes à payer" className="ax-stack" style={{ gap: 'var(--ax-space-3)' }}>
            <h2 className="tuteur-section-title">À payer</h2>
            {data.toPay.length === 0 ? (
              <EmptyState
                icon={INVOICE_ICON}
                title="Aucun paiement en attente"
                text="Quand un centre enverra une demande pour un de vos proches, elle apparaîtra ici."
              />
            ) : (
              <>
                {data.toPay.map((r) => (
                  <Link key={r.id} href={`/tuteur/demandes/${r.id}`} className="tuteur-pr-card">
                    <div className="tuteur-pr-card__top">
                      <span className="tuteur-pr-card__who">
                        <span className="tuteur-pr-card__name">{protegeName(r.patient)}</span>
                        <span className="tuteur-pr-card__center">{r.center_name}</span>
                      </span>
                      <span className="tuteur-pr-card__amount ax-num">{formatKmf(r.total_kmf)}</span>
                    </div>
                    <div className="tuteur-pr-card__meta">
                      <span>{formatDate(r.created_at)}</span>
                      <span className="ax-btn ax-btn--primary ax-btn--sm">
                        <span className="ax-btn__label">Voir le devis et payer</span>
                      </span>
                    </div>
                  </Link>
                ))}
                <p className="tuteur-money-card__note">
                  Le montant en euros et le taux de change vous seront montrés avant de payer.
                </p>
              </>
            )}
            {data.totalRequests > data.toPay.length && (
              <Link className="ax-link" href="/tuteur/demandes" style={{ fontSize: 'var(--ax-text-sm)' }}>
                Voir toutes les demandes ({data.totalRequests})
              </Link>
            )}
          </section>

          {/* 3 — invitations from relatives */}
          {data.invitations.length > 0 && (
            <section aria-label="Invitations reçues" className="ax-stack" style={{ gap: 'var(--ax-space-3)' }}>
              <h2 className="tuteur-section-title">Invitations</h2>
              {acceptError && <ErrorAlert error={acceptError} />}
              {data.invitations.map((inv) => (
                <div key={inv.id} className="ax-card" style={{ margin: 0 }}>
                  <div className="ax-card__body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-3)' }}>
                    <p style={{ margin: 0, fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)' }}>
                      <b style={{ color: 'var(--ax-text-strong)' }}>{protegeName(inv.patient)}</b>{' '}
                      vous invite à devenir son tuteur
                      {inv.relationship
                        ? ` (${RELATIONSHIP_LABELS[inv.relationship].toLowerCase()})`
                        : ''}
                      .
                    </p>
                    <button
                      type="button"
                      className="ax-btn ax-btn--primary ax-btn--block"
                      disabled={acceptingId === inv.id}
                      onClick={() => void onAccept(inv.id)}
                    >
                      <span className="ax-btn__label">
                        {acceptingId === inv.id ? 'Un instant…' : 'Accepter l’invitation'}
                      </span>
                    </button>
                    <button
                      type="button"
                      className="ax-btn ax-btn--ghost ax-btn--block"
                      disabled={acceptingId === inv.id}
                      onClick={() => {
                        setDeclineError(null);
                        setDeclineTarget(inv);
                      }}
                    >
                      <span className="ax-btn__label">Refuser</span>
                    </button>
                    <p className="tuteur-money-card__note">
                      Vous ne reconnaissez pas cette personne&nbsp;? Vous pouvez refuser.
                    </p>
                  </div>
                </div>
              ))}
            </section>
          )}

          {/* 4 — protégés at a glance */}
          <section aria-label="Mes protégés" className="ax-stack" style={{ gap: 'var(--ax-space-3)' }}>
            <h2 className="tuteur-section-title">Mes protégés</h2>
            {data.proteges.length === 0 ? (
              <EmptyState
                icon={HEART_ICON}
                title="Aucun protégé pour le moment"
                text="Ajoutez un proche pour pouvoir régler ses soins directement au centre de santé."
              >
                <p style={{ margin: 'var(--ax-space-3) 0 0' }}>
                  <Link className="ax-btn ax-btn--secondary" href="/tuteur/proteges">
                    <span className="ax-btn__label">Ajouter un protégé</span>
                  </Link>
                </p>
              </EmptyState>
            ) : (
              <div className="ax-card" style={{ margin: 0 }}>
                <div className="ax-card__body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-2)' }}>
                  <p style={{ margin: 0, fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)' }}>
                    Vous aidez{' '}
                    <b style={{ color: 'var(--ax-text-strong)' }}>
                      {data.protegesCount === 1
                        ? '1 personne'
                        : `${data.protegesCount} personnes`}
                    </b>
                    {' : '}
                    {data.proteges.map((l) => protegeName(l.patient)).join(', ')}
                    {data.protegesCount > data.proteges.length ? '…' : ''}
                  </p>
                  <Link className="ax-link" href="/tuteur/proteges" style={{ fontSize: 'var(--ax-text-sm)' }}>
                    Gérer mes protégés
                  </Link>
                </div>
              </div>
            )}
          </section>

          {/* 5 — read-only profile */}
          {profile && (
            <section aria-label="Mon profil" className="ax-stack" style={{ gap: 'var(--ax-space-3)' }}>
              <h2 className="tuteur-section-title">Mon profil</h2>
              <div className="ax-card" style={{ margin: 0 }}>
                <div className="ax-card__body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-2)' }}>
                  <div className="tuteur-money-row">
                    <span className="tuteur-money-row__label">Téléphone</span>
                    <span className="tuteur-money-row__value ax-num">{me?.phone}</span>
                  </div>
                  <div className="tuteur-money-row">
                    <span className="tuteur-money-row__label">Pays de résidence</span>
                    <span className="tuteur-money-row__value">
                      {countryName(profile.country_of_residence)}
                    </span>
                  </div>
                  <div className="tuteur-money-row">
                    <span className="tuteur-money-row__label">Devise de paiement</span>
                    <span className="tuteur-money-row__value">
                      {profile.preferred_currency === 'EUR' ? 'Euro (€)' : 'Franc comorien (KMF)'}
                    </span>
                  </div>
                </div>
              </div>
            </section>
          )}
        </>
      )}

      {declineTarget && (
        <DeclineInvitationModal
          patientName={protegeName(declineTarget.patient)}
          busy={declineBusy}
          error={declineError}
          onConfirm={() => void onDecline()}
          onClose={() => {
            if (!declineBusy) setDeclineTarget(null);
          }}
        />
      )}
    </div>
  );
}

export default TuteurHome;
