'use client';
/*
 * Chioni — carte « Mes données » (S4, ADR 0017 décision 7).
 *
 * Partagée par les TROIS espaces (patient, tuteur, centre) : les droits RGPD
 * appartiennent à la personne, pas à une casquette — un caissier ou une
 * sage-femme les exerce comme Mariama, sans garde de rôle. Elle vit donc dans
 * `screens/lite/` et n'utilise que des classes `ax-*` neutres — aucune classe
 * `pat-*` ni `tuteur-*`, pour qu'elle se pose partout sans dette.
 *
 * UN SEUL exemplaire, deux registres : la prop `audience` choisit un jeu de
 * phrases dans `ERASURE_COPY` (labels.ts), rien d'autre. Appels, états,
 * modale, piège de focus et verrou `busy` sont communs par construction — un
 * second composant « pour le staff » divergerait des durcissements passés
 * (revue guardian + UX care) à la première correction.
 *
 * Deux gestes, jamais mélangés :
 * 1. **Télécharger mes données** — un fichier, tout de suite, sans décision à
 *    prendre. L'export ne révèle rien de nouveau : c'est ce que la personne
 *    voit déjà dans son espace.
 * 2. **Demander la suppression de mon compte** — une DEMANDE, examinée par
 *    l'équipe Chioni. La modale dit honnêtement que ce n'est pas immédiat,
 *    ce qui est effacé, ce qui est conservé (le carnet de santé), ce que les
 *    proches ne pourront plus faire, et qu'une demande envoyée ne se retire
 *    pas. On ne dramatise pas, on ne culpabilise pas, et on ne promet aucune
 *    suppression instantanée.
 *
 * Trois règles portées ici, dans l'ordre où elles comptent :
 * - **la sortie d'abord** : « Ne rien faire » a la même taille que l'action et
 *   reçoit le focus à l'ouverture (`data-autofocus` du ConfirmModal) — une
 *   modale qui s'ouvre sur « Envoyer » transforme une touche Entrée en
 *   décision ;
 * - **jamais d'alarme** : cette modale reste en ton neutre (`danger` NON posé)
 *   parce qu'on dépose une demande, on n'efface rien. Le rouge est réservé au
 *   geste qui détruit, côté plateforme ;
 * - **jamais d'action sur un état inconnu** : si la lecture de l'état échoue,
 *   on montre l'erreur et son « Réessayer », pas le bouton.
 *
 * Ton : phrases courtes, vocabulaire du quotidien, une action par bouton,
 * cibles ≥ 44 px (ax-btn--lg ax-btn--block).
 */
import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '@/lib/api';
import {
  createErasureRequest,
  downloadMyDataExport,
  getMyErasureRequest,
} from '@/lib/endpoints/auth';
import {
  ERASURE_ASK_AGAIN,
  ERASURE_ASK_CANCEL,
  ERASURE_ASK_CONFIRM,
  ERASURE_ASK_LABEL,
  ERASURE_COPY,
  ERASURE_EFFECTS_TITLE,
  ERASURE_KEPT_TITLE,
  ERASURE_NO_UNDO,
  ERASURE_STATUS_SELF,
  EXPORT_LABEL,
  erasureFiledOn,
  exportSaved,
  type ErasureAudience,
  type ErasureCopy,
} from '@/lib/labels';
import type { ErasureRequestMine } from '@/lib/types';
import { ConfirmModal, ErrorAlert, SuccessAlert } from '@/screens/patient/ui';

const listStyle = {
  margin: 0,
  paddingInlineStart: 'var(--ax-space-5)',
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--ax-space-1)',
} as const;

const itemStyle = { fontSize: 'var(--ax-text-sm)', lineHeight: 1.6 } as const;

const noteStyle = {
  margin: 0,
  fontSize: 'var(--ax-text-sm)',
  color: 'var(--ax-text-muted)',
  lineHeight: 1.6,
} as const;

/** Ce que la personne lit sur l'état de sa demande. */
function RequestState({ request, copy }: { request: ErasureRequestMine; copy: ErasureCopy }) {
  const tone =
    request.status === 'en_attente' ? 'info' : request.status === 'traitee' ? 'success' : 'neutral';
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--ax-space-2)',
        padding: 'var(--ax-space-3)',
        borderRadius: 'var(--ax-radius-md)',
        background: 'var(--ax-surface-subtle)',
      }}
    >
      <span className={`ax-badge ax-badge--soft ax-badge--${tone}`} style={{ alignSelf: 'flex-start' }}>
        {ERASURE_STATUS_SELF[request.status]}
      </span>
      <p style={{ ...noteStyle, fontSize: 'var(--ax-text-xs)' }}>
        {erasureFiledOn(request.requested_at, request.processed_at)}
      </p>
      {request.status === 'en_attente' && (
        <>
          <p style={noteStyle}>{copy.pending}</p>
          {/* Redit APRÈS coup ce qui a été dit AVANT — deux fois, et pour la
              même raison : la personne qui revient sur cet écran des semaines
              plus tard ne doit chercher ni un bouton « annuler » qui n'existe
              pas, ni la raison pour laquelle sa demande n'avance pas (le
              dernier directeur d'un centre reste « en attente », côté
              backend, tant que personne ne l'a remplacé). */}
          {copy.pendingNote && <p style={noteStyle}>{copy.pendingNote}</p>}
          <p style={{ ...noteStyle, fontSize: 'var(--ax-text-xs)' }}>{ERASURE_NO_UNDO}</p>
        </>
      )}
      {/* Le motif d'un refus est écrit POUR la personne (RGPD art. 12.4) :
          il est affiché intégralement, jamais résumé. */}
      {request.status === 'refusee' && request.refusal_reason && (
        <p style={{ ...noteStyle, color: 'var(--ax-text)' }}>{request.refusal_reason}</p>
      )}
      {request.status === 'refusee' && (
        <p style={{ ...noteStyle, fontSize: 'var(--ax-text-xs)' }}>{ERASURE_ASK_AGAIN}</p>
      )}
    </div>
  );
}

export function MyDataCard({
  showHeading = true,
  audience = 'grand-public',
}: { showHeading?: boolean; audience?: ErasureAudience } = {}) {
  const copy = ERASURE_COPY[audience];
  const [request, setRequest] = useState<ErasureRequestMine | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<unknown>(null);

  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<unknown>(null);
  const [savedAs, setSavedAs] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<unknown>(null);

  const load = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    getMyErasureRequest()
      .then((data) => {
        setRequest(data);
        setLoading(false);
      })
      .catch((err: unknown) => {
        setLoadError(err);
        setLoading(false);
      });
  }, []);

  useEffect(load, [load]);

  const onDownload = async () => {
    setDownloading(true);
    setDownloadError(null);
    setSavedAs(null);
    try {
      setSavedAs(await downloadMyDataExport());
    } catch (err) {
      setDownloadError(err);
    } finally {
      setDownloading(false);
    }
  };

  const onConfirmErasure = async () => {
    setSending(true);
    setSendError(null);
    try {
      const created = await createErasureRequest();
      setRequest(created);
      setModalOpen(false);
    } catch (err) {
      setSendError(err);
      /*
       * Multi-casquettes : une seule demande peut être ouverte par COMPTE, et
       * la carte est montée dans chaque espace. Une personne à la fois
       * patiente et salariée peut donc arriver ici avec un état lu avant
       * qu'une demande soit déposée depuis l'autre espace (ou un autre
       * onglet) — le backend répond 400 « une demande est déjà en cours ».
       * On affiche ce refus tel quel ET on relit l'état : à la fermeture de
       * la modale, la carte montre la demande existante au lieu de reproposer
       * un dépôt impossible.
       */
      if (err instanceof ApiError && err.status === 400) load();
    } finally {
      setSending(false);
    }
  };

  // Une demande OUVERTE ferme le bouton ; un refus le rouvre (la contrainte
  // d'unicité du backend ne porte que sur les demandes en cours).
  // `traitee` est défensif : une fois l'anonymisation exécutée, le compte est
  // désactivé et personne ne revient lire cet écran. On le rend quand même
  // plutôt que d'afficher un bouton « demander » à un compte déjà effacé.
  const hasOpenRequest = request?.status === 'en_attente';
  const isDone = request?.status === 'traitee';

  return (
    <section className="ax-card" role="region" aria-label={copy.heading}>
      <div
        className="ax-card__body"
        style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-1)' }}>
          {/* L'espace tuteur pose son propre titre de section au-dessus de la
              carte : le répéter ici affichait « Mes données » deux fois. */}
          {showHeading && (
            <h3
              style={{
                margin: 0,
                fontFamily: 'var(--ax-font-display)',
                fontSize: 'var(--ax-text-md)',
                fontWeight: 'var(--ax-weight-semibold)',
                color: 'var(--ax-text-strong)',
              }}
            >
              {copy.heading}
            </h3>
          )}
          <p style={noteStyle}>{copy.intro}</p>
        </div>

        {/* ── 1 · copie de mes données ── */}
        {downloadError != null && <ErrorAlert error={downloadError} onRetry={() => void onDownload()} />}
        {savedAs !== null && <SuccessAlert message={exportSaved(savedAs)} />}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-2)' }}>
          <button
            type="button"
            className={`ax-btn ax-btn--secondary ax-btn--lg ax-btn--block ax-btn--wrap${downloading ? ' is-loading' : ''}`}
            onClick={() => void onDownload()}
            disabled={downloading}
            aria-busy={downloading}
          >
            <span className="ax-btn__spinner" aria-hidden="true"></span>
            <span className="ax-btn__label">{EXPORT_LABEL}</span>
          </button>
          <p style={{ ...noteStyle, fontSize: 'var(--ax-text-xs)' }}>{copy.exportHint}</p>
        </div>

        {/* ── 2 · demande de suppression ── */}
        {loading ? (
          <div className="ax-skeleton ax-skeleton--line" style={{ height: 14, width: '60%' }} aria-hidden="true" />
        ) : loadError != null ? (
          <ErrorAlert error={loadError} onRetry={load} />
        ) : request ? (
          <RequestState request={request} copy={copy} />
        ) : null}

        {/* Tant que l'état est inconnu (chargement en échec), on ne propose
            pas un geste dont on ne sait pas s'il a déjà été fait : la
            personne réessaie d'abord. */}
        {!loading && loadError == null && !hasOpenRequest && !isDone && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-2)' }}>
            <button
              type="button"
              /* `--wrap` : « Demander la suppression de mon compte » ne tient
                 sur une ligne ni dans le rail du centre, ni sur un téléphone
                 de 360 px — sans lui, le libellé se coupait en « …de mon c… »
                 et l'action devenait indevinable. */
              className="ax-btn ax-btn--ghost ax-btn--lg ax-btn--block ax-btn--wrap"
              onClick={() => {
                setSendError(null);
                setModalOpen(true);
              }}
            >
              <span className="ax-btn__label">{ERASURE_ASK_LABEL}</span>
            </button>
          </div>
        )}
      </div>

      <ConfirmModal
        open={modalOpen}
        title={ERASURE_ASK_LABEL}
        message={copy.notInstant}
        confirmLabel={ERASURE_ASK_CONFIRM}
        cancelLabel={ERASURE_ASK_CANCEL}
        busy={sending}
        error={sendError}
        onConfirm={() => void onConfirmErasure()}
        onClose={() => {
          if (!sending) setModalOpen(false);
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--ax-space-3)',
            textAlign: 'start',
            width: '100%',
          }}
        >
          {/* Un compte, pas un espace : la personne qui cumule les casquettes
              (salariée ET patiente) doit savoir, depuis n'importe lequel de
              ses espaces, que la demande les ferme tous. */}
          <p style={{ ...noteStyle, color: 'var(--ax-text)' }}>{copy.scope}</p>
          <div>
            <p style={{ ...noteStyle, fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)' }}>
              {ERASURE_EFFECTS_TITLE}
            </p>
            <ul style={listStyle}>
              {copy.effects.map((line) => (
                <li key={line} style={itemStyle}>
                  {line}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p style={{ ...noteStyle, fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)' }}>
              {ERASURE_KEPT_TITLE}
            </p>
            <ul style={listStyle}>
              {copy.kept.map((line) => (
                <li key={line} style={itemStyle}>
                  {line}
                </li>
              ))}
            </ul>
          </div>
          {/* Ce qui peut bloquer la demande — AVANT le dépôt, jamais après :
              une demande qui reste en attente sans explication se vit comme
              un refus arbitraire. */}
          {copy.delay && copy.delayTitle && (
            <div>
              <p style={{ ...noteStyle, fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)' }}>
                {copy.delayTitle}
              </p>
              <ul style={listStyle}>
                {copy.delay.map((line) => (
                  <li key={line} style={itemStyle}>
                    {line}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {/* Dernière ligne avant les boutons, et volontairement la dernière
              lue : il n'y a pas de retour en arrière possible sur la DEMANDE
              (l'effacement, lui, reste soumis à l'équipe). */}
          <p style={{ ...noteStyle, color: 'var(--ax-text)' }}>{ERASURE_NO_UNDO}</p>
        </div>
      </ConfirmModal>
    </section>
  );
}

export default MyDataCard;
