'use client';
/*
 * Chioni — /patient/tuteurs : the guardianship screen.
 *
 * Order tells the story: (1) links waiting for MY confirmation (the gate),
 * (2) active guardians with a plain-words sentence on what each one sees
 * and the consent controls, (3) sent invitations, (4) the invite button,
 * (5) revoked history, discreet at the bottom. Every definitive action goes
 * through a modal stating the consequence in one sentence.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  grantClinicalConsent,
  inviteGuardian,
  listAllGuardians,
  revokeClinicalConsent,
  revokeGuardianLink,
} from '@/lib/endpoints/patients';
import { formatDate, RELATIONSHIP_LABELS } from '@/lib/labels';
import type { GuardianLinkPatient, Relationship } from '@/lib/types';
import { PendingGuardianCards } from './PendingGuardianCards';
import {
  ConfirmModal,
  EmptyState,
  ErrorAlert,
  GuardianLinkStatusBadge,
  SkeletonCards,
  SuccessAlert,
} from './ui';

type Dialog =
  | { kind: 'invite' }
  | { kind: 'grant'; link: GuardianLinkPatient }
  | { kind: 'ungrant'; link: GuardianLinkPatient }
  | { kind: 'revoke'; link: GuardianLinkPatient }
  | { kind: 'cancel-invite'; link: GuardianLinkPatient }
  | null;

const RELATIONSHIP_OPTIONS = Object.entries(RELATIONSHIP_LABELS) as [Relationship, string][];

export function PatientTuteurs() {
  const [links, setLinks] = useState<GuardianLinkPatient[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [success, setSuccess] = useState('');

  const [dialog, setDialog] = useState<Dialog>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<unknown>(null);

  // Invite form fields.
  const [invitePhone, setInvitePhone] = useState('');
  const [inviteRelationship, setInviteRelationship] = useState<Relationship | ''>('');
  const [inviteFieldError, setInviteFieldError] = useState('');

  // Skeletons only on the FIRST load — a refetch after an action must not
  // wipe the screen (and the success message) under the user's eyes.
  const firstLoadRef = useRef(true);

  // Bring the success banner into view when it appears (it sits at the top).
  const successRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (success) successRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [success]);

  const load = useCallback(() => {
    if (firstLoadRef.current) setLoading(true);
    setLoadError(null);
    listAllGuardians()
      .then((all) => {
        setLinks(all);
        firstLoadRef.current = false;
        setLoading(false);
      })
      .catch((err: unknown) => {
        setLoadError(err);
        setLoading(false);
      });
  }, []);

  useEffect(load, [load]);

  const pending = useMemo(
    () => links.filter((l) => l.status === 'attente_confirmation_titulaire'),
    [links],
  );
  const actives = useMemo(() => links.filter((l) => l.status === 'actif'), [links]);
  const invitations = useMemo(
    () => links.filter((l) => l.status === 'invitation_envoyee'),
    [links],
  );
  const revoked = useMemo(() => links.filter((l) => l.status === 'revoque'), [links]);

  function closeDialog() {
    if (busy) return;
    setDialog(null);
    setActionError(null);
  }

  async function runAction(action: () => Promise<unknown>, doneMessage: string): Promise<boolean> {
    setBusy(true);
    setActionError(null);
    try {
      await action();
      setDialog(null);
      setSuccess(doneMessage);
      load();
      return true;
    } catch (err) {
      setActionError(err);
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function submitInvite() {
    const phone = invitePhone.trim();
    if (!phone || inviteRelationship === '') {
      setInviteFieldError('Indiquez le numéro de téléphone et le lien avec votre proche.');
      return;
    }
    setInviteFieldError('');
    const ok = await runAction(
      () => inviteGuardian(phone, inviteRelationship),
      'Invitation envoyée. Votre proche recevra un SMS.',
    );
    if (ok) {
      setInvitePhone('');
      setInviteRelationship('');
    }
  }

  if (loading) return <SkeletonCards count={3} />;
  if (loadError != null) return <ErrorAlert error={loadError} onRetry={load} />;

  return (
    <div className="pat-stack">
      <p className="pat-hello-sub" style={{ margin: 0 }}>
        Un tuteur est un proche qui peut payer vos soins pour vous. Il ne voit jamais votre
        dossier médical sans votre accord.
      </p>

      {success && (
        <div ref={successRef}>
          <SuccessAlert message={success} />
        </div>
      )}

      {/* 1 — waiting for MY confirmation. */}
      <PendingGuardianCards links={pending} onChanged={load} />

      {/* 2 — active guardians. */}
      <h3 className="pat-section">Mes tuteurs</h3>
      {actives.length === 0 ? (
        <EmptyState
          title="Vous n'avez pas encore de tuteur"
          message="Invitez un proche de confiance : il pourra payer vos soins directement au centre de santé."
        />
      ) : (
        actives.map((link) => {
          const seesClinical = link.scopes.includes('detail_clinique');
          return (
            <section key={link.id} className="ax-card" role="region" aria-label={`Tuteur ${link.guardian_name}`}>
              <div className="ax-card__body pat-gate__body">
                <div className="pat-row" style={{ minHeight: 0 }}>
                  <div className="pat-row__main">
                    <span className="pat-row__title">{link.guardian_name}</span>
                    <span className="pat-row__meta">
                      {RELATIONSHIP_LABELS[link.relationship]}
                      {link.accepted_at ? ` · depuis le ${formatDate(link.accepted_at)}` : ''}
                    </span>
                  </div>
                  <GuardianLinkStatusBadge status={link.status} />
                </div>
                <p className="pat-gate__meta">
                  {seesClinical ? (
                    'Peut payer vos soins. Pourra voir vos ordonnances (bientôt disponible).'
                  ) : (
                    <>Peut payer vos soins. Ne voit <b>pas</b> votre dossier médical.</>
                  )}
                </p>
                <div className="pat-actions">
                  {seesClinical ? (
                    <button
                      type="button"
                      className="ax-btn ax-btn--outline ax-btn--lg ax-btn--block"
                      onClick={() => setDialog({ kind: 'ungrant', link })}
                    >
                      Ne plus montrer mes ordonnances
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="ax-btn ax-btn--outline ax-btn--lg ax-btn--block"
                      onClick={() => setDialog({ kind: 'grant', link })}
                    >
                      Autoriser à voir mes ordonnances
                    </button>
                  )}
                  <button
                    type="button"
                    className="ax-btn ax-btn--soft-danger ax-btn--lg ax-btn--block"
                    onClick={() => setDialog({ kind: 'revoke', link })}
                  >
                    Retirer ce tuteur
                  </button>
                </div>
              </div>
            </section>
          );
        })
      )}

      {/* 3 — sent invitations. */}
      {invitations.length > 0 && (
        <>
          <h3 className="pat-section">Invitations envoyées</h3>
          {invitations.map((link) => (
            <section key={link.id} className="ax-card">
              <div className="ax-card__body pat-gate__body">
                <div className="pat-row" style={{ minHeight: 0 }}>
                  <div className="pat-row__main">
                    <span className="pat-row__title">
                      {link.guardian_name || 'Invitation en attente'}
                    </span>
                    <span className="pat-row__meta">{RELATIONSHIP_LABELS[link.relationship]}</span>
                  </div>
                  <GuardianLinkStatusBadge status={link.status} />
                </div>
                <button
                  type="button"
                  className="ax-btn ax-btn--outline ax-btn--lg ax-btn--block"
                  onClick={() => {
                    setActionError(null);
                    setDialog({ kind: 'cancel-invite', link });
                  }}
                >
                  Annuler l&rsquo;invitation
                </button>
              </div>
            </section>
          ))}
        </>
      )}

      {/* 4 — the invite action. */}
      <button
        type="button"
        className="ax-btn ax-btn--primary ax-btn--lg ax-btn--block"
        onClick={() => {
          setActionError(null);
          setInviteFieldError('');
          setDialog({ kind: 'invite' });
        }}
      >
        Inviter un tuteur
      </button>

      {/* 5 — revoked history, discreet. */}
      {revoked.length > 0 && (
        <details className="pat-history">
          <summary>Voir les anciens tuteurs ({revoked.length})</summary>
          <div className="pat-stack" style={{ paddingBlockStart: 'var(--ax-space-2)' }}>
            {revoked.map((link) => (
              <section key={link.id} className="ax-card">
                <div className="ax-card__body pat-row">
                  <div className="pat-row__main">
                    <span className="pat-row__title" style={{ color: 'var(--ax-text-muted)' }}>
                      {link.guardian_name}
                    </span>
                    <span className="pat-row__meta">
                      {RELATIONSHIP_LABELS[link.relationship]}
                      {link.revoked_at ? ` · retiré le ${formatDate(link.revoked_at)}` : ''}
                    </span>
                  </div>
                  <GuardianLinkStatusBadge status={link.status} />
                </div>
              </section>
            ))}
          </div>
        </details>
      )}

      {/* invite modal */}
      <ConfirmModal
        open={dialog?.kind === 'invite'}
        title="Inviter un tuteur"
        message="Votre proche recevra une invitation par SMS. Il ne verra jamais votre dossier médical sans votre accord."
        confirmLabel="Envoyer l'invitation"
        busy={busy}
        error={actionError}
        onConfirm={() => void submitInvite()}
        onClose={closeDialog}
      >
        <div className="ax-field">
          <label className="ax-label" htmlFor="tu-phone">Numéro de téléphone du proche</label>
          <input
            id="tu-phone"
            type="tel"
            inputMode="tel"
            className={`ax-input ax-input--lg${inviteFieldError ? ' is-invalid' : ''}`}
            placeholder="+33 6 12 34 56 78"
            value={invitePhone}
            onChange={(e) => setInvitePhone(e.target.value)}
            aria-describedby="tu-phone-msg"
          />
          <p id="tu-phone-msg" className="ax-field__message">
            Avec l&rsquo;indicatif du pays s&rsquo;il vit à l&rsquo;étranger (par exemple +33 pour
            la France).
          </p>
        </div>
        <div className="ax-field">
          <label className="ax-label" htmlFor="tu-rel">Qui est cette personne pour vous ?</label>
          <select
            id="tu-rel"
            className="ax-select ax-select--lg"
            value={inviteRelationship}
            onChange={(e) => setInviteRelationship(e.target.value as Relationship | '')}
          >
            <option value="">Choisir…</option>
            {RELATIONSHIP_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          {inviteFieldError && (
            <p className="ax-field__message ax-field__message--error">{inviteFieldError}</p>
          )}
        </div>
      </ConfirmModal>

      {/* clinical consent — grant */}
      <ConfirmModal
        open={dialog?.kind === 'grant'}
        title={dialog?.kind === 'grant' ? `Montrer vos ordonnances à ${dialog.link.guardian_name} ?` : ''}
        message="Cette personne pourra voir vos ordonnances (bientôt disponible). Vous pourrez retirer cette autorisation à tout moment."
        confirmLabel="Oui, autoriser"
        busy={busy}
        error={actionError}
        onConfirm={() => {
          if (dialog?.kind !== 'grant') return;
          void runAction(
            () => grantClinicalConsent(dialog.link.id),
            `${dialog.link.guardian_name} peut maintenant voir vos ordonnances.`,
          );
        }}
        onClose={closeDialog}
      />

      {/* clinical consent — withdraw */}
      <ConfirmModal
        open={dialog?.kind === 'ungrant'}
        title="Ne plus montrer vos ordonnances ?"
        message={
          dialog?.kind === 'ungrant'
            ? `${dialog.link.guardian_name} ne verra plus vos ordonnances. Il pourra toujours payer vos soins.`
            : ''
        }
        confirmLabel="Oui, retirer l'autorisation"
        busy={busy}
        error={actionError}
        onConfirm={() => {
          if (dialog?.kind !== 'ungrant') return;
          void runAction(
            () => revokeClinicalConsent(dialog.link.id),
            `${dialog.link.guardian_name} ne voit plus vos ordonnances.`,
          );
        }}
        onClose={closeDialog}
      />

      {/* cancel a SENT invitation — same endpoint as revoke, but the person
          never was a guardian, so no anxious wording. The backend keeps the
          revoked row (unique guardian/patient), so re-inviting the SAME
          person is not possible yet — the modal says it honestly. */}
      <ConfirmModal
        open={dialog?.kind === 'cancel-invite'}
        title="Annuler cette invitation ?"
        message="L'invitation sera annulée. À savoir : vous ne pourrez pas ré-inviter cette personne pour le moment."
        confirmLabel="Oui, annuler l'invitation"
        cancelLabel="Garder l'invitation"
        busy={busy}
        error={actionError}
        onConfirm={() => {
          if (dialog?.kind !== 'cancel-invite') return;
          void runAction(
            () => revokeGuardianLink(dialog.link.id),
            "L'invitation a été annulée.",
          );
        }}
        onClose={closeDialog}
      />

      {/* revoke guardian — FINAL */}
      <ConfirmModal
        open={dialog?.kind === 'revoke'}
        title="Retirer ce tuteur ?"
        message={
          dialog?.kind === 'revoke'
            ? `Cette action est définitive. ${dialog.link.guardian_name} ne pourra plus payer vos soins.`
            : ''
        }
        confirmLabel="Oui, retirer ce tuteur"
        danger
        busy={busy}
        error={actionError}
        onConfirm={() => {
          if (dialog?.kind !== 'revoke') return;
          void runAction(
            () => revokeGuardianLink(dialog.link.id),
            `${dialog.link.guardian_name} ne fait plus partie de vos tuteurs.`,
          );
        }}
        onClose={closeDialog}
      />
    </div>
  );
}

export default PatientTuteurs;
