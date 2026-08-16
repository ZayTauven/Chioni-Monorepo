'use client';
/*
 * Chioni — « Où trouver mes médicaments ? » (S9, ADR 0022), dans le carnet.
 *
 * **Le bénéfice du sprint, rendu à la personne qui marche.** Le reste du
 * module — la diffusion, le comptoir, le back-office — n'existe que pour
 * produire cet écran-ci : la liste des pharmacies qui ont le traitement, et
 * leur numéro.
 *
 * ─── Quatre décisions d'écran ─────────────────────────────────────────────
 *
 * 1. **Le téléphone est le geste utile**, avant tout le reste : un bouton
 *    `tel:` pleine largeur par officine. Appeler avant de marcher est
 *    exactement ce que le module fait gagner — pas une adresse à recopier.
 *    Il n'y a ni carte, ni itinéraire, ni distance : le produit ne localise
 *    personne (ADR 0022 décision 4).
 *
 * 2. **Lecture seule, et aucun bouton « chercher ».** Le patient consulte, le
 *    centre lance (arbitrage PO n° 3) : la recherche part en fin de
 *    consultation, quand le soignant sait quoi chercher. Offrir un bouton qui
 *    n'existe pas côté serveur créerait une attente déçue.
 *
 * 3. **Chargement à la demande.** Le carnet est consulté sur un Android
 *    d'entrée de gamme en 2G : les recherches ne sont pas préchargées pour
 *    toutes les ordonnances de la vie de la personne — on les demande quand on
 *    ouvre le panneau, et une seule fois.
 *
 * 4. **Une seule réponse par officine : la plus récente.** Le serveur rend
 *    l'historique complet (une pharmacie peut se corriger, son stock bouge),
 *    mais afficher deux réponses contradictoires de la même enseigne à
 *    quelqu'un qui cherche juste où aller serait cruel. Le centre, lui, voit
 *    tout l'historique sur son propre écran — c'est son travail.
 *
 * Ton : **aucun rouge**. « N'a pas ce médicament » est une information utile
 * (elle évite un trajet), et « cette recherche est terminée » est l'issue
 * normale au bout de 48 h — ni l'une ni l'autre n'est un échec de la personne.
 * Et **pas de `comment`** : le message libre d'une officine s'arrête au centre.
 */
import { useEffect, useState } from 'react';
import { listMyPrescriptionAvailability } from '@/lib/endpoints/pharmacy';
import {
  ISLAND_LABELS,
  PATIENT_AVAILABILITY_ACTION,
  PATIENT_AVAILABILITY_CALL,
  PATIENT_AVAILABILITY_CLOSED,
  PATIENT_AVAILABILITY_EMPTY,
  PATIENT_AVAILABILITY_HAS,
  PATIENT_AVAILABILITY_HAS_NOT,
  PATIENT_AVAILABILITY_LOADING,
  PATIENT_AVAILABILITY_NONE_HERE,
  PATIENT_AVAILABILITY_NO_ANSWER,
  PATIENT_AVAILABILITY_TITLE,
  patientAvailabilityAnswered,
} from '@/lib/labels';
import type {
  AvailabilityRequestPatient,
  AvailabilityResponsePatient,
} from '@/lib/types';
import { ErrorAlert } from './ui';

/** La dernière réponse de chaque officine — le serveur les rend triées desc. */
function latestPerPharmacy(
  responses: AvailabilityResponsePatient[],
): AvailabilityResponsePatient[] {
  const seen = new Set<number>();
  const kept: AvailabilityResponsePatient[] = [];
  for (const response of responses) {
    if (seen.has(response.pharmacy.id)) continue;
    seen.add(response.pharmacy.id);
    kept.push(response);
  }
  return kept;
}

/** Cette officine a-t-elle AU MOINS un des médicaments cherchés ? */
function hasAnything(response: AvailabilityResponsePatient): boolean {
  return response.lines.some((line) => line.is_available);
}

/**
 * Les officines qui ont quelque chose d'abord.
 *
 * C'est la seule question de la personne qui va marcher : « où est-ce que je
 * peux y aller ? ». Laisser trois « n'a rien » en tête de liste lui fait faire
 * défiler un écran pour trouver la réponse utile — et sur un carnet lu debout,
 * dans la rue, ce défilement-là ne se fait pas. Tri STABLE : à l'intérieur de
 * chaque groupe, l'ordre du serveur (le plus récent d'abord) est conservé.
 */
function usefulFirst(
  responses: AvailabilityResponsePatient[],
): AvailabilityResponsePatient[] {
  return [
    ...responses.filter((response) => hasAnything(response)),
    ...responses.filter((response) => !hasAnything(response)),
  ];
}

function ResponseCard({
  request,
  response,
}: {
  request: AvailabilityRequestPatient;
  response: AvailabilityResponsePatient;
}) {
  const available = hasAnything(response);
  return (
    <div
      style={{
        border: '1px solid var(--ax-border)',
        borderRadius: 'var(--ax-radius-md)',
        padding: 'var(--ax-space-4)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--ax-space-3)',
      }}
    >
      <div>
        <span className="pat-row__title" style={{ display: 'block' }}>
          {response.pharmacy.name}
        </span>
        <span className="pat-row__meta" style={{ display: 'block' }}>
          {response.pharmacy.city}
          {response.pharmacy.address ? ` · ${response.pharmacy.address}` : ''}
          {' · '}
          {ISLAND_LABELS[response.pharmacy.island]}
        </span>
      </div>

      {/* Les lignes, en mots simples et complets : « A ce médicament » plutôt
          que « Disponible », qui suppose de savoir de quoi on parle. */}
      <ul className="pat-lines">
        {request.items.map((item) => {
          const line = response.lines.find((l) => l.item === item.id);
          if (!line) return null;
          return (
            <li key={item.id}>
              <span className="pat-line__label">
                <span className="pat-line__name">{item.medication}</span>
                <span
                  className="pat-line__cat"
                  style={{
                    /* Le « oui » est mis en avant, le « non » reste neutre —
                       jamais rouge : ne pas avoir un médicament n'est pas une
                       faute de la pharmacie, ni un échec du patient. */
                    color: line.is_available ? 'var(--ax-success-700)' : 'var(--ax-text-muted)',
                    fontWeight: line.is_available ? 'var(--ax-weight-semibold)' : undefined,
                  }}
                >
                  {line.is_available ? PATIENT_AVAILABILITY_HAS : PATIENT_AVAILABILITY_HAS_NOT}
                </span>
              </span>
            </li>
          );
        })}
      </ul>

      {/*
        LE geste utile : appeler avant de se déplacer.

        Le bouton n'est en PRIMAIRE que si l'officine a au moins un des
        médicaments. Une pharmacie qui a répondu « non » partout gardait, elle
        aussi, un grand bouton bleu pleine largeur — c'est-à-dire une invitation
        à téléphoner pour rien, à quelqu'un qui compte ses unités. Le numéro
        reste accessible (le stock a pu bouger), il ne réclame plus l'œil.
      */}
      {!available && (
        <p className="pat-row__meta" style={{ margin: 0 }}>
          {PATIENT_AVAILABILITY_NONE_HERE}
        </p>
      )}
      {response.pharmacy.phone && (
        <a
          className={`ax-btn ${available ? 'ax-btn--primary' : 'ax-btn--secondary'} ax-btn--lg ax-btn--block`}
          href={`tel:${response.pharmacy.phone}`}
        >
          <span className="ax-btn__label">
            {PATIENT_AVAILABILITY_CALL} {response.pharmacy.phone}
          </span>
        </a>
      )}

      <span className="pat-row__meta">{patientAvailabilityAnswered(response.created_at)}</span>
    </div>
  );
}

function RequestBlock({ request }: { request: AvailabilityRequestPatient }) {
  const responses = usefulFirst(latestPerPharmacy(request.responses));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-3)' }}>
      {/* Une recherche terminée n'est pas une erreur : on le dit calmement, et
          les réponses restent lisibles en dessous. */}
      {request.status === 'close' && (
        <p className="pat-row__meta" style={{ margin: 0 }}>
          {PATIENT_AVAILABILITY_CLOSED}
        </p>
      )}
      {responses.length === 0 ? (
        <p className="pat-row__meta" style={{ margin: 0 }}>
          {PATIENT_AVAILABILITY_NO_ANSWER}
        </p>
      ) : (
        responses.map((response) => (
          <ResponseCard key={response.id} request={request} response={response} />
        ))
      )}
    </div>
  );
}

/**
 * Le panneau dépliable d'une ordonnance. Fermé par défaut, chargé au premier
 * dépliage seulement.
 */
export function PatientAvailabilityPanel({ prescriptionId }: { prescriptionId: number }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<AvailabilityRequestPatient[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    if (!open || data !== null || loading) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    listMyPrescriptionAvailability(prescriptionId).then(
      (result) => {
        if (cancelled) return;
        setData(result);
        setLoading(false);
      },
      (err) => {
        if (cancelled) return;
        setError(err);
        setLoading(false);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [open, data, loading, prescriptionId]);

  const panelId = `availability-${prescriptionId}`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-3)' }}>
      <button
        type="button"
        className={`ax-btn ax-btn--secondary ax-btn--lg ax-btn--block${loading ? ' is-loading' : ''}`}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((cur) => !cur)}
        disabled={loading}
        aria-busy={loading}
      >
        <span className="ax-btn__spinner" aria-hidden="true"></span>
        <span className="ax-btn__label">{PATIENT_AVAILABILITY_ACTION}</span>
      </button>

      {open && (
        <div id={panelId} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-3)' }}>
          {error != null ? (
            <ErrorAlert
              error={error}
              onRetry={() => {
                setData(null);
                setError(null);
              }}
            />
          ) : loading ? (
            <p className="pat-row__meta" style={{ margin: 0 }} role="status">
              {PATIENT_AVAILABILITY_LOADING}
            </p>
          ) : data === null ? null : data.length === 0 ? (
            /* Rien n'a été cherché : on dit POURQUOI et ce qu'on peut faire —
               en parler au centre —, jamais un bouton qui n'existe pas. */
            <p className="pat-row__meta" style={{ margin: 0 }}>
              {PATIENT_AVAILABILITY_EMPTY}
            </p>
          ) : (
            <>
              <h4 className="pat-row__title" style={{ margin: 0 }}>
                {PATIENT_AVAILABILITY_TITLE}
              </h4>
              {data.map((request) => (
                <RequestBlock key={request.id} request={request} />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default PatientAvailabilityPanel;
