'use client';
/*
 * Chioni — /pharmacie/equipe : les gens de l'officine (S9, ADR 0022 §12).
 *
 * **Aucun rôle, aucune hiérarchie**, et c'est une décision consignée : une
 * officine comorienne compte une à trois personnes qui font le même travail.
 * Tout membre actif répond aux demandes, dépose les pièces et inscrit un
 * collègue. Il n'y a donc ni sélecteur de rôle, ni bouton « promouvoir », ni
 * mention « responsable » — et il ne faut pas en ajouter : le backend n'a pas
 * le champ, et l'inventer à l'écran créerait une autorité imaginaire.
 *
 * La seule garde est le miroir exact du « dernier directeur » d'un centre :
 * **on ne retire pas la dernière personne active**. Une officine sans personne
 * est une boîte de réception que plus personne ne relève. Le backend refuse
 * avec une consigne ; l'écran la devance en montrant l'invitation à inscrire
 * un collègue AVANT — découvrir l'impasse au clic serait une mauvaise surprise
 * sur un geste qu'on croit anodin.
 *
 * Le compte créé est un compte **ombre** réclamé par OTP : aucun mot de passe
 * n'existe, donc l'écran n'en promet aucun.
 */
import { useEffect, useState } from 'react';
import { usePharmacy } from '@/context/PharmacyContext';
import type { ApiError } from '@/lib/api';
import {
  addPharmacyMember,
  deactivatePharmacyMember,
  listPharmacyMembers,
} from '@/lib/endpoints/pharmacy';
import {
  ACTION_CANCEL,
  PHARMACY_MEMBERS_LAST_HINT,
  PHARMACY_MEMBERS_NO_ROLE_HINT,
  PHARMACY_MEMBERS_SUBTITLE,
  PHARMACY_MEMBERS_TITLE,
  PHARMACY_MEMBER_ADD,
  PHARMACY_MEMBER_ADD_SUBMIT,
  PHARMACY_MEMBER_ADD_TITLE,
  PHARMACY_MEMBER_FIRST_NAME_LABEL,
  PHARMACY_MEMBER_INACTIVE,
  PHARMACY_MEMBER_LAST_NAME_LABEL,
  PHARMACY_MEMBER_PHONE_LABEL,
  PHARMACY_MEMBER_REMOVE,
  PHARMACY_MEMBER_REMOVE_CONFIRM,
  PHARMACY_MEMBER_REMOVE_TITLE,
  PHARMACY_MEMBER_SHADOW_NOTICE,
  pharmacyMemberAdded,
  pharmacyMemberRemoveMessage,
  pharmacyMemberRemoved,
  pharmacyMemberSince,
} from '@/lib/labels';
import type { PharmacyMember } from '@/lib/types';
import {
  Card,
  ConfirmModal,
  ErrorAlert,
  FieldError,
  SkeletonCards,
  Stack,
  SuccessAlert,
  toApiError,
  useAsync,
  useScopedState,
} from './shared';

function AddMemberForm({
  onCancel,
  onAdded,
}: {
  onCancel: () => void;
  onAdded: (member: PharmacyMember) => void;
}) {
  const { pharmacyId } = usePharmacy();
  const [phone, setPhone] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      const member = await addPharmacyMember(pharmacyId, {
        phone: phone.trim(),
        first_name: firstName.trim(),
        last_name: lastName.trim(),
      });
      onAdded(member);
    } catch (err) {
      setError(toApiError(err));
      setSaving(false);
    }
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}
    >
      <h3 style={{ margin: 0, fontSize: 'var(--ax-text-md)', color: 'var(--ax-text-strong)' }}>
        {PHARMACY_MEMBER_ADD_TITLE}
      </h3>

      {error && error.messages.length > 0 && <ErrorAlert error={error} />}

      <div className="ax-field">
        <label className="ax-label" htmlFor="pm-phone">
          {PHARMACY_MEMBER_PHONE_LABEL} <span className="ax-field__required" aria-hidden="true">*</span>
        </label>
        <input
          id="pm-phone"
          type="tel"
          inputMode="tel"
          className={`ax-input${error?.fieldErrors.phone ? ' is-invalid' : ''}`}
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+269…"
          required
          autoComplete="off"
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
          <label className="ax-label" htmlFor="pm-first">
            {PHARMACY_MEMBER_FIRST_NAME_LABEL}
          </label>
          <input
            id="pm-first"
            type="text"
            className="ax-input"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            autoComplete="off"
          />
          <FieldError error={error} field="first_name" />
        </div>
        <div className="ax-field">
          <label className="ax-label" htmlFor="pm-last">
            {PHARMACY_MEMBER_LAST_NAME_LABEL}
          </label>
          <input
            id="pm-last"
            type="text"
            className="ax-input"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            autoComplete="off"
          />
          <FieldError error={error} field="last_name" />
        </div>
      </div>

      {/* On ne promet JAMAIS un mot de passe : il n'en existe pas. */}
      <p style={{ margin: 0, fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)', lineHeight: 1.7 }}>
        {PHARMACY_MEMBER_SHADOW_NOTICE}
      </p>

      <button
        type="submit"
        className={`ax-btn ax-btn--primary ax-btn--lg ax-btn--block${saving ? ' is-loading' : ''}`}
        disabled={saving || phone.trim() === ''}
        aria-busy={saving}
      >
        <span className="ax-btn__spinner" aria-hidden="true"></span>
        <span className="ax-btn__label">{PHARMACY_MEMBER_ADD_SUBMIT}</span>
      </button>
      <button
        type="button"
        className="ax-btn ax-btn--ghost ax-btn--lg ax-btn--block"
        onClick={onCancel}
        disabled={saving}
      >
        {ACTION_CANCEL}
      </button>
    </form>
  );
}

export function PharmacyTeam() {
  const { pharmacyId } = usePharmacy();
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<PharmacyMember | null>(null);
  const [removeError, setRemoveError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);
  /* Le message de succès nomme une personne d'UNE officine : il tombe avec
     elle (guardian S9), sinon « X a été retiré » accompagne la bascule vers
     une équipe où X n'a jamais mis les pieds. */
  const [flash, setFlash] = useScopedState<string>(String(pharmacyId));

  /* Un retrait en attente de confirmation vise un membre de l'officine sous
     laquelle la modale a été ouverte : on l'annule au changement plutôt que
     de laisser un clic partir sur l'autre officine. */
  useEffect(() => {
    setAdding(false);
    setRemoving(null);
    setRemoveError(null);
  }, [pharmacyId]);

  const members = useAsync(() => listPharmacyMembers(pharmacyId), [pharmacyId]);
  const rows = members.data ?? [];
  const activeCount = rows.filter((m) => m.is_active).length;
  const lastOneStanding = activeCount <= 1;

  const remove = async () => {
    if (!removing) return;
    setBusy(true);
    setRemoveError(null);
    try {
      await deactivatePharmacyMember(pharmacyId, removing.id);
      setFlash(pharmacyMemberRemoved(removing.display_name));
      setRemoving(null);
      members.reload();
    } catch (err) {
      setRemoveError(toApiError(err));
    }
    setBusy(false);
  };

  return (
    <Stack>
      {flash && <SuccessAlert message={flash} />}

      <Card
        title={PHARMACY_MEMBERS_TITLE}
        subtitle={PHARMACY_MEMBERS_SUBTITLE}
      >
        {members.loading ? (
          <SkeletonCards count={1} />
        ) : members.error ? (
          <ErrorAlert error={members.error} onRetry={members.reload} />
        ) : (
          <>
            <ul className="ax-list ax-list--compact">
              {rows.map((member) => (
                <li key={member.id} className="ax-list__row">
                  <span className="ax-list__content">
                    <span className="ax-list__title" style={{ fontWeight: 'var(--ax-weight-medium)' }}>
                      {member.display_name}
                    </span>
                    <span
                      style={{
                        display: 'block',
                        fontSize: 'var(--ax-text-xs)',
                        color: 'var(--ax-text-muted)',
                      }}
                    >
                      {pharmacyMemberSince(member.created_at)}
                    </span>
                  </span>
                  <span
                    className="ax-list__trailing"
                    style={{ display: 'flex', gap: 'var(--ax-space-2)', alignItems: 'center' }}
                  >
                    {!member.is_active ? (
                      /* « Retiré » et non « Inactif » ni « Désactivé » : c'est
                         une personne, pas un compte technique. Ton NEUTRE —
                         un départ n'est pas un incident. */
                      <span className="ax-badge ax-badge--soft ax-badge--neutral">
                        {PHARMACY_MEMBER_INACTIVE}
                      </span>
                    ) : (
                      !lastOneStanding && (
                        <button
                          type="button"
                          className="ax-btn ax-btn--ghost ax-btn--sm"
                          onClick={() => {
                            setRemoveError(null);
                            setRemoving(member);
                          }}
                          aria-label={`Retirer ${member.display_name} de l'officine`}
                        >
                          <span className="ax-btn__label">{PHARMACY_MEMBER_REMOVE}</span>
                        </button>
                      )
                    )}
                  </span>
                </li>
              ))}
            </ul>

            {/* La garde « jamais la dernière personne », dite AVANT le clic —
                et accompagnée du geste qui la lève, plutôt que d'un refus. */}
            {lastOneStanding && (
              <p style={{ margin: 0, fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)', lineHeight: 1.7 }}>
                {PHARMACY_MEMBERS_LAST_HINT}
              </p>
            )}

            <p style={{ margin: 0, fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-muted)', lineHeight: 1.7 }}>
              {PHARMACY_MEMBERS_NO_ROLE_HINT}
            </p>

            {adding ? (
              <AddMemberForm
                onCancel={() => setAdding(false)}
                onAdded={(member) => {
                  setAdding(false);
                  setFlash(pharmacyMemberAdded(member.display_name));
                  members.reload();
                }}
              />
            ) : (
              <button
                type="button"
                className="ax-btn ax-btn--secondary ax-btn--lg ax-btn--block"
                onClick={() => setAdding(true)}
              >
                <span className="ax-btn__label">{PHARMACY_MEMBER_ADD}</span>
              </button>
            )}
          </>
        )}
      </Card>

      <ConfirmModal
        open={removing !== null}
        title={PHARMACY_MEMBER_REMOVE_TITLE}
        message={removing ? pharmacyMemberRemoveMessage(removing.display_name) : ''}
        confirmLabel={PHARMACY_MEMBER_REMOVE_CONFIRM}
        busy={busy}
        error={removeError}
        onConfirm={() => void remove()}
        onClose={() => {
          if (busy) return;
          setRemoving(null);
          setRemoveError(null);
        }}
      />
    </Stack>
  );
}

export default PharmacyTeam;
