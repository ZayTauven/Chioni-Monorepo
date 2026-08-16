'use client';
/*
 * Chioni — envoyer une recherche de disponibilité au réseau (S9, ADR 0022).
 *
 * **Le geste du sprint**, et le seul du produit qui parle à des tiers en
 * nombre. Il est monté à deux endroits — le comptoir (`Prescriptions.tsx`) et
 * la fin de consultation (`ConsultationDetail.tsx`, « le bon moment, la bonne
 * personne » selon l'arbitrage PO n° 3) — d'où un composant partagé plutôt que
 * deux copies qui divergeraient sur les phrases qui comptent.
 *
 * ─── Les quatre gardes de l'ADR, rendues à l'écran ────────────────────────
 *
 * 1. **Le prescripteur choisit ce qui sort.** Toutes les lignes sont cochées
 *    par défaut — c'est l'affordance, pas la règle : le serveur exige une
 *    liste EXPLICITE. Décocher est le geste que l'ADR protège, et il n'a de
 *    sens que si l'écran dit pourquoi : un antirétroviral, un traitement de
 *    tuberculose ou un abortif demandé à la pharmacie du village désigne
 *    quelqu'un. La phrase est donc à côté des cases, pas dans une aide repliée.
 *
 * 2. **La diffusion est ANNONCÉE.** On ne montre pas un compteur abstrait mais
 *    **la liste réelle des officines qui vont recevoir**, rafraîchie à chaque
 *    changement de zone. Un envoi à quinze pharmacies pour un médicament rare
 *    est le pire scénario du module : il doit se voir avant, pas se découvrir
 *    après.
 *
 * 3. **Ce que la pharmacie ne voit pas s'écrit.** Ni le nom du centre, ni le
 *    patient, ni la posologie. C'est l'argument qui fera utiliser la fonction —
 *    un prescripteur qui doute de la confidentialité ne coche rien.
 *
 * 4. **Le plafond refuse, il ne tronque pas.** Au-delà du maximum, le backend
 *    répond avec le compte RÉEL et une consigne (« précisez la commune »).
 *    L'écran affiche ce message tel quel : nos reformulations perdraient le
 *    chiffre, qui est précisément ce qui permet de décider.
 *
 * Asset Vireo repris : la `Modal` du socle centre (patron Contacts), avec
 * `busy` — l'envoi déclenche N SMS vers des tiers, une modale quittable en vol
 * laisserait « je ne sais pas si c'est parti », le pire état sur ce geste-là.
 */
import { useMemo, useState } from 'react';
import { useCenter } from '@/context/CenterContext';
import { ApiError } from '@/lib/api';
import {
  createAvailabilityRequest,
  listPharmacies,
  listPrescriptionAvailabilityRequests,
} from '@/lib/endpoints/pharmacy';
import {
  ACTION_CANCEL,
  AVAILABILITY_BROADCAST_HINT,
  AVAILABILITY_CITY_HINT,
  AVAILABILITY_CITY_LABEL,
  AVAILABILITY_DOSAGE_NOT_SENT,
  AVAILABILITY_DUPLICATE_ZONE_WARNING,
  AVAILABILITY_EXISTING_TITLE,
  AVAILABILITY_ISLAND_LABEL,
  AVAILABILITY_ITEMS_LEGEND,
  AVAILABILITY_NO_ITEM_HINT,
  AVAILABILITY_PRIVACY_NOTICE,
  AVAILABILITY_PRIVACY_TITLE,
  AVAILABILITY_PRIVACY_UNCHECK_HINT,
  AVAILABILITY_RECIPIENTS_EMPTY,
  AVAILABILITY_RECIPIENTS_LOADING,
  AVAILABILITY_RECIPIENTS_STALE,
  AVAILABILITY_SENDING,
  AVAILABILITY_SEND_SUBMIT,
  AVAILABILITY_SEND_TITLE,
  AVAILABILITY_ZONE_LEGEND,
  ISLAND_LABELS,
  availabilityExistingLine,
  availabilityRecipientsTitle,
  availabilityThrottled,
  availabilityZoneLabel,
} from '@/lib/labels';
import type { Island, Prescription } from '@/lib/types';
import { ErrorAlert, FieldError, Modal, toApiError, useAsync, useDebounced } from './shared';

const ISLANDS: Island[] = ['ngazidja', 'ndzuwani', 'mwali'];

export function AvailabilitySendModal({
  prescription,
  onClose,
  onSent,
}: {
  prescription: Prescription;
  onClose: () => void;
  /** Reçoit le nombre RÉEL d'officines destinataires, pour le message de succès. */
  onSent: (recipientCount: number) => void;
}) {
  const { centerId, center } = useCenter();

  /* Défauts honnêtes : la zone du CENTRE, qui est la sienne et non une
     supposition sur le patient. La commune est modifiable et peut être vidée
     — « toute l'île » reste possible, sous le plafond de destinataires. */
  const [island, setIsland] = useState<Island>(center.island);
  const [city, setCity] = useState(center.city ?? '');

  /* Toutes les lignes cochées par défaut : c'est l'affordance. Le serveur, lui,
     n'a aucun défaut — il exige la liste explicite. */
  const [checked, setChecked] = useState<Record<number, boolean>>(() =>
    Object.fromEntries(prescription.items.map((item) => [item.id, true])),
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const debouncedCity = useDebounced(city.trim());

  /* L'ANNONCE de diffusion : la liste réelle, pas un compteur. Elle se
     rafraîchit à chaque changement de zone, en un appel léger (tableau nu). */
  const recipients = useAsync(
    () => listPharmacies(centerId, { island, ...(debouncedCity ? { city: debouncedCity } : {}) }),
    [centerId, island, debouncedCity],
  );

  const selectedIds = useMemo(
    () => prescription.items.filter((item) => checked[item.id]).map((item) => item.id),
    [prescription.items, checked],
  );

  const recipientCount = recipients.data?.length ?? 0;

  /*
   * ── Ce qui a DÉJÀ été envoyé pour cette ordonnance (guardian S9) ──
   *
   * `GET .../prescriptions/{p}/availability-requests/` existait depuis le
   * premier jour du sprint et **aucun écran ne l'appelait** — la dérive de
   * contrat que la revue S5 nous a apprise à chercher. Conséquence concrète :
   * le backend refuse un second envoi sur la même ordonnance dans la même
   * zone (« le double-clic ne diffuse pas deux fois », addendum n° 6), mais
   * le prescripteur ne l'apprenait qu'APRÈS avoir décoché ses lignes, lu
   * l'annonce de diffusion et cliqué. Il l'apprend maintenant avant.
   *
   * Purement informatif : la garde reste au serveur. Un blocage client sur la
   * comparaison d'une commune se tromperait un jour, et se tromper ici veut
   * dire empêcher une recherche légitime pour quelqu'un qui attend ses
   * médicaments. On dit, on ne barre pas.
   */
  const existing = useAsync(
    () => listPrescriptionAvailabilityRequests(centerId, prescription.id),
    [centerId, prescription.id],
  );
  const openRequests = (existing.data ?? []).filter((req) => req.status === 'ouverte');
  const duplicateZone = openRequests.some(
    (req) =>
      req.island === island &&
      req.city.trim().toLowerCase() === debouncedCity.toLowerCase(),
  );

  /*
   * **L'annonce et l'envoi doivent parler de la MÊME zone.**
   *
   * La commune part au serveur sous sa forme débouncée (400 ms) : entre la
   * frappe et le débounce, la liste affichée est celle de la zone PRÉCÉDENTE,
   * sans rien qui le signale. Quelqu'un qui tape « Mitsamiouli » puis envoie
   * aussitôt diffusait donc à la zone d'avant — potentiellement toute l'île —
   * après avoir lu un décompte qui ne correspondait plus à ce qu'il voyait à
   * l'écran. L'ADR 0022 fait de l'annonce préalable une garde, pas un confort
   * (« la diffusion est bornée ET annoncée ») : tant qu'elle n'est pas à
   * jour, on ne laisse pas envoyer, et on le dit.
   */
  const zonePending = city.trim() !== debouncedCity;
  const announceReady = !zonePending && !recipients.loading && recipients.error === null;
  const canSend = selectedIds.length > 0 && !saving && announceReady;

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      await createAvailabilityRequest(centerId, prescription.id, {
        island,
        city: debouncedCity,
        item_ids: selectedIds,
      });
      onSent(recipientCount);
    } catch (err) {
      /* Le 429 du scope dédié `availability` sort en anglais de DRF : sur LE
         geste du sprint, on rend une phrase française et une attente. */
      const failure = toApiError(err);
      setError(
        failure.status === 429
          ? new ApiError(429, [availabilityThrottled(failure.retryAfterSeconds)])
          : failure,
      );
      setSaving(false);
    }
  };

  return (
    <Modal
      title={AVAILABILITY_SEND_TITLE}
      onClose={onClose}
      width={640}
      busy={saving}
      footer={
        <>
          <button
            type="button"
            className="ax-btn ax-btn--ghost"
            onClick={onClose}
            disabled={saving}
            data-autofocus=""
          >
            {ACTION_CANCEL}
          </button>
          {/*
            **Le bouton n'est PAS un `type="submit"`, et le formulaire ne
            soumet rien** (leçon S4/S5, appliquée au geste le plus exposé du
            produit). La commune est un champ texte d'une seule ligne : une
            touche Entrée dedans — le réflexe de tout le monde après avoir
            tapé un nom de ville — validait le formulaire et diffusait la
            liste de médicaments à N officines, avec N SMS, sans confirmation
            et sans que la liste des destinataires ait eu le temps de se
            rafraîchir. Un envoi au réseau ne se défait pas : il se clique.
          */}
          <button
            type="button"
            className="ax-btn ax-btn--primary"
            onClick={() => void submit()}
            disabled={!canSend}
          >
            {saving ? AVAILABILITY_SENDING : AVAILABILITY_SEND_SUBMIT}
          </button>
        </>
      }
    >
      <form
        id="availability-send-form"
        onSubmit={(e) => e.preventDefault()}
        style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}
      >
        {error && error.messages.length > 0 && <ErrorAlert error={error} />}

        {/* ── ce que la pharmacie va recevoir, et ce qu'elle ne verra pas ── */}
        <div className="ax-alert ax-alert--info" role="note">
          <div className="ax-alert__content">
            <p className="ax-alert__title">{AVAILABILITY_PRIVACY_TITLE}</p>
            <p className="ax-alert__message" style={{ lineHeight: 1.7 }}>
              {AVAILABILITY_PRIVACY_NOTICE}
            </p>
          </div>
        </div>

        {/* ── les lignes : cochées par défaut, décochables une à une ── */}
        <fieldset style={{ border: 0, margin: 0, padding: 0 }}>
          <legend
            style={{
              padding: 0,
              marginBlockEnd: 'var(--ax-space-2)',
              fontWeight: 'var(--ax-weight-semibold)',
              color: 'var(--ax-text-strong)',
            }}
          >
            {AVAILABILITY_ITEMS_LEGEND}
          </legend>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {prescription.items.map((item) => (
              <li key={item.id} style={{ paddingBlock: 'var(--ax-space-2)' }}>
                <label
                  className="ax-check"
                  style={{ display: 'flex', gap: 'var(--ax-space-3)', alignItems: 'flex-start' }}
                >
                  <input
                    type="checkbox"
                    className="ax-checkbox"
                    checked={checked[item.id] ?? false}
                    onChange={(e) =>
                      setChecked((cur) => ({ ...cur, [item.id]: e.target.checked }))
                    }
                  />
                  <span style={{ minWidth: 0 }}>
                    <span
                      style={{
                        display: 'block',
                        color: 'var(--ax-text-strong)',
                        fontSize: 'var(--ax-text-sm)',
                      }}
                    >
                      {item.medication}
                    </span>
                    {/* La posologie est affichée ICI, au centre, pour aider à
                        décider — et elle ne SORT PAS : le backend ne recopie
                        que `medication`. Le dire évite la crainte inverse. */}
                    {item.dosage && (
                      <span
                        style={{
                          display: 'block',
                          fontSize: 'var(--ax-text-xs)',
                          color: 'var(--ax-text-muted)',
                        }}
                      >
                        {item.dosage} — {AVAILABILITY_DOSAGE_NOT_SENT}
                      </span>
                    )}
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <p
            style={{
              margin: 'var(--ax-space-2) 0 0',
              fontSize: 'var(--ax-text-xs)',
              color: 'var(--ax-text-muted)',
              lineHeight: 1.7,
            }}
          >
            {AVAILABILITY_PRIVACY_UNCHECK_HINT}
          </p>
          {/* Tout décocher grise le bouton d'envoi : dire pourquoi, sinon la
              seule chose que l'écran répond à un geste légitime est un bouton
              éteint — et un bouton grisé n'est pas focalisable, donc sa raison
              n'existe pas non plus pour un lecteur d'écran. */}
          {selectedIds.length === 0 && (
            <p
              className="ax-field__message ax-field__message--error"
              role="status"
              style={{ marginBlockStart: 'var(--ax-space-2)' }}
            >
              {AVAILABILITY_NO_ITEM_HINT}
            </p>
          )}
          <FieldError error={error} field="item_ids" />
        </fieldset>

        {/* ── la zone ── */}
        <fieldset style={{ border: 0, margin: 0, padding: 0 }}>
          <legend
            style={{
              padding: 0,
              marginBlockEnd: 'var(--ax-space-2)',
              fontWeight: 'var(--ax-weight-semibold)',
              color: 'var(--ax-text-strong)',
            }}
          >
            {AVAILABILITY_ZONE_LEGEND}
          </legend>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: 'var(--ax-space-4)',
            }}
          >
            <div className="ax-field">
              <label className="ax-label" htmlFor="av-island">
                {AVAILABILITY_ISLAND_LABEL}
              </label>
              <select
                id="av-island"
                className="ax-select"
                value={island}
                onChange={(e) => setIsland(e.target.value as Island)}
              >
                {ISLANDS.map((i) => (
                  <option key={i} value={i}>
                    {ISLAND_LABELS[i]}
                  </option>
                ))}
              </select>
              <FieldError error={error} field="island" />
            </div>

            <div className="ax-field">
              <label className="ax-label" htmlFor="av-city">
                {AVAILABILITY_CITY_LABEL}
              </label>
              <input
                id="av-city"
                type="text"
                className="ax-input"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                maxLength={128}
                autoComplete="off"
              />
              <span className="ax-field__message">{AVAILABILITY_CITY_HINT}</span>
              <FieldError error={error} field="city" />
            </div>
          </div>
        </fieldset>

        {/* ── ce qui a déjà été envoyé pour CETTE ordonnance ── */}
        {openRequests.length > 0 && (
          <div
            className={`ax-alert ax-alert--${duplicateZone ? 'warning' : 'info'}`}
            role="status"
          >
            <div className="ax-alert__content">
              <p className="ax-alert__title">{AVAILABILITY_EXISTING_TITLE}</p>
              <ul
                style={{
                  margin: 0,
                  paddingInlineStart: 'var(--ax-space-5)',
                  fontSize: 'var(--ax-text-sm)',
                  lineHeight: 1.7,
                }}
              >
                {openRequests.map((req) => (
                  <li key={req.id}>
                    {availabilityExistingLine(
                      availabilityZoneLabel(req.island, req.city),
                      req.created_at,
                      req.response_count,
                    )}
                  </li>
                ))}
              </ul>
              {duplicateZone && (
                <p className="ax-alert__message" style={{ lineHeight: 1.7 }}>
                  {AVAILABILITY_DUPLICATE_ZONE_WARNING}
                </p>
              )}
            </div>
          </div>
        )}

        {/* ── l'annonce : QUI va recevoir, nommément ── */}
        <div
          style={{
            border: '1px solid var(--ax-border)',
            borderRadius: 'var(--ax-radius-md)',
            padding: 'var(--ax-space-4)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--ax-space-2)',
          }}
        >
          {zonePending || recipients.loading ? (
            /* La liste affichée n'est plus celle de la commune saisie : on ne
               laisse pas lire un décompte périmé au moment de décider. */
            <p
              style={{ margin: 0, fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}
              role="status"
            >
              {zonePending ? AVAILABILITY_RECIPIENTS_STALE : AVAILABILITY_RECIPIENTS_LOADING}
            </p>
          ) : recipients.error ? (
            <ErrorAlert error={recipients.error} onRetry={recipients.reload} />
          ) : (
            <>
              <p
                style={{
                  margin: 0,
                  fontWeight: 'var(--ax-weight-semibold)',
                  color: 'var(--ax-text-strong)',
                  fontSize: 'var(--ax-text-sm)',
                }}
                role="status"
              >
                {availabilityRecipientsTitle(recipientCount)}
              </p>
              {recipientCount === 0 ? (
                <p style={{ margin: 0, fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)', lineHeight: 1.7 }}>
                  {AVAILABILITY_RECIPIENTS_EMPTY}
                </p>
              ) : (
                <ul
                  style={{
                    margin: 0,
                    paddingInlineStart: 'var(--ax-space-5)',
                    fontSize: 'var(--ax-text-sm)',
                    color: 'var(--ax-text)',
                  }}
                >
                  {recipients.data?.map((pharmacy) => (
                    <li key={pharmacy.id}>
                      {pharmacy.name}
                      <span style={{ color: 'var(--ax-text-muted)' }}>
                        {pharmacy.city ? ` · ${pharmacy.city}` : ''}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <p style={{ margin: 0, fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-muted)', lineHeight: 1.7 }}>
                {AVAILABILITY_BROADCAST_HINT}
              </p>
            </>
          )}
        </div>
      </form>
    </Modal>
  );
}

export default AvailabilitySendModal;
