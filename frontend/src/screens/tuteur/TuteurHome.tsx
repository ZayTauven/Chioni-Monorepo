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

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import type { ApiError } from '@/lib/api';
import {
  acceptInvitation,
  declineInvitation,
  isNoActiveLinkError,
  listInvitations,
  listPaymentRequests,
  listProteges,
  updateGuardianProfile,
} from '@/lib/endpoints/guardian';
import {
  CURRENCY_LABELS,
  GUARDIAN_REMINDERS_HINT,
  GUARDIAN_REMINDERS_LABEL,
  GUARDIAN_REMINDERS_OFF,
  GUARDIAN_REMINDERS_ON,
  RELATIONSHIP_LABELS,
  RESIDENCE_COUNTRY_CODES,
  countryName,
  formatDate,
  formatKmf,
} from '@/lib/labels';
import type {
  Currency,
  GuardianLinkGuardian,
  GuardianProfile,
  Paginated,
  PaymentRequestGuardian,
} from '@/lib/types';
import { useAuth } from '@/context/AuthContext';
import { MyDataCard } from '@/screens/lite/MyDataCard';
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

/* ── profile card (S2 : pays de résidence + devise modifiables) ── */

function ProfileCard({ phone, profile }: { phone: string; profile: GuardianProfile }) {
  const { refreshMe } = useAuth();
  const [editing, setEditing] = useState(false);
  const [country, setCountry] = useState(profile.country_of_residence);
  const [currency, setCurrency] = useState<Currency>(profile.preferred_currency);
  /* S10 (ADR 0023 décision 1) — la porte de sortie du tuteur. */
  const [reminders, setReminders] = useState(profile.payment_reminders);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [saved, setSaved] = useState(false);

  // Le pays actuel reste choisissable même s'il n'est pas dans la liste courte.
  const countryOptions = RESIDENCE_COUNTRY_CODES.includes(profile.country_of_residence)
    ? RESIDENCE_COUNTRY_CODES
    : [profile.country_of_residence, ...RESIDENCE_COUNTRY_CODES];

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await updateGuardianProfile({
        country_of_residence: country,
        preferred_currency: currency,
        payment_reminders: reminders,
      });
      // guardian_profile vit dans /auth/me/ — resynchroniser l'app entière.
      await refreshMe();
      setEditing(false);
      setSaved(true);
    } catch (err) {
      setError(toDisplayError(err));
    } finally {
      setBusy(false);
    }
  };

  const fieldErrors = error?.fieldErrors ?? {};

  return (
    <section aria-label="Mon profil" className="ax-stack" style={{ gap: 'var(--ax-space-3)' }}>
      <h2 className="tuteur-section-title">Mon profil</h2>
      {saved && !editing && (
        <div className="ax-alert ax-alert--success" role="status">
          <div className="ax-alert__content">
            <p className="ax-alert__message" style={{ margin: 0 }}>Profil mis à jour.</p>
          </div>
        </div>
      )}
      <div className="ax-card" style={{ margin: 0 }}>
        {editing ? (
          <form className="ax-card__body ax-stack" style={{ gap: 'var(--ax-space-4)' }} onSubmit={(e) => void submit(e)}>
            <div className="ax-field">
              <label className="ax-field__label" htmlFor="tuteur-pays">Pays de résidence</label>
              <select
                id="tuteur-pays"
                className="ax-select"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
              >
                {countryOptions.map((code) => (
                  <option key={code} value={code}>{countryName(code)}</option>
                ))}
              </select>
              {fieldErrors.country_of_residence && (
                <p className="ax-field__message ax-field__message--error">
                  {fieldErrors.country_of_residence[0]}
                </p>
              )}
            </div>
            <div className="ax-field">
              <label className="ax-field__label" htmlFor="tuteur-devise">Devise préférée</label>
              <select
                id="tuteur-devise"
                className="ax-select"
                value={currency}
                onChange={(e) => setCurrency(e.target.value as Currency)}
              >
                {(Object.keys(CURRENCY_LABELS) as Currency[]).map((c) => (
                  <option key={c} value={c}>{CURRENCY_LABELS[c]}</option>
                ))}
              </select>
              <p className="ax-field__hint">
                C&rsquo;est une préférence d&rsquo;affichage. Avant chaque paiement, le devis vous
                montre toujours les euros que vous payez et les francs comoriens que le centre
                reçoit.
              </p>
              {fieldErrors.preferred_currency && (
                <p className="ax-field__message ax-field__message--error">
                  {fieldErrors.preferred_currency[0]}
                </p>
              )}
            </div>
            {/* S10 — l'opt-out des RELANCES, et l'honnêteté sur ce qu'il ne
                coupe pas : sans le second paragraphe, désactiver se lit
                « je ne serai plus prévenu du tout », ce qui est faux. La
                rangée entière est la cible tactile (≥ 44 px). */}
            <div className="ax-field">
              <label
                htmlFor="tuteur-relances"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 'var(--ax-space-4)',
                  minHeight: 56,
                  cursor: 'pointer',
                }}
              >
                <span
                  style={{
                    fontSize: 'var(--ax-text-base)',
                    color: 'var(--ax-text-strong)',
                    lineHeight: 1.5,
                  }}
                >
                  {GUARDIAN_REMINDERS_LABEL}
                </span>
                <input
                  id="tuteur-relances"
                  type="checkbox"
                  className="ax-switch ax-switch--lg"
                  checked={reminders}
                  onChange={(e) => setReminders(e.target.checked)}
                />
              </label>
              {/* Couleur POSÉE ici plutôt qu'héritée d'`ax-field__hint` :
                  cette classe peint en `--ax-text-subtle`, seul token du
                  design system encore sous AA (4,32:1). C'est la phrase qui
                  dit au tuteur qu'il sera TOUJOURS prévenu d'une demande de
                  paiement — la dernière du produit à mériter d'être pâle. */}
              <p
                style={{
                  margin: 0,
                  fontSize: 'var(--ax-text-xs)',
                  color: 'var(--ax-text-muted)',
                  lineHeight: 1.6,
                }}
              >
                {GUARDIAN_REMINDERS_HINT}
              </p>
              {fieldErrors.payment_reminders && (
                <p className="ax-field__message ax-field__message--error">
                  {fieldErrors.payment_reminders[0]}
                </p>
              )}
            </div>
            {error && error.messages.length > 0 && <ErrorAlert error={error} />}
            <button type="submit" className="ax-btn ax-btn--primary ax-btn--lg ax-btn--block" disabled={busy}>
              <span className="ax-btn__label">{busy ? 'Enregistrement…' : 'Enregistrer'}</span>
            </button>
            <button
              type="button"
              className="ax-btn ax-btn--ghost ax-btn--block"
              disabled={busy}
              onClick={() => {
                setCountry(profile.country_of_residence);
                setCurrency(profile.preferred_currency);
                setReminders(profile.payment_reminders);
                setError(null);
                setEditing(false);
              }}
            >
              <span className="ax-btn__label">Annuler</span>
            </button>
          </form>
        ) : (
          <div className="ax-card__body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-2)' }}>
            <div className="tuteur-money-row">
              <span className="tuteur-money-row__label">Téléphone</span>
              <span className="tuteur-money-row__value ax-num">{phone}</span>
            </div>
            <div className="tuteur-money-row">
              <span className="tuteur-money-row__label">Pays de résidence</span>
              <span className="tuteur-money-row__value">{countryName(profile.country_of_residence)}</span>
            </div>
            <div className="tuteur-money-row">
              <span className="tuteur-money-row__label">Devise préférée</span>
              <span className="tuteur-money-row__value">{CURRENCY_LABELS[profile.preferred_currency]}</span>
            </div>
            <div className="tuteur-money-row">
              <span className="tuteur-money-row__label">Rappels d&rsquo;impayé</span>
              <span className="tuteur-money-row__value">
                {profile.payment_reminders ? GUARDIAN_REMINDERS_ON : GUARDIAN_REMINDERS_OFF}
              </span>
            </div>
            {/* Dit aussi en LECTURE : c'est là que le tuteur se demande s'il
                sera prévenu, pas seulement au moment de basculer. */}
            <p
              style={{
                margin: 0,
                fontSize: 'var(--ax-text-xs)',
                color: 'var(--ax-text-muted)',
                lineHeight: 1.6,
              }}
            >
              {GUARDIAN_REMINDERS_HINT}
            </p>
            <button
              type="button"
              className="ax-btn ax-btn--secondary ax-btn--block"
              style={{ marginTop: 'var(--ax-space-2)' }}
              onClick={() => {
                setSaved(false);
                setCountry(profile.country_of_residence);
                setCurrency(profile.preferred_currency);
                setReminders(profile.payment_reminders);
                setEditing(true);
              }}
            >
              <span className="ax-btn__label">Modifier</span>
            </button>
          </div>
        )}
      </div>
    </section>
  );
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
        // S1 : sans lien actif, l'API répond 403 sur les demandes — pour un
        // tuteur fraîchement inscrit (ou entièrement révoqué) c'est simplement
        // « rien à payer », jamais une erreur.
        listPaymentRequests().catch((e): Paginated<PaymentRequestGuardian> => {
          if (isNoActiveLinkError(e)) return { count: 0, next: null, previous: null, results: [] };
          throw e;
        }),
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

          {/* 5 — profile (S2 : pays et devise modifiables) */}
          {profile && <ProfileCard phone={me?.phone ?? ''} profile={profile} />}

          {/* 6 — mes données (S4, ADR 0017 décision 7). Placée dans la zone
              « profil » : l'espace tuteur n'a pas de page dédiée, son profil
              vit ici — le même geste RGPD que côté patient, au même endroit
              relatif (juste sous les informations personnelles). */}
          <section aria-label="Mes données" className="ax-stack" style={{ gap: 'var(--ax-space-3)' }}>
            <h2 className="tuteur-section-title">Mes données</h2>
            {/* Le titre de section est celui de l'espace tuteur : la carte ne
                redit pas le sien (il s'affichait en double). */}
            <MyDataCard showHeading={false} />
          </section>
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
