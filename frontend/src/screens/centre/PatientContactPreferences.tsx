'use client';
/*
 * Chioni — carte « Messages SMS » du dossier patient (S10, ADR 0023 §1).
 *
 * Base Vireo : le panneau « Notification channels » de `pages/ProfileSettings`
 * — ses lignes « intitulé + description + `ax-switch` » sont reprises telles
 * quelles, amputées des trois colonnes de canaux (Chioni n'a qu'un canal : le
 * SMS) et branchées sur de vraies données.
 *
 * ── LES DEUX RÈGLES DE CETTE CARTE ───────────────────────────────────────
 *
 * 1. **La lecture est ouverte à tout membre actif, l'écriture ne l'est que
 *    sur un profil NON revendiqué.** Dès que la personne a activé son compte,
 *    elle gère elle-même — exactement comme le consentement clinique porte C
 *    (S2). L'écran le dit AVANT le geste : on rend les réglages en lecture
 *    seule avec la raison, jamais un formulaire qui échoue. Un formulaire qui
 *    échoue apprend au personnel à se méfier de l'écran.
 * 2. **Ces réglages ne coupent que les rappels.** Le code de connexion, « un
 *    proche demande à pouvoir payer vos soins » et « votre soin a été payé »
 *    partent toujours. Un agent qui croirait couper tous les SMS couperait, à
 *    ses yeux, la porte de confirmation du titulaire — invariant éthique du
 *    produit.
 *
 * PUT et non PATCH : le formulaire de guichet part en entier, pour qu'aucune
 * préférence ne reste silencieusement à sa valeur d'avant sans que l'agent
 * l'ait vue. Les deux interrupteurs sont donc un ÉTAT LOCAL, confirmé par un
 * bouton — pas deux écritures indépendantes qui pourraient s'appliquer dans le
 * désordre (défaut relevé en S7 sur la feuille de présence).
 */
import { useEffect, useState } from 'react';
import { useCenter } from '@/context/CenterContext';
import type { ApiError } from '@/lib/api';
import {
  getPatientContactPreferences,
  updatePatientContactPreferences,
} from '@/lib/endpoints/centers';
import {
  CONTACT_PREFERENCE_KEYS,
  DESK_PREFERENCES_CLAIMED_REASON,
  DESK_PREFERENCES_NEVER_SET,
  DESK_PREFERENCES_SAFETY_NOTICE,
  DESK_PREFERENCES_SAVED,
  DESK_PREFERENCES_SUBTITLE,
  DESK_PREFERENCES_TITLE,
  DESK_PREFERENCE_LABELS,
  deskPreferencesUpdatedAt,
} from '@/lib/labels';
import type { Patient, PatientContactPreferences } from '@/lib/types';
import { CardSkeleton, ErrorAlert, toApiError, useAsync, useScopedState } from './shared';

export function ContactPreferencesCard({ patient }: { patient: Patient }) {
  const { centerId } = useCenter();
  const claimed = patient.claim_status === 'actif';

  const prefs = useAsync(
    () => getPatientContactPreferences(centerId, patient.id),
    [centerId, patient.id],
  );

  /*
   * La vérité APRÈS écriture est celle que le PUT a rendue — on ne recharge
   * pas : un rechargement ferait repasser l'effet ci-dessous et effacerait le
   * message de succès dans la seconde. `useScopedState` borne cette valeur au
   * couple (centre actif, patient) sous lequel elle a été obtenue : changer de
   * centre depuis le sélecteur ne peut pas laisser à l'écran les réglages de
   * quelqu'un d'autre (fenêtre d'affichage inter-tenant, revues S6/S7/S9).
   */
  const [patched, setPatched] = useScopedState<PatientContactPreferences>(
    `${centerId}:${patient.id}`,
  );
  const loaded = patched ?? prefs.data;

  /* Le brouillon du formulaire, réaligné à chaque arrivée de données SERVEUR
     — jamais initialisé une seule fois : un changement de centre ou de patient
     doit remettre les interrupteurs sur la vérité du serveur. */
  const [draft, setDraft] = useState<Record<string, boolean> | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<ApiError | null>(null);
  const [saved, setSaved] = useState(false);

  const fetched = prefs.data;
  useEffect(() => {
    if (!fetched) {
      setDraft(null);
      return;
    }
    setDraft({
      appointment_reminders: fetched.appointment_reminders,
      missed_appointment_followup: fetched.missed_appointment_followup,
    });
    setSaved(false);
    setSaveError(null);
  }, [fetched]);

  const dirty =
    draft !== null &&
    loaded !== null &&
    CONTACT_PREFERENCE_KEYS.some((key) => draft[key] !== loaded[key]);

  const submit = async () => {
    if (!draft || saving) return;
    setSaving(true);
    setSaveError(null);
    setSaved(false);
    try {
      const updated = await updatePatientContactPreferences(centerId, patient.id, {
        appointment_reminders: draft.appointment_reminders,
        missed_appointment_followup: draft.missed_appointment_followup,
      });
      setPatched(updated);
      setDraft({
        appointment_reminders: updated.appointment_reminders,
        missed_appointment_followup: updated.missed_appointment_followup,
      });
      setSaved(true);
    } catch (err) {
      setSaveError(toApiError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="ax-card ax-col--4" role="region" aria-label={DESK_PREFERENCES_TITLE}>
      <div className="ax-card__header">
        <div className="ax-card__titles">
          <h2 className="ax-card__title">{DESK_PREFERENCES_TITLE}</h2>
          <p className="ax-card__subtitle">{DESK_PREFERENCES_SUBTITLE}</p>
        </div>
      </div>
      <div
        className="ax-card__body"
        style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}
      >
        {prefs.loading ? (
          <CardSkeleton lines={3} />
        ) : prefs.error ? (
          <ErrorAlert error={prefs.error} onRetry={prefs.reload} />
        ) : draft && loaded ? (
          <>
            {/* La raison AVANT le geste : les interrupteurs sont désactivés
                et le pourquoi est écrit, plutôt qu'un formulaire qui prendra
                un 400. */}
            {claimed && (
              <div className="ax-alert ax-alert--info" role="note">
                <div className="ax-alert__content">
                  <p className="ax-alert__message" style={{ margin: 0, lineHeight: 1.7 }}>
                    {DESK_PREFERENCES_CLAIMED_REASON}
                  </p>
                </div>
              </div>
            )}

            {saved && !dirty && (
              <div className="ax-alert ax-alert--success" role="status">
                <div className="ax-alert__content">
                  <p className="ax-alert__message" style={{ margin: 0 }}>
                    {DESK_PREFERENCES_SAVED}
                  </p>
                </div>
              </div>
            )}
            {saveError && <ErrorAlert error={saveError} />}

            {/* La même phrase que côté patient, et AVANT les interrupteurs :
                un agent qui croirait couper tous les SMS couperait, à ses
                yeux, la porte de confirmation du titulaire. Lue sous les
                boutons, elle arrive après le geste. */}
            <p style={{ margin: 0, fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-muted)', lineHeight: 1.6 }}>
              {DESK_PREFERENCES_SAFETY_NOTICE}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-3)' }}>
              {CONTACT_PREFERENCE_KEYS.map((key) => (
                <label
                  key={key}
                  className="ax-cluster"
                  style={{
                    justifyContent: 'space-between',
                    gap: 'var(--ax-space-3)',
                    flexWrap: 'nowrap',
                    cursor: claimed ? 'default' : 'pointer',
                  }}
                >
                  <span
                    style={{
                      fontSize: 'var(--ax-text-sm)',
                      color: claimed ? 'var(--ax-text-muted)' : 'var(--ax-text)',
                      lineHeight: 1.5,
                    }}
                  >
                    {DESK_PREFERENCE_LABELS[key]}
                  </span>
                  <input
                    type="checkbox"
                    className="ax-switch"
                    checked={draft[key]}
                    disabled={claimed || saving}
                    aria-label={DESK_PREFERENCE_LABELS[key]}
                    onChange={(e) =>
                      setDraft((d) => (d === null ? d : { ...d, [key]: e.target.checked }))
                    }
                  />
                </label>
              ))}
            </div>

            <p style={{ margin: 0, fontSize: 'var(--ax-text-2xs)', color: 'var(--ax-text-muted)' }}>
              {loaded.updated_at ? deskPreferencesUpdatedAt(loaded.updated_at) : DESK_PREFERENCES_NEVER_SET}
            </p>

            {!claimed && (
              <button
                type="button"
                className="ax-btn ax-btn--secondary"
                disabled={!dirty || saving}
                onClick={() => void submit()}
              >
                <span className="ax-btn__label">
                  {saving ? 'Enregistrement…' : 'Enregistrer ces choix'}
                </span>
              </button>
            )}
          </>
        ) : null}
      </div>
    </section>
  );
}

export default ContactPreferencesCard;
