'use client';
/*
 * Chioni — /pharmacie/demandes/[id] : répondre à une demande (S9, ADR 0022).
 *
 * **L'écran central du 5ᵉ espace.** Tout le sprint converge ici : c'est le
 * seul endroit où quelqu'un, hors du centre, agit sur une donnée de soin.
 *
 * ─── Trois règles d'écran, et aucune n'est cosmétique ─────────────────────
 *
 * 1. **Deux boutons par ligne, JAMAIS une case à cocher.** Une case laisse
 *    exactement le doute que le module existe pour lever : « je n'ai pas
 *    répondu » et « je ne l'ai pas » deviendraient le même pixel. Le backend
 *    refuse d'ailleurs une couverture partielle (« Répondez pour chacun des
 *    médicaments demandés. ») — l'écran rend cette règle lisible AVANT l'envoi
 *    plutôt que de la faire découvrir par un refus.
 *
 * 2. **Répondre à nouveau est normal, et le bouton ne se grise jamais.** Le
 *    stock bouge : une officine se corrige par une nouvelle réponse
 *    (append-only côté serveur, la dernière fait foi). Le libellé passe de
 *    « Envoyer ma réponse » à « Mettre à jour ma réponse », et une phrase
 *    invite explicitement à le faire. Un bouton grisé après le premier envoi
 *    aurait transformé un constat daté en engagement définitif — exactement ce
 *    que l'ADR refuse (décision 3).
 *
 * 3. **On dit à l'officine ce qu'elle NE reçOIT PAS.** Un pharmacien qui ne
 *    comprend pas pourquoi l'information est si maigre suppose un bug — ou
 *    rappelle le centre pour demander « c'est pour qui ? ». La phrase est donc
 *    à l'écran, du côté du destinataire aussi, et pas seulement du côté du
 *    prescripteur.
 *
 * ─── Ce qui BARRE le formulaire, et ce qui se contente d'avertir ─────────
 *
 * Le refus d'envoi n'est jamais deviné côté client : demande close, demande
 * expirée et officine non validée sont relus EN BASE par le service. L'écran
 * les anticipe pour ne pas faire écrire dans le vide, et affiche le message du
 * backend tel quel quand il arrive quand même (course avec une suspension).
 *
 * Mais anticiper n'est pas décider, et la revue guardian S9 a tranché la
 * frontière : **seul un fait établi par le SERVEUR peut retirer le
 * formulaire.** Deux anticipations le faisaient à tort —
 *
 * - les 48 h, calculées avec `Date.now()` : un téléphone qui a perdu l'heure
 *   réseau retirait l'officine du réseau en silence. C'est désormais un
 *   avertissement, et on laisse envoyer ;
 * - le statut d'officine venu de `/auth/me/`, figé à la connexion : une
 *   officine validée par Chioni pendant la session restait barrée jusqu'à sa
 *   prochaine reconnexion. Il est relu — et uniquement quand il pourrait
 *   bloquer, pour que le cas normal reste à une seule requête.
 */
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { usePharmacy } from '@/context/PharmacyContext';
import type { ApiError } from '@/lib/api';
import { getInboxRequest, getPharmacy, respondToRequest } from '@/lib/endpoints/pharmacy';
import {
  AVAILABILITY_STATUS_LABELS,
  ISLAND_LABELS,
  PHARMACY_ANSWER_AGAIN_HINT,
  PHARMACY_ANSWER_BLOCKED_PENDING,
  PHARMACY_ANSWER_BLOCKED_SUSPENDED,
  PHARMACY_ANSWER_COMMENT_HINT,
  PHARMACY_ANSWER_COMMENT_LABEL,
  PHARMACY_ANSWER_INCOMPLETE,
  PHARMACY_ANSWER_LEGEND,
  PHARMACY_ANSWER_NO,
  PHARMACY_ANSWER_SAVED,
  PHARMACY_ANSWER_SUBMIT_AGAIN,
  PHARMACY_ANSWER_SUBMIT_FIRST,
  PHARMACY_ANSWER_YES,
  PHARMACY_REQUEST_BACK,
  PHARMACY_REQUEST_CLOSED_NOTICE,
  PHARMACY_REQUEST_EXPIRED_NOTICE,
  PHARMACY_REQUEST_SCOPE_NOTICE,
  PHARMACY_REQUEST_TITLE,
  pharmacyAnsweredOn,
  pharmacyRequestAge,
  pharmacyRequestExpires,
} from '@/lib/labels';
import type { InboxRequest } from '@/lib/types';
import {
  Card,
  ErrorAlert,
  SkeletonCards,
  Stack,
  SuccessAlert,
  isRequestOver,
  toApiError,
  useAsync,
  useScopedState,
} from './shared';

/** Une ligne : le médicament, et DEUX boutons — jamais une case. */
function AnswerLine({
  medication,
  value,
  disabled,
  onChange,
}: {
  medication: string;
  value: boolean | undefined;
  disabled: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <li
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--ax-space-2)',
        paddingBlock: 'var(--ax-space-3)',
        borderBlockEnd: '1px solid var(--ax-border)',
      }}
    >
      <span
        style={{
          fontWeight: 'var(--ax-weight-semibold)',
          color: 'var(--ax-text-strong)',
          fontSize: 'var(--ax-text-sm)',
        }}
      >
        {medication}
      </span>
      {/* `role="group"` + `aria-pressed` : deux boutons bascule, pas un
          composite radio incomplet (même posture honnête que les onglets du
          carnet patient).

          `minmax(200px, …)` et non 150 : `.ax-btn__label` est en
          `white-space: nowrap` + `text-overflow: ellipsis`, donc à 150 px sur
          un écran de 375 px les deux colonnes tenaient… en tronquant « Non,
          je n'en ai pas » en « Non, je n'en… ». Sur LE bouton du sprint, une
          réponse coupée est inadmissible. `ax-btn--wrap` ferme le cas
          restant : le libellé passe à la ligne plutôt que de disparaître, et
          la cible ne fait que grandir. */}
      <div
        role="group"
        aria-label={`Disponibilité de ${medication}`}
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 'var(--ax-space-2)',
        }}
      >
        <button
          type="button"
          className={`ax-btn ax-btn--lg ax-btn--wrap ${value === true ? 'ax-btn--primary' : 'ax-btn--secondary'}`}
          aria-pressed={value === true}
          disabled={disabled}
          onClick={() => onChange(true)}
        >
          <span className="ax-btn__label">{PHARMACY_ANSWER_YES}</span>
        </button>
        <button
          type="button"
          className={`ax-btn ax-btn--lg ax-btn--wrap ${value === false ? 'ax-btn--primary' : 'ax-btn--secondary'}`}
          aria-pressed={value === false}
          disabled={disabled}
          onClick={() => onChange(false)}
        >
          {/* « Non » n'est PAS un `danger` : ne pas avoir un médicament n'est
              ni une faute ni un échec — c'est une information utile, et c'est
              même celle qui évite un déplacement inutile au patient. */}
          <span className="ax-btn__label">{PHARMACY_ANSWER_NO}</span>
        </button>
      </div>
    </li>
  );
}

function AnswerForm({
  request,
  blocked,
  notice,
  saved,
  onAnswered,
}: {
  request: InboxRequest;
  /**
   * Phrase de blocage — RÉSERVÉE aux faits que le SERVEUR a établis (demande
   * close, statut d'officine relu en base). Rien qui dépende de l'horloge du
   * téléphone ne doit atterrir ici.
   */
  blocked: string | null;
  /**
   * Un avertissement qui n'empêche pas de répondre : l'expiration présumée,
   * calculée avec `Date.now()`. Voir `PHARMACY_REQUEST_EXPIRED_NOTICE`.
   */
  notice: string | null;
  /** Confirmation du dernier envoi — rendue AU CONTACT du bouton. */
  saved: string | null;
  onAnswered: (fresh: InboxRequest) => void;
}) {
  const { pharmacyId } = usePharmacy();
  const alreadyAnswered = request.my_response !== null;

  /* Pré-remplissage par la dernière réponse : on modifie, on ne recommence
     pas. Sur un parc de six médicaments dont un seul a changé, retaper les
     cinq autres serait la porte ouverte à une erreur de saisie. */
  const [answers, setAnswers] = useState<Record<number, boolean>>(() => {
    const initial: Record<number, boolean> = {};
    for (const line of request.my_response?.lines ?? []) {
      initial[line.item] = line.is_available;
    }
    return initial;
  });
  const [comment, setComment] = useState(request.my_response?.comment ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [incomplete, setIncomplete] = useState(false);

  const missing = request.items.filter((item) => answers[item.id] === undefined).length;

  const submit = async () => {
    /*
     * Garde CLIENT, et le bouton reste actif : un bouton grisé n'est pas
     * focalisable, donc la raison du blocage n'existe pas pour un lecteur
     * d'écran — la personne resterait devant un formulaire qui « ne fait
     * rien ». On laisse cliquer, et on explique.
     */
    if (missing > 0) {
      setIncomplete(true);
      return;
    }
    setIncomplete(false);
    setSaving(true);
    setError(null);
    try {
      const fresh = await respondToRequest(pharmacyId, request.id, {
        lines: request.items.map((item) => ({
          item: item.id,
          is_available: answers[item.id],
        })),
        comment: comment.trim(),
      });
      onAnswered(fresh);
    } catch (err) {
      setError(toApiError(err));
    }
    setSaving(false);
  };

  if (blocked !== null) {
    return (
      <div className="ax-alert ax-alert--info" role="status">
        <div className="ax-alert__content">
          <p className="ax-alert__message" style={{ lineHeight: 1.7 }}>
            {blocked}
          </p>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}
    >
      {notice !== null && (
        <div className="ax-alert ax-alert--info" role="status">
          <div className="ax-alert__content">
            <p className="ax-alert__message" style={{ lineHeight: 1.7 }}>
              {notice}
            </p>
          </div>
        </div>
      )}

      <fieldset style={{ border: 0, margin: 0, padding: 0 }}>
        <legend
          style={{
            padding: 0,
            marginBlockEnd: 'var(--ax-space-2)',
            fontWeight: 'var(--ax-weight-semibold)',
            color: 'var(--ax-text-strong)',
          }}
        >
          {PHARMACY_ANSWER_LEGEND}
        </legend>
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {request.items.map((item) => (
            <AnswerLine
              key={item.id}
              medication={item.medication}
              value={answers[item.id]}
              disabled={saving}
              onChange={(next) => {
                setAnswers((cur) => ({ ...cur, [item.id]: next }));
                setIncomplete(false);
              }}
            />
          ))}
        </ul>
      </fieldset>

      <div className="ax-field">
        <label className="ax-label" htmlFor="pharmacy-comment">
          {PHARMACY_ANSWER_COMMENT_LABEL}
        </label>
        <textarea
          id="pharmacy-comment"
          className="ax-textarea"
          rows={3}
          maxLength={280}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />
        {/* Qui lit ce message : le centre, pas le patient (ADR 0022 décision
            3 — le texte libre d'un tiers ne descend pas dans un carnet). Le
            dire ici évite qu'on y écrive un conseil au patient. */}
        <span className="ax-field__message">{PHARMACY_ANSWER_COMMENT_HINT}</span>
      </div>

      {incomplete && (
        <p className="ax-field__message ax-field__message--error" role="alert">
          {PHARMACY_ANSWER_INCOMPLETE}
        </p>
      )}

      {/*
        L'échec est affiché ICI, juste au-dessus du bouton, et pas en tête du
        formulaire : sur un téléphone, la personne appuie sur le bouton pleine
        largeur en bas de page — si le réseau tombe au milieu (le cas normal
        au comptoir, en 2G), une alerte posée au-dessus de six médicaments est
        hors de vue et l'écran a l'air de n'avoir rien fait. Sa réponse, elle,
        reste saisie : le formulaire n'est pas démonté, on peut renvoyer.
      */}
      {error && <ErrorAlert error={error} />}

      <button
        type="submit"
        className={`ax-btn ax-btn--primary ax-btn--lg ax-btn--block${saving ? ' is-loading' : ''}`}
        disabled={saving}
        aria-busy={saving}
      >
        <span className="ax-btn__spinner" aria-hidden="true"></span>
        <span className="ax-btn__label">
          {alreadyAnswered ? PHARMACY_ANSWER_SUBMIT_AGAIN : PHARMACY_ANSWER_SUBMIT_FIRST}
        </span>
      </button>

      {/*
        Le « merci » arrive SOUS le bouton, pas en tête d'écran.

        Après six médicaments, la personne est en bas de page, le pouce sur le
        bouton : une confirmation posée tout en haut est hors de vue, et un
        envoi sans accusé de réception se rejoue — on récrit alors une réponse
        déjà enregistrée, en 2G, entre deux clients.
      */}
      {saved && <SuccessAlert message={saved} />}

      {alreadyAnswered && (
        <p style={{ margin: 0, fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)', lineHeight: 1.7 }}>
          {PHARMACY_ANSWER_AGAIN_HINT}
        </p>
      )}
    </form>
  );
}

export function PharmacyInboxRequestDetail({ recipientId }: { recipientId: number }) {
  const { pharmacyId, pharmacy } = usePharmacy();

  /*
   * Portée : l'officine ACTIVE et la ligne de diffusion. Le sélecteur
   * d'officine de l'en-tête est présent sur cet écran-ci comme sur les
   * autres, et il ne quitte pas la page : sans cette portée, une personne qui
   * tient deux officines et répond ici puis bascule gardait à l'écran **la
   * liste de médicaments adressée à l'officine PRÉCÉDENTE**, sous le nom et
   * l'état de la nouvelle — pendant que le 404 de la relecture restait muet,
   * l'état optimiste non nul empêchant l'alerte de s'afficher.
   */
  const scope = `${pharmacyId}:${recipientId}`;
  const [patched, setPatched] = useScopedState<InboxRequest>(scope);
  const [flash, setFlash] = useScopedState<string>(scope);

  const requestState = useAsync(
    () => getInboxRequest(pharmacyId, recipientId),
    [pharmacyId, recipientId],
  );

  /*
   * Le statut de l'officine, RELU quand il pourrait bloquer (guardian S9).
   *
   * `/auth/me/` fige les casquettes au moment de la connexion. Une officine
   * validée par Chioni pendant la session gardait donc, pour tout le reste de
   * cette session, un formulaire barré d'un « vous pourrez répondre dès que
   * votre officine sera validée » — alors que le serveur, lui, aurait accepté.
   * Le seul chemin de sortie était de se déconnecter, ce que personne ne
   * devine ; et c'est précisément l'officine qui vient d'être validée, donc
   * celle qui attend ses premières demandes.
   *
   * On relit la fiche UNIQUEMENT dans ce cas — miroir exact du `needsBanner`
   * de la boîte de réception : le cas normal (officine validée) reste à une
   * seule requête, comme la conception le voulait.
   */
  const mayBeBlocked = pharmacy.status !== 'validee';
  const freshProfile = useAsync(
    () => (mayBeBlocked ? getPharmacy(pharmacyId) : Promise.resolve(null)),
    [pharmacyId, mayBeBlocked],
  );
  const pharmacyStatus = freshProfile.data?.status ?? pharmacy.status;

  const request = patched ?? requestState.data;

  /*
   * Pourquoi le formulaire ne peut pas être envoyé, s'il y a une raison. Elle
   * est calculée à l'affichage et RE-vérifiée par le serveur : l'écran
   * anticipe pour ne pas faire écrire dans le vide, il ne décide rien.
   *
   * L'état de l'officine vient de `/auth/me/` (`PharmacyContext`), pas d'un
   * `GET /pharmacy/{p}/` : c'est **l'écran central du 5ᵉ espace**, ouvert au
   * comptoir entre deux clients, et un aller-retour réseau de plus pour lire
   * un champ qu'on a déjà se paie en secondes sur une connexion comorienne.
   * Une suspension décidée pendant la session reste rattrapée par le serveur,
   * qui relit le statut EN BASE et dont le refus s'affiche tel quel.
   */
  const blocked = useMemo<string | null>(() => {
    if (!request) return null;
    if (request.status === 'close') return PHARMACY_REQUEST_CLOSED_NOTICE;
    if (pharmacyStatus === 'en_attente') return PHARMACY_ANSWER_BLOCKED_PENDING;
    if (pharmacyStatus === 'suspendue') return PHARMACY_ANSWER_BLOCKED_SUSPENDED;
    return null;
  }, [request, pharmacyStatus]);

  /*
   * L'expiration des 48 h ne BLOQUE plus : elle avertit. Elle se calcule avec
   * l'horloge du téléphone, et un appareil qui a perdu l'heure réseau
   * retirait l'officine du réseau sans que personne ne puisse le deviner.
   * Le serveur tranche, sous verrou, et son refus s'affiche tel quel.
   */
  const expiryNotice =
    request && blocked === null && isRequestOver(request)
      ? PHARMACY_REQUEST_EXPIRED_NOTICE
      : null;

  return (
    <Stack>
      <Link href="/pharmacie" className="ax-link" style={{ fontSize: 'var(--ax-text-sm)' }}>
        ← {PHARMACY_REQUEST_BACK}
      </Link>

      {requestState.loading && !request ? (
        <SkeletonCards count={2} />
      ) : !request ? (
        requestState.error && (
          <ErrorAlert error={requestState.error} onRetry={requestState.reload} />
        )
      ) : (
        <>
          <Card title={PHARMACY_REQUEST_TITLE}>
            <div className="pat-row" style={{ minHeight: 0 }}>
              <div className="pat-row__main">
                <span className="pat-row__title">
                  {request.city ? `${request.city} · ` : ''}
                  {ISLAND_LABELS[request.island]}
                </span>
                <span className="pat-row__meta">{pharmacyRequestAge(request.created_at)}</span>
              </div>
              <span
                className={`ax-badge ax-badge--soft ax-badge--${request.status === 'ouverte' ? 'info' : 'neutral'}`}
              >
                {AVAILABILITY_STATUS_LABELS[request.status]}
              </span>
            </div>

            {request.status === 'ouverte' && (
              <p className="pat-row__meta" style={{ margin: 0 }}>
                {pharmacyRequestExpires(request.expires_at)}
              </p>
            )}

            {request.my_response && (
              <p className="pat-row__meta" style={{ margin: 0 }}>
                {pharmacyAnsweredOn(request.my_response.created_at)}
              </p>
            )}

            {/* Ce que l'officine ne reçoit pas — dit de son côté aussi. */}
            <div className="ax-alert ax-alert--info" role="note">
              <div className="ax-alert__content">
                <p className="ax-alert__message" style={{ lineHeight: 1.7 }}>
                  {PHARMACY_REQUEST_SCOPE_NOTICE}
                </p>
              </div>
            </div>
          </Card>

          <Card>
            <AnswerForm
              key={request.my_response?.id ?? 'first'}
              request={request}
              blocked={blocked}
              notice={expiryNotice}
              saved={flash}
              onAnswered={(fresh) => {
                setPatched(fresh);
                setFlash(PHARMACY_ANSWER_SAVED);
              }}
            />
          </Card>
        </>
      )}
    </Stack>
  );
}

export default PharmacyInboxRequestDetail;
