'use client';
/*
 * Chioni — the claimant-confirmation gate (ADR 0010), as cards.
 *
 * Every guardian link in `attente_confirmation_titulaire` becomes a top-
 * priority call to action: « {name} souhaite pouvoir payer vos soins.
 * Est-ce bien votre proche ? ». « Oui, je confirme » acts immediately
 * (revocable later) ; « Non » opens a modal because the refusal is FINAL.
 * Shared by the home screen and the guardians screen.
 */
import { useState } from 'react';
import { confirmGuardianLink, declineGuardianLink } from '@/lib/endpoints/patients';
import { RELATIONSHIP_LABELS } from '@/lib/labels';
import type { GuardianLinkPatient } from '@/lib/types';
import { ConfirmModal, ErrorAlert, SuccessAlert } from './ui';

export function PendingGuardianCards({
  links,
  onChanged,
}: {
  /** Links already filtered on `attente_confirmation_titulaire`. */
  links: GuardianLinkPatient[];
  /** Called after a successful confirm/decline so the parent reloads. */
  onChanged: () => void;
}) {
  const [declining, setDeclining] = useState<GuardianLinkPatient | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [actionError, setActionError] = useState<unknown>(null);
  const [declineError, setDeclineError] = useState<unknown>(null);
  const [success, setSuccess] = useState('');

  async function confirm(link: GuardianLinkPatient) {
    setBusyId(link.id);
    setActionError(null);
    setSuccess('');
    try {
      await confirmGuardianLink(link.id);
      setSuccess(`C'est fait. ${link.guardian_name} peut maintenant payer vos soins.`);
      onChanged();
    } catch (err) {
      setActionError(err);
    } finally {
      setBusyId(null);
    }
  }

  async function decline() {
    if (!declining) return;
    setBusyId(declining.id);
    setDeclineError(null);
    setSuccess('');
    try {
      await declineGuardianLink(declining.id);
      setDeclining(null);
      setSuccess('Cette demande a été refusée.');
      onChanged();
    } catch (err) {
      setDeclineError(err);
    } finally {
      setBusyId(null);
    }
  }

  if (links.length === 0 && !success) return null;

  return (
    <div className="pat-stack">
      {success && <SuccessAlert message={success} />}
      {actionError != null && <ErrorAlert error={actionError} />}

      {links.map((link) => (
        <section key={link.id} className="ax-card pat-gate" role="region" aria-label="Demande à confirmer">
          <div className="ax-card__body pat-gate__body">
            <p className="pat-gate__eyebrow">Une réponse est attendue de vous</p>
            <h3 className="pat-gate__question">
              {link.guardian_name} souhaite pouvoir payer vos soins. Est-ce bien votre proche&nbsp;?
            </h3>
            <p className="pat-gate__meta">
              Lien indiqué&nbsp;: {RELATIONSHIP_LABELS[link.relationship]}. Cette personne ne verra
              jamais votre dossier médical sans votre accord.
            </p>
            <div className="pat-actions">
              <button
                type="button"
                className={`ax-btn ax-btn--primary ax-btn--lg ax-btn--block${busyId === link.id ? ' is-loading' : ''}`}
                onClick={() => void confirm(link)}
                disabled={busyId !== null}
                aria-busy={busyId === link.id}
              >
                <span className="ax-btn__spinner" aria-hidden="true"></span>
                <span className="ax-btn__label">Oui, je confirme</span>
              </button>
              <button
                type="button"
                className="ax-btn ax-btn--outline ax-btn--lg ax-btn--block"
                onClick={() => {
                  setDeclineError(null);
                  setDeclining(link);
                }}
                disabled={busyId !== null}
              >
                Non, je refuse
              </button>
            </div>
          </div>
        </section>
      ))}

      <ConfirmModal
        open={declining !== null}
        title="Refuser cette demande ?"
        message={
          declining
            ? `Ce refus est définitif. ${declining.guardian_name} ne pourra pas payer vos soins. Vous n'avez pas à vous justifier.`
            : ''
        }
        confirmLabel="Oui, je refuse"
        cancelLabel="Revenir en arrière"
        danger
        busy={busyId !== null}
        error={declineError}
        onConfirm={() => void decline()}
        onClose={() => setDeclining(null)}
      />
    </div>
  );
}
