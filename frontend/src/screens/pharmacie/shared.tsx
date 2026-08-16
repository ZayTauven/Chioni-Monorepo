'use client';
/*
 * Chioni — briques partagées des écrans de l'OFFICINE (S9, ADR 0022).
 *
 * ─── D'où viennent les primitives, et pourquoi de là ──────────────────────
 *
 * Deux socles se croisent ici, et le partage n'est pas arbitraire :
 *
 * - **l'affichage vient de `screens/patient/ui`** — alertes lisibles, boutons
 *   pleine largeur ≥ 48 px, états vides qui expliquent, `ConfirmModal` dont le
 *   focus tombe sur la SORTIE et jamais sur le bouton d'action. Ce sont les
 *   primitives écrites pour un Android d'entrée de gamme, et une officine
 *   comorienne répond depuis un téléphone, au comptoir. Elles sont neutres
 *   (aucun contexte, aucun appel API), donc réexportées plutôt que copiées ;
 * - **la mécanique vient de `screens/centre/shared`** — `useAsync`,
 *   `toApiError`, `Pagination`, `FieldError` : du code sans contexte lui aussi.
 *
 * Ce qui n'est **PAS** repris, et c'est la règle du module : l'`ErrorAlert` du
 * centre (il monte un bouton « Actualiser mes accès » branché sur
 * `CenterContext`) et tout ce qui touche à un centre. Les écrans de cet espace
 * n'importent QUE depuis ce fichier, ce qui rend la règle vérifiable en lisant
 * les imports : **rien sous `screens/pharmacie/` ne peut appeler
 * `useCenter()`** — une officine n'est pas un tenant, et le contexte n'est
 * jamais monté sous ce layout.
 */
import type { ReactNode } from 'react';
import {
  PHARMACY_PENDING_MESSAGE,
  PHARMACY_PENDING_TITLE,
  PHARMACY_STATUS_REASON_LABEL,
  PHARMACY_SUSPENDED_MESSAGE,
  PHARMACY_SUSPENDED_TITLE,
} from '@/lib/labels';
import type { AvailabilityRequestStatus, PharmacyStatus } from '@/lib/types';

/**
 * Une demande à laquelle on ne peut plus répondre — **la règle des DEUX
 * écrans de la boîte de réception**.
 *
 * Deux causes, une seule conséquence : le centre a terminé sa recherche, ou
 * les 48 h sont passées. Et la péremption est **opposable avant le beat
 * horaire** côté serveur (ADR 0022, addendum n° 7) : une demande peut donc
 * être encore `ouverte` en base et déjà refusée à l'envoi.
 *
 * Sans cette règle partagée, la liste affichait « En cours » et « Vous n'avez
 * pas encore répondu » sur une demande dont le détail bloque le formulaire :
 * on fait traverser un écran à quelqu'un qui est au comptoir, pour un mur —
 * et la phrase se lit comme un reproche sur un geste devenu impossible.
 *
 * **Ce que cette fonction N'AUTORISE PAS (revue guardian S9)** : à retirer le
 * formulaire de réponse. La branche `status === 'close'` vient du serveur, la
 * branche `expires_at` vient de l'horloge du téléphone — et un appareil
 * d'entrée de gamme qui a perdu l'heure réseau retirerait alors l'officine du
 * réseau sans que personne, au comptoir, n'ait de raison de soupçonner sa
 * date. Elle sert donc à PEINDRE (badge de liste, avertissement de détail) ;
 * le droit de répondre, lui, se demande au serveur.
 */
export function isRequestOver(request: {
  status: AvailabilityRequestStatus;
  expires_at: string;
}): boolean {
  if (request.status === 'close') return true;
  const expires = new Date(request.expires_at).getTime();
  return Number.isFinite(expires) && expires <= Date.now();
}

export {
  ConfirmModal,
  EmptyState,
  ErrorAlert,
  LoadMoreButton,
  Modal,
  SkeletonCards,
  SuccessAlert,
  errorMessages,
} from '@/screens/patient/ui';

export {
  FieldError,
  PAGE_SIZE,
  Pagination,
  toApiError,
  useAsync,
  useDebounced,
  useScopedState,
} from '@/screens/centre/shared';

/**
 * Le bandeau d'état de l'officine — **la pièce la plus importante de l'espace**.
 *
 * Il existe pour une raison précise et documentée : une boîte de réception
 * vide sans phrase se lit « l'application ne marche pas », et on n'y revient
 * pas. Une officine en attente doit lire *pourquoi* elle ne reçoit rien.
 *
 * Deux règles de rédaction, tenues par les libellés qu'il affiche :
 *
 * 1. **`en_attente` n'est pas une erreur** — c'est l'état ordinaire du premier
 *    jour. Ton `info`, jamais `warning` ni `danger` : accueillir une nouvelle
 *    inscrite par un panneau d'alarme serait absurde. Le geste utile
 *    (« déposez vos pièces ») est dans la phrase, pas dans un bouton isolé.
 * 2. **`suspendue` dit ce qui CONTINUE avant ce qui est fermé** (patron des
 *    bandeaux S4/S5). Commencer par la sanction fait refermer l'écran avant
 *    d'avoir lu comment se régulariser — et se régulariser est précisément ce
 *    qu'on veut rendre facile.
 *
 * Le motif écrit par Chioni (`status_reason`) est rendu **en entier**, à la
 * suite : c'est le miroir exact du `kyc_reason` lu par un directeur de centre,
 * et suspendre quelqu'un sans lui dire quoi corriger n'est pas une décision,
 * c'est une punition.
 *
 * Une officine `validee` n'affiche **rien** : un bandeau permanent « tout va
 * bien » s'apprend à ignorer, et le jour où il change de texte, personne ne le
 * lit plus.
 */
export function PharmacyStatusBanner({
  status,
  statusReason = '',
}: {
  status: PharmacyStatus;
  /**
   * Le motif écrit par Chioni. Optionnel **à dessein** : il ne vit que sur
   * `GET /pharmacy/{p}/`, alors que le STATUT arrive avec `/auth/me/`. Le
   * bandeau se peint donc dès la première frame avec ce qu'il sait, et gagne
   * la consigne quand elle arrive — plutôt que de laisser une officine « en
   * attente » regarder une boîte vide sans un mot le temps d'un aller-retour
   * réseau. C'est précisément l'écran qui ne doit jamais ressembler à une
   * panne, et une connexion comorienne rend cette seconde-là très longue.
   */
  statusReason?: string;
}) {
  if (status === 'validee') return null;
  const pending = status === 'en_attente';
  return (
    <div className={`ax-alert ax-alert--${pending ? 'info' : 'warning'}`} role="status">
      <div className="ax-alert__content">
        <p className="ax-alert__title">
          {pending ? PHARMACY_PENDING_TITLE : PHARMACY_SUSPENDED_TITLE}
        </p>
        <p className="ax-alert__message" style={{ lineHeight: 1.7 }}>
          {pending ? PHARMACY_PENDING_MESSAGE : PHARMACY_SUSPENDED_MESSAGE}
        </p>
        {statusReason !== '' && (
          <>
            <p
              className="ax-alert__message"
              style={{ marginBlockStart: 'var(--ax-space-3)', fontWeight: 'var(--ax-weight-semibold)' }}
            >
              {PHARMACY_STATUS_REASON_LABEL}
            </p>
            <p className="ax-alert__message" style={{ lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
              {statusReason}
            </p>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Une carte de l'espace : le conteneur, en un seul endroit.
 *
 * `actions` reste optionnel et volontairement peu utilisé : sur un téléphone,
 * un bouton dans un en-tête de carte se retrouve serré contre le titre — les
 * écrans de cet espace posent leurs actions en pleine largeur, dans le corps.
 */
export function Card({
  title,
  subtitle,
  actions,
  children,
}: {
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="ax-card" role="region" aria-label={title}>
      {(title || actions) && (
        <div className="ax-card__header" style={{ flexWrap: 'wrap', gap: 'var(--ax-space-3)' }}>
          <div className="ax-card__titles">
            {title && <h2 className="ax-card__title">{title}</h2>}
            {subtitle && <p className="ax-card__subtitle">{subtitle}</p>}
          </div>
          {actions}
        </div>
      )}
      <div
        className="ax-card__body"
        style={{
          paddingTop: title ? 0 : undefined,
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--ax-space-4)',
        }}
      >
        {children}
      </div>
    </section>
  );
}

/** La pile verticale des écrans de l'espace (même rythme que le patient). */
export function Stack({ children }: { children: ReactNode }) {
  return <div className="pat-stack">{children}</div>;
}
