'use client';
/*
 * Chioni — /plateforme/effacements : la file RGPD (S4 lot 3, ADR 0017 déc. 7).
 *
 * Lecture `support` + `admin` (« où en est ma demande ? » est un geste de
 * support) ; exécution `admin` SEUL — l'anonymisation est irréversible et le
 * refus est un acte juridique. Les commandes d'écriture ne sont donc pas
 * MONTÉES pour un `support` (patron du bloc finances du dashboard centre).
 *
 * Deux exigences produit portées ici :
 * 1. les `blockers` s'affichent AVANT le bouton — on ne découvre pas un refus
 *    au clic, et le bouton « Anonymiser » n'est pas proposé tant qu'il en
 *    reste un (l'API refuserait, et la demande resterait « en attente ») ;
 * 2. la confirmation écrit noir sur blanc ce que l'anonymisation fait ET ce
 *    qu'elle ne fait pas (le carnet de santé reste, il devient orphelin
 *    d'identité).
 *
 * Aucune PII ici : l'objet gouverné EST une personne, et l'exploitant ne voit
 * qu'un identifiant de compte, des casquettes en booléens et des codes.
 */
import { useState, type ReactNode } from 'react';
import type { ApiError } from '@/lib/api';
import { PlatformPageHead } from '@/components/shell-platform/PlatformPageHead';
import { listErasureRequests, processErasureRequest } from '@/lib/endpoints/platform';
import {
  ERASURE_BLOCKER_LABELS,
  ERASURE_COPY,
  ERASURE_EFFECTS_OPERATOR,
  ERASURE_HAT_LABELS,
  ERASURE_KEPT_OPERATOR,
  ERASURE_STATUS_LABELS,
  formatDateTime,
} from '@/lib/labels';
import type { ErasureStatus, PlatformErasureRequest } from '@/lib/types';
import {
  EmptyState,
  ErrorAlert,
  FieldError,
  Modal,
  Pagination,
  ReadOnlyNotice,
  Ref,
  StatusBadge,
  TableSkeleton,
  toApiError,
  useAsync,
  usePlatformRole,
  type BadgeTone,
} from './shared';

const STATUS_TONES: Record<ErasureStatus, BadgeTone> = {
  en_attente: 'warning',
  traitee: 'success',
  refusee: 'neutral',
};

const STATUS_FILTERS: Array<{ value: '' | ErasureStatus; label: string }> = [
  { value: '', label: 'Toutes les demandes' },
  { value: 'en_attente', label: ERASURE_STATUS_LABELS.en_attente },
  { value: 'traitee', label: ERASURE_STATUS_LABELS.traitee },
  { value: 'refusee', label: ERASURE_STATUS_LABELS.refusee },
];

const HAT_KEYS = Object.keys(ERASURE_HAT_LABELS) as Array<keyof typeof ERASURE_HAT_LABELS>;

/** Bloc titré d'une modale de décision : un intitulé, une liste, rien d'autre. */
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <p
        style={{
          margin: '0 0 var(--ax-space-1)',
          fontSize: 'var(--ax-text-xs)',
          textTransform: 'uppercase',
          letterSpacing: '.04em',
          color: 'var(--ax-text-muted)',
        }}
      >
        {title}
      </p>
      <ul style={{ margin: 0, paddingInlineStart: 'var(--ax-space-5)', display: 'flex', flexDirection: 'column', gap: 4 }}>
        {children}
      </ul>
    </div>
  );
}

/* ── confirmation d'anonymisation ── */

function AnonymizeModal({
  request,
  onClose,
  onDone,
}: {
  request: PlatformErasureRequest;
  onClose: () => void;
  onDone: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const hats = HAT_KEYS.filter((key) => request.hats[key]);

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      await processErasureRequest(request.id, 'anonymiser');
      onDone();
    } catch (err) {
      setError(toApiError(err));
      setSaving(false);
    }
  };

  return (
    <Modal
      title={`Anonymiser le compte n° ${request.user} ?`}
      onClose={onClose}
      width={560}
      busy={saving}
      footer={
        <>
          <button type="button" className="ax-btn ax-btn--ghost" onClick={onClose} disabled={saving} data-autofocus="">
            Annuler
          </button>
          <button type="button" className="ax-btn ax-btn--danger" onClick={() => void submit()} disabled={saving}>
            {saving ? 'Anonymisation…' : 'Anonymiser définitivement'}
          </button>
        </>
      }
    >
      {error && <ErrorAlert error={error} />}
      <p style={{ margin: 0, fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)', lineHeight: 1.7 }}>
        Ce geste est <b>irréversible</b>&nbsp;: il n&apos;y aura plus rien à restaurer, et aucun
        délai de grâce n&apos;est prévu.
      </p>

      {/* Les casquettes sont rappelées ICI, au point de décision — les lire
          sur la ligne puis les oublier en ouvrant la modale est exactement le
          mode d'erreur que la vigilance de l'ADR 0017 (lot 3) décrit. */}
      {hats.length > 0 && (
        <Section title="Ce que ce compte porte">
          <li style={{ fontSize: 'var(--ax-text-sm)' }}>
            {hats.map((key) => ERASURE_HAT_LABELS[key]).join(' · ')}
          </li>
        </Section>
      )}

      <Section title="Ce qui est effacé">
        {ERASURE_EFFECTS_OPERATOR.map((line) => (
          <li key={line} style={{ fontSize: 'var(--ax-text-sm)' }}>
            {line}
          </li>
        ))}
      </Section>

      <Section title="Ce qui reste, et pourquoi">
        {ERASURE_KEPT_OPERATOR.map((line) => (
          <li key={line} style={{ fontSize: 'var(--ax-text-sm)' }}>
            {line}
          </li>
        ))}
      </Section>

      {/* Sans numéro, volontairement : la pierre tombale du centre est
          numérotée avec l'identifiant du DOSSIER PATIENT, que la plateforme
          ne connaît pas et ne doit pas connaître (invariant du sprint).
          Afficher ici le n° de compte donnait une correspondance fausse. */}
      <p style={{ margin: 0, fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-muted)', lineHeight: 1.6 }}>
        Dans les listes des centres, la personne apparaîtra sous «&nbsp;Patient
        anonymisé&nbsp;» — jamais une ligne blanche qui ressemblerait à un bug.
      </p>
    </Modal>
  );
}

/* ── refus motivé ── */

function RefuseModal({
  request,
  onClose,
  onDone,
}: {
  request: PlatformErasureRequest;
  onClose: () => void;
  onDone: () => void;
}) {
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      await processErasureRequest(request.id, 'refuser', reason.trim());
      onDone();
    } catch (err) {
      setError(toApiError(err));
      setSaving(false);
    }
  };

  return (
    <Modal
      title={`Refuser la demande n° ${request.id} ?`}
      onClose={onClose}
      width={560}
      busy={saving}
      footer={
        <>
          <button type="button" className="ax-btn ax-btn--ghost" onClick={onClose} disabled={saving}>
            Annuler
          </button>
          <button
            type="submit"
            form="erasure-refuse-form"
            className="ax-btn ax-btn--primary"
            disabled={saving || reason.trim().length === 0}
          >
            {saving ? 'Enregistrement…' : 'Refuser et expliquer'}
          </button>
        </>
      }
    >
      <form
        id="erasure-refuse-form"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}
      >
        {error && error.messages.length > 0 && <ErrorAlert error={error} />}

        <p style={{ margin: 0, fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)', lineHeight: 1.7 }}>
          Refuser un effacement oblige à en expliquer la raison. <b>Ce texte est lu par la
          personne concernée</b> dans son espace — écrivez-le pour elle, pas pour un dossier
          interne.
        </p>

        <div className="ax-field">
          <label className="ax-label" htmlFor="erasure-reason">
            Motif du refus <span className="ax-field__required" aria-hidden="true">*</span>
          </label>
          <textarea
            id="erasure-reason"
            className={`ax-input${error?.fieldErrors.refusal_reason ? ' is-invalid' : ''}`}
            rows={4}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            required
            data-autofocus=""
          />
          <FieldError error={error} field="refusal_reason" />
        </div>

        <p style={{ margin: 0, fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)', lineHeight: 1.6 }}>
          Après un refus, la personne peut déposer une nouvelle demande.
        </p>
      </form>
    </Modal>
  );
}

/* ── une ligne de la file ── */

function RequestCard({
  request,
  canWrite,
  onAnonymize,
  onRefuse,
}: {
  request: PlatformErasureRequest;
  canWrite: boolean;
  onAnonymize: () => void;
  onRefuse: () => void;
}) {
  const hats = HAT_KEYS.filter((key) => request.hats[key]);
  const pending = request.status === 'en_attente';
  const blocked = request.blockers.length > 0;

  return (
    <li className="ax-list__row" style={{ alignItems: 'flex-start', gap: 'var(--ax-space-4)' }}>
      <div className="ax-list__content" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-2)' }}>
        <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flexWrap: 'wrap', alignItems: 'center' }}>
          <span className="ax-list__title" style={{ fontWeight: 'var(--ax-weight-medium)' }}>
            Demande n° {request.id}
          </span>
          <StatusBadge tone={STATUS_TONES[request.status]} label={ERASURE_STATUS_LABELS[request.status]} />
          <Ref>compte #{request.user}</Ref>
        </div>

        <p style={{ margin: 0, fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-muted)' }}>
          Déposée le {formatDateTime(request.requested_at)}
          {request.processed_at ? ` · traitée le ${formatDateTime(request.processed_at)}` : ''}
        </p>

        {hats.length > 0 && (
          <p style={{ margin: 0, fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-muted)' }}>
            Ce compte est&nbsp;: {hats.map((key) => ERASURE_HAT_LABELS[key]).join(' · ')}
          </p>
        )}

        {request.status === 'refusee' && request.refusal_reason && (
          <p
            style={{
              margin: 0,
              fontSize: 'var(--ax-text-sm)',
              color: 'var(--ax-text)',
              borderInlineStart: '2px solid var(--ax-border-strong)',
              paddingInlineStart: 'var(--ax-space-3)',
            }}
          >
            Motif communiqué à la personne&nbsp;: {request.refusal_reason}
          </p>
        )}

        {pending && blocked && (
          <div className="ax-alert ax-alert--warning" role="status">
            <div className="ax-alert__content">
              <p className="ax-alert__title">Cet effacement ne peut pas encore être exécuté</p>
              <ul style={{ margin: 'var(--ax-space-1) 0 0', paddingInlineStart: 'var(--ax-space-5)' }}>
                {request.blockers.map((code) => (
                  <li key={code} style={{ fontSize: 'var(--ax-text-sm)' }}>
                    {ERASURE_BLOCKER_LABELS[code]}
                  </li>
                ))}
              </ul>
              <p className="ax-alert__message" style={{ marginTop: 'var(--ax-space-1)' }}>
                La demande reste en attente&nbsp;: la personne n&apos;aura pas à la redéposer une
                fois l&apos;obstacle levé.
              </p>
            </div>
          </div>
        )}
      </div>

      {canWrite && pending && (
        <div className="ax-list__trailing" style={{ display: 'flex', gap: 'var(--ax-space-2)', flexWrap: 'wrap' }}>
          {/* Le bouton d'anonymisation n'est PAS monté tant qu'un blocage
              existe : l'API le refuserait, et proposer une action qui échoue
              apprend à un exploitant à se méfier de son outil. */}
          {!blocked && (
            <button type="button" className="ax-btn ax-btn--danger ax-btn--sm" onClick={onAnonymize}>
              <span className="ax-btn__label">Anonymiser</span>
            </button>
          )}
          <button type="button" className="ax-btn ax-btn--secondary ax-btn--sm" onClick={onRefuse}>
            <span className="ax-btn__label">Refuser</span>
          </button>
        </div>
      )}
    </li>
  );
}

/* ── écran ── */

export function PlatformErasureRequests() {
  const { canWrite } = usePlatformRole();
  const [status, setStatus] = useState<'' | ErasureStatus>('en_attente');
  const [page, setPage] = useState(1);
  const [anonymizing, setAnonymizing] = useState<PlatformErasureRequest | null>(null);
  const [refusing, setRefusing] = useState<PlatformErasureRequest | null>(null);

  const requests = useAsync(
    () => listErasureRequests(status || undefined, page),
    [status, page],
  );
  const rows = requests.data?.results ?? [];

  return (
    <>
      <PlatformPageHead
        title="Demandes d'effacement"
        subtitle="Le droit à l'effacement, exercé depuis un espace Chioni et exécuté ici."
      />

      <div className="ax-dash-grid">
        <section className="ax-card ax-col--12" role="region" aria-label="File des demandes d'effacement">
          <div className="ax-card__body" style={{ paddingBottom: 'var(--ax-space-3)', display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-3)' }}>
            <div className="ax-field" style={{ maxWidth: 260 }}>
              <label className="ax-label" htmlFor="er-status">Statut</label>
              <select
                id="er-status"
                className="ax-select ax-select--sm"
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value as '' | ErasureStatus);
                  setPage(1);
                }}
              >
                {STATUS_FILTERS.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>
            {!canWrite && <ReadOnlyNotice />}
          </div>

          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            {requests.loading ? (
              <TableSkeleton rows={4} cols={3} />
            ) : requests.error ? (
              <ErrorAlert error={requests.error} onRetry={requests.reload} />
            ) : rows.length === 0 ? (
              <EmptyState
                title={status === 'en_attente' ? 'Aucune demande en attente' : 'Aucune demande'}
                message={
                  status === 'en_attente'
                    ? // Les TROIS espaces portent la carte « Mes données »
                      // depuis que le personnel des centres exerce ce droit
                      // (registre `staff`). Cette phrase dit d'où arrivent les
                      // demandes : en oublier un ferait chercher ailleurs.
                      'Rien à traiter pour le moment. Les demandes arrivent ici dès qu’une personne en dépose une depuis son espace — patient, tuteur ou personnel d’un centre.'
                    : 'Changez le filtre de statut pour voir l’historique des demandes traitées et refusées.'
                }
              />
            ) : (
              <>
                <ul className="ax-list">
                  {rows.map((request) => (
                    <RequestCard
                      key={request.id}
                      request={request}
                      canWrite={canWrite}
                      onAnonymize={() => setAnonymizing(request)}
                      onRefuse={() => setRefusing(request)}
                    />
                  ))}
                </ul>
                {requests.data && (
                  <Pagination count={requests.data.count} page={page} onPage={setPage} />
                )}
              </>
            )}
          </div>

          {/* Ce que la personne a lu AVANT de déposer sa demande — cité mot
              pour mot, pour que l'exploitant sache à quoi il l'engage. En
              liste : concaténées, ces phrases formaient un pavé que personne
              ne lisait.

              DEUX blocs depuis que le personnel des centres exerce ce droit
              depuis son espace : le registre lu dépend de l'espace où la
              demande a été déposée (la casquette `is_center_staff` de la ligne
              indique lequel s'applique). N'en citer qu'un ferait juger un
              salarié sur des promesses qu'on ne lui a pas faites. */}
          <div className="ax-card__footer" style={{ borderTop: '1px solid var(--ax-border)' }}>
            {(
              [
                ['Ce que la personne a lu — espaces patient et tuteur', ERASURE_COPY['grand-public']],
                ['Ce que la personne a lu — espace centre (personnel)', ERASURE_COPY.staff],
              ] as const
            ).map(([caption, copy]) => (
              <div key={caption} style={{ marginBlockEnd: 'var(--ax-space-3)' }}>
                <p style={{ margin: '0 0 var(--ax-space-2)', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-muted)' }}>
                  {caption}
                </p>
                <ul
                  style={{
                    margin: 0,
                    paddingInlineStart: 'var(--ax-space-5)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 'var(--ax-space-1)',
                  }}
                >
                  {[copy.scope, ...copy.effects, ...copy.kept, ...(copy.delay ?? [])].map((line) => (
                    <li key={line} style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-muted)', lineHeight: 1.7 }}>
                      {line}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      </div>

      {anonymizing && canWrite && (
        <AnonymizeModal
          request={anonymizing}
          onClose={() => setAnonymizing(null)}
          onDone={() => {
            setAnonymizing(null);
            requests.reload();
          }}
        />
      )}
      {refusing && canWrite && (
        <RefuseModal
          request={refusing}
          onClose={() => setRefusing(null)}
          onDone={() => {
            setRefusing(null);
            requests.reload();
          }}
        />
      )}
    </>
  );
}

export default PlatformErasureRequests;
