'use client';
/*
 * Chioni — /pharmacie : la boîte de réception de l'officine (S9, ADR 0022).
 *
 * L'écran d'accueil du 5ᵉ espace, et **il doit dire la vérité sur le statut
 * avant toute chose**. Trois cas, trois écrans différents :
 *
 * - `en_attente` → « votre inscription est en cours d'examen ». Surtout pas
 *   une liste vide sans phrase : elle se lirait « ça ne marche pas », et
 *   personne ne revient sur une application qui semble cassée le premier jour ;
 * - `suspendue` → ce qui CONTINUE (l'historique, les pièces) avant ce qui est
 *   fermé (recevoir, répondre) ;
 * - `validee` → la liste, tout simplement.
 *
 * Ce que l'officine voit d'une demande, et rien d'autre : une zone, une liste
 * de médicaments, une date. Il n'y a **aucun emplacement** pour un centre, un
 * patient ou une posologie — le backend ne les envoie pas, et cet écran n'en
 * invente pas.
 *
 * Assets Vireo repris et adaptés : la liste en cartes empilées du chrome lite
 * (patron `PatientPaiements`) plutôt qu'un tableau — au comptoir, on lit une
 * carte à la fois, sur 360 px de large, sans défilement horizontal.
 */
import { useState } from 'react';
import Link from 'next/link';
import { usePharmacy } from '@/context/PharmacyContext';
import { getPharmacy, listInbox } from '@/lib/endpoints/pharmacy';
import {
  AVAILABILITY_STATUS_LABELS,
  PHARMACY_INBOX_EMPTY_MESSAGE,
  PHARMACY_INBOX_EMPTY_TITLE,
  PHARMACY_INBOX_FILTER_ALL,
  PHARMACY_INBOX_FILTER_CLOSED,
  PHARMACY_INBOX_FILTER_EMPTY_MESSAGE,
  PHARMACY_INBOX_FILTER_EMPTY_TITLE,
  PHARMACY_INBOX_FILTER_OPEN,
  PHARMACY_INBOX_NOT_ANSWERED,
  PHARMACY_INBOX_OVER_NOT_ANSWERED,
  PHARMACY_INBOX_SUBTITLE,
  PHARMACY_INBOX_TITLE,
  PHARMACY_PENDING_INBOX_EMPTY,
  PHARMACY_SUSPENDED_INBOX_EMPTY,
  availabilityItemsLabel,
  pharmacyAnsweredOn,
  pharmacyRequestAge,
} from '@/lib/labels';
import type { AvailabilityRequestStatus, InboxRequest } from '@/lib/types';
import {
  Card,
  EmptyState,
  ErrorAlert,
  PharmacyStatusBanner,
  Pagination,
  SkeletonCards,
  Stack,
  isRequestOver,
  useAsync,
} from './shared';

type Filter = AvailabilityRequestStatus | 'toutes';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'ouverte', label: PHARMACY_INBOX_FILTER_OPEN },
  { key: 'close', label: PHARMACY_INBOX_FILTER_CLOSED },
  { key: 'toutes', label: PHARMACY_INBOX_FILTER_ALL },
];

/**
 * Une demande reçue, en carte.
 *
 * `my_response` gouverne l'invite : « Répondre » la première fois, « Modifier
 * ma réponse » ensuite — jamais un état figé qui laisserait croire que c'est
 * joué. Le stock bouge, répondre à nouveau est le geste normal.
 */
function RequestCard({ request }: { request: InboxRequest }) {
  const answered = request.my_response !== null;
  /*
   * `open` ne suit PAS `status` seul : les 48 h peuvent être passées sans que
   * le beat horaire du serveur ait encore soldé l'enregistrement. La carte
   * disait alors « En cours » et menait à un formulaire bloqué — un mur au
   * bout d'un écran, pour quelqu'un qui est debout au comptoir.
   */
  const open = !isRequestOver(request);
  return (
    <Link
      href={`/pharmacie/demandes/${request.id}`}
      className="ax-card ax-card--interactive"
      style={{ textDecoration: 'none' }}
    >
      <div className="ax-card__body pat-gate__body">
        <div className="pat-row" style={{ minHeight: 0 }}>
          <div className="pat-row__main">
            <span className="pat-row__title">{availabilityItemsLabel(request.items.length)}</span>
            <span className="pat-row__meta">{pharmacyRequestAge(request.created_at)}</span>
          </div>
          <span
            className={`ax-badge ax-badge--soft ax-badge--${open ? 'info' : 'neutral'}`}
          >
            {AVAILABILITY_STATUS_LABELS[open ? 'ouverte' : 'close']}
          </span>
        </div>

        {/* Les libellés eux-mêmes : c'est LA donnée de l'écran, et la seule
            qui compte pour décider si on ouvre la demande. */}
        <ul className="pat-lines">
          {request.items.slice(0, 4).map((item) => (
            <li key={item.id}>
              <span className="pat-line__label">
                <span className="pat-line__name">{item.medication}</span>
              </span>
            </li>
          ))}
          {request.items.length > 4 && (
            <li>
              <span className="pat-line__label">
                <span className="pat-line__cat">
                  et {request.items.length - 4} autre
                  {request.items.length - 4 > 1 ? 's' : ''}…
                </span>
              </span>
            </li>
          )}
        </ul>

        <p className="pat-row__meta" style={{ margin: 0 }}>
          {answered && request.my_response
            ? pharmacyAnsweredOn(request.my_response.created_at)
            : open
              ? PHARMACY_INBOX_NOT_ANSWERED
              : PHARMACY_INBOX_OVER_NOT_ANSWERED}
        </p>
      </div>
    </Link>
  );
}

export function PharmacyInbox() {
  const { pharmacyId, pharmacy } = usePharmacy();
  const [filter, setFilter] = useState<Filter>('ouverte');
  const [page, setPage] = useState(1);

  /*
   * L'ÉTAT vient de `/auth/me/` (`PharmacyContext`) : il est juste dès la
   * première frame, sans attendre un fetch. La fiche n'est demandée que quand
   * elle a quelque chose à dire — c'est-à-dire quand l'officine n'est pas
   * validée : elle seule porte le `status_reason`, la consigne écrite par
   * Chioni. Dans le cas normal (officine validée, le bandeau ne s'affiche
   * pas), l'écran d'accueil du 5ᵉ espace tient donc en UNE requête au lieu de
   * deux — sur une connexion comorienne, ce n'est pas un détail.
   */
  const needsBanner = pharmacy.status !== 'validee';
  const profile = useAsync(
    () => (needsBanner ? getPharmacy(pharmacyId) : Promise.resolve(null)),
    [pharmacyId, needsBanner],
  );
  const inbox = useAsync(
    () =>
      listInbox(pharmacyId, {
        ...(filter === 'toutes' ? {} : { status: filter }),
        page,
      }),
    [pharmacyId, filter, page],
  );

  const rows = inbox.data?.results ?? [];
  /*
   * Le statut affiché : celui de `/auth/me/` d'abord (juste dès la première
   * frame), REMPLACÉ par celui de la fiche dès qu'elle arrive.
   *
   * `/auth/me/` fige les casquettes à la connexion : une officine validée par
   * Chioni pendant la session gardait « votre inscription est en cours
   * d'examen » au-dessus d'une boîte qui, elle, se remplissait — jusqu'à ce
   * qu'elle pense à se déconnecter. C'est l'écran qui ne doit jamais
   * ressembler à une panne : il ne doit pas non plus mentir sur l'état.
   * (guardian S9)
   */
  const status = profile.data?.status ?? pharmacy.status;

  return (
    <Stack>
      {/* Le bandeau se peint AVANT le moindre fetch (statut venu de
          `/auth/me/`) et se complète du motif de Chioni dès qu'il arrive. */}
      <PharmacyStatusBanner status={status} statusReason={profile.data?.status_reason} />

      <Card title={PHARMACY_INBOX_TITLE} subtitle={PHARMACY_INBOX_SUBTITLE}>
        {/* Filtres en pastilles — patron ProjectsList de Vireo, déjà adapté
            pour le parc de matériel (S8) et l'occupation (S6). */}
        <div
          className="ax-cluster"
          style={{ gap: 'var(--ax-space-2)', flexWrap: 'wrap' }}
          role="group"
          aria-label="Filtrer les demandes"
        >
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              className={`ax-btn ax-btn--sm ax-btn--pill ${filter === f.key ? 'ax-btn--primary' : 'ax-btn--secondary'}`}
              aria-pressed={filter === f.key}
              onClick={() => {
                setFilter(f.key);
                setPage(1);
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        {inbox.loading ? (
          <SkeletonCards />
        ) : inbox.error ? (
          <ErrorAlert error={inbox.error} onRetry={inbox.reload} />
        ) : rows.length === 0 ? (
          <EmptyState
            /*
             * L'état vide DIT pourquoi il est vide, et l'ordre des causes n'est
             * pas neutre : le STATUT passe AVANT le filtre. Une officine en
             * attente qui bascule sur « Toutes » ne doit pas lire « changez de
             * filtre » — sa boîte est vide parce que Chioni ne l'a pas encore
             * validée, et c'est la seule phrase qui l'aide. « Aucune demande »
             * et « vous ne recevez pas encore de demandes » sont deux vérités
             * différentes, et une seule est actionnable.
             */
            title={
              status === 'en_attente' || status === 'suspendue'
                ? PHARMACY_INBOX_EMPTY_TITLE
                : filter === 'toutes'
                  ? PHARMACY_INBOX_EMPTY_TITLE
                  : PHARMACY_INBOX_FILTER_EMPTY_TITLE
            }
            message={
              status === 'en_attente'
                ? PHARMACY_PENDING_INBOX_EMPTY
                : status === 'suspendue'
                  ? PHARMACY_SUSPENDED_INBOX_EMPTY
                  : filter === 'toutes'
                    ? PHARMACY_INBOX_EMPTY_MESSAGE
                    : PHARMACY_INBOX_FILTER_EMPTY_MESSAGE
            }
          />
        ) : (
          <>
            <div className="pat-stack">
              {rows.map((request) => (
                <RequestCard key={request.id} request={request} />
              ))}
            </div>
            {inbox.data && (
              <Pagination count={inbox.data.count} page={page} onPage={setPage} />
            )}
          </>
        )}
      </Card>

      {/* La fiche n'a pas chargé : on le dit, la boîte reste utilisable. */}
      {profile.error && <ErrorAlert error={profile.error} onRetry={profile.reload} />}
    </Stack>
  );
}

export default PharmacyInbox;
