'use client';
/*
 * Chioni — /plateforme/exploitants : l'équipe Chioni (S5 lot 3, ADR 0018 déc. 6).
 *
 * **`admin` SEUL, y compris en LECTURE.** C'est la seule lecture du back-office
 * fermée au `support`, et c'est un arbitrage backend explicite : savoir qui
 * détient la 4ᵉ casquette relève de la gouvernance — un `support` n'a pas à
 * savoir qui peut le désactiver. L'écran est donc auto-gardé (aucun fetch pour
 * un `support`) et l'entrée de menu est masquée pour lui.
 *
 * Trois honnêtetés portées ici :
 *
 * 1. **Le compte naît OMBRE.** Aucun mot de passe n'est créé ni transmis, pas
 *    même pour l'équipe Chioni : la personne prend possession de son compte
 *    par SMS. L'écran ne promet donc jamais d'identifiants.
 * 2. **La garde « dernier administrateur » est EXPLIQUÉE, pas subie.** Quand
 *    la liste ne compte qu'un seul `admin` actif, les deux gestes qui le
 *    retireraient sont désactivés et la phrase dit quoi faire d'abord.
 * 3. **On ne supprime pas un exploitant**, on lui retire l'accès : la ligne
 *    est ce qui rend lisible une vieille entrée de journal.
 *
 * La liste est faite d'IDS, sans nom ni téléphone — contrat backend assumé
 * (un compte ombre porte son numéro dans son identifiant). L'écran le dit
 * plutôt que de laisser croire à un bug d'affichage.
 */
import { useState } from 'react';
import { PlatformPageHead } from '@/components/shell-platform/PlatformPageHead';
import type { ApiError } from '@/lib/api';
import { createOperator, listOperators, updateOperator } from '@/lib/endpoints/platform';
import {
  OPERATOR_ADMIN_ONLY_MESSAGE,
  OPERATOR_ADMIN_ONLY_TITLE,
  OPERATOR_LAST_ADMIN_NOTICE,
  OPERATOR_LAST_ADMIN_ROW,
  OPERATOR_LIST_AUSTERE_NOTICE,
  OPERATOR_NO_DELETE_NOTICE,
  OPERATOR_REACTIVATE_NOTICE,
  OPERATOR_SEPARATION_NOTICE,
  OPERATOR_SHADOW_NOTICE,
  PLATFORM_ROLE_HELP,
  PLATFORM_ROLE_LABELS,
  formatDate,
  operatorAccountLabel,
  operatorLabel,
} from '@/lib/labels';
import type { PlatformOperator, PlatformRole } from '@/lib/types';
import {
  EmptyState,
  ErrorAlert,
  FieldError,
  IconPlus,
  Modal,
  Pagination,
  Ref,
  StatusBadge,
  TableSkeleton,
  toApiError,
  useAsync,
  usePlatformRole,
} from './shared';

const ROLES: PlatformRole[] = ['support', 'admin'];

/* ── créer un exploitant ── */

function NewOperatorModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<PlatformRole>('support');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      await createOperator({
        phone: phone.trim(),
        role,
        first_name: firstName.trim() || undefined,
        last_name: lastName.trim() || undefined,
      });
      onCreated();
    } catch (err) {
      setError(toApiError(err));
      setSaving(false);
    }
  };

  return (
    <Modal
      title="Ajouter un exploitant"
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
            form="operator-form"
            className="ax-btn ax-btn--primary"
            disabled={saving || phone.trim().length === 0}
          >
            {saving ? 'Création…' : 'Créer le compte'}
          </button>
        </>
      }
    >
      <form
        id="operator-form"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}
      >
        {error && error.messages.length > 0 && <ErrorAlert error={error} />}

        <p style={{ margin: 0, fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)', lineHeight: 1.7 }}>
          {OPERATOR_SHADOW_NOTICE}
        </p>

        <div className="ax-field">
          <label className="ax-label" htmlFor="op-phone">
            Téléphone <span className="ax-field__required" aria-hidden="true">*</span>
          </label>
          <input
            id="op-phone"
            type="tel"
            inputMode="tel"
            autoComplete="off"
            className={`ax-input${error?.fieldErrors.phone ? ' is-invalid' : ''}`}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+269…"
            required
            data-autofocus=""
            aria-describedby="op-phone-help"
          />
          <p id="op-phone-help" className="ax-field__message">
            {OPERATOR_SEPARATION_NOTICE}
          </p>
          <FieldError error={error} field="phone" />
        </div>

        <div className="ax-field">
          <label className="ax-label" htmlFor="op-role">
            Rôle
          </label>
          <select
            id="op-role"
            className="ax-select"
            value={role}
            onChange={(e) => setRole(e.target.value as PlatformRole)}
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {PLATFORM_ROLE_LABELS[r]}
              </option>
            ))}
          </select>
          <p className="ax-field__message">{PLATFORM_ROLE_HELP[role]}</p>
          <FieldError error={error} field="role" />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 'var(--ax-space-4)' }}>
          <div className="ax-field">
            <label className="ax-label" htmlFor="op-first">Prénom</label>
            <input id="op-first" type="text" className="ax-input" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            <FieldError error={error} field="first_name" />
          </div>
          <div className="ax-field">
            <label className="ax-label" htmlFor="op-last">Nom</label>
            <input id="op-last" type="text" className="ax-input" value={lastName} onChange={(e) => setLastName(e.target.value)} />
            <FieldError error={error} field="last_name" />
          </div>
        </div>
      </form>
    </Modal>
  );
}

/* ── changer un rôle / retirer un accès ── */

function OperatorChangeModal({
  operator,
  change,
  onClose,
  onDone,
}: {
  operator: PlatformOperator;
  change: { role?: PlatformRole; is_active?: boolean };
  onClose: () => void;
  onDone: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const revoking = change.is_active === false;

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      await updateOperator(operator.id, change);
      onDone();
    } catch (err) {
      setError(toApiError(err));
      setSaving(false);
    }
  };

  const title = revoking
    ? `Retirer l’accès de ${operatorLabel(operator.id)} ?`
    : change.is_active
      ? `Rendre l’accès à ${operatorLabel(operator.id)} ?`
      : `Passer ${operatorLabel(operator.id)} en « ${PLATFORM_ROLE_LABELS[change.role ?? 'support']} » ?`;

  return (
    <Modal
      title={title}
      onClose={onClose}
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
            type="button"
            className={`ax-btn ${revoking ? 'ax-btn--danger' : 'ax-btn--primary'}`}
            onClick={() => void submit()}
            disabled={saving}
          >
            {saving ? 'Enregistrement…' : revoking ? 'Retirer l’accès' : 'Confirmer'}
          </button>
        </>
      }
    >
      {error && <ErrorAlert error={error} />}
      <p style={{ margin: 0, fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)', lineHeight: 1.7 }}>
        {revoking ? OPERATOR_NO_DELETE_NOTICE : PLATFORM_ROLE_HELP[change.role ?? operator.role]}
      </p>
      {/* RÉACTIVER VAUT CRÉER (correctif guardian S5) : la séparation des
          pouvoirs s'applique aussi au retour, et le refus arriverait sinon
          sans prévenir. La modale ne montrait que le libellé du rôle — vrai,
          mais hors sujet pour ce geste-là. */}
      {change.is_active === true && (
        <p style={{ margin: 0, fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)', lineHeight: 1.7 }}>
          {OPERATOR_REACTIVATE_NOTICE}
        </p>
      )}
    </Modal>
  );
}

/* ── écran ── */

export function PlatformOperators() {
  const { role, canWrite } = usePlatformRole();
  // `admin` seul, y compris en lecture : rien n'est requêté pour un `support`.
  const isAdmin = role === 'admin';
  const [page, setPage] = useState(1);
  const [newOpen, setNewOpen] = useState(false);
  const [pending, setPending] = useState<{
    operator: PlatformOperator;
    change: { role?: PlatformRole; is_active?: boolean };
  } | null>(null);

  const operators = useAsync(
    () => (isAdmin ? listOperators({ page }) : Promise.resolve(null)),
    [isAdmin, page],
  );

  if (!isAdmin) {
    return (
      <>
        <PlatformPageHead title="Équipe Chioni" />
        <div className="ax-dash-grid">
          <section className="ax-card ax-col--12">
            <div className="ax-card__body">
              <EmptyState title={OPERATOR_ADMIN_ONLY_TITLE} message={OPERATOR_ADMIN_ONLY_MESSAGE} />
            </div>
          </section>
        </div>
      </>
    );
  }

  const rows = operators.data?.results ?? [];
  // La garde du backend, RENDUE : quand il ne reste qu'un `admin` actif sur la
  // page, ni la rétrogradation ni la désactivation ne sont proposées. Portée
  // honnête : ce compte porte sur la page chargée, et le backend reste seul
  // juge — son refus est une consigne, affichée telle quelle.
  const activeAdmins = rows.filter((o) => o.is_active && o.role === 'admin');
  const lastAdminId = activeAdmins.length === 1 ? activeAdmins[0].id : null;

  return (
    <>
      <PlatformPageHead
        title="Équipe Chioni"
        subtitle="Qui détient la casquette d’exploitant — et ce que chacun peut faire."
        actions={
          canWrite ? (
            <button type="button" className="ax-btn ax-btn--primary" onClick={() => setNewOpen(true)}>
              <IconPlus />
              <span className="ax-btn__label">Ajouter un exploitant</span>
            </button>
          ) : undefined
        }
      />

      <div className="ax-dash-grid">
        <section className="ax-card ax-col--12" role="region" aria-label="Exploitants de la plateforme">
          <div
            className="ax-card__body"
            style={{ paddingBottom: 'var(--ax-space-3)', display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-2)' }}
          >
            <p style={{ margin: 0, fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-muted)', lineHeight: 1.7 }}>
              {OPERATOR_LIST_AUSTERE_NOTICE}
            </p>
            <p style={{ margin: 0, fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-muted)', lineHeight: 1.7 }}>
              {OPERATOR_NO_DELETE_NOTICE}
            </p>
            {/* La garde s'EXPLIQUE : noyée en troisième ligne grise, elle se
                subissait (revue UX care S5). Une garde qui retire des boutons
                doit être lue avant qu'on les cherche — et elle porte une
                marche à suivre, donc un ton `info`, jamais un avertissement. */}
            {lastAdminId !== null && (
              <div className="ax-alert ax-alert--info" role="note">
                <div className="ax-alert__content">
                  <p className="ax-alert__message" style={{ lineHeight: 1.7 }}>
                    {OPERATOR_LAST_ADMIN_NOTICE}
                  </p>
                </div>
              </div>
            )}
          </div>

          {operators.loading ? (
            <TableSkeleton rows={4} cols={4} />
          ) : operators.error ? (
            <div style={{ padding: 'var(--ax-space-4)' }}>
              <ErrorAlert error={operators.error} onRetry={operators.reload} />
            </div>
          ) : rows.length === 0 ? (
            <EmptyState
              title="Aucun exploitant"
              message="Le tout premier exploitant s’amorce hors ligne, par une commande d’installation. Ensuite, l’équipe se gère ici."
            />
          ) : (
            <>
              <div className="ax-table-wrap" tabIndex={0} role="region" aria-label="Tableau">
                <table className="ax-table ax-table--hover">
                  <thead className="ax-table__head">
                    <tr>
                      <th className="ax-table__th" scope="col">Exploitant</th>
                      <th className="ax-table__th" scope="col">Rôle</th>
                      <th className="ax-table__th" scope="col">Accès</th>
                      <th className="ax-table__th" scope="col">Depuis</th>
                      {canWrite && <th className="ax-table__th" scope="col">Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((operator) => {
                      const isLastAdmin = operator.id === lastAdminId;
                      return (
                        <tr key={operator.id} className="ax-table__row">
                          <td className="ax-table__td">
                            <div style={{ fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)' }}>
                              {operatorLabel(operator.id)}
                            </div>
                            <Ref>{operatorAccountLabel(operator.user)}</Ref>
                          </td>
                          <td className="ax-table__td">
                            <StatusBadge
                              tone={operator.role === 'admin' ? 'accent' : 'neutral'}
                              label={PLATFORM_ROLE_LABELS[operator.role]}
                            />
                          </td>
                          <td className="ax-table__td">
                            <StatusBadge
                              tone={operator.is_active ? 'success' : 'neutral'}
                              label={operator.is_active ? 'Actif' : 'Retiré'}
                            />
                          </td>
                          <td className="ax-table__td" style={{ color: 'var(--ax-text-muted)', whiteSpace: 'nowrap' }}>
                            {formatDate(operator.created_at)}
                          </td>
                          {canWrite && (
                            <td className="ax-table__td">
                              <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)', flexWrap: 'wrap' }}>
                                {operator.is_active && !isLastAdmin && (
                                  <button
                                    type="button"
                                    className="ax-btn ax-btn--ghost ax-btn--sm"
                                    onClick={() =>
                                      setPending({
                                        operator,
                                        change: { role: operator.role === 'admin' ? 'support' : 'admin' },
                                      })
                                    }
                                  >
                                    <span className="ax-btn__label">
                                      {operator.role === 'admin' ? 'Passer en support' : 'Passer en administrateur'}
                                    </span>
                                  </button>
                                )}
                                {operator.is_active ? (
                                  !isLastAdmin && (
                                    <button
                                      type="button"
                                      className="ax-btn ax-btn--ghost ax-btn--sm"
                                      onClick={() => setPending({ operator, change: { is_active: false } })}
                                    >
                                      <span className="ax-btn__label">Retirer l’accès</span>
                                    </button>
                                  )
                                ) : (
                                  <button
                                    type="button"
                                    className="ax-btn ax-btn--ghost ax-btn--sm"
                                    onClick={() => setPending({ operator, change: { is_active: true } })}
                                  >
                                    <span className="ax-btn__label">Rendre l’accès</span>
                                  </button>
                                )}
                                {/* Là où les boutons manquent, la ligne dit
                                    POURQUOI et QUOI FAIRE — un constat sec
                                    (« Dernier administrateur actif ») laisse
                                    chercher la sortie. */}
                                {isLastAdmin && (
                                  <span style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-muted)', lineHeight: 1.6 }}>
                                    {OPERATOR_LAST_ADMIN_ROW}
                                  </span>
                                )}
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {operators.data && (
                <Pagination count={operators.data.count} page={page} onPage={setPage} />
              )}
            </>
          )}
        </section>
      </div>

      {newOpen && canWrite && (
        <NewOperatorModal
          onClose={() => setNewOpen(false)}
          onCreated={() => {
            setNewOpen(false);
            setPage(1);
            operators.reload();
          }}
        />
      )}

      {pending && canWrite && (
        <OperatorChangeModal
          operator={pending.operator}
          change={pending.change}
          onClose={() => setPending(null)}
          onDone={() => {
            setPending(null);
            operators.reload();
          }}
        />
      )}
    </>
  );
}

export default PlatformOperators;
