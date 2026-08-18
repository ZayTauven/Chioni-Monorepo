'use client';
/*
 * Chioni — /plateforme/centres/[id] : la fiche d'un tenant (S4, ADR 0017).
 *
 * Quatre blocs : identité (lecture seule — le profil du centre reste au
 * directeur, la plateforme décide le KYC, pas l'adresse), compteurs,
 * transitions KYC, pièces justificatives.
 *
 * Le poids de la décision KYC est porté par l'UI et pas seulement par l'API :
 * suspendre ferme le Pont de Confiance ET RIEN D'AUTRE — le centre continue
 * de soigner, de facturer et d'encaisser au guichet. La modale le dit avant
 * le clic, avec le motif obligatoire (il sera lu par le directeur du centre).
 */
import { useState } from 'react';
import type { ApiError } from '@/lib/api';
import { PlatformPageHead } from '@/components/shell-platform/PlatformPageHead';
import {
  createPlatformDirector,
  downloadPlatformKycDocument,
  getPlatformCenter,
  listPlatformKycDocuments,
  setPlatformCenterKyc,
} from '@/lib/endpoints/platform';
import {
  CENTER_TYPE_LABELS,
  ISLAND_LABELS,
  KYC_ACTIVATE_NOTICE,
  KYC_DOC_TYPE_LABELS,
  KYC_STATUS_LABELS,
  KYC_SUSPEND_WARNING,
  SHADOW_ACCOUNT_NOTICE,
  formatDate,
  formatDateTime,
} from '@/lib/labels';
import type { KycStatus, PlatformCenter } from '@/lib/types';
import {
  AvatarChip,
  CardSkeleton,
  DetailItem,
  EmptyState,
  ErrorAlert,
  FieldError,
  IconCheck,
  KYC_TONES,
  Modal,
  Pagination,
  ReadOnlyNotice,
  Ref,
  StatusBadge,
  toApiError,
  useAsync,
  usePlatformRole,
} from './shared';

const DOWNLOAD_ICON = (
  <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2" />
    <path d="M7 11l5 5l5 -5" />
    <path d="M12 4l0 12" />
  </svg>
);

/* ── transitions KYC ── */

/** Les transitions permises par la machine à états du backend. */
function allowedTransitions(current: KycStatus): KycStatus[] {
  if (current === 'en_attente') return ['actif', 'suspendu'];
  if (current === 'actif') return ['suspendu'];
  return ['actif'];
}

function KycTransitionModal({
  center,
  target,
  onClose,
  onDone,
}: {
  center: PlatformCenter;
  target: KycStatus;
  onClose: () => void;
  onDone: (fresh: PlatformCenter) => void;
}) {
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const suspending = target === 'suspendu';

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      const fresh = await setPlatformCenterKyc(center.id, target, reason.trim());
      onDone(fresh);
    } catch (err) {
      setError(toApiError(err));
      setSaving(false);
    }
  };

  return (
    <Modal
      title={suspending ? `Suspendre ${center.name} ?` : `Activer ${center.name} ?`}
      onClose={onClose}
      width={560}
      busy={saving}
      footer={
        <>
          <button type="button" className="ax-btn ax-btn--ghost" onClick={onClose} disabled={saving} data-autofocus="">
            Annuler
          </button>
          <button
            type="submit"
            form="kyc-transition-form"
            className={`ax-btn ${suspending ? 'ax-btn--danger' : 'ax-btn--primary'}`}
            disabled={saving || (suspending && reason.trim().length === 0)}
          >
            {saving
              ? 'Enregistrement…'
              : suspending
                ? 'Suspendre le Pont de Confiance'
                : 'Activer le Pont de Confiance'}
          </button>
        </>
      }
    >
      <form
        id="kyc-transition-form"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}
      >
        {error && error.messages.length > 0 && <ErrorAlert error={error} />}

        <p style={{ margin: 0, fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)', lineHeight: 1.7 }}>
          {suspending ? KYC_SUSPEND_WARNING : KYC_ACTIVATE_NOTICE}
        </p>

        <div className="ax-field">
          <label className="ax-label" htmlFor="kyc-reason">
            Motif{' '}
            {suspending ? (
              <span className="ax-field__required" aria-hidden="true">*</span>
            ) : (
              <span style={{ color: 'var(--ax-text-subtle)', fontWeight: 400 }}>(facultatif)</span>
            )}
          </label>
          <textarea
            id="kyc-reason"
            className={`ax-input${error?.fieldErrors.reason ? ' is-invalid' : ''}`}
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            required={suspending}
            aria-describedby="kyc-reason-help"
          />
          <p id="kyc-reason-help" className="ax-field__message">
            Ce motif est lu par le <b>directeur du centre</b> — et par lui seul. Ni le patient ni
            le tuteur ne le voient jamais. Écrivez ce qu&apos;il doit corriger.
          </p>
          <FieldError error={error} field="reason" />
        </div>
      </form>
    </Modal>
  );
}

/* ── amorçage d'un directeur ── */

function DirectorModal({
  center,
  onClose,
  onDone,
}: {
  center: PlatformCenter;
  onClose: () => void;
  onDone: () => void;
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
      await createPlatformDirector(center.id, {
        phone: phone.trim(),
        first_name: firstName.trim() || undefined,
        last_name: lastName.trim() || undefined,
      });
      onDone();
    } catch (err) {
      setError(toApiError(err));
      setSaving(false);
    }
  };

  return (
    <Modal
      title="Amorcer un directeur"
      onClose={onClose}
      width={520}
      busy={saving}
      footer={
        <>
          <button type="button" className="ax-btn ax-btn--ghost" onClick={onClose} disabled={saving}>
            Annuler
          </button>
          <button type="submit" form="director-form" className="ax-btn ax-btn--primary" disabled={saving}>
            {saving ? 'Création…' : 'Créer le directeur'}
          </button>
        </>
      }
    >
      <form
        id="director-form"
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
          <label className="ax-label" htmlFor="dir-phone">
            Téléphone <span className="ax-field__required" aria-hidden="true">*</span>
          </label>
          <input
            id="dir-phone"
            type="tel"
            inputMode="tel"
            autoComplete="off"
            className={`ax-input${error?.fieldErrors.phone ? ' is-invalid' : ''}`}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+269…"
            required
            data-autofocus=""
          />
          <FieldError error={error} field="phone" />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 'var(--ax-space-4)' }}>
          <div className="ax-field">
            <label className="ax-label" htmlFor="dir-first">Prénom</label>
            <input id="dir-first" type="text" className="ax-input" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            <FieldError error={error} field="first_name" />
          </div>
          <div className="ax-field">
            <label className="ax-label" htmlFor="dir-last">Nom</label>
            <input id="dir-last" type="text" className="ax-input" value={lastName} onChange={(e) => setLastName(e.target.value)} />
            <FieldError error={error} field="last_name" />
          </div>
        </div>
      </form>
    </Modal>
  );
}

/* ── pièces justificatives (lecture + téléchargement authentifié) ── */

function KycDocumentsCard({ centerId }: { centerId: number }) {
  const [page, setPage] = useState(1);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [downloadError, setDownloadError] = useState<ApiError | null>(null);
  const documents = useAsync(() => listPlatformKycDocuments(centerId, page), [centerId, page]);
  const rows = documents.data?.results ?? [];

  const download = async (id: number) => {
    setDownloadingId(id);
    setDownloadError(null);
    try {
      await downloadPlatformKycDocument(centerId, id);
    } catch (err) {
      setDownloadError(toApiError(err));
    }
    setDownloadingId(null);
  };

  return (
    <section className="ax-card ax-col--12" role="region" aria-label="Pièces justificatives">
      <div className="ax-card__header">
        <div className="ax-card__titles">
          <h2 className="ax-card__title">Pièces justificatives</h2>
          <p className="ax-card__subtitle">
            Déposées par le directeur du centre — archivées comprises.
          </p>
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
            title="Aucune pièce déposée"
            message="Le directeur du centre dépose ses pièces depuis « Mon centre » dans son espace. Tant qu'il n'a rien déposé, il n'y a rien à vérifier ici."
          />
        ) : (
          <>
            <ul className="ax-list ax-list--compact">
              {rows.map((doc) => (
                <li key={doc.id} className="ax-list__row">
                  <span className="ax-list__content">
                    <span className="ax-list__title" style={{ fontWeight: 'var(--ax-weight-medium)' }}>
                      {KYC_DOC_TYPE_LABELS[doc.doc_type]}
                    </span>
                    <span style={{ display: 'block', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>
                      Déposée le {formatDate(doc.created_at)}
                      {doc.archived_at ? ` · archivée le ${formatDate(doc.archived_at)}` : ''}
                    </span>
                  </span>
                  <span className="ax-list__trailing" style={{ display: 'flex', gap: 'var(--ax-space-2)', alignItems: 'center' }}>
                    {doc.archived_at && <StatusBadge tone="neutral" label="Archivée" />}
                    <button
                      type="button"
                      className="ax-btn ax-btn--ghost ax-btn--sm"
                      onClick={() => void download(doc.id)}
                      disabled={downloadingId === doc.id}
                      aria-label={`Télécharger ${KYC_DOC_TYPE_LABELS[doc.doc_type]}`}
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
            {documents.data && (
              <Pagination count={documents.data.count} page={page} onPage={setPage} />
            )}
          </>
        )}
      </div>
    </section>
  );
}

/* ── écran ── */

export function PlatformCenterDetail({ centerId }: { centerId: number }) {
  const { canWrite } = usePlatformRole();
  const [patched, setPatched] = useState<PlatformCenter | null>(null);
  const [target, setTarget] = useState<KycStatus | null>(null);
  const [directorOpen, setDirectorOpen] = useState(false);

  const centerState = useAsync(() => getPlatformCenter(centerId), [centerId]);
  const center = patched ?? centerState.data;

  if (centerState.loading && !center) {
    return (
      <>
        <PlatformPageHead title="Centre" trail={[{ label: 'Centres', href: '/plateforme' }, { label: 'Fiche' }]} />
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

  if (!center) {
    return (
      <>
        <PlatformPageHead title="Centre" trail={[{ label: 'Centres', href: '/plateforme' }, { label: 'Fiche' }]} />
        <div className="ax-dash-grid">
          <section className="ax-card ax-col--12">
            <div className="ax-card__body">
              {centerState.error ? (
                <ErrorAlert error={centerState.error} onRetry={centerState.reload} />
              ) : null}
            </div>
          </section>
        </div>
      </>
    );
  }

  const transitions = allowedTransitions(center.kyc_status);

  return (
    <>
      <PlatformPageHead
        title={center.name}
        subtitle={`${CENTER_TYPE_LABELS[center.type]} · ${center.city || 'ville non renseignée'} · ${ISLAND_LABELS[center.island]}`}
        trail={[{ label: 'Centres', href: '/plateforme' }, { label: center.name }]}
      />

      <div className="ax-dash-grid">
        {/* ── identité ── */}
        <section className="ax-card ax-col--7" role="region" aria-label="Identité du centre">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <h2 className="ax-card__title">Identité</h2>
              <p className="ax-card__subtitle">
                Le profil du centre appartient à son directeur — la plateforme décide la
                vérification, pas l&apos;adresse.
              </p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            {/* SV — le logo du centre (exposé par /platform/centers/) : la
                vraie image, ou la pastille d'initiales quand il n'y en a pas.
                Le dire évite de chercher un upload qui n'existe pas ici — le
                logo appartient au directeur, comme le reste du profil. */}
            <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flexWrap: 'nowrap', marginBottom: 'var(--ax-space-4)' }}>
              {center.logo ? (
                // eslint-disable-next-line @next/next/no-img-element -- URL média de l'API, aucun loader Next configuré
                <img
                  src={center.logo}
                  alt=""
                  width={48}
                  height={48}
                  style={{ width: 48, height: 48, borderRadius: 'var(--ax-radius-md)', objectFit: 'cover', flex: '0 0 auto' }}
                />
              ) : (
                <AvatarChip name={center.name} seed={center.id} />
              )}
              <span style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-muted)' }}>
                {center.logo
                  ? 'Logo déposé par le directeur du centre.'
                  : 'Aucun logo déposé — les documents du centre portent ses initiales.'}
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--ax-space-4)' }}>
              <DetailItem label="Nom">{center.name}</DetailItem>
              <DetailItem label="Type">{CENTER_TYPE_LABELS[center.type]}</DetailItem>
              <DetailItem label="Île">{ISLAND_LABELS[center.island]}</DetailItem>
              <DetailItem label="Ville">{center.city || '—'}</DetailItem>
              <DetailItem label="Adresse">{center.address || '—'}</DetailItem>
              <DetailItem label="Téléphone">{center.phone || '—'}</DetailItem>
              <DetailItem label="E-mail">{center.email || '—'}</DetailItem>
              <DetailItem label="Inscrit le">{formatDate(center.created_at)}</DetailItem>
            </div>
          </div>
        </section>

        {/* ── compteurs ── */}
        <section className="ax-card ax-col--5" role="region" aria-label="Compteurs du centre">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <h2 className="ax-card__title">Encadrement</h2>
              <p className="ax-card__subtitle">
                Des compteurs, pas un annuaire&nbsp;: le module Personnel de la plateforme
                viendra plus tard.
              </p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 'var(--ax-space-4)' }}>
              <DetailItem label="Personnel actif">{center.staff_active_count}</DetailItem>
              <DetailItem label="Directeurs actifs">{center.director_active_count}</DetailItem>
              <DetailItem label="Pièces déposées">{center.kyc_document_count}</DetailItem>
            </div>

            {center.director_active_count === 0 && (
              <div className="ax-alert ax-alert--danger" role="note">
                <div className="ax-alert__content">
                  <p className="ax-alert__title">Ce centre n&apos;a plus de directeur</p>
                  <p className="ax-alert__message">
                    Personne ne peut plus gérer le personnel, les tarifs ni les pièces du centre.
                    Amorcez un directeur pour lui rendre son espace.
                  </p>
                </div>
              </div>
            )}

            {canWrite ? (
              <div>
                <button type="button" className="ax-btn ax-btn--secondary ax-btn--sm" onClick={() => setDirectorOpen(true)}>
                  <span className="ax-btn__label">
                    {center.director_active_count === 0 ? 'Amorcer un directeur' : 'Ajouter un directeur'}
                  </span>
                </button>
              </div>
            ) : (
              <ReadOnlyNotice />
            )}
          </div>
        </section>

        {/* ── vérification KYC ── */}
        <section className="ax-card ax-col--12" role="region" aria-label="Vérification du centre">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <h2 className="ax-card__title">Vérification (KYC)</h2>
              <p className="ax-card__subtitle">
                Le seul levier de la plateforme sur ce tenant — il ouvre ou ferme le Pont de
                Confiance, rien d&apos;autre.
              </p>
            </div>
            <StatusBadge tone={KYC_TONES[center.kyc_status]} label={KYC_STATUS_LABELS[center.kyc_status]} />
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--ax-space-4)' }}>
              <DetailItem label="Dernière décision">
                {center.kyc_updated_at ? formatDateTime(center.kyc_updated_at) : 'Aucune décision encore'}
              </DetailItem>
              <DetailItem label="Motif de la dernière décision">
                {center.kyc_reason || '—'}
              </DetailItem>
            </div>

            {canWrite ? (
              <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)', flexWrap: 'wrap' }}>
                {transitions.map((t) => (
                  <button
                    key={t}
                    type="button"
                    className={`ax-btn ${t === 'suspendu' ? 'ax-btn--danger' : 'ax-btn--primary'} ax-btn--sm`}
                    onClick={() => setTarget(t)}
                  >
                    {t === 'actif' && <IconCheck />}
                    <span className="ax-btn__label">
                      {t === 'actif' ? 'Activer le centre' : 'Suspendre le centre'}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <ReadOnlyNotice />
            )}

            <p style={{ margin: 0, fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-muted)', lineHeight: 1.7 }}>
              Référence du tenant&nbsp;: <Ref>centre #{center.id}</Ref>
            </p>
          </div>
        </section>

        <KycDocumentsCard centerId={center.id} />
      </div>

      {target && canWrite && (
        <KycTransitionModal
          center={center}
          target={target}
          onClose={() => setTarget(null)}
          onDone={(fresh) => {
            setPatched(fresh);
            setTarget(null);
          }}
        />
      )}
      {directorOpen && canWrite && (
        <DirectorModal
          center={center}
          onClose={() => setDirectorOpen(false)}
          onDone={() => {
            setDirectorOpen(false);
            setPatched(null);
            centerState.reload();
          }}
        />
      )}
    </>
  );
}

export default PlatformCenterDetail;
