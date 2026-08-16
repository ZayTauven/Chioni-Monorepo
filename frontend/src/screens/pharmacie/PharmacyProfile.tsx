'use client';
/*
 * Chioni — /pharmacie/officine : la fiche de l'officine (S9, ADR 0022).
 *
 * ─── LE point de vigilance de l'écran : le déménagement ───────────────────
 *
 * Modifier `island` ou `city` sur une officine **validée** la renvoie
 * `en_attente` (arbitrage PO du 16/08/2026, issu de la revue guardian). Ce
 * n'est pas une sanction : la commune n'est pas une ligne d'adresse, c'est la
 * SEULE borne à la distance que parcourt une liste de médicaments — une
 * officine validée à Fomboni qui se déclare à Moroni entrerait, à la seconde
 * suivante et sans que personne ne revérifie rien, dans le ciblage de chaque
 * diffusion de la capitale.
 *
 * Conséquence d'écran, non négociable : **on prévient AVANT de valider**.
 * Sans cet avertissement, la pharmacienne corrige son adresse un mardi matin,
 * ne reçoit plus rien le mercredi, et vit la rétrogradation comme un bug —
 * puis appelle le support, ou pire, abandonne. La modale dit les trois choses
 * dans cet ordre : ce qui arrive, ce qu'elle garde, comment en sortir. On ne
 * commence jamais par la perte.
 *
 * Corriger l'adresse, le téléphone, l'e-mail ou le nom **ne change rien** au
 * statut : l'avertissement ne se déclenche pas dans ces cas-là, sinon il
 * deviendrait un bruit qu'on apprend à cliquer sans lire.
 *
 * Assets Vireo repris : la fiche en lecture (`DetailItem`, patron
 * `CenterDetail`) et le formulaire `ax-field`/`ax-input` du socle. Le
 * formulaire est INLINE et non modal : sur un téléphone au comptoir, une
 * modale de six champs se défile mal et masque ce qu'on est en train de
 * corriger.
 */
import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { usePharmacy } from '@/context/PharmacyContext';
import type { ApiError } from '@/lib/api';
import { getPharmacy, updatePharmacy } from '@/lib/endpoints/pharmacy';
import {
  ACTION_CANCEL,
  ISLAND_LABELS,
  PHARMACY_ADDRESS_LABEL,
  PHARMACY_CITY_LABEL,
  PHARMACY_EMAIL_LABEL,
  PHARMACY_ISLAND_LABEL,
  PHARMACY_NAME_LABEL,
  PHARMACY_PHONE_LABEL,
  PHARMACY_PROFILE_EDIT,
  PHARMACY_PROFILE_SAVE,
  PHARMACY_PROFILE_SAVED,
  PHARMACY_PROFILE_SUBTITLE,
  PHARMACY_PROFILE_TITLE,
  PHARMACY_PUBLIC_HINT,
  PHARMACY_RELOCATION_CANCEL,
  PHARMACY_RELOCATION_CONFIRM,
  PHARMACY_RELOCATION_SAVED,
  PHARMACY_RELOCATION_TITLE,
  PHARMACY_RELOCATION_WARNING,
  PHARMACY_STATUS_READONLY_HINT,
  PHARMACY_ZONE_HINT,
} from '@/lib/labels';
import type { Island, PharmacySelf } from '@/lib/types';
import {
  Card,
  ConfirmModal,
  ErrorAlert,
  FieldError,
  PharmacyStatusBanner,
  SkeletonCards,
  Stack,
  SuccessAlert,
  toApiError,
  useAsync,
  useScopedState,
} from './shared';

const ISLANDS: Island[] = ['ngazidja', 'ndzuwani', 'mwali'];

const FORM_GRID: React.CSSProperties = {
  display: 'grid',
  /* `auto-fit` et non un `1fr 1fr` figé : sur un Android d'entrée de gamme en
     portrait, deux colonnes de 150 px rendent les libellés illisibles
     (correctif de la revue UX S3, appliqué partout depuis). */
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: 'var(--ax-space-4)',
};

function ReadView({ pharmacy, onEdit }: { pharmacy: PharmacySelf; onEdit: () => void }) {
  const rows: [string, string][] = [
    [PHARMACY_NAME_LABEL, pharmacy.name],
    [PHARMACY_ISLAND_LABEL, ISLAND_LABELS[pharmacy.island]],
    [PHARMACY_CITY_LABEL, pharmacy.city || '—'],
    [PHARMACY_ADDRESS_LABEL, pharmacy.address || '—'],
    [PHARMACY_PHONE_LABEL, pharmacy.phone || '—'],
    [PHARMACY_EMAIL_LABEL, pharmacy.email || '—'],
  ];
  return (
    <>
      <div style={FORM_GRID}>
        {rows.map(([label, value]) => (
          <div key={label}>
            <div
              style={{
                fontSize: 'var(--ax-text-2xs)',
                color: 'var(--ax-text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '.04em',
                marginBottom: 2,
              }}
            >
              {label}
            </div>
            <div style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)' }}>{value}</div>
          </div>
        ))}
      </div>

      <p style={{ margin: 0, fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)', lineHeight: 1.7 }}>
        {PHARMACY_PUBLIC_HINT}
      </p>

      <button type="button" className="ax-btn ax-btn--secondary ax-btn--lg ax-btn--block" onClick={onEdit}>
        <span className="ax-btn__label">{PHARMACY_PROFILE_EDIT}</span>
      </button>

      {/* Le statut appartient à Chioni : le dire évite qu'on le cherche. */}
      <p style={{ margin: 0, fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-muted)', lineHeight: 1.7 }}>
        {PHARMACY_STATUS_READONLY_HINT}
      </p>
    </>
  );
}

function EditView({
  pharmacy,
  onCancel,
  onSaved,
}: {
  pharmacy: PharmacySelf;
  onCancel: () => void;
  onSaved: (fresh: PharmacySelf, relocated: boolean) => void;
}) {
  const { pharmacyId } = usePharmacy();
  const [name, setName] = useState(pharmacy.name);
  const [island, setIsland] = useState<Island>(pharmacy.island);
  const [city, setCity] = useState(pharmacy.city);
  const [address, setAddress] = useState(pharmacy.address);
  const [phone, setPhone] = useState(pharmacy.phone);
  const [email, setEmail] = useState(pharmacy.email);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [confirmRelocation, setConfirmRelocation] = useState(false);

  /*
   * Le déménagement : île OU commune modifiée.
   *
   * **La comparaison est celle que fait le SERVEUR** — valeur à valeur, sur
   * la chaîne exactement telle qu'elle partira. La version précédente
   * normalisait la casse et les espaces, en promettant que corriger
   * « moroni » en « Moroni » n'était pas un déménagement : le backend, lui,
   * compare `getattr(pharmacy, field) != value` et rétrograde. La
   * pharmacienne corrigeait donc une faute de frappe un mardi matin,
   * l'écran ne lui disait rien, et elle ne recevait plus rien le mercredi —
   * exactement le « vécu comme un bug » que l'arbitrage PO veut éviter.
   *
   * On ne peut pas empêcher la rétrogradation côté client ; on peut la dire
   * avant. Le texte d'avertissement nomme donc explicitement le cas de la
   * correction d'orthographe, parce que Chioni ne sait pas la distinguer d'un
   * déménagement.
   */
  const nextCity = city.trim();
  const zoneChanged = island !== pharmacy.island || nextCity !== pharmacy.city;

  /* L'avertissement n'a de sens QUE sur une officine validée : une officine
     déjà en attente ou suspendue ne reçoit rien, elle ne perd rien. */
  const willBeDowngraded = zoneChanged && pharmacy.status === 'validee';

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const fresh = await updatePharmacy(pharmacyId, {
        name: name.trim(),
        island,
        city: nextCity,
        address: address.trim(),
        phone: phone.trim(),
        email: email.trim(),
      });
      onSaved(fresh, willBeDowngraded);
    } catch (err) {
      /*
       * La modale reste OUVERTE et porte l'échec (elle sait ramener son corps
       * en haut, correctif S5). La refermer renvoyait la personne devant un
       * formulaire de six champs dont l'explication vivait tout en haut,
       * c'est-à-dire hors de vue sur un téléphone — après avoir confirmé un
       * geste dont elle vient de lire les conséquences.
       */
      setError(toApiError(err));
      setSaving(false);
    }
  };

  const submit = () => {
    if (willBeDowngraded) {
      setConfirmRelocation(true);
      return;
    }
    void save();
  };

  return (
    <>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}
      >
        {error && error.messages.length > 0 && <ErrorAlert error={error} />}

        <div className="ax-field">
          <label className="ax-label" htmlFor="ph-name">
            {PHARMACY_NAME_LABEL}
          </label>
          <input
            id="ph-name"
            type="text"
            className={`ax-input${error?.fieldErrors.name ? ' is-invalid' : ''}`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={255}
            autoComplete="off"
          />
          <FieldError error={error} field="name" />
        </div>

        <div style={FORM_GRID}>
          <div className="ax-field">
            <label className="ax-label" htmlFor="ph-island">
              {PHARMACY_ISLAND_LABEL}
            </label>
            <select
              id="ph-island"
              className="ax-select"
              value={island}
              onChange={(e) => setIsland(e.target.value as Island)}
            >
              {ISLANDS.map((i) => (
                <option key={i} value={i}>
                  {ISLAND_LABELS[i]}
                </option>
              ))}
            </select>
            <FieldError error={error} field="island" />
          </div>

          <div className="ax-field">
            <label className="ax-label" htmlFor="ph-city">
              {PHARMACY_CITY_LABEL}
            </label>
            <input
              id="ph-city"
              type="text"
              className={`ax-input${error?.fieldErrors.city ? ' is-invalid' : ''}`}
              value={city}
              onChange={(e) => setCity(e.target.value)}
              maxLength={128}
              autoComplete="off"
            />
            <FieldError error={error} field="city" />
          </div>
        </div>

        {/* La commune n'est pas une ligne d'adresse : le dire AU CONTACT des
            deux champs concernés, pas dans une aide générale. */}
        <p style={{ margin: 0, fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-muted)', lineHeight: 1.7 }}>
          {PHARMACY_ZONE_HINT}
        </p>

        {/* Et quand le changement est RÉELLEMENT en cours de saisie, la
            conséquence s'affiche avant même le bouton — la modale de
            confirmation ne doit jamais être la première fois qu'on l'apprend. */}
        {willBeDowngraded && (
          <div className="ax-alert ax-alert--warning" role="status">
            <div className="ax-alert__content">
              <p className="ax-alert__title">{PHARMACY_RELOCATION_TITLE}</p>
              <p className="ax-alert__message" style={{ lineHeight: 1.7 }}>
                {PHARMACY_RELOCATION_WARNING}
              </p>
            </div>
          </div>
        )}

        <div className="ax-field">
          <label className="ax-label" htmlFor="ph-address">
            {PHARMACY_ADDRESS_LABEL}
          </label>
          <input
            id="ph-address"
            type="text"
            className="ax-input"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            maxLength={255}
            autoComplete="off"
          />
          <FieldError error={error} field="address" />
        </div>

        <div style={FORM_GRID}>
          <div className="ax-field">
            <label className="ax-label" htmlFor="ph-phone">
              {PHARMACY_PHONE_LABEL}
            </label>
            <input
              id="ph-phone"
              type="tel"
              inputMode="tel"
              className={`ax-input${error?.fieldErrors.phone ? ' is-invalid' : ''}`}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+269…"
              autoComplete="off"
            />
            <FieldError error={error} field="phone" />
          </div>

          <div className="ax-field">
            <label className="ax-label" htmlFor="ph-email">
              {PHARMACY_EMAIL_LABEL}
            </label>
            <input
              id="ph-email"
              type="email"
              className={`ax-input${error?.fieldErrors.email ? ' is-invalid' : ''}`}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="off"
            />
            <FieldError error={error} field="email" />
          </div>
        </div>

        <button
          type="submit"
          className={`ax-btn ax-btn--primary ax-btn--lg ax-btn--block${saving ? ' is-loading' : ''}`}
          disabled={saving}
          aria-busy={saving}
        >
          <span className="ax-btn__spinner" aria-hidden="true"></span>
          <span className="ax-btn__label">{PHARMACY_PROFILE_SAVE}</span>
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

      {/* Second temps de la même vérité : le geste est à un clic, la modale
          le nomme (« Déclarer le déménagement ») et la sortie est explicite
          (« Garder ma commune actuelle ») — jamais un « Annuler » qui laisse
          croire qu'on annule l'enregistrement entier. */}
      <ConfirmModal
        open={confirmRelocation}
        title={PHARMACY_RELOCATION_TITLE}
        message={PHARMACY_RELOCATION_WARNING}
        confirmLabel={PHARMACY_RELOCATION_CONFIRM}
        cancelLabel={PHARMACY_RELOCATION_CANCEL}
        busy={saving}
        error={confirmRelocation ? error : undefined}
        onConfirm={() => void save()}
        onClose={() => {
          if (saving) return;
          setConfirmRelocation(false);
        }}
      />
    </>
  );
}

export function PharmacyProfile() {
  const { pharmacyId, pharmacy: contextPharmacy } = usePharmacy();
  const { refreshMe } = useAuth();

  /*
   * ── Portée : l'officine ACTIVE, et c'est ici que ça comptait le plus ──
   *
   * La fiche gardée après un enregistrement décrit UNE officine. Sans portée,
   * une personne qui en tient deux — corrige la fiche de la première, puis
   * bascule depuis le sélecteur de l'en-tête, qui ne quitte pas la page —
   * lisait la devanture de l'officine A sous le nom de l'officine B ; et
   * comme `EditView` sème ses six champs depuis cet objet-là pendant que son
   * `pharmacyId` vient du contexte, un « Modifier » suivi d'un
   * « Enregistrer » **écrivait l'identité de A sur B**. Le PATCH aurait alors
   * changé la commune de B — c'est-à-dire l'aurait renvoyée `en_attente` et
   * coupée de toute demande, sans que personne n'ait voulu la déménager.
   */
  const scope = String(pharmacyId);
  const [patched, setPatched] = useScopedState<PharmacySelf>(scope);
  const [flash, setFlash] = useScopedState<string>(scope);
  const [editing, setEditing] = useState(false);

  /* Un formulaire ouvert appartient à l'officine sous laquelle il a été
     ouvert : on ne le transporte pas, on le referme. */
  useEffect(() => {
    setEditing(false);
  }, [pharmacyId]);

  const profile = useAsync(() => getPharmacy(pharmacyId), [pharmacyId]);
  const pharmacy = patched ?? profile.data;

  return (
    <Stack>
      {flash && <SuccessAlert message={flash} />}
      <PharmacyStatusBanner
        status={pharmacy?.status ?? contextPharmacy.status}
        statusReason={pharmacy?.status_reason}
      />

      <Card title={PHARMACY_PROFILE_TITLE} subtitle={PHARMACY_PROFILE_SUBTITLE}>
        {profile.loading && !pharmacy ? (
          <SkeletonCards count={1} />
        ) : !pharmacy ? (
          profile.error && <ErrorAlert error={profile.error} onRetry={profile.reload} />
        ) : editing ? (
          <EditView
            /* Défense en profondeur : le formulaire sème SIX champs depuis
               `pharmacy` au montage. La clé garantit qu'il ne survit jamais à
               un changement d'officine, quoi qu'il arrive au-dessus. */
            key={pharmacyId}
            pharmacy={pharmacy}
            onCancel={() => setEditing(false)}
            onSaved={(fresh, relocated) => {
              setPatched(fresh);
              setEditing(false);
              /* Le message NOMME ce qui vient de se passer. « Votre fiche est
                 à jour. » posé au-dessus d'un bandeau « en attente de
                 validation » que la personne n'a rien fait pour mériter se
                 lit comme une panne — c'est la rétrogradation elle-même qu'il
                 faut annoncer, avec ce qui continue. */
              setFlash(relocated ? PHARMACY_RELOCATION_SAVED : PHARMACY_PROFILE_SAVED);
              /* Le nom, la zone ET le statut vivent aussi dans `/auth/me/`
                 (ils alimentent le bandeau d'identité du chrome) : sans ce
                 rafraîchissement, l'en-tête afficherait « Validée » sur une
                 officine que le déménagement vient de renvoyer en
                 vérification — c'est-à-dire l'inverse de ce que l'écran vient
                 d'annoncer. */
              void refreshMe();
            }}
          />
        ) : (
          <ReadView pharmacy={pharmacy} onEdit={() => setEditing(true)} />
        )}
      </Card>
    </Stack>
  );
}

export default PharmacyProfile;
