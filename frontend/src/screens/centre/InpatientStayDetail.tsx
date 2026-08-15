'use client';
/*
 * Chioni — /centre/hospitalisation/[id] : le détail d'un séjour (S6, ADR 0019).
 *
 * Trois audiences sur un même écran, et l'API en gouverne deux :
 * - **tout staff** lit le séjour (le payload administratif ne PORTE PAS
 *   `reason`/`diagnosis`/`cancel_reason` : la carte clinique n'est même pas
 *   montée, fetch compris — patron de la fiche patient S3) ;
 * - **rôles cliniques** : lit, transfert, médecins assignés, sortie,
 *   annulation, historique des lits, surveillance ;
 * - **rôles BILLING** : la facturation des journées.
 *
 * Surveillance : AUCUN second formulaire de mesures. Les signes vitaux d'un
 * hospitalisé se saisissent sur la **consultation pivot**, et cet écran monte
 * `VitalSignsCard` telle quelle — bornes de plausibilité, unités et libellés
 * ont une définition unique (ADR 0019 décision 1).
 *
 * Assets Vireo : `ax-timeline` (pages/Timeline) pour l'historique des lits,
 * `ax-list`/`ax-card` du dashboard healthcare pour les médecins assignés.
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PageHead } from '@/components/shell/PageHead';
import { useCenter } from '@/context/CenterContext';
import type { ApiError } from '@/lib/api';
import {
  billStayDays,
  cancelStay,
  dischargeStay,
  getEncounter,
  getStay,
  listPractitioners,
  listStayBedAssignments,
  listTariffs,
  releaseStayBed,
  setStayAttending,
} from '@/lib/endpoints/centers';
import {
  ATTENDING_EMPTY,
  ATTENDING_HINT,
  ATTENDING_TITLE,
  BED_ASSIGN_TITLE,
  BED_RELEASE_HINT,
  BED_RELEASE_TITLE,
  BED_TRANSFER_TITLE,
  BILL_DAYS_ALL_BILLED,
  BILL_DAYS_CANCELLED_STAY,
  BILL_DAYS_CAP_LABEL,
  BILL_DAYS_CAP_RULE,
  BILL_DAYS_CLOCK_NOTICE,
  BILL_DAYS_DURATION_LABEL,
  BILL_DAYS_HOWTO,
  BILL_DAYS_NO_TARIFF,
  BILL_DAYS_NO_TARIFF_TITLE,
  BILL_DAYS_PREFILL_HINT,
  BILL_DAYS_REPLAY_SAFE,
  BILL_DAYS_TITLE,
  STAFF_ROLE_LABELS,
  STAY_CANCEL_BLOCKED_BY_ACTS,
  STAY_CANCEL_FINAL,
  STAY_CANCEL_LEAD,
  STAY_CANCEL_REASON_LABEL,
  STAY_CANCEL_REASON_PRIVACY,
  STAY_CANCEL_TITLE,
  STAY_DISCHARGE_EFFECTS,
  STAY_DISCHARGE_FINAL,
  STAY_DISCHARGE_TITLE,
  STAY_NO_BED_HINT,
  STAY_STATUS_LABELS,
  STAY_SURVEILLANCE_HINT,
  STAY_SURVEILLANCE_TITLE,
  billDaysOverCapMessage,
  billDaysRemainingLabel,
  billedDaysLabel,
  dayCountLabel,
  formatDate,
  formatDateTime,
  formatKmf,
  stayDurationDays,
  stayDurationLabel,
} from '@/lib/labels';
import type { EncounterStatus, Stay, TariffItem } from '@/lib/types';
import { AssignBedModal, BedLabel, StayPriorityBadge, StayStatusBadge } from './InpatientShared';
import { VitalSignsCard } from './VitalSignsCard';
import {
  BILLING_ROLES,
  CLINICAL_ROLES,
  CardSkeleton,
  DetailItem,
  EmptyState,
  ErrorAlert,
  FieldError,
  IconArrowLeft,
  IconBed,
  IconCheck,
  IconClose,
  IconEdit,
  IconExchange,
  IconLogout,
  IconReceipt,
  Modal,
  hasRole,
  newIdempotencyKey,
  toApiError,
  useAsync,
} from './shared';

/* ── tarifs « hospitalisation » (la grille du centre, filtrée) ── */

async function fetchHospitalisationTariffs(centerId: number): Promise<TariffItem[]> {
  const all: TariffItem[] = [];
  let page = 1;
  // Même garde-fou que la création de consultation : 15 pages (300 actes).
  while (page <= 15) {
    const chunk = await listTariffs(centerId, page);
    all.push(...chunk.results);
    if (!chunk.next) break;
    page += 1;
  }
  return all.filter((t) => t.is_active && t.generic_category === 'hospitalisation');
}

/* ── sortie ── */

function DischargeModal({
  stay,
  onClose,
  onDone,
}: {
  stay: Stay;
  onClose: () => void;
  onDone: (fresh: Stay) => void;
}) {
  const { centerId } = useCenter();
  const [dischargedAt, setDischargedAt] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      onDone(
        await dischargeStay(
          centerId,
          stay.id,
          dischargedAt ? new Date(dischargedAt).toISOString() : undefined,
        ),
      );
    } catch (err) {
      setError(toApiError(err));
      setSaving(false);
    }
  };

  return (
    <Modal
      title={STAY_DISCHARGE_TITLE}
      onClose={onClose}
      busy={saving}
      width={540}
      footer={
        <>
          <button
            type="button"
            className="ax-btn ax-btn--ghost"
            onClick={onClose}
            disabled={saving}
            data-autofocus=""
          >
            Pas encore
          </button>
          <button
            type="button"
            className="ax-btn ax-btn--primary"
            onClick={() => void submit()}
            disabled={saving}
          >
            <IconCheck />
            <span className="ax-btn__label">{saving ? 'Enregistrement…' : 'Enregistrer la sortie'}</span>
          </button>
        </>
      }
    >
      {error && error.messages.length > 0 && <ErrorAlert error={error} />}
      <p style={{ margin: 0, fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)', lineHeight: 1.6 }}>
        <b>{stay.patient_name}</b> — admis le {formatDateTime(stay.admitted_at)}.
      </p>
      <ul style={{ margin: 0, paddingInlineStart: '1.1rem', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {STAY_DISCHARGE_EFFECTS.map((line) => (
          <li key={line} style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)', lineHeight: 1.6 }}>
            {line}
          </li>
        ))}
      </ul>
      <div className="ax-field" style={{ maxWidth: 280, marginBottom: 0 }}>
        <label className="ax-label" htmlFor="disch-at">
          Date et heure de sortie
        </label>
        <input
          id="disch-at"
          type="datetime-local"
          className="ax-input"
          value={dischargedAt}
          onChange={(e) => setDischargedAt(e.target.value)}
        />
        <span className="ax-field__message">Laissez vide pour « maintenant ».</span>
        <FieldError error={error} field="discharged_at" />
      </div>
      <p style={{ margin: 0, fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-muted)' }}>
        {STAY_DISCHARGE_FINAL}
      </p>
    </Modal>
  );
}

/* ── annulation d'une admission saisie par erreur ── */

function CancelStayModal({
  stay,
  onClose,
  onDone,
}: {
  stay: Stay;
  onClose: () => void;
  onDone: (fresh: Stay) => void;
}) {
  const { centerId } = useCenter();
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  // `billed_days > 0` ⇒ refus CERTAIN côté service : on le dit avant le clic.
  // L'inverse n'est pas une promesse (le backend refuse dès qu'UN acte, quel
  // qu'il soit, pend au pivot) — dans ce cas son 400 s'affiche tel quel.
  const blocked = stay.billed_days > 0;

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      onDone(await cancelStay(centerId, stay.id, reason.trim()));
    } catch (err) {
      setError(toApiError(err));
      setSaving(false);
    }
  };

  return (
    <Modal
      title={STAY_CANCEL_TITLE}
      onClose={onClose}
      busy={saving}
      width={540}
      footer={
        <>
          <button
            type="button"
            className="ax-btn ax-btn--ghost"
            onClick={onClose}
            disabled={saving}
            data-autofocus=""
          >
            Ne rien faire
          </button>
          <button
            type="submit"
            form="stay-cancel-form"
            className="ax-btn ax-btn--danger"
            disabled={saving || blocked || reason.trim() === ''}
          >
            {saving ? 'Annulation…' : "Annuler l'admission"}
          </button>
        </>
      }
    >
      <form
        id="stay-cancel-form"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}
      >
        {error && error.messages.length > 0 && <ErrorAlert error={error} />}
        {blocked && (
          <div className="ax-alert ax-alert--warning" role="status">
            <div className="ax-alert__content">
              <p className="ax-alert__message">{STAY_CANCEL_BLOCKED_BY_ACTS}</p>
            </div>
          </div>
        )}
        <p style={{ margin: 0, fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)', lineHeight: 1.6 }}>
          {STAY_CANCEL_LEAD}
        </p>
        <div className="ax-field" style={{ marginBottom: 0 }}>
          <label className="ax-label" htmlFor="stay-cancel-reason">
            {STAY_CANCEL_REASON_LABEL} <span className="ax-field__required" aria-hidden="true">*</span>
          </label>
          <textarea
            id="stay-cancel-reason"
            className={`ax-textarea${error?.fieldErrors.reason ? ' is-invalid' : ''}`}
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={blocked}
            required
          />
          <span className="ax-field__message">{STAY_CANCEL_REASON_PRIVACY}</span>
          <FieldError error={error} field="reason" />
        </div>
        <p style={{ margin: 0, fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-muted)' }}>
          {STAY_CANCEL_FINAL}
        </p>
      </form>
    </Modal>
  );
}

/* ── libération du lit sans transfert ── */

function ReleaseBedModal({
  stay,
  onClose,
  onDone,
}: {
  stay: Stay;
  onClose: () => void;
  onDone: (fresh: Stay) => void;
}) {
  const { centerId } = useCenter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      onDone(await releaseStayBed(centerId, stay.id));
    } catch (err) {
      setError(toApiError(err));
      setSaving(false);
    }
  };

  return (
    <Modal
      title={BED_RELEASE_TITLE}
      onClose={onClose}
      busy={saving}
      width={480}
      footer={
        <>
          <button
            type="button"
            className="ax-btn ax-btn--ghost"
            onClick={onClose}
            disabled={saving}
            data-autofocus=""
          >
            Annuler
          </button>
          <button
            type="button"
            className="ax-btn ax-btn--primary"
            onClick={() => void submit()}
            disabled={saving}
          >
            <span className="ax-btn__label">{saving ? 'Libération…' : 'Libérer le lit'}</span>
          </button>
        </>
      }
    >
      {error && error.messages.length > 0 && <ErrorAlert error={error} />}
      <p style={{ margin: 0, fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)', lineHeight: 1.6 }}>
        {BED_RELEASE_HINT}
      </p>
    </Modal>
  );
}

/* ── médecins qui suivent le séjour ── */

function AttendingModal({
  stay,
  onClose,
  onDone,
}: {
  stay: Stay;
  onClose: () => void;
  onDone: (fresh: Stay) => void;
}) {
  const { centerId } = useCenter();
  const [selected, setSelected] = useState<number[]>(stay.attending.map((a) => a.id));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const practitioners = useAsync(() => listPractitioners(centerId), [centerId]);

  const toggle = (id: number) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      onDone(await setStayAttending(centerId, stay.id, selected));
    } catch (err) {
      setError(toApiError(err));
      setSaving(false);
    }
  };

  return (
    <Modal
      title={ATTENDING_TITLE}
      onClose={onClose}
      busy={saving}
      width={520}
      footer={
        <>
          <button
            type="button"
            className="ax-btn ax-btn--ghost"
            onClick={onClose}
            disabled={saving}
            data-autofocus=""
          >
            Annuler
          </button>
          <button
            type="button"
            className="ax-btn ax-btn--primary"
            onClick={() => void submit()}
            disabled={saving}
          >
            <span className="ax-btn__label">{saving ? 'Enregistrement…' : 'Enregistrer'}</span>
          </button>
        </>
      }
    >
      {error && error.messages.length > 0 && <ErrorAlert error={error} />}
      <p style={{ margin: 0, fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-muted)', lineHeight: 1.6 }}>
        {ATTENDING_HINT}
      </p>
      {practitioners.loading ? (
        <CardSkeleton lines={3} />
      ) : practitioners.error ? (
        <ErrorAlert error={practitioners.error} onRetry={practitioners.reload} />
      ) : (practitioners.data?.length ?? 0) === 0 ? (
        <p style={{ margin: 0, fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>
          Aucun soignant actif dans l&apos;annuaire du centre.
        </p>
      ) : (
        <div
          style={{
            maxHeight: 260,
            overflowY: 'auto',
            border: '1px solid var(--ax-border)',
            borderRadius: 'var(--ax-radius-md)',
            padding: 'var(--ax-space-2)',
          }}
        >
          {(practitioners.data ?? []).map((p) => (
            <label
              key={p.id}
              className="ax-cluster"
              style={{
                gap: 'var(--ax-space-3)',
                flexWrap: 'nowrap',
                padding: 'var(--ax-space-2)',
                cursor: 'pointer',
                borderRadius: 'var(--ax-radius-sm)',
              }}
            >
              <input
                type="checkbox"
                className="ax-checkbox"
                checked={selected.includes(p.id)}
                onChange={() => toggle(p.id)}
              />
              <span style={{ flex: '1 1 auto', minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-strong)' }}>
                  {p.display_name}
                </span>
                <span style={{ display: 'block', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-muted)' }}>
                  {STAFF_ROLE_LABELS[p.role]}
                </span>
              </span>
            </label>
          ))}
        </div>
      )}
      <FieldError error={error} field="attending" />
    </Modal>
  );
}

/* ── facturation des journées (rôles BILLING) ── */

/**
 * Facturer des journées, après le correctif PO du 15/08/2026.
 *
 * Les deux constats de la revue guardian S6 sont désormais tenus PAR LE
 * BACKEND, et l'écran en tire les conséquences plutôt que d'en garder les
 * avertissements périmés :
 *
 * 1. **`idempotency_key` obligatoire.** Une clé UUID par TENTATIVE, générée à
 *    l'ouverture du formulaire, CONSERVÉE en cas d'échec (rejouer après un
 *    timeout renvoie le même état, jamais 2 × N actes) et régénérée après un
 *    succès — exactement le contrat de l'encaissement guichet. `busy` reste
 *    posé sur la modale : la clé protège la donnée, elle ne dispense pas de
 *    dire à la personne que son geste est en vol.
 * 2. **Plafond de journées côté serveur.** Le champ est pré-rempli avec ce
 *    qu'il RESTE facturable (plafond − déjà facturé) et la durée réelle est
 *    affichée à côté : l'écart entre ce qu'on tape et ce que le séjour a duré
 *    reste visible, et un dépassement est refusé avec son décompte — message
 *    rendu tel quel.
 */
function BillDaysModal({
  stay,
  onClose,
  onDone,
}: {
  stay: Stay;
  onClose: () => void;
  onDone: (fresh: Stay, days: number) => void;
}) {
  const { centerId } = useCenter();
  /* Plafond client = même règle que le backend (journées civiles entamées).
     Le fuseau du navigateur peut différer de l'heure des Comores d'une journée
     aux bornes : c'est une indication, le refus du serveur fait foi. */
  const cap = stayDurationDays(stay.admitted_at, stay.discharged_at);
  const remaining = Math.max(0, cap - stay.billed_days);
  const [tariffId, setTariffId] = useState<number | ''>('');
  const [days, setDays] = useState(remaining > 0 ? String(remaining) : '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState(() => newIdempotencyKey());
  const tariffs = useAsync(() => fetchHospitalisationTariffs(centerId), [centerId]);

  const options = tariffs.data ?? [];
  const tariff = options.find((t) => t.id === tariffId) ?? null;
  const parsedDays = Number.parseInt(days, 10);
  const validDays = Number.isFinite(parsedDays) && parsedDays >= 1 ? parsedDays : null;
  const total =
    tariff !== null && validDays !== null
      ? String(Number.parseFloat(tariff.price_kmf) * validDays)
      : null;
  const overCap = validDays !== null && validDays > remaining;

  const submit = async () => {
    if (tariffId === '' || validDays === null) return;
    setSaving(true);
    setError(null);
    try {
      const fresh = await billStayDays(centerId, stay.id, {
        tariff: tariffId,
        days: validDays,
        idempotency_key: idempotencyKey,
      });
      // Succès : la clé a servi, on en prépare une neuve pour la suite.
      setIdempotencyKey(newIdempotencyKey());
      onDone(fresh, validDays);
    } catch (err) {
      // Échec : la clé est CONSERVÉE — réessayer rejoue le même corps.
      setError(toApiError(err));
      setSaving(false);
    }
  };

  return (
    <Modal
      title={BILL_DAYS_TITLE}
      onClose={onClose}
      busy={saving}
      width={600}
      footer={
        <>
          <button
            type="button"
            className="ax-btn ax-btn--ghost"
            onClick={onClose}
            disabled={saving}
            data-autofocus=""
          >
            Annuler
          </button>
          <button
            type="submit"
            form="bill-days-form"
            className="ax-btn ax-btn--primary"
            /* Volontairement PAS gardé par `remaining === 0` : ce plafond est
               calculé par le navigateur et peut compter un jour de moins que
               l'heure des Comores. Le refuser ici rendrait la dernière journée
               d'un séjour infacturable depuis l'écran ; le serveur, lui, refuse
               avec le bon compte et sa phrase est affichée telle quelle. */
            disabled={saving || tariffId === '' || validDays === null}
          >
            {saving ? 'Enregistrement…' : 'Poser les journées'}
          </button>
        </>
      }
    >
      <form
        id="bill-days-form"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}
      >
        {/* Le refus du serveur (plafond dépassé, clé rejouée autrement) porte
            son décompte et ses dates : on le rend TEL QUEL, en tête. */}
        {error && error.messages.length > 0 && <ErrorAlert error={error} />}

        {remaining === 0 && (
          <div className="ax-alert ax-alert--info" role="status">
            <div className="ax-alert__content">
              <p className="ax-alert__message" style={{ lineHeight: 1.6 }}>
                {BILL_DAYS_ALL_BILLED}
              </p>
            </div>
          </div>
        )}

        {tariffs.loading ? (
          <CardSkeleton lines={3} />
        ) : tariffs.error ? (
          <ErrorAlert error={tariffs.error} onRetry={tariffs.reload} />
        ) : options.length === 0 ? (
          <div className="ax-alert ax-alert--info" role="status">
            <div className="ax-alert__content">
              <p className="ax-alert__title">{BILL_DAYS_NO_TARIFF_TITLE}</p>
              <p className="ax-alert__message" style={{ lineHeight: 1.6 }}>
                {BILL_DAYS_NO_TARIFF}
              </p>
              <div className="ax-alert__actions" style={{ marginTop: 'var(--ax-space-2)' }}>
                <Link href="/centre/tarifs" className="ax-btn ax-btn--secondary ax-btn--sm">
                  <span className="ax-btn__label">Ouvrir les tarifs</span>
                </Link>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="ax-field">
              <label className="ax-label" htmlFor="bill-tariff">
                Tarif de la journée <span className="ax-field__required" aria-hidden="true">*</span>
              </label>
              <select
                id="bill-tariff"
                className="ax-select"
                value={tariffId === '' ? '' : String(tariffId)}
                onChange={(e) =>
                  setTariffId(e.target.value === '' ? '' : Number.parseInt(e.target.value, 10))
                }
              >
                <option value="">Choisir un tarif…</option>
                {options.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label} — {formatKmf(t.price_kmf)}
                  </option>
                ))}
              </select>
              <FieldError error={error} field="tariff" />
            </div>

            {/* La durée réelle, À CÔTÉ du champ : l'écart entre ce qu'on tape
                et ce que le séjour a duré reste visible d'un coup d'œil. */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: 'var(--ax-space-4)',
                alignItems: 'start',
              }}
            >
              <div className="ax-field" style={{ marginBottom: 0 }}>
                <label className="ax-label" htmlFor="bill-days">
                  Journées à facturer <span className="ax-field__required" aria-hidden="true">*</span>
                </label>
                <input
                  id="bill-days"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={366}
                  className={`ax-input${error?.fieldErrors.days || overCap ? ' is-invalid' : ''}`}
                  value={days}
                  onChange={(e) => setDays(e.target.value)}
                  required
                />
                <span className="ax-field__message">{BILL_DAYS_PREFILL_HINT}</span>
                <FieldError error={error} field="days" />
              </div>
              {/*
                Le décompte se lit en TROIS lignes alignées, pas en une phrase
                à trois valeurs séparées par des points médians : un caissier
                pressé cherche un nombre, il ne lit pas une prose. L'ordre suit
                la question posée — combien le séjour ouvre, combien est déjà
                pris, combien il reste.
              */}
              <div
                style={{
                  border: '1px solid var(--ax-border)',
                  borderRadius: 'var(--ax-radius-md)',
                  padding: 'var(--ax-space-3)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--ax-space-2)',
                }}
              >
                <span
                  style={{
                    fontSize: 'var(--ax-text-2xs)',
                    color: 'var(--ax-text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '.04em',
                  }}
                >
                  {BILL_DAYS_DURATION_LABEL}
                </span>
                <b className="ax-num" style={{ color: 'var(--ax-text-strong)' }}>
                  {stayDurationLabel(stay.admitted_at, stay.discharged_at)}
                </b>
                <span style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-muted)' }}>
                  {stay.discharged_at
                    ? `Du ${formatDate(stay.admitted_at)} au ${formatDate(stay.discharged_at)}`
                    : `Depuis le ${formatDate(stay.admitted_at)}`}
                </span>
                <dl className="ax-billdays-recap">
                  <dt>{BILL_DAYS_CAP_LABEL}</dt>
                  <dd className="ax-num">{cap}</dd>
                  <dt>Déjà facturées</dt>
                  <dd className="ax-num">{stay.billed_days}</dd>
                  <dt>Reste à facturer</dt>
                  <dd className="ax-num ax-billdays-recap__strong">{remaining}</dd>
                </dl>
              </div>
            </div>

            <p style={{ margin: 0, fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-muted)', lineHeight: 1.6 }}>
              {BILL_DAYS_CAP_RULE} {BILL_DAYS_CLOCK_NOTICE}
            </p>

            {/* La garantie de rejeu vit À CÔTÉ du bouton, pas en haut du
                formulaire : c'est au moment d'appuyer — ou de réappuyer après
                un écran figé — qu'on a besoin de savoir qu'on ne double rien. */}
            <p style={{ margin: 0, fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-muted)', lineHeight: 1.6 }}>
              {BILL_DAYS_REPLAY_SAFE}
            </p>

            {overCap && (
              <div className="ax-alert ax-alert--warning" role="status">
                <div className="ax-alert__content">
                  <p className="ax-alert__message">
                    {billDaysOverCapMessage(cap, stay.billed_days, validDays ?? 0, remaining)}
                  </p>
                </div>
              </div>
            )}

            {/* Où ça atterrit, dit noir sur blanc. */}
            {validDays !== null && tariff !== null && (
              <div
                className="ax-alert ax-alert--info"
                role="status"
                style={{ marginBottom: 0 }}
              >
                <div className="ax-alert__content">
                  <p className="ax-alert__message" style={{ lineHeight: 1.6 }}>
                    <b>
                      {dayCountLabel(validDays)} à {formatKmf(tariff.price_kmf)}
                      {total !== null ? ` — soit ${formatKmf(total)}` : ''}
                    </b>
                    , posées comme {validDays > 1 ? `${validDays} actes` : '1 acte'} sur la
                    consultation n° {stay.encounter} du séjour.
                  </p>
                  <p className="ax-alert__message" style={{ lineHeight: 1.6 }}>
                    {BILL_DAYS_HOWTO}
                  </p>
                </div>
              </div>
            )}
          </>
        )}
      </form>
    </Modal>
  );
}

/* ── écran ── */

export function InpatientStayDetail({ stayId }: { stayId: number }) {
  const { centerId, roles } = useCenter();
  const router = useRouter();
  const clinical = hasRole(roles, CLINICAL_ROLES);
  const billing = hasRole(roles, BILLING_ROLES);

  const [bedOpen, setBedOpen] = useState(false);
  const [releaseOpen, setReleaseOpen] = useState(false);
  const [attendingOpen, setAttendingOpen] = useState(false);
  const [dischargeOpen, setDischargeOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [billOpen, setBillOpen] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [patched, setPatched] = useState<Stay | null>(null);

  const loaded = useAsync(() => getStay(centerId, stayId), [centerId, stayId]);

  /*
   * `patched` est le séjour RENVOYÉ par une écriture : il prime sur le fetch le
   * temps que l'écran se recharge, et il ne décrit QUE le couple (centre actif,
   * id de route) sous lequel il a été obtenu — il doit donc mourir avec lui.
   *
   * Le sélecteur de centre de l'en-tête NE QUITTE PAS la page : sans cette
   * remise à zéro, un membre de plusieurs centres qui écrit ici puis bascule de
   * centre gardait à l'écran le séjour du centre PRÉCÉDENT — nom du patient,
   * motif et diagnostic compris. Le message de succès (« Lit attribué :
   * Chambre 2 · Lit A ») nomme lui aussi un parc qui n'est plus celui qu'on
   * regarde : il tombe avec. Patron du constat S5 (`patched ?? state.data` non
   * lié à l'id de route).
   */
  useEffect(() => {
    setPatched(null);
    setFlash(null);
  }, [centerId, stayId]);

  const stay = patched ?? loaded.data;

  /* L'historique des lits : rôles CLINIQUES seuls (le guichet a déjà la seule
     réponse dont il a besoin — « où est le patient maintenant »). Jamais monté
     hors garde, fetch compris. */
  const history = useAsync(
    () => (clinical ? listStayBedAssignments(centerId, stayId) : Promise.resolve(null)),
    [centerId, stayId, clinical],
  );

  /* La consultation pivot : son statut RÉEL gouverne la carte de surveillance.
     Un clinicien a pu la clore depuis les routes consultation alors que le
     séjour est encore en cours — déduire le statut du séjour afficherait alors
     un bouton « Nouveau relevé » que l'API refuserait. En cas d'échec de
     lecture, on retombe sur la déduction (sortie/annulation ferment le pivot). */
  const encounterId = stay?.encounter ?? null;
  const pivot = useAsync(
    () =>
      clinical && encounterId !== null
        ? getEncounter(centerId, encounterId)
        : Promise.resolve(null),
    [centerId, clinical, encounterId],
  );

  const applyFresh = (fresh: Stay, message: string) => {
    setPatched(fresh);
    setFlash(message);
    history.reload();
  };

  /*
   * Le squelette pendant TOUT chargement, et pas seulement le premier :
   * `useAsync` conserve la donnée précédente le temps de l'aller-retour, si
   * bien que la garde `&& stay == null` laissait le séjour du centre quitté à
   * l'écran pendant toute la durée du nouvel appel — sur une connexion
   * comorienne, plusieurs secondes de clinique d'un autre tenant sous une
   * casquette qui n'y a pas droit. Le seul rechargement de `loaded` déclenché
   * par l'écran est le bouton « Réessayer » d'une erreur : personne ne perd de
   * contexte à ce moment-là.
   */
  if (loaded.loading) {
    return (
      <div className="ax-dash-grid">
        <section className="ax-card ax-col--12">
          <CardSkeleton lines={6} />
        </section>
      </div>
    );
  }

  if (loaded.error || stay == null) {
    return (
      <>
        <PageHead title="Séjour" />
        <div className="ax-dash-grid">
          <section className="ax-card ax-col--12">
            <div style={{ padding: 'var(--ax-space-4)' }}>
              {loaded.error ? (
                <ErrorAlert error={loaded.error} onRetry={loaded.reload} />
              ) : (
                <EmptyState title="Séjour introuvable" message="Ce séjour n’existe pas dans ce centre." />
              )}
            </div>
          </section>
        </div>
      </>
    );
  }

  const ongoing = stay.status === 'en_cours';
  const pivotStatus: EncounterStatus = pivot.data?.status ?? (ongoing ? 'en_cours' : 'terminee');

  return (
    <>
      <PageHead
        title={`Séjour — ${stay.patient_name}`}
        /* Pas de durée sur une admission annulée : elle n'a jamais eu lieu, et
           « 5 jours (en cours) » à côté du mot « Annulé » se contredisait. */
        subtitle={
          stay.status === 'annule'
            ? `${STAY_STATUS_LABELS[stay.status]} · admission enregistrée le ${formatDateTime(stay.admitted_at)}`
            : `${STAY_STATUS_LABELS[stay.status]} · admis le ${formatDateTime(stay.admitted_at)} · ${stayDurationLabel(stay.admitted_at, stay.discharged_at)}`
        }
        actions={
          <>
            <button
              type="button"
              className="ax-btn ax-btn--ghost"
              onClick={() => router.push('/centre/hospitalisation')}
            >
              <IconArrowLeft />
              <span className="ax-btn__label">Hospitalisation</span>
            </button>
            {clinical && ongoing && (
              <>
                <button type="button" className="ax-btn ax-btn--secondary" onClick={() => setBedOpen(true)}>
                  {stay.bed ? <IconExchange /> : <IconBed />}
                  <span className="ax-btn__label">{stay.bed ? BED_TRANSFER_TITLE : BED_ASSIGN_TITLE}</span>
                </button>
                <button type="button" className="ax-btn ax-btn--primary" onClick={() => setDischargeOpen(true)}>
                  <IconLogout />
                  <span className="ax-btn__label">Enregistrer la sortie</span>
                </button>
              </>
            )}
            {billing && stay.status !== 'annule' && (
              <button type="button" className="ax-btn ax-btn--secondary" onClick={() => setBillOpen(true)}>
                <IconReceipt />
                <span className="ax-btn__label">Facturer des journées</span>
              </button>
            )}
          </>
        }
      />

      {flash && (
        <div className="ax-alert ax-alert--success" role="status" style={{ marginBottom: 'var(--ax-space-5)' }}>
          <div className="ax-alert__content">
            <p className="ax-alert__message">{flash}</p>
          </div>
          <div className="ax-alert__actions">
            <button
              type="button"
              className="ax-btn ax-btn--ghost ax-btn--sm ax-btn--icon"
              onClick={() => setFlash(null)}
              aria-label="Fermer le message"
            >
              <IconClose />
            </button>
          </div>
        </div>
      )}

      <div className="ax-dash-grid">
        {/* 1 · Le séjour */}
        <section className="ax-card ax-col--7" role="region" aria-label="Le séjour">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <h2 className="ax-card__title">Le séjour</h2>
              <p className="ax-card__subtitle">Hébergement, dates et facturation</p>
            </div>
            <StayStatusBadge status={stay.status} />
          </div>
          <div className="ax-card__body">
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: 'var(--ax-space-4)',
              }}
            >
              <DetailItem label="Patient">
                <Link href={`/centre/patients/${stay.patient}`} className="ax-link">
                  {stay.patient_name}
                </Link>
              </DetailItem>
              <DetailItem label="Admission">{formatDateTime(stay.admitted_at)}</DetailItem>
              <DetailItem label="Sortie">
                {stay.discharged_at
                  ? formatDateTime(stay.discharged_at)
                  : stay.status === 'annule'
                    ? '—'
                    : 'Pas encore enregistrée'}
              </DetailItem>
              <DetailItem label="Durée">
                {stayDurationLabel(stay.admitted_at, stay.discharged_at, stay.status)}
              </DetailItem>
              <DetailItem label="Lit">
                <BedLabel bed={stay.bed} />
              </DetailItem>
              <DetailItem label="Priorité">
                <StayPriorityBadge priority={stay.priority} />
              </DetailItem>
              <DetailItem label="Journées facturées">{billedDaysLabel(stay.billed_days)}</DetailItem>
              <DetailItem label="Consultation du séjour">
                <Link href={`/centre/consultations/${stay.encounter}`} className="ax-link">
                  Ouvrir la consultation n° {stay.encounter}
                </Link>
              </DetailItem>
            </div>

            {ongoing && stay.bed === null && (
              <p
                style={{
                  marginTop: 'var(--ax-space-4)',
                  marginBottom: 0,
                  fontSize: 'var(--ax-text-sm)',
                  color: 'var(--ax-text-muted)',
                  lineHeight: 1.6,
                }}
              >
                {STAY_NO_BED_HINT}
              </p>
            )}

            {clinical && ongoing && (
              <div
                className="ax-cluster"
                style={{ gap: 'var(--ax-space-2)', marginTop: 'var(--ax-space-4)', flexWrap: 'wrap' }}
              >
                {stay.bed !== null && (
                  <button
                    type="button"
                    className="ax-btn ax-btn--ghost ax-btn--sm"
                    onClick={() => setReleaseOpen(true)}
                  >
                    <span className="ax-btn__label">Libérer le lit</span>
                  </button>
                )}
                <button
                  type="button"
                  className="ax-btn ax-btn--ghost ax-btn--sm"
                  onClick={() => setCancelOpen(true)}
                >
                  <span className="ax-btn__label">Annuler l&apos;admission (erreur de saisie)</span>
                </button>
              </div>
            )}
          </div>
        </section>

        {/* 2 · Clinique — deux verrous plutôt qu'un, comme le plan des lits.
            Le payload d'un rôle administratif ne PORTE PAS `reason` : la carte
            n'est pas montée, fetch compris. On exige EN PLUS la casquette
            clinique du centre ACTIF — c'est elle qui est juste à l'instant où
            les deux peuvent diverger (le sélecteur de centre change les rôles
            immédiatement, la donnée n'arrive qu'après l'aller-retour), et une
            régression de sérialiseur ne suffirait plus à afficher un motif. */}
        {clinical && stay.reason !== undefined && (
          <section className="ax-card ax-col--5" role="region" aria-label="Motif et diagnostic">
            <div className="ax-card__header">
              <div className="ax-card__titles">
                <h2 className="ax-card__title">Motif et diagnostic</h2>
                <p className="ax-card__subtitle">Portés par la consultation du séjour</p>
              </div>
            </div>
            <div
              className="ax-card__body"
              style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}
            >
              <DetailItem label="Motif d'admission">{stay.reason || '—'}</DetailItem>
              <DetailItem label="Diagnostic">{stay.diagnosis || 'Non renseigné'}</DetailItem>
              {stay.status === 'annule' && stay.cancel_reason && (
                <DetailItem label="Motif de l'annulation">{stay.cancel_reason}</DetailItem>
              )}
            </div>
          </section>
        )}

        {/* 3 · Médecins qui suivent */}
        <section className="ax-card ax-col--5" role="region" aria-label={ATTENDING_TITLE}>
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <h2 className="ax-card__title">{ATTENDING_TITLE}</h2>
            </div>
            {clinical && ongoing && (
              <button
                type="button"
                className="ax-btn ax-btn--ghost ax-btn--sm"
                onClick={() => setAttendingOpen(true)}
              >
                <IconEdit />
                <span className="ax-btn__label">Modifier</span>
              </button>
            )}
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            {stay.attending.length === 0 ? (
              <p style={{ margin: 0, fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>
                {ATTENDING_EMPTY}
              </p>
            ) : (
              <ul className="ax-list ax-list--compact">
                {stay.attending.map((doctor) => (
                  <li key={doctor.id} className="ax-list__row">
                    <span className="ax-list__content">
                      <span className="ax-list__title" style={{ fontWeight: 'var(--ax-weight-medium)' }}>
                        {doctor.name}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* 4 · Historique des lits (clinique) — timeline de Vireo. */}
        {clinical && (
          <section className="ax-card ax-col--7" role="region" aria-label="Historique des lits">
            <div className="ax-card__header">
              <div className="ax-card__titles">
                <h2 className="ax-card__title">Historique des lits</h2>
                <p className="ax-card__subtitle">Un transfert s’empile, il ne réécrit rien</p>
              </div>
            </div>
            <div className="ax-card__body" style={{ paddingTop: 0 }}>
              {history.loading ? (
                <CardSkeleton lines={3} />
              ) : history.error ? (
                <ErrorAlert error={history.error} onRetry={history.reload} />
              ) : (history.data?.length ?? 0) === 0 ? (
                <p style={{ margin: 0, fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>
                  Aucun lit n’a encore été attribué à ce séjour.
                </p>
              ) : (
                <ul className="ax-timeline">
                  {(history.data ?? []).map((row) => (
                    <li
                      key={row.id}
                      className={`ax-timeline__item${row.released_at === null ? ' is-current' : ''}`}
                    >
                      <span className="ax-timeline__marker" aria-hidden="true">
                        <IconBed className="" />
                      </span>
                      <div className="ax-timeline__content">
                        <span className="ax-timeline__time">
                          {formatDateTime(row.assigned_at)}
                          {row.released_at
                            ? ` → ${formatDateTime(row.released_at)}`
                            : ' → en cours'}
                        </span>
                        <span className="ax-timeline__title">
                          {row.room_name} · {row.bed_name}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        )}

        {/* 5 · Surveillance (clinique) — la carte des signes vitaux, telle quelle. */}
        {clinical && (
          <section className="ax-card ax-col--12" role="region" aria-label={STAY_SURVEILLANCE_TITLE}>
            <div className="ax-card__header">
              <div className="ax-card__titles">
                <h2 className="ax-card__title">{STAY_SURVEILLANCE_TITLE}</h2>
                <p className="ax-card__subtitle">{STAY_SURVEILLANCE_HINT}</p>
              </div>
              <Link href={`/centre/consultations/${stay.encounter}`} className="ax-btn ax-btn--ghost ax-btn--sm">
                <span className="ax-btn__label">Ouvrir la consultation du séjour</span>
              </Link>
            </div>
          </section>
        )}
        {clinical && <VitalSignsCard encounterId={stay.encounter} status={pivotStatus} />}

        {/* 6 · Facturation des journées (BILLING) */}
        {billing && (
          <section className="ax-card ax-col--12" role="region" aria-label="Facturation des journées">
            <div className="ax-card__header">
              <div className="ax-card__titles">
                <h2 className="ax-card__title">Journées d’hospitalisation</h2>
                {/* Un séjour ANNULÉ n'a jamais eu lieu : lui annoncer « reste
                    5 journées à facturer » juste au-dessus de « aucune journée
                    ne peut y être facturée » était une contradiction sur deux
                    lignes voisines, sur de l'argent. */}
                <p className="ax-card__subtitle">
                  {stay.status === 'annule'
                    ? billedDaysLabel(stay.billed_days)
                    : `${billedDaysLabel(stay.billed_days)} · ${billDaysRemainingLabel(
                        Math.max(
                          0,
                          stayDurationDays(stay.admitted_at, stay.discharged_at) - stay.billed_days,
                        ),
                      )}`}
                </p>
              </div>
              {stay.status !== 'annule' && (
                <button type="button" className="ax-btn ax-btn--secondary ax-btn--sm" onClick={() => setBillOpen(true)}>
                  <IconReceipt />
                  <span className="ax-btn__label">Facturer des journées</span>
                </button>
              )}
            </div>
            <div className="ax-card__body" style={{ paddingTop: 0 }}>
              {stay.status === 'annule' ? (
                <p style={{ margin: 0, fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)', lineHeight: 1.6 }}>
                  {BILL_DAYS_CANCELLED_STAY}
                </p>
              ) : (
                <p style={{ margin: 0, fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)', lineHeight: 1.6 }}>
                  {BILL_DAYS_HOWTO} {BILL_DAYS_CAP_RULE}
                </p>
              )}
            </div>
          </section>
        )}
      </div>

      {bedOpen && (
        <AssignBedModal
          stay={stay}
          onClose={() => setBedOpen(false)}
          onAssigned={(fresh) => {
            setBedOpen(false);
            applyFresh(
              fresh,
              fresh.bed
                ? `Lit attribué : ${fresh.bed.room_name} · ${fresh.bed.name}.`
                : 'Lit mis à jour.',
            );
          }}
        />
      )}

      {releaseOpen && (
        <ReleaseBedModal
          stay={stay}
          onClose={() => setReleaseOpen(false)}
          onDone={(fresh) => {
            setReleaseOpen(false);
            applyFresh(fresh, 'Le lit est libéré. Le patient reste hospitalisé, sans lit attribué.');
          }}
        />
      )}

      {attendingOpen && (
        <AttendingModal
          stay={stay}
          onClose={() => setAttendingOpen(false)}
          onDone={(fresh) => {
            setAttendingOpen(false);
            applyFresh(fresh, 'Les médecins qui suivent ce patient ont été mis à jour.');
          }}
        />
      )}

      {dischargeOpen && (
        <DischargeModal
          stay={stay}
          onClose={() => setDischargeOpen(false)}
          onDone={(fresh) => {
            setDischargeOpen(false);
            applyFresh(fresh, 'Sortie enregistrée. Le lit est libéré et la consultation du séjour est clôturée.');
          }}
        />
      )}

      {cancelOpen && (
        <CancelStayModal
          stay={stay}
          onClose={() => setCancelOpen(false)}
          onDone={(fresh) => {
            setCancelOpen(false);
            applyFresh(
              fresh,
              'Admission annulée. Le lit est libéré et ce séjour ne compte plus au tableau d’occupation.',
            );
          }}
        />
      )}

      {billOpen && (
        <BillDaysModal
          stay={stay}
          onClose={() => setBillOpen(false)}
          onDone={(fresh, days) => {
            setBillOpen(false);
            applyFresh(
              fresh,
              `${dayCountLabel(days)} ${days > 1 ? 'posées' : 'posée'} sur la consultation du séjour. Créez la facture depuis « Factures » quand vous le souhaitez.`,
            );
          }}
        />
      )}
    </>
  );
}

export default InpatientStayDetail;
