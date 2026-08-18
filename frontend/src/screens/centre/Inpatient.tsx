"use client";
/*
 * Chioni — /centre/hospitalisation : le tableau d'occupation et les séjours.
 *
 * Deux modes, comme la page « Rendez-vous » : **Occupation** par défaut (c'est
 * l'écran qu'on ouvre pour admettre quelqu'un — « où sont mes patients, que
 * me reste-t-il de places ? ») et **Séjours** (la liste filtrable).
 *
 * Assets Vireo repris et adaptés :
 * - `dashboards/Healthcare.tsx` — la ligne de KPI, les barres d'occupation par
 *   service (ici : par chambre) et le contrat de la carte hôpital ;
 * - `ui/Progress.tsx` — l'anneau circulaire (`ax-progress--circle`, r=32,
 *   dasharray 201.06) pour le taux d'occupation ;
 * - `projects/ProjectsList.tsx` — la barre d'outils « pastilles de statut »
 *   (`ax-btn--pill` primary/secondary) et le segment de mode.
 *
 * Le PLAN DES LITS est une grille de cartes, PAS un board déplaçable — le
 * pourquoi est écrit dans `styles/centre.css` (§ hospitalisation) : la lecture
 * est ouverte à tout le staff alors que l'attribution est un geste clinique, un
 * lit occupé est refusé par la base, et le clavier comme le pouce d'un Android
 * d'entrée de gamme passent mieux par un bouton que par un glisser-déposer.
 *
 * Sérialiseur par audience (R-API-1) : `reason` / `diagnosis` / `cancel_reason`
 * n'existent PAS dans le payload d'un rôle administratif. L'écran REND ce qui
 * arrive — il ne réserve aucune colonne pour un champ qu'il ne recevra pas.
 */
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageHead } from "@/components/shell/PageHead";
import { useCenter } from "@/context/CenterContext";
import type { ApiError } from "@/lib/api";
import {
  admitPatient,
  createBed,
  createRoom,
  getOccupancy,
  listBeds,
  listPatients,
  listPractitioners,
  listStays,
} from "@/lib/endpoints/centers";
import {
  ADMISSION_PIVOT_NOTICE,
  ADMISSION_REASON_HINT,
  ADMISSION_TITLE,
  BED_ADD_LABEL,
  BED_FIELD_HINT,
  BED_INACTIVE_LABEL,
  BED_NONE_FREE,
  INPATIENT_SUBTITLE_ADMIN,
  INPATIENT_SUBTITLE_CLINICAL,
  OCCUPANCY_EMPTY_DIRECTOR,
  OCCUPANCY_EMPTY_STAFF,
  OCCUPANCY_EMPTY_TITLE,
  OCCUPANCY_RATE_LABEL,
  OCCUPANCY_TRUNCATED_NOTICE,
  ROOM_ADD_LABEL,
  ROOM_BED_DIRECTOR_ONLY,
  ROOM_BED_NO_EDIT_NOTICE,
  STAY_NO_BED_HINT,
  STAY_PRIORITIES,
  STAY_PRIORITY_FILTER_EMPTY_PAGE,
  STAY_PRIORITY_FILTER_NOTICE,
  STAY_PRIORITY_LABELS,
  STAY_STATUSES,
  STAY_STATUS_LABELS,
  STAFF_ROLE_LABELS,
  formatDate,
  formatDateTime,
  freeBedsLabel,
  occupancySummary,
  stayDurationLabel,
  staysWithoutBedLabel,
} from "@/lib/labels";
import type {
  OccupancyRoom,
  Patient,
  Stay,
  StayPriority,
  StayStatus,
} from "@/lib/types";
import {
  AssignBedModal,
  BedLabel,
  StayPriorityBadge,
  StayStatusBadge,
} from "./InpatientShared";
import {
  AvatarChip,
  CLINICAL_ROLES,
  CardSkeleton,
  EmptyState,
  ErrorAlert,
  FieldError,
  IconBed,
  IconChevronRight,
  IconPlus,
  IconSearch,
  Modal,
  Pagination,
  TableSkeleton,
  hasRole,
  toApiError,
  useAsync,
  useDebounced,
} from "./shared";

/* ── chargement des séjours en cours (le tableau en a besoin en entier) ── */

/** Garde-fou : 5 pages (100 séjours en cours) — au-delà, l'écran le dit. */
async function fetchOngoingStays(
  centerId: number,
): Promise<{ items: Stay[]; truncated: boolean }> {
  const items: Stay[] = [];
  let page = 1;
  while (page <= 5) {
    const chunk = await listStays(centerId, { status: "en_cours", page });
    items.push(...chunk.results);
    if (!chunk.next) return { items, truncated: false };
    page += 1;
  }
  return { items, truncated: true };
}

/* ── anneau d'occupation (adapté de vireo template/src/screens/ui/Progress.tsx) ── */

const RING_CIRCUMFERENCE = 201.06; // 2πr, r = 32 — la valeur du template.

function OccupancyRing({ pct }: { pct: number }) {
  const clamped = Math.max(0, Math.min(100, pct));
  const offset = (RING_CIRCUMFERENCE * (100 - clamped)) / 100;
  // Le ton suit la tension du service : ≥ 90 % il faut chercher une place.
  const stroke =
    clamped >= 90
      ? "var(--ax-danger-500)"
      : clamped >= 75
        ? "var(--ax-warning-500)"
        : undefined;
  return (
    <div
      className="ax-progress ax-progress--circle"
      style={{ width: 108, height: 108 }}
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`${OCCUPANCY_RATE_LABEL} ${clamped} %`}
    >
      <svg viewBox="0 0 80 80" width={108} height={108} aria-hidden="true">
        <circle
          className="ax-progress__ring-track"
          cx={40}
          cy={40}
          r={32}
          strokeWidth={7}
        />
        <circle
          className="ax-progress__ring-fill"
          cx={40}
          cy={40}
          r={32}
          strokeWidth={7}
          strokeDasharray={String(RING_CIRCUMFERENCE)}
          strokeDashoffset={offset.toFixed(2)}
          transform="rotate(-90 40 40)"
          style={stroke ? { stroke } : undefined}
        />
      </svg>
      <div
        className="ax-progress__center"
        style={{ flexDirection: "column", lineHeight: 1 }}
      >
        {/* Le taux passe SOUS le nombre de places libres dans la hiérarchie :
            c'est un indicateur de tension, pas la réponse à « puis-je
            l'installer ? ». */}
        <b
          className="ax-num"
          style={{
            fontSize: "var(--ax-text-lg)",
            color: "var(--ax-text-strong)",
          }}
        >
          {clamped} %
        </b>
        <small
          style={{
            fontFamily: "var(--ax-font-sans)",
            fontSize: "var(--ax-text-2xs)",
            color: "var(--ax-text-muted)",
            marginTop: 4,
          }}
        >
          occupé
        </small>
      </div>
    </div>
  );
}

/* ── déclaration du parc (directeur seul) ── */

function NameModal({
  title,
  label,
  onClose,
  onSubmit,
}: {
  title: string;
  label: string;
  onClose: () => void;
  onSubmit: (name: string) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      await onSubmit(name.trim());
    } catch (err) {
      setError(toApiError(err));
      setSaving(false);
    }
  };

  return (
    <Modal
      title={title}
      onClose={onClose}
      busy={saving}
      width={460}
      footer={
        <>
          <button
            type="button"
            className="ax-btn ax-btn--ghost"
            onClick={onClose}
            disabled={saving}
          >
            Annuler
          </button>
          <button
            type="submit"
            form="park-form"
            className="ax-btn ax-btn--primary"
            disabled={saving || name.trim() === ""}
          >
            {saving ? "Enregistrement…" : "Enregistrer"}
          </button>
        </>
      }
    >
      <form
        id="park-form"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "var(--ax-space-4)",
        }}
      >
        {error && error.messages.length > 0 && <ErrorAlert error={error} />}
        <div className="ax-field">
          <label className="ax-label" htmlFor="park-name">
            {label}{" "}
            <span className="ax-field__required" aria-hidden="true">
              *
            </span>
          </label>
          <input
            id="park-name"
            type="text"
            className={`ax-input${error?.fieldErrors.name ? " is-invalid" : ""}`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={64}
            required
            autoComplete="off"
            data-autofocus=""
          />
          <FieldError error={error} field="name" />
          <span className="ax-field__message">{ROOM_BED_NO_EDIT_NOTICE}</span>
        </div>
      </form>
    </Modal>
  );
}

/* ── admission (rôles cliniques) ── */

function AdmitModal({
  onClose,
  onAdmitted,
}: {
  onClose: () => void;
  onAdmitted: (id: number) => void;
}) {
  const { centerId } = useCenter();
  const [patientQ, setPatientQ] = useState("");
  const [patient, setPatient] = useState<Patient | null>(null);
  const [reason, setReason] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [priority, setPriority] = useState<StayPriority>("normale");
  const [bedId, setBedId] = useState<number | "">("");
  const [attending, setAttending] = useState<number[]>([]);
  const [admittedAt, setAdmittedAt] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const debouncedQ = useDebounced(patientQ.trim());

  const candidates = useAsync(
    () =>
      debouncedQ
        ? listPatients(centerId, { q: debouncedQ, page: 1 })
        : Promise.resolve(null),
    [centerId, debouncedQ],
  );
  const beds = useAsync(() => listBeds(centerId, { free: true }), [centerId]);
  const practitioners = useAsync(() => listPractitioners(centerId), [centerId]);

  const toggleAttending = (id: number) =>
    setAttending((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id],
    );

  const submit = async () => {
    if (patient === null) return;
    setSaving(true);
    setError(null);
    try {
      const stay = await admitPatient(centerId, {
        patient: patient.id,
        reason: reason.trim(),
        ...(diagnosis.trim() ? { diagnosis: diagnosis.trim() } : {}),
        priority,
        ...(bedId !== "" ? { bed: bedId } : {}),
        ...(attending.length > 0 ? { attending } : {}),
        ...(admittedAt
          ? { admitted_at: new Date(admittedAt).toISOString() }
          : {}),
      });
      onAdmitted(stay.id);
    } catch (err) {
      setError(toApiError(err));
      setSaving(false);
    }
  };

  const freeBeds = beds.data ?? [];

  return (
    <Modal
      title={ADMISSION_TITLE}
      onClose={onClose}
      busy={saving}
      width={640}
      footer={
        <>
          <button
            type="button"
            className="ax-btn ax-btn--ghost"
            onClick={onClose}
            disabled={saving}
          >
            Annuler
          </button>
          <button
            type="submit"
            form="admit-form"
            className="ax-btn ax-btn--primary"
            disabled={saving || patient === null || !reason.trim()}
          >
            {saving ? "Admission…" : "Enregistrer l'admission"}
          </button>
        </>
      }
    >
      <form
        id="admit-form"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "var(--ax-space-4)",
        }}
      >
        {error && error.messages.length > 0 && <ErrorAlert error={error} />}

        <div className="ax-alert ax-alert--info" role="note">
          <div className="ax-alert__content">
            <p className="ax-alert__message" style={{ lineHeight: 1.6 }}>
              {ADMISSION_PIVOT_NOTICE}
            </p>
          </div>
        </div>

        {/* Patient */}
        <div className="ax-field">
          <label className="ax-label" htmlFor="adm-patient">
            Patient{" "}
            <span className="ax-field__required" aria-hidden="true">
              *
            </span>
          </label>
          {patient ? (
            <div
              className="ax-cluster"
              style={{
                gap: "var(--ax-space-3)",
                flexWrap: "nowrap",
                alignItems: "center",
              }}
            >
              <AvatarChip
                name={`${patient.first_name} ${patient.last_name}`}
                seed={patient.id}
              />
              <span
                style={{
                  fontWeight: 500,
                  color: "var(--ax-text-strong)",
                  flex: "1 1 auto",
                }}
              >
                {patient.first_name} {patient.last_name}
              </span>
              <button
                type="button"
                className="ax-btn ax-btn--ghost ax-btn--sm"
                onClick={() => setPatient(null)}
                disabled={saving}
              >
                Changer
              </button>
            </div>
          ) : (
            <>
              <div className="ax-field__control">
                <span className="ax-field__affix ax-field__affix--leading">
                  <IconSearch className="" />
                </span>
                <input
                  id="adm-patient"
                  type="search"
                  className="ax-input ax-input--with-leading-icon"
                  placeholder="Rechercher un patient par nom ou téléphone…"
                  value={patientQ}
                  onChange={(e) => setPatientQ(e.target.value)}
                  data-autofocus=""
                />
              </div>
              {debouncedQ && candidates.loading && <CardSkeleton lines={2} />}
              {debouncedQ &&
                !candidates.loading &&
                (candidates.data?.results.length ?? 0) === 0 && (
                  <span className="ax-field__message">
                    Aucun patient trouvé — créez d&apos;abord son dossier dans «
                    Patients ».
                  </span>
                )}
              {(candidates.data?.results.length ?? 0) > 0 && (
                <ul
                  className="ax-list ax-list--compact"
                  aria-label="Patients trouvés"
                >
                  {candidates.data?.results.slice(0, 6).map((p) => (
                    <li key={p.id} className="ax-list__row">
                      <button
                        type="button"
                        onClick={() => setPatient(p)}
                        className="ax-btn ax-btn--ghost ax-btn--block"
                        style={{
                          justifyContent: "flex-start",
                          gap: "var(--ax-space-3)",
                        }}
                      >
                        <AvatarChip
                          name={`${p.first_name} ${p.last_name}`}
                          seed={p.id}
                        />
                        <span
                          className="ax-btn__label"
                          style={{ textAlign: "start" }}
                        >
                          {p.first_name} {p.last_name}
                          <span
                            style={{
                              display: "block",
                              fontSize: "var(--ax-text-xs)",
                              color: "var(--ax-text-muted)",
                              fontWeight: 400,
                            }}
                          >
                            {p.birth_date
                              ? formatDate(p.birth_date)
                              : "Naissance inconnue"}{" "}
                            · {p.phone || "Sans téléphone"}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
          <FieldError error={error} field="patient" />
        </div>

        <div className="ax-field">
          <label className="ax-label" htmlFor="adm-reason">
            Motif d&apos;admission{" "}
            <span className="ax-field__required" aria-hidden="true">
              *
            </span>
          </label>
          <input
            id="adm-reason"
            type="text"
            className={`ax-input${error?.fieldErrors.reason ? " is-invalid" : ""}`}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={255}
            required
            autoComplete="off"
          />
          <span className="ax-field__message">{ADMISSION_REASON_HINT}</span>
          <FieldError error={error} field="reason" />
        </div>

        <div className="ax-field">
          <label className="ax-label" htmlFor="adm-diagnosis">
            Diagnostic
          </label>
          <textarea
            id="adm-diagnosis"
            className="ax-textarea"
            rows={2}
            value={diagnosis}
            onChange={(e) => setDiagnosis(e.target.value)}
          />
          <FieldError error={error} field="diagnosis" />
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "var(--ax-space-4)",
          }}
        >
          <div className="ax-field">
            <label className="ax-label" htmlFor="adm-priority">
              Priorité
            </label>
            <select
              id="adm-priority"
              className="ax-select"
              value={priority}
              onChange={(e) => setPriority(e.target.value as StayPriority)}
            >
              {STAY_PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {STAY_PRIORITY_LABELS[p]}
                </option>
              ))}
            </select>
            <FieldError error={error} field="priority" />
          </div>

          <div className="ax-field">
            <label className="ax-label" htmlFor="adm-bed">
              Lit
            </label>
            <select
              id="adm-bed"
              className="ax-select"
              value={bedId === "" ? "" : String(bedId)}
              onChange={(e) =>
                setBedId(
                  e.target.value === ""
                    ? ""
                    : Number.parseInt(e.target.value, 10),
                )
              }
              disabled={beds.loading || freeBeds.length === 0}
            >
              <option value="">Sans lit pour l&apos;instant</option>
              {freeBeds.map((bed) => (
                <option key={bed.id} value={bed.id}>
                  {bed.room_name} · {bed.name}
                </option>
              ))}
            </select>
            <span className="ax-field__message">
              {beds.loading
                ? "Recherche des lits libres…"
                : freeBeds.length === 0
                  ? BED_NONE_FREE
                  : BED_FIELD_HINT}
            </span>
            <FieldError error={error} field="bed" />
          </div>

          <div className="ax-field">
            <label className="ax-label" htmlFor="adm-date">
              Date et heure d&apos;admission
            </label>
            <input
              id="adm-date"
              type="datetime-local"
              className="ax-input"
              value={admittedAt}
              onChange={(e) => setAdmittedAt(e.target.value)}
            />
            <span className="ax-field__message">
              Laissez vide pour « maintenant ».
            </span>
            <FieldError error={error} field="admitted_at" />
          </div>
        </div>

        <div className="ax-field">
          <span className="ax-label">Médecins qui suivent le patient</span>
          {practitioners.loading ? (
            <CardSkeleton lines={2} />
          ) : (practitioners.data?.length ?? 0) === 0 ? (
            <span className="ax-field__message">
              Aucun soignant actif dans l&apos;annuaire du centre —
              l&apos;admission reste possible.
            </span>
          ) : (
            <div
              style={{
                maxHeight: 180,
                overflowY: "auto",
                border: "1px solid var(--ax-border)",
                borderRadius: "var(--ax-radius-md)",
                padding: "var(--ax-space-2)",
              }}
            >
              {(practitioners.data ?? []).map((p) => (
                <label
                  key={p.id}
                  className="ax-cluster"
                  style={{
                    gap: "var(--ax-space-3)",
                    flexWrap: "nowrap",
                    padding: "var(--ax-space-2)",
                    cursor: "pointer",
                    borderRadius: "var(--ax-radius-sm)",
                  }}
                >
                  <input
                    type="checkbox"
                    className="ax-checkbox"
                    checked={attending.includes(p.id)}
                    onChange={() => toggleAttending(p.id)}
                  />
                  <span style={{ flex: "1 1 auto", minWidth: 0 }}>
                    <span
                      style={{
                        display: "block",
                        fontSize: "var(--ax-text-sm)",
                        color: "var(--ax-text-strong)",
                      }}
                    >
                      {p.display_name}
                    </span>
                    <span
                      style={{
                        display: "block",
                        fontSize: "var(--ax-text-xs)",
                        color: "var(--ax-text-muted)",
                      }}
                    >
                      {STAFF_ROLE_LABELS[p.role]}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          )}
          <FieldError error={error} field="attending" />
        </div>
      </form>
    </Modal>
  );
}

/* ── mode « Occupation » ── */

function BedCard({
  bed,
  clinical,
}: {
  bed: OccupancyRoom["beds"][number];
  clinical: boolean;
}) {
  const occupant = bed.occupant;
  if (!bed.is_active) {
    return (
      <div className="ax-bed ax-bed--inactive">
        <span className="ax-bed__name">{bed.name}</span>
        <span className="ax-bed__free-label">{BED_INACTIVE_LABEL}</span>
      </div>
    );
  }
  if (occupant === null) {
    return (
      <div className="ax-bed ax-bed--free">
        <span className="ax-bed__name">{bed.name}</span>
        <span className="ax-bed__free-label">Libre</span>
      </div>
    );
  }
  const tone =
    occupant.priority === "critique"
      ? " ax-bed--critical"
      : occupant.priority === "urgente"
        ? " ax-bed--urgent"
        : " ax-bed--occupied";
  return (
    <div className={`ax-bed${tone}`}>
      <div
        className="ax-cluster"
        style={{ justifyContent: "space-between", gap: "var(--ax-space-2)" }}
      >
        <span className="ax-bed__name">{bed.name}</span>
        <StayPriorityBadge priority={occupant.priority} />
      </div>
      <Link
        href={`/centre/hospitalisation/${occupant.stay}`}
        className="ax-bed__patient ax-link"
      >
        {occupant.patient_name}
      </Link>
      <span className="ax-bed__meta">
        Depuis le {formatDate(occupant.since)}
      </span>
      {clinical && occupant.reason && (
        <span className="ax-bed__meta ax-truncate" title={occupant.reason}>
          {occupant.reason}
        </span>
      )}
    </div>
  );
}

function OccupancyBoard({
  rooms,
  ongoing,
  truncated,
  clinical,
  director,
  onAddBed,
  onAssignBed,
}: {
  rooms: OccupancyRoom[];
  ongoing: Stay[];
  truncated: boolean;
  clinical: boolean;
  director: boolean;
  onAddBed: (room: OccupancyRoom) => void;
  onAssignBed: (stay: Stay) => void;
}) {
  const allBeds = rooms.flatMap((room) =>
    room.beds.map((bed) => ({ room, bed })),
  );
  const usable = allBeds.filter(
    ({ room, bed }) => room.is_active && bed.is_active,
  );
  /* Occupation comptée sur les lits UTILISABLES, dénominateur compris : mêler
     un lit hors service occupé au numérateur d'un dénominateur qui l'exclut
     produisait un taux au-dessus de 100 % et un « Aucun lit libre » faux. */
  const occupied = usable.filter(({ bed }) => bed.occupant !== null).length;
  const total = usable.length;
  const free = Math.max(0, total - occupied);
  const rate = total > 0 ? Math.round((occupied / total) * 100) : 0;
  const withoutBed = ongoing.filter((stay) => stay.bed === null);

  return (
    <>
      {/* Le chiffre qui sert à admettre — pas une série, une photo.
          La QUESTION de cet écran est « me reste-t-il une place ? », pas
          « quel est mon taux d'occupation ? ». Le nombre de lits libres est
          donc le chiffre en gros ; le taux, lui, reste dans l'anneau, où il
          donne la tension du service d'un coup d'œil. */}
      <section
        className="ax-card ax-col--4"
        role="region"
        aria-label={OCCUPANCY_RATE_LABEL}
      >
        <div className="ax-card__header">
          <div className="ax-card__titles">
            <span className="ax-card__eyebrow">Maintenant</span>
            <h2 className="ax-card__title">Places disponibles</h2>
          </div>
        </div>
        <div
          className="ax-card__body"
          style={{
            paddingTop: 0,
            display: "flex",
            alignItems: "center",
            gap: "var(--ax-space-5)",
            flexWrap: "wrap",
          }}
        >
          <OccupancyRing pct={rate} />
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 6,
              minWidth: 150,
            }}
          >
            <b
              className="ax-num"
              style={{
                color: "var(--ax-text-strong)",
                fontSize: "var(--ax-text-xl)",
                lineHeight: 1.1,
                fontWeight: "var(--ax-weight-semibold)",
              }}
            >
              {/* Sans aucun lit déclaré, « Aucun lit libre » en gros se lit
                  « le service est plein » — l'inverse de la vérité, qui est
                  « le parc n'est pas encore décrit ». */}
              {total > 0 ? freeBedsLabel(free) : "Aucun lit déclaré"}
            </b>
            <span
              style={{
                fontSize: "var(--ax-text-sm)",
                color: "var(--ax-text-muted)",
              }}
            >
              {total > 0
                ? occupancySummary(occupied, total)
                : director
                  ? "Ajoutez un lit à une chambre pour pouvoir y placer un patient."
                  : ROOM_BED_DIRECTOR_ONLY}
            </span>
            {withoutBed.length > 0 && (
              <span
                style={{
                  fontSize: "var(--ax-text-xs)",
                  color: "var(--ax-text-muted)",
                }}
              >
                {staysWithoutBedLabel(withoutBed.length)}
              </span>
            )}
            {truncated && (
              <span
                style={{
                  fontSize: "var(--ax-text-xs)",
                  color: "var(--ax-text-muted)",
                  lineHeight: 1.5,
                }}
              >
                {OCCUPANCY_TRUNCATED_NOTICE}
              </span>
            )}
          </div>
        </div>
      </section>

      {/* Occupation par chambre — barres du dashboard healthcare de Vireo. */}
      <section
        className="ax-card ax-col--8"
        role="region"
        aria-label="Occupation par chambre"
      >
        <div className="ax-card__header">
          <div className="ax-card__titles">
            <h2 className="ax-card__title">Par chambre</h2>
            <p className="ax-card__subtitle">Où il reste de la place</p>
          </div>
        </div>
        <div
          className="ax-card__body"
          style={{
            paddingTop: 0,
            display: "flex",
            flexDirection: "column",
            gap: "var(--ax-space-4)",
          }}
        >
          {rooms.map((room) => {
            const beds = room.beds.filter((b) => b.is_active);
            const busy = beds.filter((b) => b.occupant !== null).length;
            const pct =
              beds.length > 0 ? Math.round((busy / beds.length) * 100) : 0;
            const color =
              pct >= 90
                ? "var(--ax-danger-500)"
                : pct >= 75
                  ? "var(--ax-warning-500)"
                  : "var(--ax-accent)";
            return (
              <div key={room.id}>
                <div
                  className="ax-cluster"
                  style={{
                    justifyContent: "space-between",
                    marginBottom: 6,
                    gap: "var(--ax-space-3)",
                  }}
                >
                  <span
                    style={{
                      fontSize: "var(--ax-text-sm)",
                      color: "var(--ax-text)",
                    }}
                  >
                    {room.name}
                  </span>
                  {/* Le chiffre utile pour admettre est le nombre de LIBRES ;
                      « pris / déclarés » demandait une soustraction mentale. */}
                  <span
                    className="ax-cluster"
                    style={{ gap: "var(--ax-space-2)", flexWrap: "nowrap" }}
                  >
                    <b
                      className="ax-num"
                      style={{
                        color: "var(--ax-text-strong)",
                        fontSize: "var(--ax-text-sm)",
                      }}
                    >
                      {freeBedsLabel(Math.max(0, beds.length - busy))}
                    </b>
                    <span
                      className="ax-num"
                      style={{
                        color: "var(--ax-text-muted)",
                        fontSize: "var(--ax-text-xs)",
                      }}
                    >
                      {busy}/{beds.length}
                    </span>
                  </span>
                </div>
                <div className="ax-progress ax-progress--sm">
                  <div className="ax-progress__track">
                    <div
                      className="ax-progress__fill"
                      style={{ width: `${pct}%`, background: color }}
                      role="progressbar"
                      aria-valuenow={pct}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`${room.name} : ${busy} lit(s) occupé(s) sur ${beds.length}`}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Les patients hospitalisés SANS lit : la réalité d'un service plein. */}
      {withoutBed.length > 0 && (
        <section
          className="ax-card ax-col--12"
          role="region"
          aria-label="Patients sans lit"
        >
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <h2 className="ax-card__title">
                {staysWithoutBedLabel(withoutBed.length)}
              </h2>
              <p className="ax-card__subtitle">{STAY_NO_BED_HINT}</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            <ul className="ax-list ax-list--compact">
              {withoutBed.map((stay) => (
                <li key={stay.id} className="ax-list__row">
                  <span className="ax-list__leading">
                    <AvatarChip name={stay.patient_name} seed={stay.patient} />
                  </span>
                  <span className="ax-list__content">
                    <Link
                      href={`/centre/hospitalisation/${stay.id}`}
                      className="ax-list__title ax-link"
                    >
                      {stay.patient_name}
                    </Link>
                    <span
                      style={{
                        display: "block",
                        fontSize: "var(--ax-text-xs)",
                        color: "var(--ax-text-muted)",
                      }}
                    >
                      Admis le {formatDate(stay.admitted_at)} ·{" "}
                      {stayDurationLabel(stay.admitted_at, null)}
                    </span>
                  </span>
                  <span
                    className="ax-list__trailing"
                    style={{
                      display: "flex",
                      gap: "var(--ax-space-2)",
                      alignItems: "center",
                    }}
                  >
                    <StayPriorityBadge priority={stay.priority} />
                    {clinical && (
                      <button
                        type="button"
                        className="ax-btn ax-btn--secondary ax-btn--sm"
                        onClick={() => onAssignBed(stay)}
                      >
                        <IconBed />
                        <span className="ax-btn__label">Attribuer un lit</span>
                      </button>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* Le plan des lits, chambre par chambre. */}
      {rooms.map((room) => (
        <section
          key={room.id}
          className="ax-card ax-col--6"
          role="region"
          aria-label={`Chambre ${room.name}`}
        >
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <h2 className="ax-card__title">{room.name}</h2>
              <p className="ax-card__subtitle">
                {room.beds.length === 0
                  ? "Aucun lit déclaré dans cette chambre"
                  : freeBedsLabel(room.free_beds)}
              </p>
            </div>
            {director && (
              <button
                type="button"
                className="ax-btn ax-btn--ghost ax-btn--sm"
                onClick={() => onAddBed(room)}
              >
                <IconPlus />
                <span className="ax-btn__label">{BED_ADD_LABEL}</span>
              </button>
            )}
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            {room.beds.length === 0 ? (
              <p
                style={{
                  margin: 0,
                  fontSize: "var(--ax-text-sm)",
                  color: "var(--ax-text-muted)",
                }}
              >
                {director
                  ? "Ajoutez son premier lit pour pouvoir y placer un patient."
                  : ROOM_BED_DIRECTOR_ONLY}
              </p>
            ) : (
              <div className="ax-beds">
                {room.beds.map((bed) => (
                  <BedCard key={bed.id} bed={bed} clinical={clinical} />
                ))}
              </div>
            )}
          </div>
        </section>
      ))}
    </>
  );
}

/* ── mode « Séjours » ── */

/** L'ordre des pastilles : l'état de travail d'abord, « Tous » en sortie. */
const STATUS_PILLS: Array<StayStatus | "tous"> = [...STAY_STATUSES, "tous"];

function StayList() {
  const { centerId, roles } = useCenter();
  const clinical = hasRole(roles, CLINICAL_ROLES);
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<StayStatus | "tous">(
    "en_cours",
  );
  const [priorityFilter, setPriorityFilter] = useState<StayPriority | "">("");

  const stays = useAsync(
    () =>
      listStays(centerId, {
        page,
        ...(statusFilter === "tous" ? { all: true } : { status: statusFilter }),
      }),
    [centerId, page, statusFilter],
  );

  useEffect(() => {
    setPage(1);
  }, [centerId, statusFilter]);

  const results = stays.data?.results ?? [];
  /* Le sérialiseur d'un rôle administratif ne PORTE PAS `reason` : la colonne
     n'existe que si la donnée arrive réellement — ET que la casquette du centre
     ACTIF est clinique. Deux verrous, comme le plan des lits : le rôle est juste
     immédiatement (changement de centre), le payload est juste après
     l'aller-retour, et aucune régression de sérialiseur ne suffit à ouvrir la
     colonne à elle seule. */
  const hasClinicalFields = clinical && results.some((s) => s.reason !== undefined);
  const shown =
    priorityFilter === ""
      ? results
      : results.filter((s) => s.priority === priorityFilter);
  const hasFilters = statusFilter !== "en_cours" || priorityFilter !== "";

  return (
    <section
      className="ax-card ax-col--12"
      role="region"
      aria-label="Liste des séjours"
    >
      <div
        className="ax-card__header"
        style={{ flexWrap: "wrap", gap: "var(--ax-space-3)" }}
      >
        <div
          className="ax-cluster"
          style={{
            gap: "var(--ax-space-3)",
            flexWrap: "wrap",
            alignItems: "flex-end",
          }}
        >
          {/* Pastilles de statut — patron ProjectsList de Vireo. */}
          <div
            className="ax-cluster"
            style={{ gap: "var(--ax-space-2)" }}
            role="group"
            aria-label="Filtrer par statut"
          >
            {STATUS_PILLS.map((key) => (
              <button
                key={key}
                type="button"
                className={`ax-btn ax-btn--sm ax-btn--pill ${statusFilter === key ? "ax-btn--primary" : "ax-btn--secondary"}`}
                aria-pressed={statusFilter === key}
                onClick={() => setStatusFilter(key)}
              >
                {key === "tous" ? "Tous" : STAY_STATUS_LABELS[key]}
              </button>
            ))}
          </div>
          <div className="ax-field" style={{ marginBottom: 0 }}>
            <label className="ax-label" htmlFor="stay-f-priority">
              Priorité
            </label>
            <select
              id="stay-f-priority"
              className="ax-select ax-select--sm"
              style={{ minWidth: 160 }}
              value={priorityFilter}
              onChange={(e) =>
                setPriorityFilter(e.target.value as StayPriority | "")
              }
            >
              <option value="">Toutes les priorités</option>
              {STAY_PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {STAY_PRIORITY_LABELS[p]}
                </option>
              ))}
            </select>
          </div>
          {hasFilters && (
            <button
              type="button"
              className="ax-btn ax-btn--ghost ax-btn--sm"
              onClick={() => {
                setStatusFilter("en_cours");
                setPriorityFilter("");
              }}
            >
              Effacer les filtres
            </button>
          )}
        </div>
      </div>

      {priorityFilter !== "" && (
        <p
          style={{
            margin: "0 var(--ax-space-5) var(--ax-space-3)",
            fontSize: "var(--ax-text-xs)",
            color: "var(--ax-text-muted)",
          }}
        >
          {STAY_PRIORITY_FILTER_NOTICE}
        </p>
      )}

      {stays.loading ? (
        <TableSkeleton rows={6} cols={6} />
      ) : stays.error ? (
        <div style={{ padding: "var(--ax-space-4)" }}>
          <ErrorAlert error={stays.error} onRetry={stays.reload} />
        </div>
      ) : results.length === 0 ? (
        <EmptyState
          title="Aucun séjour"
          message={
            statusFilter !== "en_cours"
              ? "Aucun séjour ne correspond à ce filtre."
              : "Personne n'est hospitalisé en ce moment. Les admissions apparaîtront ici."
          }
        />
      ) : (
        <>
          {/*
            Cul-de-sac fermé : le filtre de priorité travaille sur la PAGE
            affichée. Quand il la vide, l'ancien état vide remplaçait le tableau
            ET la pagination — la seule sortie (« page suivante ») disparaissait
            avec elle. On garde donc la pagination à l'écran et on dit ce qui se
            passe, plutôt que d'annoncer « aucun séjour » à quelqu'un dont la
            page 2 en contient peut-être trois.
          */}
          {shown.length === 0 && (
            <div style={{ padding: "0 var(--ax-space-5) var(--ax-space-4)" }}>
              <div className="ax-alert ax-alert--info" role="status">
                <div className="ax-alert__content">
                  <p className="ax-alert__message">
                    {STAY_PRIORITY_FILTER_EMPTY_PAGE}
                  </p>
                </div>
              </div>
            </div>
          )}
          <div className="ax-table-wrap" tabIndex={0} role="region" aria-label="Tableau" hidden={shown.length === 0}>
            <table className="ax-table ax-table--hover">
              <thead className="ax-table__head">
                <tr>
                  <th className="ax-table__th" scope="col">
                    Patient
                  </th>
                  <th className="ax-table__th" scope="col">
                    Admis le
                  </th>
                  <th className="ax-table__th" scope="col">
                    Durée
                  </th>
                  <th className="ax-table__th" scope="col">
                    Lit
                  </th>
                  {hasClinicalFields && (
                    <th className="ax-table__th" scope="col">
                      Motif
                    </th>
                  )}
                  <th className="ax-table__th" scope="col">
                    Priorité
                  </th>
                  <th className="ax-table__th ax-table__th--num" scope="col">
                    Journées
                  </th>
                  <th className="ax-table__th" scope="col">
                    Statut
                  </th>
                  <th className="ax-table__th" scope="col">
                    <span className="ax-visually-hidden">Ouvrir</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {shown.map((stay) => (
                  <tr
                    key={stay.id}
                    className="ax-table__row"
                    onClick={() =>
                      router.push(`/centre/hospitalisation/${stay.id}`)
                    }
                    style={{ cursor: "pointer" }}
                  >
                    <td className="ax-table__td">
                      <div
                        className="ax-cluster"
                        style={{ gap: "var(--ax-space-3)", flexWrap: "nowrap" }}
                      >
                        <AvatarChip
                          name={stay.patient_name}
                          seed={stay.patient}
                        />
                        <Link
                          href={`/centre/hospitalisation/${stay.id}`}
                          className="ax-link"
                          onClick={(ev) => ev.stopPropagation()}
                          style={{
                            fontWeight: 500,
                            color: "var(--ax-text-strong)",
                          }}
                        >
                          {stay.patient_name}
                        </Link>
                      </div>
                    </td>
                    <td
                      className="ax-table__td"
                      style={{
                        color: "var(--ax-text-muted)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {formatDateTime(stay.admitted_at)}
                    </td>
                    <td
                      className="ax-table__td"
                      style={{
                        color: "var(--ax-text-muted)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {stayDurationLabel(
                        stay.admitted_at,
                        stay.discharged_at,
                        stay.status,
                      )}
                    </td>
                    <td className="ax-table__td">
                      <BedLabel bed={stay.bed} />
                    </td>
                    {hasClinicalFields && (
                      <td
                        className="ax-table__td"
                        style={{ color: "var(--ax-text-muted)", maxWidth: 220 }}
                      >
                        <span
                          className="ax-truncate"
                          style={{ display: "block" }}
                        >
                          {stay.reason || "—"}
                        </span>
                      </td>
                    )}
                    <td className="ax-table__td">
                      <StayPriorityBadge priority={stay.priority} />
                    </td>
                    <td className="ax-table__td ax-table__td--num ax-num">
                      {stay.billed_days}
                    </td>
                    <td className="ax-table__td">
                      <StayStatusBadge status={stay.status} />
                    </td>
                    <td className="ax-table__td" style={{ textAlign: "end" }}>
                      <IconChevronRight className="" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {stays.data && (
            <Pagination count={stays.data.count} page={page} onPage={setPage} />
          )}
        </>
      )}
    </section>
  );
}

/* ── écran ── */

type Mode = "occupation" | "sejours";

export function Inpatient() {
  const { centerId, roles } = useCenter();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("occupation");
  const [admitOpen, setAdmitOpen] = useState(false);
  const [roomOpen, setRoomOpen] = useState(false);
  const [bedForRoom, setBedForRoom] = useState<OccupancyRoom | null>(null);
  const [assignFor, setAssignFor] = useState<Stay | null>(null);

  const clinical = hasRole(roles, CLINICAL_ROLES);
  const director = hasRole(roles, ["directeur"]);

  const occupancy = useAsync(
    () =>
      mode === "occupation" ? getOccupancy(centerId) : Promise.resolve(null),
    [centerId, mode],
  );
  const ongoing = useAsync(
    () =>
      mode === "occupation"
        ? fetchOngoingStays(centerId)
        : Promise.resolve(null),
    [centerId, mode],
  );

  const rooms = occupancy.data;
  const ongoingStays = useMemo(() => ongoing.data?.items ?? [], [ongoing.data]);

  const reloadBoard = () => {
    occupancy.reload();
    ongoing.reload();
  };

  return (
    <>
      <PageHead
        title="Hospitalisation"
        subtitle={
          clinical ? INPATIENT_SUBTITLE_CLINICAL : INPATIENT_SUBTITLE_ADMIN
        }
        actions={
          <>
            <div
              className="ax-segment"
              role="radiogroup"
              aria-label="Mode d'affichage"
            >
              <button
                type="button"
                className={`ax-segment__option${mode === "occupation" ? " is-active" : ""}`}
                role="radio"
                aria-checked={mode === "occupation"}
                onClick={() => setMode("occupation")}
              >
                Occupation
              </button>
              <button
                type="button"
                className={`ax-segment__option${mode === "sejours" ? " is-active" : ""}`}
                role="radio"
                aria-checked={mode === "sejours"}
                onClick={() => setMode("sejours")}
              >
                Séjours
              </button>
            </div>
            {director && (
              <button
                type="button"
                className="ax-btn ax-btn--secondary"
                onClick={() => setRoomOpen(true)}
              >
                <IconPlus />
                <span className="ax-btn__label">{ROOM_ADD_LABEL}</span>
              </button>
            )}
            {clinical && (
              <button
                type="button"
                className="ax-btn ax-btn--primary"
                onClick={() => setAdmitOpen(true)}
              >
                <IconBed />
                <span className="ax-btn__label">Admettre un patient</span>
              </button>
            )}
          </>
        }
      />

      <div className="ax-dash-grid">
        {mode === "sejours" ? (
          <StayList />
        ) : occupancy.loading || ongoing.loading ? (
          <section className="ax-card ax-col--12">
            <CardSkeleton lines={5} />
          </section>
        ) : occupancy.error ? (
          <section className="ax-card ax-col--12">
            <div style={{ padding: "var(--ax-space-4)" }}>
              <ErrorAlert error={occupancy.error} onRetry={reloadBoard} />
            </div>
          </section>
        ) : (rooms?.length ?? 0) === 0 ? (
          <section
            className="ax-card ax-col--12"
            role="region"
            aria-label={OCCUPANCY_EMPTY_TITLE}
          >
            <EmptyState
              title={OCCUPANCY_EMPTY_TITLE}
              message={
                director ? OCCUPANCY_EMPTY_DIRECTOR : OCCUPANCY_EMPTY_STAFF
              }
              action={
                director ? (
                  <button
                    type="button"
                    className="ax-btn ax-btn--secondary"
                    onClick={() => setRoomOpen(true)}
                  >
                    <IconPlus />
                    <span className="ax-btn__label">{ROOM_ADD_LABEL}</span>
                  </button>
                ) : undefined
              }
            />
          </section>
        ) : (
          <>
            {ongoing.error && (
              <section className="ax-card ax-col--12">
                <div style={{ padding: "var(--ax-space-4)" }}>
                  <ErrorAlert error={ongoing.error} onRetry={ongoing.reload} />
                </div>
              </section>
            )}
            <OccupancyBoard
              rooms={rooms ?? []}
              ongoing={ongoingStays}
              truncated={ongoing.data?.truncated ?? false}
              clinical={clinical}
              director={director}
              onAddBed={setBedForRoom}
              onAssignBed={setAssignFor}
            />
          </>
        )}
      </div>

      {admitOpen && (
        <AdmitModal
          onClose={() => setAdmitOpen(false)}
          onAdmitted={(id) => {
            setAdmitOpen(false);
            router.push(`/centre/hospitalisation/${id}`);
          }}
        />
      )}

      {roomOpen && (
        <NameModal
          title={ROOM_ADD_LABEL}
          label="Nom de la chambre"
          onClose={() => setRoomOpen(false)}
          onSubmit={async (name) => {
            await createRoom(centerId, name);
            setRoomOpen(false);
            reloadBoard();
          }}
        />
      )}

      {bedForRoom && (
        <NameModal
          title={`${BED_ADD_LABEL} — ${bedForRoom.name}`}
          label="Nom du lit"
          onClose={() => setBedForRoom(null)}
          onSubmit={async (name) => {
            await createBed(centerId, bedForRoom.id, name);
            setBedForRoom(null);
            reloadBoard();
          }}
        />
      )}

      {assignFor && (
        <AssignBedModal
          stay={assignFor}
          onClose={() => setAssignFor(null)}
          onAssigned={() => {
            setAssignFor(null);
            reloadBoard();
          }}
        />
      )}
    </>
  );
}

export default Inpatient;
