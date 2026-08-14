'use client';
/*
 * Chioni — /tuteur/proteges (protégés, invitations, porte A).
 *
 * Porte A: the guardian creates the record of a relative who has no
 * smartphone — the link is active immediately. If a phone number is given,
 * the relative gets an SMS invitation to activate their own health record.
 *
 * When a protégé claims their profile, the link leaves the protégés list
 * until the patient confirms it (ADR 0010 — the claimant-confirmation gate).
 * S2: GET /guardian/links/ makes that link VISIBLE here, in a dedicated
 * « en attente de confirmation de votre proche » section that presents the
 * wait as the patient's protection — never as an error, never with a nudge
 * to chase the patient. Revoked links live in a folded, discreet history.
 * The links payload carries no phone and no scopes: nothing more is shown.
 */

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import type { ApiError } from '@/lib/api';
import {
  acceptInvitation,
  createProtege,
  declineInvitation,
  listGuardianLinks,
  listInvitations,
  listProteges,
  revokeLink,
  type ProtegePayload,
} from '@/lib/endpoints/guardian';
import { RELATIONSHIP_LABELS, SEX_LABELS, formatDate } from '@/lib/labels';
import type { GuardianLinkGuardian, Relationship, Sex } from '@/lib/types';
import {
  DeclineInvitationModal,
  EmptyState,
  ErrorAlert,
  HEART_ICON,
  LoadingCard,
  Modal,
  protegeInitials,
  protegeName,
  toDisplayError,
  usePagedList,
} from './common';

const RELATIONSHIP_OPTIONS = Object.entries(RELATIONSHIP_LABELS) as [Relationship, string][];

/* ── add-protégé form (porte A) ── */

const EMPTY_FORM = {
  first_name: '',
  last_name: '',
  relationship: '' as '' | Relationship,
  birth_date: '',
  sex: '' as Sex,
  phone: '',
  city: '',
};

function FieldError({ errors }: { errors?: string[] }) {
  if (!errors || errors.length === 0) return null;
  return <p className="ax-field__message ax-field__message--error">{errors[0]}</p>;
}

function AddProtegeForm({
  onDone,
  onCancel,
}: {
  onDone: (name: string) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const set = <K extends keyof typeof EMPTY_FORM>(key: K, value: (typeof EMPTY_FORM)[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy || !form.relationship) return;
    setBusy(true);
    setError(null);
    const payload: ProtegePayload = {
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      relationship: form.relationship,
    };
    if (form.birth_date) payload.birth_date = form.birth_date;
    if (form.sex) payload.sex = form.sex;
    if (form.phone.trim()) payload.phone = form.phone.trim();
    if (form.city.trim()) payload.city = form.city.trim();
    try {
      const link = await createProtege(payload);
      onDone(protegeName(link.patient));
    } catch (err) {
      setError(toDisplayError(err));
      setBusy(false);
    }
  };

  const fieldErrors = error?.fieldErrors ?? {};

  return (
    <section className="ax-card" style={{ margin: 0 }} aria-label="Ajouter un protégé">
      <div className="ax-card__header">
        <div className="ax-card__titles"><h2 className="ax-card__title">Ajouter un protégé</h2></div>
      </div>
      <div className="ax-card__body" style={{ paddingTop: 0 }}>
        <form onSubmit={(e) => void submit(e)} className="ax-stack" style={{ gap: 'var(--ax-space-4)' }}>
          <div className="ax-field">
            <label className="ax-field__label" htmlFor="protege-first-name">
              Prénom <span className="ax-field__required">*</span>
            </label>
            <input
              id="protege-first-name"
              className="ax-input"
              required
              autoComplete="off"
              value={form.first_name}
              onChange={(e) => set('first_name', e.target.value)}
            />
            <FieldError errors={fieldErrors.first_name} />
          </div>

          <div className="ax-field">
            <label className="ax-field__label" htmlFor="protege-last-name">
              Nom <span className="ax-field__required">*</span>
            </label>
            <input
              id="protege-last-name"
              className="ax-input"
              required
              autoComplete="off"
              value={form.last_name}
              onChange={(e) => set('last_name', e.target.value)}
            />
            <FieldError errors={fieldErrors.last_name} />
          </div>

          <div className="ax-field">
            <label className="ax-field__label" htmlFor="protege-relationship">
              Votre lien avec cette personne <span className="ax-field__required">*</span>
            </label>
            <select
              id="protege-relationship"
              className="ax-select"
              required
              value={form.relationship}
              onChange={(e) => set('relationship', e.target.value as Relationship)}
            >
              <option value="" disabled>Choisir…</option>
              {RELATIONSHIP_OPTIONS.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <FieldError errors={fieldErrors.relationship} />
          </div>

          <div className="ax-field">
            <label className="ax-field__label" htmlFor="protege-birth-date">Date de naissance</label>
            <input
              id="protege-birth-date"
              type="date"
              className="ax-input"
              value={form.birth_date}
              onChange={(e) => set('birth_date', e.target.value)}
            />
            <FieldError errors={fieldErrors.birth_date} />
          </div>

          <div className="ax-field">
            <label className="ax-field__label" htmlFor="protege-sex">Sexe</label>
            <select
              id="protege-sex"
              className="ax-select"
              value={form.sex}
              onChange={(e) => set('sex', e.target.value as Sex)}
            >
              <option value="">{SEX_LABELS['']}</option>
              <option value="f">{SEX_LABELS.f}</option>
              <option value="m">{SEX_LABELS.m}</option>
            </select>
            <FieldError errors={fieldErrors.sex} />
          </div>

          <div className="ax-field">
            <label className="ax-field__label" htmlFor="protege-phone">Son téléphone</label>
            <input
              id="protege-phone"
              type="tel"
              inputMode="tel"
              className="ax-input"
              placeholder="+269…"
              value={form.phone}
              onChange={(e) => set('phone', e.target.value)}
            />
            <p className="ax-field__hint">
              Si vous donnez son numéro, votre proche recevra une invitation par SMS pour activer
              son carnet.
            </p>
            <FieldError errors={fieldErrors.phone} />
          </div>

          <div className="ax-field">
            <label className="ax-field__label" htmlFor="protege-city">Ville</label>
            <input
              id="protege-city"
              className="ax-input"
              value={form.city}
              onChange={(e) => set('city', e.target.value)}
            />
            <FieldError errors={fieldErrors.city} />
          </div>

          {error && error.messages.length > 0 && <ErrorAlert error={error} />}

          <button type="submit" className="ax-btn ax-btn--primary ax-btn--lg ax-btn--block" disabled={busy}>
            <span className="ax-btn__label">{busy ? 'Ajout…' : 'Ajouter ce protégé'}</span>
          </button>
          <button type="button" className="ax-btn ax-btn--ghost ax-btn--block" disabled={busy} onClick={onCancel}>
            <span className="ax-btn__label">Annuler</span>
          </button>
        </form>
      </div>
    </section>
  );
}

/* ── revoke confirmation ── */

function RevokeModal({
  link,
  busy,
  error,
  onConfirm,
  onClose,
}: {
  link: GuardianLinkGuardian;
  busy: boolean;
  error: ApiError | null;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const name = protegeName(link.patient);
  return (
    <Modal title="Retirer ce lien ?" onClose={onClose}>
      <div className="ax-stack" style={{ gap: 'var(--ax-space-4)' }}>
        <p style={{ margin: 0, fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)', lineHeight: 1.6 }}>
          Vous ne verrez plus les demandes de paiement de{' '}
          <b style={{ color: 'var(--ax-text-strong)' }}>{name}</b> et vous ne pourrez plus régler
          ses soins.
        </p>
        <div className="ax-alert ax-alert--warning" role="note">
          <div className="ax-alert__content">
            <p className="ax-alert__message" style={{ margin: 0 }}>
              Ce retrait est définitif. Pour aider {name} à nouveau, il faudra créer un nouveau
              lien.
            </p>
          </div>
        </div>
        {error && <ErrorAlert error={error} />}
        <div className="ax-cluster" style={{ justifyContent: 'flex-end', gap: 'var(--ax-space-3)' }}>
          <button type="button" className="ax-btn ax-btn--ghost" disabled={busy} onClick={onClose}>
            <span className="ax-btn__label">Garder le lien</span>
          </button>
          <button type="button" className="ax-btn ax-btn--danger" disabled={busy} onClick={onConfirm}>
            <span className="ax-btn__label">{busy ? 'Retrait…' : 'Retirer définitivement'}</span>
          </button>
        </div>
      </div>
    </Modal>
  );
}

/* ── screen ── */

export function TuteurProteges() {
  const proteges = usePagedList(listProteges);
  /* S2 : l'historique complet des liens — la source des sections « en
     attente de confirmation » et « anciens liens ». */
  const links = usePagedList(listGuardianLinks);
  const pendingConfirmation = useMemo(
    () => links.items.filter((l) => l.status === 'attente_confirmation_titulaire'),
    [links.items],
  );
  const revokedLinks = useMemo(
    () => links.items.filter((l) => l.status === 'revoque'),
    [links.items],
  );

  const [invitations, setInvitations] = useState<GuardianLinkGuardian[]>([]);
  const [invitationsError, setInvitationsError] = useState<ApiError | null>(null);
  const [acceptingId, setAcceptingId] = useState<number | null>(null);

  const [adding, setAdding] = useState(false);
  const [addedName, setAddedName] = useState<string | null>(null);

  const [revokeTarget, setRevokeTarget] = useState<GuardianLinkGuardian | null>(null);
  const [revokeBusy, setRevokeBusy] = useState(false);
  const [revokeError, setRevokeError] = useState<ApiError | null>(null);

  const [declineTarget, setDeclineTarget] = useState<GuardianLinkGuardian | null>(null);
  const [declineBusy, setDeclineBusy] = useState(false);
  const [declineError, setDeclineError] = useState<ApiError | null>(null);

  const loadInvitations = useCallback(async () => {
    setInvitationsError(null);
    try {
      const data = await listInvitations();
      setInvitations(data.results);
    } catch (e) {
      setInvitationsError(toDisplayError(e));
    }
  }, []);

  useEffect(() => {
    void loadInvitations();
  }, [loadInvitations]);

  const onAccept = async (linkId: number) => {
    setAcceptingId(linkId);
    try {
      await acceptInvitation(linkId);
      await Promise.all([loadInvitations(), proteges.reload()]);
    } catch (e) {
      setInvitationsError(toDisplayError(e));
    } finally {
      setAcceptingId(null);
    }
  };

  const onRevoke = async () => {
    if (!revokeTarget) return;
    setRevokeBusy(true);
    setRevokeError(null);
    try {
      await revokeLink(revokeTarget.id);
      setRevokeTarget(null);
      await proteges.reload();
    } catch (e) {
      setRevokeError(toDisplayError(e));
    } finally {
      setRevokeBusy(false);
    }
  };

  const onDecline = async () => {
    if (!declineTarget) return;
    setDeclineBusy(true);
    setDeclineError(null);
    try {
      await declineInvitation(declineTarget.id);
      setDeclineTarget(null);
      await loadInvitations();
    } catch (e) {
      setDeclineError(toDisplayError(e));
    } finally {
      setDeclineBusy(false);
    }
  };

  const claimBadge = (link: GuardianLinkGuardian) =>
    link.patient.claim_status === 'actif' ? (
      <span className="ax-badge ax-badge--soft ax-badge--success ax-badge--sm ax-badge--pill">
        A activé son compte
      </span>
    ) : (
      <span className="ax-badge ax-badge--soft ax-badge--neutral ax-badge--sm ax-badge--pill">
        Compte non encore activé
      </span>
    );

  return (
    <div className="tuteur-screen">
      {addedName && (
        <div className="ax-alert ax-alert--success" role="status">
          <div className="ax-alert__content">
            <p className="ax-alert__message" style={{ margin: 0 }}>
              {addedName} fait maintenant partie de vos protégés. Vous pourrez régler ses soins dès
              qu&rsquo;un centre enverra une demande.
            </p>
          </div>
        </div>
      )}

      {/* invitations first: someone is waiting for an answer */}
      {(invitations.length > 0 || invitationsError) && (
        <section aria-label="Invitations reçues" className="ax-stack" style={{ gap: 'var(--ax-space-3)' }}>
          <h2 className="tuteur-section-title">Invitations reçues</h2>
          {invitationsError && (
            <ErrorAlert error={invitationsError} onRetry={() => void loadInvitations()} />
          )}
          {invitations.map((inv) => (
            <div key={inv.id} className="ax-card" style={{ margin: 0 }}>
              <div className="ax-card__body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-3)' }}>
                <p style={{ margin: 0, fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)' }}>
                  <b style={{ color: 'var(--ax-text-strong)' }}>{protegeName(inv.patient)}</b> vous
                  invite à devenir son tuteur (
                  {RELATIONSHIP_LABELS[inv.relationship].toLowerCase()}).
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

      {adding ? (
        <AddProtegeForm
          onDone={(name) => {
            setAdding(false);
            setAddedName(name);
            void proteges.reload();
          }}
          onCancel={() => setAdding(false)}
        />
      ) : (
        <button
          type="button"
          className="ax-btn ax-btn--primary ax-btn--lg ax-btn--block"
          onClick={() => {
            setAddedName(null);
            setAdding(true);
          }}
        >
          <span className="ax-btn__label">Ajouter un protégé</span>
        </button>
      )}

      <section aria-label="Mes protégés" className="ax-stack" style={{ gap: 'var(--ax-space-3)' }}>
        <h2 className="tuteur-section-title">Mes protégés</h2>

        {proteges.loading && <LoadingCard />}
        {!proteges.loading && proteges.error && proteges.items.length === 0 && (
          <ErrorAlert error={proteges.error} onRetry={() => void proteges.reload()} />
        )}

        {!proteges.loading && !proteges.error && proteges.items.length === 0 && (
          <EmptyState
            icon={HEART_ICON}
            title="Aucun protégé pour le moment"
            text="Ajoutez un proche pour pouvoir régler ses soins directement au centre de santé."
          />
        )}

        {proteges.items.length > 0 && (
          <div className="ax-card" style={{ margin: 0 }}>
            <div className="ax-card__body" style={{ paddingBlock: 'var(--ax-space-2)' }}>
              {proteges.items.map((link) => (
                <div key={link.id} className="tuteur-protege">
                  <span className="tuteur-protege__avatar" aria-hidden="true">
                    {protegeInitials(link.patient)}
                  </span>
                  <span className="tuteur-protege__body">
                    <span className="tuteur-protege__name">{protegeName(link.patient)}</span>
                    <span className="tuteur-protege__meta">
                      <span>{RELATIONSHIP_LABELS[link.relationship]}</span>
                      {claimBadge(link)}
                    </span>
                  </span>
                  <button
                    type="button"
                    className="ax-btn ax-btn--ghost ax-btn--sm"
                    onClick={() => {
                      setRevokeError(null);
                      setRevokeTarget(link);
                    }}
                  >
                    <span className="ax-btn__label">Retirer</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {proteges.hasMore && (
          <button
            type="button"
            className="ax-btn ax-btn--secondary ax-btn--block"
            disabled={proteges.loadingMore}
            onClick={() => void proteges.loadMore()}
          >
            <span className="ax-btn__label">
              {proteges.loadingMore
                ? 'Chargement…'
                : `Voir plus (${proteges.items.length} sur ${proteges.count})`}
            </span>
          </button>
        )}
      </section>

      {/* S2 — liens en attente de la confirmation du titulaire : le protégé
          n'a pas « disparu », il protège son dossier. Aucune action ici,
          aucune relance suggérée. */}
      {!links.loading && links.error && (
        <ErrorAlert error={links.error} onRetry={() => void links.reload()} />
      )}
      {pendingConfirmation.length > 0 && (
        <section
          aria-label="En attente de confirmation de votre proche"
          className="ax-stack"
          style={{ gap: 'var(--ax-space-3)' }}
        >
          <h2 className="tuteur-section-title">En attente de confirmation</h2>
          <div className="ax-card" style={{ margin: 0 }}>
            <div className="ax-card__body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-3)' }}>
              {pendingConfirmation.map((l) => (
                <div key={l.id} className="tuteur-protege" style={{ paddingBlock: 0 }}>
                  <span className="tuteur-protege__avatar" aria-hidden="true">
                    {l.protege_display_name
                      .split(/\s+/)
                      .filter(Boolean)
                      .slice(0, 2)
                      .map((w) => w[0]?.toUpperCase() ?? '')
                      .join('') || '?'}
                  </span>
                  <span className="tuteur-protege__body">
                    <span className="tuteur-protege__name">{l.protege_display_name}</span>
                    <span className="tuteur-protege__meta">
                      <span className="ax-badge ax-badge--soft ax-badge--warning ax-badge--sm ax-badge--pill">
                        Attend sa confirmation
                      </span>
                    </span>
                  </span>
                </div>
              ))}
              <p className="tuteur-money-card__note" style={{ margin: 0 }}>
                Votre proche doit confirmer votre lien depuis son espace, à son rythme. Dès sa
                confirmation, ses demandes de paiement apparaîtront ici — cette étape protège son
                dossier.
              </p>
            </div>
          </div>
        </section>
      )}

      {/* S2 — historique révoqué : discret et replié. */}
      {revokedLinks.length > 0 && (
        <details className="tuteur-privacy">
          <summary>Anciens liens ({revokedLinks.length})</summary>
          <div className="tuteur-privacy__panel">
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-2)' }}>
              {revokedLinks.map((l) => (
                <li key={l.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--ax-space-3)', flexWrap: 'wrap' }}>
                  <span>{l.protege_display_name}</span>
                  <span style={{ color: 'var(--ax-text-subtle)' }}>
                    {l.revoked_at ? `Lien retiré le ${formatDate(l.revoked_at)}` : 'Lien retiré'}
                  </span>
                </li>
              ))}
            </ul>
            {links.hasMore && (
              <button
                type="button"
                className="ax-btn ax-btn--ghost ax-btn--sm ax-btn--block"
                style={{ marginTop: 'var(--ax-space-3)' }}
                disabled={links.loadingMore}
                onClick={() => void links.loadMore()}
              >
                <span className="ax-btn__label">
                  {links.loadingMore ? 'Chargement…' : 'Voir plus d’historique'}
                </span>
              </button>
            )}
          </div>
        </details>
      )}

      {revokeTarget && (
        <RevokeModal
          link={revokeTarget}
          busy={revokeBusy}
          error={revokeError}
          onConfirm={() => void onRevoke()}
          onClose={() => setRevokeTarget(null)}
        />
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

export default TuteurProteges;
