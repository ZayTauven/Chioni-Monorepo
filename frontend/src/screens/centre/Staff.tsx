'use client';
/*
 * Chioni — /centre/personnel : l'équipe du centre.
 *
 * Le backend réserve TOUTE la ressource staff au directeur (lecture comprise,
 * vérifié dans apps/centers/views.py) : pour les autres rôles l'écran
 * l'explique sans appeler l'API. Ajout : téléphone* + rôle* (+ prénom/nom) —
 * un compte est créé s'il n'existe pas et la personne l'active par SMS.
 * Désactivation avec confirmation ; le 400 « dernier directeur » est montré
 * tel quel. Jamais de suppression (historique = piste d'audit).
 */
import { useEffect, useState } from 'react';
import { PageHead } from '@/components/shell/PageHead';
import { useCenter } from '@/context/CenterContext';
import type { ApiError } from '@/lib/api';
import { createStaff, deactivateStaff, listStaff, type StaffPayload } from '@/lib/endpoints/centers';
import { STAFF_ROLE_LABELS, formatDate } from '@/lib/labels';
import type { StaffMember, StaffRole } from '@/lib/types';
import {
  AvatarChip,
  EmptyState,
  ErrorAlert,
  FieldError,
  IconPlus,
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

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--ax-space-4)' }}>
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

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--ax-space-4)' }}>
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

/* ── screen ── */

export function Staff() {
  const { centerId, role } = useCenter();
  const isDirector = role === 'directeur';
  const [page, setPage] = useState(1);
  const [addOpen, setAddOpen] = useState(false);
  const [deactivating, setDeactivating] = useState<StaffMember | null>(null);

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
              <div className="ax-table-wrap">
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
                            <AvatarChip name={memberName(m)} seed={m.user.id} />
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
                          {m.is_active && (
                            <button
                              type="button"
                              className="ax-btn ax-btn--ghost ax-btn--sm"
                              onClick={() => setDeactivating(m)}
                            >
                              <IconUserOff />
                              <span className="ax-btn__label">Désactiver</span>
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
    </>
  );
}

export default Staff;
