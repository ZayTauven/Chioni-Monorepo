'use client';
/*
 * Chioni — /plateforme/pharmacies/[id] : la fiche d'une officine (S9, ADR 0022).
 *
 * ─── L'ordre des blocs EST la décision de conception ──────────────────────
 *
 * Identité (lecture seule) → compteurs → **PIÈCES JUSTIFICATIVES** → décision.
 *
 * Les pièces viennent **avant** le bouton de validation, et c'est délibéré :
 * la validation est le seul vrai pouvoir de ce module — elle ouvre la
 * réception des demandes, c'est-à-dire la circulation de listes de médicaments
 * vers un tiers. **Valider une officine sans avoir lu sa licence est du
 * théâtre.** Mettre la décision en haut de page l'aurait rendue accessible
 * sans avoir jamais fait défiler jusqu'aux preuves.
 *
 * ─── Ce que la plateforme ne fait PAS ─────────────────────────────────────
 *
 * Elle ne corrige pas la devanture : nom, adresse et téléphone appartiennent à
 * l'officine (`PATCH /pharmacy/{p}/` depuis son espace). Même partage qu'avec
 * les centres — la plateforme décide le statut, pas l'adresse.
 *
 * Elle ne lit **aucun médicament** : `received_request_count` est un compteur,
 * et il n'ouvre sur rien. Superviser des officines n'est pas lire les
 * ordonnances du pays.
 *
 * ─── Les trois transitions, et leurs trois tons ───────────────────────────
 *
 * `validee` (ouvre la réception), `suspendue` (motif OBLIGATOIRE, et la modale
 * dit ce qui CONTINUE avant ce qui est fermé), `en_attente` — le retour en
 * examen, qui n'est **pas une sanction** : « je revérifie » n'est pas « je
 * sanctionne », le motif y reste facultatif, et le bouton n'est pas rouge.
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PlatformPageHead } from '@/components/shell-platform/PlatformPageHead';
import type { ApiError } from '@/lib/api';
import {
  createPlatformPharmacyMember,
  downloadPlatformPharmacyDocument,
  getPlatformPharmacy,
  listPlatformPharmacyDocuments,
  setPlatformPharmacyStatus,
} from '@/lib/endpoints/pharmacy';
import {
  ISLAND_LABELS,
  PHARMACY_ADDRESS_LABEL,
  PHARMACY_CITY_LABEL,
  PHARMACY_DOC_TYPE_LABELS,
  PHARMACY_EMAIL_LABEL,
  PHARMACY_ISLAND_LABEL,
  PHARMACY_NAME_LABEL,
  PHARMACY_PHONE_LABEL,
  PHARMACY_STATUS_LABELS,
  PLATFORM_PHARMACIES_TITLE,
  PLATFORM_PHARMACY_DECISION_SUBTITLE,
  PLATFORM_PHARMACY_DECISION_TITLE,
  PLATFORM_PHARMACY_DOCS_EMPTY_MESSAGE,
  PLATFORM_PHARMACY_DOCS_EMPTY_TITLE,
  PLATFORM_PHARMACY_DOCS_LABEL,
  PLATFORM_PHARMACY_DOCS_SUBTITLE,
  PLATFORM_PHARMACY_DOCS_TITLE,
  PLATFORM_PHARMACY_MEMBERS_LABEL,
  PLATFORM_PHARMACY_MEMBER_ADD,
  PLATFORM_PHARMACY_MEMBER_ADD_MORE,
  PLATFORM_PHARMACY_NO_MEMBER_MESSAGE,
  PLATFORM_PHARMACY_NO_MEMBER_TITLE,
  PLATFORM_PHARMACY_REASON_HELP,
  PLATFORM_PHARMACY_REQUESTS_HINT,
  PLATFORM_PHARMACY_REQUESTS_LABEL,
  PLATFORM_PHARMACY_REVIEW,
  PLATFORM_PHARMACY_REVIEW_NOTICE,
  PLATFORM_PHARMACY_SEPARATION_HINT,
  PLATFORM_PHARMACY_SUSPEND,
  PLATFORM_PHARMACY_SUSPEND_WARNING,
  PLATFORM_PHARMACY_VALIDATE,
  PLATFORM_PHARMACY_VALIDATE_NOTICE,
  PHARMACY_DOC_ARCHIVED,
  SHADOW_ACCOUNT_NOTICE,
  formatDate,
  formatDateTime,
  pharmacyDocDeposited,
  platformPharmacyMemberAdded,
  platformPharmacyStatusChanged,
} from '@/lib/labels';
import type { PharmacyStatus, PlatformPharmacy } from '@/lib/types';
import {
  CardSkeleton,
  DetailItem,
  EmptyState,
  ErrorAlert,
  FieldError,
  IconCheck,
  Modal,
  PHARMACY_TONES,
  ReadOnlyNotice,
  Ref,
  StatusBadge,
  toApiError,
  useAsync,
  usePlatformRole,
  useScopedState,
} from './shared';

const DOWNLOAD_ICON = (
  <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2" />
    <path d="M7 11l5 5l5 -5" />
    <path d="M12 4l0 12" />
  </svg>
);

/** Les transitions permises par la machine à états du backend. */
function allowedTransitions(current: PharmacyStatus): PharmacyStatus[] {
  if (current === 'en_attente') return ['validee', 'suspendue'];
  if (current === 'validee') return ['suspendue', 'en_attente'];
  return ['validee'];
}

const TRANSITION_LABELS: Record<PharmacyStatus, string> = {
  validee: PLATFORM_PHARMACY_VALIDATE,
  suspendue: PLATFORM_PHARMACY_SUSPEND,
  en_attente: PLATFORM_PHARMACY_REVIEW,
};

const TRANSITION_NOTICES: Record<PharmacyStatus, string> = {
  validee: PLATFORM_PHARMACY_VALIDATE_NOTICE,
  suspendue: PLATFORM_PHARMACY_SUSPEND_WARNING,
  en_attente: PLATFORM_PHARMACY_REVIEW_NOTICE,
};

function StatusModal({
  pharmacy,
  target,
  onClose,
  onDone,
}: {
  pharmacy: PlatformPharmacy;
  target: PharmacyStatus;
  onClose: () => void;
  onDone: (fresh: PlatformPharmacy) => void;
}) {
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const suspending = target === 'suspendue';

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      const fresh = await setPlatformPharmacyStatus(pharmacy.id, target, reason.trim());
      onDone(fresh);
    } catch (err) {
      setError(toApiError(err));
      setSaving(false);
    }
  };

  return (
    <Modal
      title={`${TRANSITION_LABELS[target]} — ${pharmacy.name}`}
      onClose={onClose}
      width={560}
      /* Geste irréversible dans ses effets (des SMS partent, ou cessent) : la
         modale n'est pas quittable en vol (correctif guardian S4). */
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
            Annuler
          </button>
          <button
            type="submit"
            form="pharmacy-status-form"
            className={`ax-btn ${suspending ? 'ax-btn--danger' : 'ax-btn--primary'}`}
            disabled={saving || (suspending && reason.trim().length === 0)}
          >
            {saving ? 'Enregistrement…' : TRANSITION_LABELS[target]}
          </button>
        </>
      }
    >
      <form
        id="pharmacy-status-form"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}
      >
        {error && error.messages.length > 0 && <ErrorAlert error={error} />}

        <p style={{ margin: 0, fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)', lineHeight: 1.7 }}>
          {TRANSITION_NOTICES[target]}
        </p>

        <div className="ax-field">
          <label className="ax-label" htmlFor="pharmacy-reason">
            Motif{' '}
            {suspending ? (
              <span className="ax-field__required" aria-hidden="true">*</span>
            ) : (
              <span style={{ color: 'var(--ax-text-muted)', fontWeight: 400 }}>(facultatif)</span>
            )}
          </label>
          <textarea
            id="pharmacy-reason"
            className={`ax-textarea${error?.fieldErrors.reason ? ' is-invalid' : ''}`}
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            required={suspending}
            aria-describedby="pharmacy-reason-help"
          />
          {/* Le motif est LU PAR L'OFFICINE : une consigne actionnable, jamais
              une note interne. Miroir exact du `kyc_reason` d'un centre. */}
          <p id="pharmacy-reason-help" className="ax-field__message">
            {PLATFORM_PHARMACY_REASON_HELP}
          </p>
          <FieldError error={error} field="reason" />
        </div>
      </form>
    </Modal>
  );
}

function MemberModal({
  pharmacy,
  onClose,
  onDone,
}: {
  pharmacy: PlatformPharmacy;
  onClose: () => void;
  onDone: (name: string) => void;
}) {
  const [phone, setPhone] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      const member = await createPlatformPharmacyMember(pharmacy.id, {
        phone: phone.trim(),
        first_name: firstName.trim(),
        last_name: lastName.trim(),
      });
      onDone(member.display_name);
    } catch (err) {
      setError(toApiError(err));
      setSaving(false);
    }
  };

  return (
    <Modal
      title={PLATFORM_PHARMACY_MEMBER_ADD}
      onClose={onClose}
      width={520}
      busy={saving}
      footer={
        <>
          <button type="button" className="ax-btn ax-btn--ghost" onClick={onClose} disabled={saving}>
            Annuler
          </button>
          <button
            type="submit"
            form="pharmacy-member-form"
            className="ax-btn ax-btn--primary"
            disabled={saving || phone.trim() === ''}
          >
            {saving ? 'Création…' : 'Créer la personne'}
          </button>
        </>
      }
    >
      <form
        id="pharmacy-member-form"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}
      >
        {error && error.messages.length > 0 && <ErrorAlert error={error} />}

        <p style={{ margin: 0, fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)', lineHeight: 1.7 }}>
          {SHADOW_ACCOUNT_NOTICE}
        </p>

        <div className="ax-field">
          <label className="ax-label" htmlFor="pm-plat-phone">
            Téléphone <span className="ax-field__required" aria-hidden="true">*</span>
          </label>
          <input
            id="pm-plat-phone"
            type="tel"
            inputMode="tel"
            className={`ax-input${error?.fieldErrors.phone ? ' is-invalid' : ''}`}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+269…"
            required
            autoComplete="off"
            data-autofocus=""
          />
          <FieldError error={error} field="phone" />
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
            gap: 'var(--ax-space-4)',
          }}
        >
          <div className="ax-field">
            <label className="ax-label" htmlFor="pm-plat-first">Prénom</label>
            <input
              id="pm-plat-first"
              type="text"
              className="ax-input"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              autoComplete="off"
            />
            <FieldError error={error} field="first_name" />
          </div>
          <div className="ax-field">
            <label className="ax-label" htmlFor="pm-plat-last">Nom</label>
            <input
              id="pm-plat-last"
              type="text"
              className="ax-input"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              autoComplete="off"
            />
            <FieldError error={error} field="last_name" />
          </div>
        </div>

        <p style={{ margin: 0, fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-muted)', lineHeight: 1.7 }}>
          {PLATFORM_PHARMACY_SEPARATION_HINT}
        </p>
      </form>
    </Modal>
  );
}

/** Les pièces — montées AVANT le bloc de décision, et c'est l'essentiel. */
function DocumentsCard({ pharmacyId }: { pharmacyId: number }) {
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [downloadError, setDownloadError] = useState<ApiError | null>(null);
  const documents = useAsync(() => listPlatformPharmacyDocuments(pharmacyId), [pharmacyId]);
  const rows = documents.data ?? [];

  const download = async (id: number) => {
    setDownloadingId(id);
    setDownloadError(null);
    try {
      await downloadPlatformPharmacyDocument(pharmacyId, id);
    } catch (err) {
      setDownloadError(toApiError(err));
    }
    setDownloadingId(null);
  };

  return (
    <section className="ax-card ax-col--12" role="region" aria-label={PLATFORM_PHARMACY_DOCS_TITLE}>
      <div className="ax-card__header">
        <div className="ax-card__titles">
          <h2 className="ax-card__title">{PLATFORM_PHARMACY_DOCS_TITLE}</h2>
          <p className="ax-card__subtitle">{PLATFORM_PHARMACY_DOCS_SUBTITLE}</p>
        </div>
      </div>
      <div className="ax-card__body" style={{ paddingTop: 0 }}>
        {downloadError && <ErrorAlert error={downloadError} />}
        {documents.loading ? (
          <CardSkeleton lines={3} />
        ) : documents.error ? (
          <ErrorAlert error={documents.error} onRetry={documents.reload} />
        ) : rows.length === 0 ? (
          <EmptyState
            title={PLATFORM_PHARMACY_DOCS_EMPTY_TITLE}
            message={PLATFORM_PHARMACY_DOCS_EMPTY_MESSAGE}
          />
        ) : (
          <ul className="ax-list ax-list--compact">
            {rows.map((doc) => (
              <li key={doc.id} className="ax-list__row">
                <span className="ax-list__content">
                  <span className="ax-list__title" style={{ fontWeight: 'var(--ax-weight-medium)' }}>
                    {PHARMACY_DOC_TYPE_LABELS[doc.doc_type]}
                  </span>
                  <span
                    style={{
                      display: 'block',
                      fontSize: 'var(--ax-text-xs)',
                      color: 'var(--ax-text-muted)',
                    }}
                  >
                    {pharmacyDocDeposited(doc.created_at)}
                    {doc.archived_at ? ` · archivée le ${formatDate(doc.archived_at)}` : ''}
                  </span>
                </span>
                <span
                  className="ax-list__trailing"
                  style={{ display: 'flex', gap: 'var(--ax-space-2)', alignItems: 'center' }}
                >
                  {doc.archived_at && (
                    <StatusBadge tone="neutral" label={PHARMACY_DOC_ARCHIVED} />
                  )}
                  <button
                    type="button"
                    className="ax-btn ax-btn--ghost ax-btn--sm"
                    onClick={() => void download(doc.id)}
                    disabled={downloadingId === doc.id}
                    aria-label={`Télécharger ${PHARMACY_DOC_TYPE_LABELS[doc.doc_type]}`}
                  >
                    {DOWNLOAD_ICON}
                    <span className="ax-btn__label">
                      {downloadingId === doc.id ? 'Téléchargement…' : 'Télécharger'}
                    </span>
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

export function PlatformPharmacyDetail({ pharmacyId }: { pharmacyId: number }) {
  const { canWrite } = usePlatformRole();

  /* Portée : l'officine de la ROUTE (guardian S9). Deux fiches d'officine
     partagent la même route dynamique : sans elle, un aller-retour navigateur
     entre deux d'entre elles laissait la fiche — et le message « Officine
     validée » — de la PRÉCÉDENTE sous le nom de la suivante, sur l'écran qui
     porte le seul vrai pouvoir du module. */
  const scope = String(pharmacyId);
  const [patched, setPatched] = useScopedState<PlatformPharmacy>(scope);
  const [flash, setFlash] = useScopedState<string>(scope);
  const [target, setTarget] = useState<PharmacyStatus | null>(null);
  const [memberOpen, setMemberOpen] = useState(false);

  /* Une décision de statut en attente de confirmation vise l'officine sous
     laquelle la modale a été ouverte : elle s'annule, elle ne se transporte
     pas — valider ou suspendre la mauvaise officine se paie en SMS. */
  useEffect(() => {
    setTarget(null);
    setMemberOpen(false);
  }, [pharmacyId]);

  const state = useAsync(() => getPlatformPharmacy(pharmacyId), [pharmacyId]);
  const pharmacy = patched ?? state.data;

  const trail = [
    { label: PLATFORM_PHARMACIES_TITLE, href: '/plateforme/pharmacies' },
    { label: pharmacy?.name ?? 'Officine' },
  ];

  if (state.loading && !pharmacy) {
    return (
      <>
        <PlatformPageHead title="Officine" trail={trail} />
        <div className="ax-dash-grid">
          <section className="ax-card ax-col--12">
            <div className="ax-card__body">
              <CardSkeleton lines={6} />
            </div>
          </section>
        </div>
      </>
    );
  }

  if (!pharmacy) {
    return (
      <>
        <PlatformPageHead title="Officine" trail={trail} />
        <div className="ax-dash-grid">
          <section className="ax-card ax-col--12">
            <div className="ax-card__body">
              {state.error && <ErrorAlert error={state.error} onRetry={state.reload} />}
            </div>
          </section>
        </div>
      </>
    );
  }

  const transitions = allowedTransitions(pharmacy.status);

  return (
    <>
      <PlatformPageHead
        title={pharmacy.name}
        subtitle={`${pharmacy.city || 'commune non renseignée'} · ${ISLAND_LABELS[pharmacy.island]}`}
        trail={trail}
        actions={
          <Link className="ax-btn ax-btn--ghost" href="/plateforme/pharmacies">
            <span className="ax-btn__label">{PLATFORM_PHARMACIES_TITLE}</span>
          </Link>
        }
      />

      <div className="ax-dash-grid">
        {flash && (
          <div className="ax-col--12">
            <div className="ax-alert ax-alert--success" role="status">
              <div className="ax-alert__content">
                <p className="ax-alert__message">{flash}</p>
              </div>
            </div>
          </div>
        )}

        {/* ── identité (lecture seule) ── */}
        <section className="ax-card ax-col--7" role="region" aria-label="Identité de l'officine">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <h2 className="ax-card__title">Identité</h2>
              <p className="ax-card__subtitle">
                La devanture appartient à l&rsquo;officine — la plateforme décide la
                vérification, pas l&rsquo;adresse.
              </p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: 'var(--ax-space-4)',
              }}
            >
              <DetailItem label={PHARMACY_NAME_LABEL}>{pharmacy.name}</DetailItem>
              <DetailItem label={PHARMACY_ISLAND_LABEL}>{ISLAND_LABELS[pharmacy.island]}</DetailItem>
              <DetailItem label={PHARMACY_CITY_LABEL}>{pharmacy.city || '—'}</DetailItem>
              <DetailItem label={PHARMACY_ADDRESS_LABEL}>{pharmacy.address || '—'}</DetailItem>
              <DetailItem label={PHARMACY_PHONE_LABEL}>{pharmacy.phone || '—'}</DetailItem>
              <DetailItem label={PHARMACY_EMAIL_LABEL}>{pharmacy.email || '—'}</DetailItem>
              <DetailItem label="Enregistrée le">{formatDate(pharmacy.created_at)}</DetailItem>
            </div>
          </div>
        </section>

        {/* ── compteurs ── */}
        <section className="ax-card ax-col--5" role="region" aria-label="Compteurs de l'officine">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <h2 className="ax-card__title">Activité</h2>
              <p className="ax-card__subtitle">
                Des compteurs, pas un annuaire — ni des personnes, ni des médicaments.
              </p>
            </div>
          </div>
          <div
            className="ax-card__body"
            style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                gap: 'var(--ax-space-4)',
              }}
            >
              <DetailItem label={PLATFORM_PHARMACY_MEMBERS_LABEL}>
                {pharmacy.member_active_count}
              </DetailItem>
              <DetailItem label={PLATFORM_PHARMACY_DOCS_LABEL}>{pharmacy.document_count}</DetailItem>
              <DetailItem label={PLATFORM_PHARMACY_REQUESTS_LABEL}>
                {pharmacy.received_request_count}
              </DetailItem>
            </div>

            <p style={{ margin: 0, fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-muted)', lineHeight: 1.7 }}>
              {PLATFORM_PHARMACY_REQUESTS_HINT}
            </p>

            {/* Une officine sans personne est une boîte que plus personne ne
                relève — et personne ne peut plus s'y inscrire : le chemin de
                secours est ici. */}
            {pharmacy.member_active_count === 0 && (
              <div className="ax-alert ax-alert--warning" role="note">
                <div className="ax-alert__content">
                  <p className="ax-alert__title">{PLATFORM_PHARMACY_NO_MEMBER_TITLE}</p>
                  <p className="ax-alert__message" style={{ lineHeight: 1.7 }}>
                    {PLATFORM_PHARMACY_NO_MEMBER_MESSAGE}
                  </p>
                </div>
              </div>
            )}

            {canWrite ? (
              <div>
                <button
                  type="button"
                  className="ax-btn ax-btn--secondary ax-btn--sm"
                  onClick={() => setMemberOpen(true)}
                >
                  <span className="ax-btn__label">
                    {pharmacy.member_active_count === 0
                      ? PLATFORM_PHARMACY_MEMBER_ADD
                      : PLATFORM_PHARMACY_MEMBER_ADD_MORE}
                  </span>
                </button>
              </div>
            ) : (
              <ReadOnlyNotice />
            )}
          </div>
        </section>

        {/* ── LES PIÈCES, AVANT LA DÉCISION ── */}
        <DocumentsCard pharmacyId={pharmacy.id} />

        {/* ── la décision ── */}
        <section className="ax-card ax-col--12" role="region" aria-label={PLATFORM_PHARMACY_DECISION_TITLE}>
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <h2 className="ax-card__title">{PLATFORM_PHARMACY_DECISION_TITLE}</h2>
              <p className="ax-card__subtitle">{PLATFORM_PHARMACY_DECISION_SUBTITLE}</p>
            </div>
            <StatusBadge
              tone={PHARMACY_TONES[pharmacy.status]}
              label={PHARMACY_STATUS_LABELS[pharmacy.status]}
            />
          </div>
          <div
            className="ax-card__body"
            style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: 'var(--ax-space-4)',
              }}
            >
              <DetailItem label="Dernière décision">
                {pharmacy.status_updated_at
                  ? formatDateTime(pharmacy.status_updated_at)
                  : 'Aucune décision encore'}
              </DetailItem>
              <DetailItem label="Motif de la dernière décision">
                {pharmacy.status_reason || '—'}
              </DetailItem>
            </div>

            {canWrite ? (
              <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)', flexWrap: 'wrap' }}>
                {transitions.map((t) => (
                  <button
                    key={t}
                    type="button"
                    /* Seule la SUSPENSION est rouge. « Remettre en examen »
                       n'est pas une sanction — la peindre en danger
                       découragerait une gradation utile. */
                    className={`ax-btn ${t === 'suspendue' ? 'ax-btn--danger' : t === 'validee' ? 'ax-btn--primary' : 'ax-btn--secondary'} ax-btn--sm`}
                    onClick={() => setTarget(t)}
                  >
                    {t === 'validee' && <IconCheck />}
                    <span className="ax-btn__label">{TRANSITION_LABELS[t]}</span>
                  </button>
                ))}
              </div>
            ) : (
              <ReadOnlyNotice />
            )}

            <p style={{ margin: 0, fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-muted)', lineHeight: 1.7 }}>
              Référence de l&rsquo;officine&nbsp;: <Ref>pharmacie #{pharmacy.id}</Ref>
            </p>
          </div>
        </section>
      </div>

      {target && canWrite && (
        <StatusModal
          pharmacy={pharmacy}
          target={target}
          onClose={() => setTarget(null)}
          onDone={(fresh) => {
            setPatched(fresh);
            setTarget(null);
            setFlash(platformPharmacyStatusChanged(fresh.status));
          }}
        />
      )}
      {memberOpen && canWrite && (
        <MemberModal
          pharmacy={pharmacy}
          onClose={() => setMemberOpen(false)}
          onDone={(name) => {
            setMemberOpen(false);
            setFlash(platformPharmacyMemberAdded(name));
            setPatched(null);
            state.reload();
          }}
        />
      )}
    </>
  );
}

export default PlatformPharmacyDetail;
