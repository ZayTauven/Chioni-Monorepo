'use client';
/*
 * Chioni — carte « Consentements » du dossier patient (S2, ADR 0004 addendum).
 *
 * Pour un patient NON revendiqué, les rôles BILLING peuvent enregistrer un
 * consentement clinique recueilli au guichet (formulaire papier signé ou
 * accord oral) au bénéfice d'un lien de tutelle ACTIF — et le retirer.
 * Un patient revendiqué gère ses consentements lui-même, depuis son espace.
 *
 * Honnêteté des données : GET /centers/{c}/patients/{pk}/guardian-links/ ne
 * porte VOLONTAIREMENT ni scopes ni historique — l'état persistant du
 * consentement clinique n'est donc PAS lisible côté centre (trou de contrat
 * assumé, remonté). L'écran n'invente rien : il n'affiche que le résultat
 * des actions faites dans CETTE session (réponses 201/200 de l'API) et
 * laisse le backend arbitrer (« déjà accordé », « aucun consentement actif »
 * → 400 affichés tels quels).
 */
import { useState } from 'react';
import { useCenter } from '@/context/CenterContext';
import type { ApiError } from '@/lib/api';
import {
  grantDeskClinicalConsent,
  listPatientGuardianLinks,
  revokeDeskClinicalConsent,
} from '@/lib/endpoints/centers';
import { CONSENT_COLLECTED_VIA_LABELS, RELATIONSHIP_LABELS, formatDateTime } from '@/lib/labels';
import type {
  ConsentCollectedVia,
  DeskClinicalConsent,
  GuardianLinkCenter,
  Patient,
} from '@/lib/types';
import {
  AvatarChip,
  CardSkeleton,
  ErrorAlert,
  Modal,
  toApiError,
  useAsync,
} from './shared';

/** Follow the pagination of the patient's active links (few in practice). */
async function fetchAllLinks(centerId: number, patientId: number): Promise<GuardianLinkCenter[]> {
  const all: GuardianLinkCenter[] = [];
  let page = 1;
  // Garde-fou : 5 pages (100 liens) — largement au-delà du réel.
  while (page <= 5) {
    const chunk = await listPatientGuardianLinks(centerId, patientId, page);
    all.push(...chunk.results);
    if (!chunk.next) break;
    page += 1;
  }
  return all;
}

const RESPONSIBILITY_TEXT =
  'Vous attestez avoir recueilli l’accord du patient. Ce consentement ouvre le détail clinique à ce proche et sera tracé à votre nom.';

const AUTO_REVOKE_NOTE =
  'Si le patient active son compte, ce consentement sera automatiquement suspendu : il devra le confirmer lui-même depuis son espace.';

/* ── grant modal ── */

function GrantConsentModal({
  patientId,
  links,
  onClose,
  onDone,
}: {
  patientId: number;
  links: GuardianLinkCenter[];
  onClose: () => void;
  onDone: (consent: DeskClinicalConsent, link: GuardianLinkCenter) => void;
}) {
  const { centerId } = useCenter();
  const [linkId, setLinkId] = useState<number | ''>(links.length === 1 ? links[0].id : '');
  const [via, setVia] = useState<ConsentCollectedVia | ''>('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const submit = async () => {
    if (linkId === '' || via === '') return;
    setSaving(true);
    setError(null);
    try {
      const consent = await grantDeskClinicalConsent(centerId, patientId, linkId, via);
      const link = links.find((l) => l.id === linkId);
      if (link) onDone(consent, link);
    } catch (err) {
      setError(toApiError(err));
      setSaving(false);
    }
  };

  return (
    <Modal
      title="Enregistrer un consentement"
      onClose={onClose}
      width={560}
      footer={
        <>
          <button type="button" className="ax-btn ax-btn--ghost" onClick={onClose} disabled={saving}>
            Annuler
          </button>
          <button
            type="submit"
            form="desk-consent-form"
            className="ax-btn ax-btn--primary"
            disabled={saving || linkId === '' || via === ''}
          >
            {saving ? 'Enregistrement…' : 'Enregistrer le consentement'}
          </button>
        </>
      }
    >
      <form
        id="desk-consent-form"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}
      >
        {error && <ErrorAlert error={error} />}

        <div className="ax-field">
          <label className="ax-label" htmlFor="dc-link">
            Proche concerné <span className="ax-field__required" aria-hidden="true">*</span>
          </label>
          <select
            id="dc-link"
            className="ax-select"
            required
            value={linkId === '' ? '' : String(linkId)}
            onChange={(e) => setLinkId(e.target.value === '' ? '' : Number.parseInt(e.target.value, 10))}
            data-autofocus=""
          >
            <option value="" disabled>Choisir…</option>
            {links.map((l) => (
              <option key={l.id} value={l.id}>
                {l.guardian_name} — {RELATIONSHIP_LABELS[l.relationship]}
              </option>
            ))}
          </select>
        </div>

        <fieldset className="ax-field" style={{ border: 0, margin: 0, padding: 0 }}>
          <legend className="ax-label">
            Mode de recueil <span className="ax-field__required" aria-hidden="true">*</span>
          </legend>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-2)' }}>
            {(Object.keys(CONSENT_COLLECTED_VIA_LABELS) as ConsentCollectedVia[]).map((mode) => (
              <label key={mode} className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flexWrap: 'nowrap', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="dc-via"
                  className="ax-radio"
                  checked={via === mode}
                  onChange={() => setVia(mode)}
                  required
                />
                <span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)' }}>
                  {CONSENT_COLLECTED_VIA_LABELS[mode]}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="ax-alert ax-alert--warning" role="note">
          <div className="ax-alert__content">
            <p className="ax-alert__message" style={{ margin: 0 }}>{RESPONSIBILITY_TEXT}</p>
          </div>
        </div>

        <p style={{ margin: 0, fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-muted)' }}>
          {AUTO_REVOKE_NOTE}
        </p>
      </form>
    </Modal>
  );
}

/* ── withdraw modal ── */

function WithdrawConsentModal({
  patientId,
  links,
  onClose,
  onDone,
}: {
  patientId: number;
  links: GuardianLinkCenter[];
  onClose: () => void;
  onDone: (consent: DeskClinicalConsent, link: GuardianLinkCenter) => void;
}) {
  const { centerId } = useCenter();
  const [linkId, setLinkId] = useState<number | ''>(links.length === 1 ? links[0].id : '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const submit = async () => {
    if (linkId === '') return;
    setSaving(true);
    setError(null);
    try {
      const consent = await revokeDeskClinicalConsent(centerId, patientId, linkId);
      const link = links.find((l) => l.id === linkId);
      if (link) onDone(consent, link);
    } catch (err) {
      setError(toApiError(err));
      setSaving(false);
    }
  };

  return (
    <Modal
      title="Retirer un consentement"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="ax-btn ax-btn--ghost" onClick={onClose} disabled={saving}>
            Annuler
          </button>
          <button
            type="button"
            className="ax-btn ax-btn--danger"
            disabled={saving || linkId === ''}
            onClick={() => void submit()}
          >
            {saving ? 'Retrait…' : 'Retirer le consentement'}
          </button>
        </>
      }
    >
      {error && <ErrorAlert error={error} />}
      <div className="ax-field">
        <label className="ax-label" htmlFor="dc-withdraw-link">Proche concerné</label>
        <select
          id="dc-withdraw-link"
          className="ax-select"
          value={linkId === '' ? '' : String(linkId)}
          onChange={(e) => setLinkId(e.target.value === '' ? '' : Number.parseInt(e.target.value, 10))}
          data-autofocus=""
        >
          <option value="" disabled>Choisir…</option>
          {links.map((l) => (
            <option key={l.id} value={l.id}>
              {l.guardian_name} — {RELATIONSHIP_LABELS[l.relationship]}
            </option>
          ))}
        </select>
      </div>
      <p style={{ margin: 0, fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)', lineHeight: 1.6 }}>
        Le proche choisi ne verra plus le détail clinique de ce patient. Ce retrait sera tracé à
        votre nom.
      </p>
    </Modal>
  );
}

/* ── card ── */

type SessionAction = { kind: 'accorde' | 'retire'; at: string };

export function DeskConsentsCard({ patient }: { patient: Patient }) {
  const { centerId } = useCenter();
  const claimed = patient.claim_status === 'actif';

  const links = useAsync(
    () => (claimed ? Promise.resolve([]) : fetchAllLinks(centerId, patient.id)),
    [centerId, patient.id, claimed],
  );

  const [grantOpen, setGrantOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  /** Résultat des actions de CETTE session (réponses API), par lien. */
  const [sessionActions, setSessionActions] = useState<Record<number, SessionAction>>({});
  const [notice, setNotice] = useState<string | null>(null);

  const activeLinks = links.data ?? [];

  return (
    <section className="ax-card ax-col--4" role="region" aria-label="Consentements">
      <div className="ax-card__header">
        <div className="ax-card__titles">
          <h2 className="ax-card__title">Consentements</h2>
          <p className="ax-card__subtitle">Accès du proche au détail clinique</p>
        </div>
      </div>
      <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}>
        {claimed ? (
          <p style={{ margin: 0, fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)', lineHeight: 1.6 }}>
            Ce patient a activé son compte : il gère ses consentements lui-même, depuis son espace.
          </p>
        ) : links.loading ? (
          <CardSkeleton lines={3} />
        ) : links.error ? (
          <ErrorAlert error={links.error} onRetry={links.reload} />
        ) : activeLinks.length === 0 ? (
          <p style={{ margin: 0, fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)', lineHeight: 1.6 }}>
            Aucun tuteur actif pour ce patient. Un consentement clinique se recueille auprès
            d&rsquo;un proche déjà relié au dossier.
          </p>
        ) : (
          <>
            {notice && (
              <div className="ax-alert ax-alert--success" role="status">
                <div className="ax-alert__content">
                  <p className="ax-alert__message" style={{ margin: 0 }}>{notice}</p>
                </div>
              </div>
            )}

            <ul className="ax-list ax-list--compact">
              {activeLinks.map((l) => {
                const action = sessionActions[l.id];
                return (
                  <li key={l.id} className="ax-list__row" style={{ paddingInline: 0 }}>
                    <span className="ax-list__leading">
                      <AvatarChip name={l.guardian_name} seed={l.id} />
                    </span>
                    <span className="ax-list__content">
                      <span className="ax-list__title" style={{ fontWeight: 'var(--ax-weight-medium)' }}>
                        {l.guardian_name}
                      </span>
                      <span style={{ display: 'block', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>
                        {RELATIONSHIP_LABELS[l.relationship]}
                      </span>
                    </span>
                    {action && (
                      <span className="ax-list__trailing">
                        <span
                          className={`ax-badge ax-badge--soft ax-badge--pill ax-badge--${action.kind === 'accorde' ? 'success' : 'neutral'}`}
                        >
                          {action.kind === 'accorde' ? 'Consentement enregistré' : 'Consentement retiré'}
                        </span>
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-2)' }}>
              <button type="button" className="ax-btn ax-btn--secondary" onClick={() => { setNotice(null); setGrantOpen(true); }}>
                <span className="ax-btn__label">Enregistrer un consentement (papier / oral)</span>
              </button>
              {/* Same hit target as the grant button: withdrawing is a RIGHT,
                  never a second-class action. */}
              <button type="button" className="ax-btn ax-btn--ghost" onClick={() => { setNotice(null); setWithdrawOpen(true); }}>
                <span className="ax-btn__label">Retirer un consentement</span>
              </button>
            </div>

            <p style={{ margin: 0, fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>
              {AUTO_REVOKE_NOTE}
            </p>
          </>
        )}
      </div>

      {grantOpen && (
        <GrantConsentModal
          patientId={patient.id}
          links={activeLinks}
          onClose={() => setGrantOpen(false)}
          onDone={(consent, link) => {
            setGrantOpen(false);
            setSessionActions((m) => ({ ...m, [link.id]: { kind: 'accorde', at: consent.granted_at } }));
            setNotice(
              `Consentement enregistré le ${formatDateTime(consent.granted_at)} : ${link.guardian_name} peut voir le détail clinique de ce patient.`,
            );
          }}
        />
      )}
      {withdrawOpen && (
        <WithdrawConsentModal
          patientId={patient.id}
          links={activeLinks}
          onClose={() => setWithdrawOpen(false)}
          onDone={(consent, link) => {
            setWithdrawOpen(false);
            setSessionActions((m) => ({ ...m, [link.id]: { kind: 'retire', at: consent.revoked_at ?? '' } }));
            setNotice(`Consentement retiré : ${link.guardian_name} ne voit plus le détail clinique de ce patient.`);
          }}
        />
      )}
    </section>
  );
}

export default DeskConsentsCard;
