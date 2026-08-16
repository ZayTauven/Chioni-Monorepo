'use client';
/*
 * Chioni — « Mes messages » (espace patient, S10 / ADR 0023 décision 1).
 *
 * Base Vireo : les lignes « intitulé + description + `ax-switch` » du panneau
 * Notifications de `pages/ProfileSettings`, en version `--lg` (44 px de piste,
 * rangée de 56 px de haut : la cible tactile est la LIGNE entière, pas
 * l'interrupteur) et débarrassées des trois colonnes de canaux — Chioni n'a
 * qu'un canal, le SMS.
 *
 * ── LA PHRASE QUI NE PEUT PAS MANQUER ────────────────────────────────────
 *
 * `CONTACT_PREFERENCES_SAFETY_NOTICE` dit que ces réglages ne coupent QUE les
 * rappels. Sans elle, « je coupe les SMS » se lit « Chioni ne m'écrira plus »,
 * ce qui est faux **et dangereux** : c'est par ce canal que passent le code de
 * connexion et « un proche demande à pouvoir payer vos soins » — la porte de
 * confirmation du titulaire, invariant éthique du produit. Quelqu'un qui
 * croirait s'être coupé de tout n'ouvrirait plus ses messages.
 *
 * ── LE GESTE ─────────────────────────────────────────────────────────────
 *
 * Un interrupteur = une action, enregistrée tout de suite (PATCH partiel) :
 * pas de bouton « Enregistrer » à trouver en bas d'écran. Pendant l'appel les
 * deux interrupteurs sont figés — deux écritures parties ensemble pourraient
 * s'appliquer dans le désordre (défaut relevé en S7). En cas d'échec la valeur
 * revient à ce que le serveur dit, et l'erreur est écrite : un réglage qui
 * échoue en silence est pire que pas de réglage du tout.
 *
 * **L'interrupteur bouge AU DOIGT, pas au retour du serveur** (`pending`).
 * Un `checked` branché sur la seule valeur serveur remet le bouton à sa
 * position d'avant le temps de l'aller-retour : sur une connexion lente, le
 * geste semble n'avoir aucun effet, on retape, et on conclut que l'écran est
 * cassé. Ici la position suit l'intention tout de suite, « Enregistrement… »
 * dit que ce n'est pas encore acquis, et un échec ramène la position à la
 * vérité du serveur avec sa raison écrite.
 */
import { useCallback, useEffect, useState } from 'react';
import { getMyContactPreferences, updateMyContactPreferences } from '@/lib/endpoints/patients';
import {
  CONTACT_PREFERENCES_SAFETY_NOTICE,
  CONTACT_PREFERENCES_SAVED,
  CONTACT_PREFERENCES_SAVING,
  CONTACT_PREFERENCES_SUBTITLE,
  CONTACT_PREFERENCES_TITLE,
  CONTACT_PREFERENCE_HINTS,
  CONTACT_PREFERENCE_KEYS,
  CONTACT_PREFERENCE_LABELS,
  type ContactPreferenceKey,
} from '@/lib/labels';
import type { PatientContactPreferences } from '@/lib/types';
import { ErrorAlert, SuccessAlert } from './ui';

/** L'intention en vol : la position que l'interrupteur doit montrer TOUT DE SUITE. */
interface Pending {
  key: ContactPreferenceKey;
  value: boolean;
}

export function ContactPreferencesCard() {
  const [prefs, setPrefs] = useState<PatientContactPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [saveError, setSaveError] = useState<unknown>(null);
  const [saved, setSaved] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    getMyContactPreferences()
      .then((data) => {
        setPrefs(data);
        setLoading(false);
      })
      .catch((err: unknown) => {
        setLoadError(err);
        setLoading(false);
      });
  }, []);

  useEffect(load, [load]);

  const toggle = async (key: ContactPreferenceKey, next: boolean) => {
    if (pending !== null) return;
    /* La position suit le doigt immédiatement — le serveur confirmera. */
    setPending({ key, value: next });
    setSaveError(null);
    setSaved(false);
    try {
      const updated = await updateMyContactPreferences({ [key]: next });
      setPrefs(updated);
      setSaved(true);
    } catch (err) {
      /* Échec : la position revient à ce que le serveur dit (`pending`
         retombe à null juste après), et la raison est écrite au-dessus des
         interrupteurs. Un réglage qui échoue en silence est pire que pas de
         réglage du tout. */
      setSaveError(err);
    } finally {
      setPending(null);
    }
  };

  return (
    <section className="ax-card" role="region" aria-label={CONTACT_PREFERENCES_TITLE}>
      <div className="ax-card__body pat-gate__body">
        <h3 className="pat-row__title" style={{ margin: 0 }}>
          {CONTACT_PREFERENCES_TITLE}
        </h3>
        <p className="pat-row__meta" style={{ margin: 0 }}>
          {CONTACT_PREFERENCES_SUBTITLE}
        </p>

        {loading ? (
          <div className="pat-skeleton-body" aria-hidden="true">
            <div className="ax-skeleton ax-skeleton--line" style={{ width: '70%' }} />
            <div className="ax-skeleton ax-skeleton--line" style={{ width: '55%' }} />
          </div>
        ) : loadError != null ? (
          <ErrorAlert error={loadError} onRetry={load} />
        ) : prefs === null ? null : (
          <>
            {/* La phrase obligatoire, AVANT les interrupteurs : on décide en
                sachant ce qu'on ne coupe pas. Reléguée sous les boutons, elle
                serait lue après le geste — c'est-à-dire trop tard pour celui
                qui pose son doigt puis referme l'écran. */}
            <div className="ax-alert ax-alert--info" role="note">
              <div className="ax-alert__content">
                <p className="ax-alert__message" style={{ margin: 0, lineHeight: 1.7 }}>
                  {CONTACT_PREFERENCES_SAFETY_NOTICE}
                </p>
              </div>
            </div>

            {saved && <SuccessAlert message={CONTACT_PREFERENCES_SAVED} />}
            {saveError != null && <ErrorAlert error={saveError} />}

            <div style={{ display: 'flex', flexDirection: 'column' }} aria-busy={pending !== null}>
              {CONTACT_PREFERENCE_KEYS.map((key) => (
                <label
                  key={key}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 'var(--ax-space-4)',
                    minHeight: 56,
                    paddingBlock: 'var(--ax-space-2)',
                    cursor: 'pointer',
                  }}
                >
                  <span style={{ display: 'block' }}>
                    <span
                      style={{
                        display: 'block',
                        fontSize: 'var(--ax-text-base)',
                        color: 'var(--ax-text-strong)',
                        lineHeight: 1.5,
                      }}
                    >
                      {CONTACT_PREFERENCE_LABELS[key]}
                    </span>
                    <span
                      style={{
                        display: 'block',
                        fontSize: 'var(--ax-text-sm)',
                        color: 'var(--ax-text-muted)',
                        lineHeight: 1.5,
                      }}
                    >
                      {CONTACT_PREFERENCE_HINTS[key]}
                    </span>
                  </span>
                  <input
                    type="checkbox"
                    className="ax-switch ax-switch--lg"
                    checked={pending?.key === key ? pending.value : prefs[key]}
                    disabled={pending !== null}
                    aria-label={CONTACT_PREFERENCE_LABELS[key]}
                    onChange={(e) => void toggle(key, e.target.checked)}
                  />
                </label>
              ))}
            </div>

            {/* Dit que ce n'est pas encore acquis. Sans cette ligne, une
                connexion lente laisse deux interrupteurs figés sans un mot. */}
            <p
              role="status"
              style={{
                margin: 0,
                minHeight: '1.5em',
                fontSize: 'var(--ax-text-sm)',
                color: 'var(--ax-text-muted)',
              }}
            >
              {pending !== null ? CONTACT_PREFERENCES_SAVING : ''}
            </p>
          </>
        )}
      </div>
    </section>
  );
}

export default ContactPreferencesCard;
