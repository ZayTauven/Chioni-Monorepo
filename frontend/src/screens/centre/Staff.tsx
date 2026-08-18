'use client';
/*
 * Chioni — /centre/personnel : l'équipe du centre.
 *
 * Le backend réserve TOUTE la ressource staff au directeur (lecture comprise,
 * vérifié dans apps/centers/views.py) : pour les autres rôles l'écran
 * l'explique sans appeler l'API. Ajout : téléphone* + rôle* (+ prénom/nom) —
 * un compte est créé s'il n'existe pas et la personne l'active par SMS.
 * Désactivation avec confirmation ; le 400 « dernier directeur » est montré
 * tel quel. Réactivation (S1) : symétrique, sur un membre désactivé — la
 * désactivation n'est plus irréversible. Jamais de suppression (historique =
 * piste d'audit).
 */
import { useEffect, useState } from 'react';
import { PageHead } from '@/components/shell/PageHead';
import { useCenter } from '@/context/CenterContext';
import type { ApiError } from '@/lib/api';
import { createStaff, deactivateStaff, listStaff, reactivateStaff, updateStaff, type StaffPayload, type StaffUpdatePayload } from '@/lib/endpoints/centers';
import { STAFF_ROLE_LABELS, formatDate } from '@/lib/labels';
import type { StaffMember, StaffRole } from '@/lib/types';
import {
  AvatarChip,
  EmptyState,
  ErrorAlert,
  FieldError,
  IconEdit,
  IconPlus,
  IconRefresh,
  IconUserOff,
  Modal,
  Pagination,
  StatusBadge,
  TableSkeleton,
  toApiError,
  useAsync,
} from './shared';

function memberName(m: StaffMember): string {
  return `${m.user.first_name} ${m.user.last_name}`.trim() || m.user.phone;
}

/** Photo réelle si le membre en a une, sinon la pastille d'initiales. */
function MemberAvatar({ member }: { member: StaffMember }) {
  if (member.user.avatar) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- API media URL, no Next loader configured
      <img
        src={member.user.avatar}
        alt=""
        width={32}
        height={32}
        style={{ width: 32, height: 32, borderRadius: 'var(--ax-radius-sm)', objectFit: 'cover', flex: '0 0 auto' }}
      />
    );
  }
  return <AvatarChip name={memberName(member)} seed={member.user.id} />;
}

/* ── add modal ── */

function AddStaffModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { centerId } = useCenter();
  const [form, setForm] = useState<{ phone: string; role: StaffRole; first_name: string; last_name: string }>({
    phone: '',
    role: 'secretaire',
    first_name: '',
    last_name: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const submit = async () => {
    setSaving(true);
    setError(null);
    const payload: StaffPayload = { phone: form.phone.trim(), role: form.role };
    if (form.first_name.trim()) payload.first_name = form.first_name.trim();
    if (form.last_name.trim()) payload.last_name = form.last_name.trim();
    try {
      await createStaff(centerId, payload);
      onCreated();
    } catch (err) {
      setError(toApiError(err));
      setSaving(false);
    }
  };

  return (
    <Modal
      title="Ajouter un membre de l'équipe"
      busy={saving}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="ax-btn ax-btn--ghost" onClick={onClose} disabled={saving}>
            Annuler
          </button>
          <button type="submit" form="staff-add-form" className="ax-btn ax-btn--primary" disabled={saving}>
            {saving ? 'Ajout…' : 'Ajouter'}
          </button>
        </>
      }
    >
      <form
        id="staff-add-form"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}
      >
        {error && error.messages.length > 0 && <ErrorAlert error={error} />}

        <p style={{ margin: 0, fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>
          Si cette personne n&apos;a pas encore de compte Chioni, un compte est créé avec ce numéro : elle l&apos;activera
          elle-même en recevant un code par SMS à sa première connexion.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--ax-space-4)' }}>
          <div className="ax-field">
            <label className="ax-label" htmlFor="st-phone">
              Téléphone <span className="ax-field__required" aria-hidden="true">*</span>
            </label>
            <input
              id="st-phone"
              type="tel"
              className={`ax-input${error?.fieldErrors.phone ? ' is-invalid' : ''}`}
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              placeholder="+269…"
              required
              data-autofocus=""
            />
            <FieldError error={error} field="phone" />
          </div>
          <div className="ax-field">
            <label className="ax-label" htmlFor="st-role">
              Rôle <span className="ax-field__required" aria-hidden="true">*</span>
            </label>
            <select
              id="st-role"
              className="ax-select"
              value={form.role}
              onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as StaffRole }))}
            >
              {(Object.keys(STAFF_ROLE_LABELS) as StaffRole[]).map((r) => (
                <option key={r} value={r}>
                  {STAFF_ROLE_LABELS[r]}
                </option>
              ))}
            </select>
            <FieldError error={error} field="role" />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--ax-space-4)' }}>
          <div className="ax-field">
            <label className="ax-label" htmlFor="st-first">Prénom</label>
            <input
              id="st-first"
              type="text"
              className="ax-input"
              value={form.first_name}
              onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))}
            />
            <FieldError error={error} field="first_name" />
          </div>
          <div className="ax-field">
            <label className="ax-label" htmlFor="st-last">Nom</label>
            <input
              id="st-last"
              type="text"
              className="ax-input"
              value={form.last_name}
              onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))}
            />
            <FieldError error={error} field="last_name" />
          </div>
        </div>
      </form>
    </Modal>
  );
}

/* ── edit modal (directeur : rôle, et nom tant que le compte est un compte ombre) ── */

function EditStaffModal({
  member,
  onClose,
  onSaved,
}: {
  member: StaffMember;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { centerId } = useCenter();
  const [role, setRole] = useState<StaffRole>(member.role);
  const [firstName, setFirstName] = useState(member.user.first_name);
  const [lastName, setLastName] = useState(member.user.last_name);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  /* SV — `identity_editable` est LE prédicat du PATCH, calculé par le
     backend : on grise l'identité PROACTIVEMENT avec la raison, au lieu de
     laisser le PATCH échouer après la saisie. */
  const identityLocked = !member.user.identity_editable;

  const submit = async () => {
    const payload: StaffUpdatePayload = {};
    if (role !== member.role) payload.role = role;
    if (!identityLocked && firstName !== member.user.first_name) payload.first_name = firstName.trim();
    if (!identityLocked && lastName !== member.user.last_name) payload.last_name = lastName.trim();
    if (Object.keys(payload).length === 0) {
      onClose();
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await updateStaff(centerId, member.id, payload);
      onSaved();
    } catch (err) {
      setError(toApiError(err));
      setSaving(false);
    }
  };

  return (
    <Modal
      title={`Modifier ${memberName(member)}`}
      busy={saving}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="ax-btn ax-btn--ghost" onClick={onClose} disabled={saving}>
            Annuler
          </button>
          <button type="submit" form="staff-edit-form" className="ax-btn ax-btn--primary" disabled={saving}>
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </>
      }
    >
      <form
        id="staff-edit-form"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}
      >
        {error && error.messages.length > 0 && <ErrorAlert error={error} />}

        <div className="ax-field">
          <label className="ax-label" htmlFor="ste-role">Rôle dans ce centre</label>
          <select
            id="ste-role"
            className={`ax-select${error?.fieldErrors.role ? ' is-invalid' : ''}`}
            value={role}
            onChange={(e) => setRole(e.target.value as StaffRole)}
            data-autofocus=""
          >
            {(Object.keys(STAFF_ROLE_LABELS) as StaffRole[]).map((r) => (
              <option key={r} value={r}>
                {STAFF_ROLE_LABELS[r]}
              </option>
            ))}
          </select>
          <FieldError error={error} field="role" />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--ax-space-4)' }}>
          <div className="ax-field">
            <label className="ax-label" htmlFor="ste-first">Prénom</label>
            <input
              id="ste-first"
              type="text"
              className={`ax-input${error?.fieldErrors.first_name ? ' is-invalid' : ''}`}
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              disabled={identityLocked}
              aria-describedby={identityLocked ? 'ste-identity-locked' : undefined}
            />
            <FieldError error={error} field="first_name" />
          </div>
          <div className="ax-field">
            <label className="ax-label" htmlFor="ste-last">Nom</label>
            <input
              id="ste-last"
              type="text"
              className={`ax-input${error?.fieldErrors.last_name ? ' is-invalid' : ''}`}
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              disabled={identityLocked}
              aria-describedby={identityLocked ? 'ste-identity-locked' : undefined}
            />
            <FieldError error={error} field="last_name" />
          </div>
        </div>

        {identityLocked ? (
          /* SV — la raison au moment du grisage, jamais un champ mort sans
             explication : le directeur saurait sinon seulement que « ça ne
             marche pas ». */
          <p id="ste-identity-locked" style={{ margin: 0, fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-muted)' }}>
            Ce compte a été revendiqué par son titulaire&nbsp;: seule la personne concernée peut
            modifier son identité, depuis son profil. Le rôle, lui, reste modifiable.
          </p>
        ) : (
          <p style={{ margin: 0, fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-muted)' }}>
            Le nom n&apos;est modifiable que tant que la personne n&apos;a pas activé son compte. Une fois le compte
            activé, seule la personne concernée peut modifier son identité, depuis son profil.
          </p>
        )}
      </form>
    </Modal>
  );
}

/* ── deactivate confirmation ── */

function DeactivateModal({
  member,
  onClose,
  onDone,
}: {
  member: StaffMember;
  onClose: () => void;
  onDone: () => void;
}) {
  const { centerId } = useCenter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      await deactivateStaff(centerId, member.id);
      onDone();
    } catch (err) {
      setError(toApiError(err));
      setSaving(false);
    }
  };

  return (
    <Modal
      title={`Désactiver ${memberName(member)} ?`}
      busy={saving}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="ax-btn ax-btn--ghost" onClick={onClose} disabled={saving}>
            Annuler
          </button>
          <button type="button" className="ax-btn ax-btn--soft-danger" onClick={() => void submit()} disabled={saving}>
            <IconUserOff />
            <span className="ax-btn__label">{saving ? 'Désactivation…' : 'Désactiver'}</span>
          </button>
        </>
      }
    >
      {error && <ErrorAlert error={error} />}
      <p style={{ margin: 0, fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)' }}>
        Cette personne perdra immédiatement l&apos;accès à cet espace centre ({STAFF_ROLE_LABELS[member.role]}). Son
        historique d&apos;activité est conservé — un membre n&apos;est jamais supprimé, seulement désactivé.
      </p>
    </Modal>
  );
}

/* ── reactivate confirmation (S1 — symmetric of deactivation) ── */

function ReactivateModal({
  member,
  onClose,
  onDone,
}: {
  member: StaffMember;
  onClose: () => void;
  onDone: () => void;
}) {
  const { centerId } = useCenter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      await reactivateStaff(centerId, member.id);
      onDone();
    } catch (err) {
      setError(toApiError(err));
      setSaving(false);
    }
  };

  return (
    <Modal
      title={`Réactiver ${memberName(member)} ?`}
      busy={saving}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="ax-btn ax-btn--ghost" onClick={onClose} disabled={saving}>
            Annuler
          </button>
          <button type="button" className="ax-btn ax-btn--primary" onClick={() => void submit()} disabled={saving}>
            <IconRefresh />
            <span className="ax-btn__label">{saving ? 'Réactivation…' : 'Réactiver'}</span>
          </button>
        </>
      }
    >
      {error && <ErrorAlert error={error} />}
      <p style={{ margin: 0, fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)' }}>
        Cette personne retrouvera immédiatement l&apos;accès à cet espace centre, avec son rôle
        ({STAFF_ROLE_LABELS[member.role]}) et son historique intacts.
      </p>
    </Modal>
  );
}

/* ── screen ── */

export function Staff() {
  const { centerId, roles } = useCenter();
  // Multi-roles S2 : un directeur-médecin garde l'accès personnel.
  const isDirector = roles.includes('directeur');
  const [page, setPage] = useState(1);
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<StaffMember | null>(null);
  const [deactivating, setDeactivating] = useState<StaffMember | null>(null);
  const [reactivating, setReactivating] = useState<StaffMember | null>(null);

  const staff = useAsync(
    () => (isDirector ? listStaff(centerId, page) : Promise.resolve(null)),
    [centerId, page, isDirector],
  );
  const results = staff.data?.results ?? [];

  useEffect(() => {
    setPage(1);
  }, [centerId]);

  return (
    <>
      <PageHead
        title="Personnel"
        subtitle="Les membres de l'équipe et leurs rôles dans ce centre."
        actions={
          isDirector ? (
            <button type="button" className="ax-btn ax-btn--primary" onClick={() => setAddOpen(true)}>
              <IconPlus />
              <span className="ax-btn__label">Ajouter un membre</span>
            </button>
          ) : undefined
        }
      />

      <div className="ax-dash-grid">
        <section className="ax-card ax-col--12" role="region" aria-label="Équipe du centre">
          {!isDirector ? (
            <EmptyState
              title="Réservé au directeur"
              message="La gestion du personnel (liste, ajout, désactivation) est réservée au directeur du centre."
            />
          ) : staff.loading ? (
            <TableSkeleton rows={5} cols={4} />
          ) : staff.error ? (
            <div style={{ padding: 'var(--ax-space-4)' }}>
              <ErrorAlert error={staff.error} onRetry={staff.reload} />
            </div>
          ) : results.length === 0 ? (
            <EmptyState
              title="Aucun membre"
              message="Ajoutez les membres de votre équipe : chacun se connectera avec son téléphone."
              action={
                <button type="button" className="ax-btn ax-btn--secondary" onClick={() => setAddOpen(true)}>
                  <IconPlus />
                  <span className="ax-btn__label">Ajouter un membre</span>
                </button>
              }
            />
          ) : (
            <>
              <div className="ax-table-wrap" tabIndex={0} role="region" aria-label="Tableau">
                <table className="ax-table ax-table--hover">
                  <thead className="ax-table__head">
                    <tr>
                      <th className="ax-table__th" scope="col">Membre</th>
                      <th className="ax-table__th" scope="col">Téléphone</th>
                      <th className="ax-table__th" scope="col">Rôle</th>
                      <th className="ax-table__th" scope="col">Statut</th>
                      <th className="ax-table__th" scope="col">Depuis</th>
                      <th className="ax-table__th" scope="col"><span className="ax-visually-hidden">Actions</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((m) => (
                      <tr key={m.id} className="ax-table__row" style={m.is_active ? undefined : { opacity: 0.6 }}>
                        <td className="ax-table__td">
                          <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flexWrap: 'nowrap' }}>
                            <MemberAvatar member={m} />
                            <span style={{ fontWeight: 500, color: 'var(--ax-text-strong)' }}>{memberName(m)}</span>
                          </div>
                        </td>
                        <td className="ax-table__td ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-muted)' }}>
                          {m.user.phone}
                        </td>
                        <td className="ax-table__td">
                          <StatusBadge tone={m.role === 'directeur' ? 'accent' : 'info'} label={STAFF_ROLE_LABELS[m.role]} />
                        </td>
                        <td className="ax-table__td">
                          {m.is_active ? (
                            <StatusBadge tone="success" label="Actif" />
                          ) : (
                            <StatusBadge tone="neutral" label="Désactivé" />
                          )}
                        </td>
                        <td className="ax-table__td" style={{ color: 'var(--ax-text-muted)', whiteSpace: 'nowrap' }}>
                          {formatDate(m.created_at)}
                        </td>
                        <td className="ax-table__td" style={{ textAlign: 'end' }}>
                          {m.is_active ? (
                            <div className="ax-cluster" style={{ gap: 'var(--ax-space-1)', justifyContent: 'flex-end', flexWrap: 'nowrap' }}>
                              <button
                                type="button"
                                className="ax-btn ax-btn--ghost ax-btn--sm"
                                onClick={() => setEditing(m)}
                              >
                                <IconEdit />
                                <span className="ax-btn__label">Modifier</span>
                              </button>
                              <button
                                type="button"
                                className="ax-btn ax-btn--ghost ax-btn--sm"
                                onClick={() => setDeactivating(m)}
                              >
                                <IconUserOff />
                                <span className="ax-btn__label">Désactiver</span>
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              className="ax-btn ax-btn--ghost ax-btn--sm"
                              onClick={() => setReactivating(m)}
                            >
                              <IconRefresh />
                              <span className="ax-btn__label">Réactiver</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {staff.data && <Pagination count={staff.data.count} page={page} onPage={setPage} />}
            </>
          )}
        </section>
      </div>

      {addOpen && (
        <AddStaffModal
          onClose={() => setAddOpen(false)}
          onCreated={() => {
            setAddOpen(false);
            staff.reload();
          }}
        />
      )}
      {editing && (
        <EditStaffModal
          member={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            staff.reload();
          }}
        />
      )}
      {deactivating && (
        <DeactivateModal
          member={deactivating}
          onClose={() => setDeactivating(null)}
          onDone={() => {
            setDeactivating(null);
            staff.reload();
          }}
        />
      )}
      {reactivating && (
        <ReactivateModal
          member={reactivating}
          onClose={() => setReactivating(null)}
          onDone={() => {
            setReactivating(null);
            staff.reload();
          }}
        />
      )}
    </>
  );
}

export default Staff;
