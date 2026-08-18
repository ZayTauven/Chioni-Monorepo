'use client';
/*
 * Chioni — /centre/relances : les deux files de travail (S10, ADR 0023).
 *
 * Base Vireo : l'écran de table filtrable (`tables/`, patron déjà adapté par
 * `UnpaidInvoices` et `CashJournal`) + le segment de tête d'`Appointments` /
 * `HrRegister` pour les deux onglets. Rien de neuf n'a été dessiné.
 *
 * ── LA RÈGLE QUI GOUVERNE CET ÉCRAN ──────────────────────────────────────
 *
 * **Chioni n'envoie jamais de message de dette à un patient** (arbitrage PO
 * n° 1). Cette page existe pour qu'un humain décroche son téléphone. Il n'y a
 * donc AUCUN bouton « relancer par SMS » — non pas parce qu'on a oublié de le
 * construire, mais parce qu'aucune route ne le permet et que c'est voulu
 * (décision 3 : personne, dans aucun écran, ne compose de message).
 *
 * Deux audiences, deux onglets :
 *
 * - « À relancer » = une vue d'argent → **rôles BILLING**, auto-gardé AVANT
 *   le fetch (patron `impayes` / `caisse` : jamais un écran monté qui prend
 *   403). Un rôle clinique ne voit pas l'onglet du tout ;
 * - « À recontacter » = de l'exploitation, comme la file du jour → **tout
 *   staff actif**. C'est la raison pour laquelle l'entrée de sidebar n'est
 *   PAS gatée : une infirmière doit pouvoir rappeler quelqu'un.
 *
 * ── LE TON ───────────────────────────────────────────────────────────────
 *
 * On manque un rendez-vous parce qu'on n'a pas le transport, pas l'argent, ou
 * parce qu'on avait honte. Le vocabulaire dit « n'a pas pu venir », jamais
 * « absent » ni « manqué », et **aucune ligne n'est rouge** : un dossier à
 * rappeler n'est pas une faute, c'est du travail à faire.
 *
 * ── L'ÉTAT APRÈS ÉCRITURE ────────────────────────────────────────────────
 *
 * Après « j'ai appelé », chaque file RECHARGE la sienne plutôt que de rapiécer
 * la ligne : `last_contact_at` et `last_outcome` sont des agrégats serveur, et
 * l'état optimiste est exactement ce qui a produit la fenêtre d'affichage
 * inter-tenant des revues S6/S7/S9. `reload()` est hors des deps de `useAsync`
 * (par construction), donc la liste reste à l'écran sans clignoter et les
 * filtres ne sont pas réinitialisés. Le seul état local est le message de
 * succès, porté par `useScopedState` : il meurt avec le centre actif.
 */
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { PageHead } from '@/components/shell/PageHead';
import { useCenter } from '@/context/CenterContext';
import type { ApiError } from '@/lib/api';
import {
  listMissedAppointments,
  listUnpaidFollowups,
  logContact,
  type ContactLogPayload,
} from '@/lib/endpoints/crm';
import {
  CONTACT_CHANNEL_LABELS,
  CONTACT_KIND_LABELS,
  CONTACT_OUTCOMES_BY_KIND,
  CONTACT_OUTCOME_LABELS,
  CONTACT_RECIPIENTS,
  CONTACT_RECIPIENT_LABELS,
  FOLLOWUPS_NO_SMS_NOTICE,
  FOLLOWUPS_SUBTITLE,
  FOLLOWUPS_TITLE,
  GUARDIAN_REACHABLE_NO,
  GUARDIAN_REACHABLE_NO_HINT,
  GUARDIAN_REACHABLE_YES,
  HUMAN_CONTACT_CHANNELS,
  LOG_CONTACT_LABEL,
  LOG_CONTACT_NO_NOTE_HINT,
  LOG_CONTACT_OUTCOME_REQUIRED,
  LOG_CONTACT_TITLE,
  MISSED_NOTHING_TO_DO,
  MISSED_NOTHING_TO_DO_THIS_PAGE,
  MISSED_REBOOKED_HINT,
  MISSED_REBOOKED_LABEL,
  REMINDERS_EXHAUSTED_LABEL,
  REMINDERS_PACING_HINT,
  UNPAID_FOLLOWUP_ORDERING_LABELS,
  contactLoggedNotice,
  formatDate,
  formatKmf,
  lastContactLabel,
  missedAppointmentLabel,
  remindersSentLabel,
  shiftIsoDate,
  todayIsoDate,
  unpaidLastContactLabel,
} from '@/lib/labels';
import type {
  ContactKind,
  ContactOutcome,
  ContactRecipient,
  HumanContactChannel,
  MissedAppointmentFollowup,
  UnpaidFollowup,
  UnpaidFollowupOrdering,
} from '@/lib/types';
import {
  BILLING_ROLES,
  EmptyState,
  ErrorAlert,
  Modal,
  Pagination,
  StatusBadge,
  TableSkeleton,
  hasRole,
  toApiError,
  useAsync,
  useScopedState,
} from './shared';

type Mode = 'impayes' | 'rendez-vous';

/** La cible d'un appel à noter — ce que la modale a besoin de savoir. */
interface ContactTarget {
  kind: ContactKind;
  patientName: string;
  /** Exactement l'un des deux : c'est le motif qui commande l'objet. */
  invoice?: number;
  appointment?: number;
}

function FlashNotice({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="ax-card__body" style={{ paddingTop: 0 }}>
      <div className="ax-alert ax-alert--success" role="status">
        <div className="ax-alert__content">
          <p className="ax-alert__message" style={{ margin: 0 }}>
            {message}
          </p>
        </div>
      </div>
    </div>
  );
}

/* ── « j'ai appelé » — la modale, sans un champ de texte ─────────────────── */

/**
 * Trois listes fermées, zéro caractère libre, et c'est une décision
 * d'architecture (ADR 0023 décision 3) : une note d'appel dans un dossier
 * patient finit toujours par contenir de la donnée clinique, et ce module
 * n'est gardé par aucun rôle clinique.
 *
 * Le focus initial va au premier CHAMP (`data-autofocus`), jamais au bouton
 * d'action — le piège relevé en S4, où une touche Entrée déposait un geste
 * qu'on n'avait pas voulu. `busy` ferme les trois sorties involontaires
 * pendant l'appel.
 */
function LogContactModal({
  target,
  onClose,
  onDone,
}: {
  target: ContactTarget;
  onClose: () => void;
  onDone: (name: string) => void;
}) {
  const { centerId } = useCenter();
  const [channel, setChannel] = useState<HumanContactChannel>('appel');
  const [recipient, setRecipient] = useState<ContactRecipient>('patient');
  const [outcome, setOutcome] = useState<ContactOutcome | ''>('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  /* Le bouton reste ACTIF tant que rien n'est parti : un bouton grisé sans
     explication laisse une secrétaire qui a quelqu'un au téléphone chercher
     ce qui cloche. On accepte le clic, on dit ce qui manque, et on renvoie
     le curseur dans le champ. */
  const [missingOutcome, setMissingOutcome] = useState(false);
  const outcomeRef = useRef<HTMLSelectElement>(null);

  const submit = async () => {
    if (busy) return;
    if (outcome === '') {
      setMissingOutcome(true);
      outcomeRef.current?.focus();
      return;
    }
    setBusy(true);
    setError(null);
    const payload: ContactLogPayload = {
      kind: target.kind,
      channel,
      recipient,
      outcome,
      ...(target.invoice !== undefined ? { invoice: target.invoice } : {}),
      ...(target.appointment !== undefined ? { appointment: target.appointment } : {}),
    };
    try {
      await logContact(centerId, payload);
      onDone(target.patientName);
    } catch (err) {
      setError(toApiError(err));
      setBusy(false);
    }
  };

  return (
    <Modal
      title={LOG_CONTACT_TITLE}
      onClose={onClose}
      width={520}
      busy={busy}
      footer={
        <>
          <button type="button" className="ax-btn ax-btn--ghost" onClick={onClose} disabled={busy}>
            Annuler
          </button>
          <button type="submit" form="log-contact-form" className="ax-btn ax-btn--primary" disabled={busy}>
            {busy ? 'Enregistrement…' : 'Noter l’appel'}
          </button>
        </>
      }
    >
      <form
        id="log-contact-form"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}
      >
        {error && <ErrorAlert error={error} />}

        <p style={{ margin: 0, fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)', lineHeight: 1.6 }}>
          {CONTACT_KIND_LABELS[target.kind]} — vous notez un contact avec{' '}
          <strong>{target.patientName}</strong>. Rien ne part&nbsp;: ce carnet sert seulement à
          savoir qui a déjà été appelé.
        </p>

        <div className="ax-field">
          <label className="ax-label" htmlFor="lc-outcome">
            Que s’est-il passé&nbsp;? <span className="ax-field__required" aria-hidden="true">*</span>
          </label>
          <select
            id="lc-outcome"
            ref={outcomeRef}
            className="ax-select"
            value={outcome}
            aria-invalid={missingOutcome || undefined}
            aria-describedby={missingOutcome ? 'lc-outcome-error' : undefined}
            onChange={(e) => {
              setOutcome(e.target.value as ContactOutcome);
              setMissingOutcome(false);
            }}
            data-autofocus=""
          >
            <option value="" disabled>
              Choisir…
            </option>
            {/* Les issues qui peuvent être VRAIES pour ce motif d'appel :
                on ne propose pas « a dit qu'elle réglerait » à qui appelle
                pour proposer une nouvelle date. */}
            {CONTACT_OUTCOMES_BY_KIND[target.kind].map((o) => (
              <option key={o} value={o}>
                {CONTACT_OUTCOME_LABELS[o]}
              </option>
            ))}
          </select>
          {missingOutcome && (
            <span id="lc-outcome-error" className="ax-field__message ax-field__message--error" role="alert">
              {LOG_CONTACT_OUTCOME_REQUIRED}
            </span>
          )}
          <span className="ax-field__message">{LOG_CONTACT_NO_NOTE_HINT}</span>
        </div>

        <div className="ax-field">
          <label className="ax-label" htmlFor="lc-recipient">
            Qui avez-vous eu&nbsp;?
          </label>
          <select
            id="lc-recipient"
            className="ax-select"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value as ContactRecipient)}
          >
            {CONTACT_RECIPIENTS.map((r) => (
              <option key={r} value={r}>
                {CONTACT_RECIPIENT_LABELS[r]}
              </option>
            ))}
          </select>
        </div>

        <div className="ax-field">
          <label className="ax-label" htmlFor="lc-channel">
            Comment&nbsp;?
          </label>
          <select
            id="lc-channel"
            className="ax-select"
            value={channel}
            onChange={(e) => setChannel(e.target.value as HumanContactChannel)}
          >
            {HUMAN_CONTACT_CHANNELS.map((c) => (
              <option key={c} value={c}>
                {CONTACT_CHANNEL_LABELS[c]}
              </option>
            ))}
          </select>
        </div>
      </form>
    </Modal>
  );
}

/* ── onglet « à relancer » (rôles BILLING) ───────────────────────────────── */

function UnpaidQueue() {
  const { centerId, roles } = useCenter();
  const billing = hasRole(roles, BILLING_ROLES);
  const [ordering, setOrdering] = useState<UnpaidFollowupOrdering>('-age');
  const [page, setPage] = useState(1);
  const [target, setTarget] = useState<ContactTarget | null>(null);
  const [flash, setFlash] = useScopedState<string>(String(centerId));

  const list = useAsync(
    () => (billing ? listUnpaidFollowups(centerId, { ordering, page }) : Promise.resolve(null)),
    [centerId, ordering, page, billing],
  );

  useEffect(() => {
    setPage(1);
  }, [centerId, ordering]);

  if (!billing) {
    return (
      <section className="ax-card ax-col--12">
        <EmptyState
          title="Réservé aux rôles de facturation"
          message="Le suivi des impayés est accessible au directeur, à la secrétaire et au caissier. L’onglet « À recontacter », lui, est ouvert à toute l’équipe."
        />
      </section>
    );
  }

  const rows: UnpaidFollowup[] = list.data?.results ?? [];

  return (
    <section className="ax-card ax-col--12" role="region" aria-label="Factures à relancer">
      <div className="ax-card__header">
        <div className="ax-card__titles">
          <h2 className="ax-card__title">À relancer</h2>
          <p className="ax-card__subtitle">{REMINDERS_PACING_HINT}</p>
        </div>
        <div className="ax-field" style={{ marginBottom: 0, minWidth: 220 }}>
          <label className="ax-label" htmlFor="fu-ordering">
            Trier par
          </label>
          <select
            id="fu-ordering"
            className="ax-select"
            value={ordering}
            onChange={(e) => setOrdering(e.target.value as UnpaidFollowupOrdering)}
          >
            {(Object.keys(UNPAID_FOLLOWUP_ORDERING_LABELS) as UnpaidFollowupOrdering[]).map((o) => (
              <option key={o} value={o}>
                {UNPAID_FOLLOWUP_ORDERING_LABELS[o]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <FlashNotice message={flash} />

      {list.loading ? (
        <TableSkeleton rows={6} cols={5} />
      ) : list.error ? (
        <div style={{ padding: 'var(--ax-space-4)' }}>
          <ErrorAlert error={list.error} onRetry={list.reload} />
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          title="Personne à relancer"
          message="Toutes les factures émises sont réglées. C’est la meilleure liste vide du logiciel."
        />
      ) : (
        <>
          <div className="ax-table-wrap" tabIndex={0} role="region" aria-label="Tableau">
            <table className="ax-table ax-table--hover">
              <thead className="ax-table__head">
                <tr>
                  <th className="ax-table__th" scope="col">Patient</th>
                  <th className="ax-table__th" scope="col">Facture</th>
                  <th className="ax-table__th ax-table__th--num" scope="col">Reste dû</th>
                  <th className="ax-table__th" scope="col">Messages automatiques</th>
                  <th className="ax-table__th" scope="col">Dernier contact</th>
                  <th className="ax-table__th" scope="col">
                    <span className="ax-visually-hidden">Action</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const name = row.patient_name || `Patient n° ${row.patient}`;
                  return (
                    <tr key={row.id} className="ax-table__row">
                      <td className="ax-table__td">
                        <Link href={`/centre/patients/${row.patient}`} className="ax-link" style={{ fontWeight: 500 }}>
                          {name}
                        </Link>
                        <span
                          style={{
                            display: 'block',
                            fontFamily: 'var(--ax-font-mono)',
                            fontSize: 'var(--ax-text-2xs)',
                            color: 'var(--ax-text-muted)',
                          }}
                        >
                          {row.patient_phone_masked || 'Pas de téléphone au dossier'}
                        </span>
                      </td>
                      <td className="ax-table__td">
                        <Link href={`/centre/factures/${row.id}`} className="ax-link">
                          Facture n° {row.id}
                        </Link>
                        {/* L'ancienneté attire l'œil sans alarmer : `warning`
                            et jamais `danger` — un impayé de 40 jours est un
                            travail à faire, pas un incident. */}
                        <span
                          style={{
                            display: 'block',
                            fontSize: 'var(--ax-text-2xs)',
                            color: row.age_days > 30 ? 'var(--ax-warning-700)' : 'var(--ax-text-muted)',
                          }}
                        >
                          émise le {formatDate(row.created_at)} · {row.age_days} j
                        </span>
                      </td>
                      <td
                        className="ax-table__td ax-table__td--num ax-num"
                        style={{ fontFamily: 'var(--ax-font-mono)', fontWeight: 700, color: 'var(--ax-text-strong)' }}
                      >
                        {formatKmf(row.balance_kmf)}
                        <span
                          style={{
                            display: 'block',
                            fontWeight: 400,
                            fontSize: 'var(--ax-text-2xs)',
                            color: 'var(--ax-text-muted)',
                          }}
                        >
                          sur {formatKmf(row.total_kmf)}
                        </span>
                      </td>
                      <td className="ax-table__td" style={{ maxWidth: 280 }}>
                        {/*
                          Trois informations, dans cet ordre : ce qui est
                          parti, ce qui ne partira plus, et qui peut recevoir.
                          « Chioni n'enverra plus de message » est CE qui
                          déclenche l'appel humain — sans lui, le silence de
                          l'automate se lit comme une panne.
                        */}
                        <span style={{ display: 'block', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text)' }}>
                          {remindersSentLabel(row.reminders_sent)}
                        </span>
                        {row.reminders_exhausted && (
                          /* Au moins aussi lisible que la ligne au-dessus :
                             c'est CETTE phrase qui déclenche l'appel humain,
                             elle ne peut pas être la plus petite du tableau. */
                          <span
                            style={{
                              display: 'block',
                              fontSize: 'var(--ax-text-xs)',
                              color: 'var(--ax-warning-700)',
                              fontWeight: 500,
                            }}
                          >
                            {REMINDERS_EXHAUSTED_LABEL}
                          </span>
                        )}
                        <span
                          style={{ display: 'block', fontSize: 'var(--ax-text-2xs)', color: 'var(--ax-text-muted)' }}
                        >
                          {row.guardian_reachable ? GUARDIAN_REACHABLE_YES : GUARDIAN_REACHABLE_NO}
                        </span>
                        {!row.guardian_reachable && (
                          <span
                            style={{
                              display: 'block',
                              fontSize: 'var(--ax-text-2xs)',
                              color: 'var(--ax-text-muted)',
                              lineHeight: 1.5,
                            }}
                          >
                            {GUARDIAN_REACHABLE_NO_HINT}
                          </span>
                        )}
                      </td>
                      {/* SV — `last_human_contact_at` date le contact HUMAIN :
                          le verbe précis revient (« Contact le … »), le SMS
                          de l'automate reste « Message automatique le … ». */}
                      <td className="ax-table__td" style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-muted)' }}>
                        {unpaidLastContactLabel(
                          row.last_contact_at,
                          row.last_human_contact_at,
                          row.last_outcome,
                        )}
                      </td>
                      <td className="ax-table__td" style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <button
                          type="button"
                          className="ax-btn ax-btn--secondary ax-btn--sm"
                          onClick={() =>
                            setTarget({ kind: 'relance_impaye', patientName: name, invoice: row.id })
                          }
                        >
                          <span className="ax-btn__label">{LOG_CONTACT_LABEL}</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {list.data && <Pagination count={list.data.count} page={page} onPage={setPage} />}
        </>
      )}

      {target && (
        <LogContactModal
          target={target}
          onClose={() => setTarget(null)}
          onDone={(name) => {
            setTarget(null);
            setFlash(contactLoggedNotice(name));
            list.reload();
          }}
        />
      )}
    </section>
  );
}

/* ── onglet « à recontacter » (tout staff actif) ─────────────────────────── */

function MissedRow({
  row,
  onCall,
  done,
}: {
  row: MissedAppointmentFollowup;
  onCall: (target: ContactTarget) => void;
  done: boolean;
}) {
  const name = row.patient_name || `Patient n° ${row.patient}`;
  return (
    <tr className="ax-table__row">
      <td className="ax-table__td">
        <Link href={`/centre/patients/${row.patient}`} className="ax-link" style={{ fontWeight: 500 }}>
          {name}
        </Link>
        <span
          style={{
            display: 'block',
            fontFamily: 'var(--ax-font-mono)',
            fontSize: 'var(--ax-text-2xs)',
            color: 'var(--ax-text-muted)',
          }}
        >
          {row.patient_phone_masked || 'Pas de téléphone au dossier'}
        </span>
      </td>
      <td className="ax-table__td" style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)' }}>
        {missedAppointmentLabel(row.scheduled_at)}
      </td>
      <td className="ax-table__td" style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-muted)' }}>
        {lastContactLabel(row.contacted_at, row.last_outcome)}
      </td>
      <td className="ax-table__td" style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
        {done ? (
          /* Un badge et non un bouton : il n'y a plus rien à faire, et offrir
             l'action reviendrait à inviter à rappeler quelqu'un qui a déjà
             fait le geste. */
          <StatusBadge tone="success" label={MISSED_REBOOKED_LABEL} />
        ) : (
          <button
            type="button"
            className="ax-btn ax-btn--secondary ax-btn--sm"
            onClick={() => onCall({ kind: 'reprise_contact', patientName: name, appointment: row.id })}
          >
            <span className="ax-btn__label">{LOG_CONTACT_LABEL}</span>
          </button>
        )}
      </td>
    </tr>
  );
}

/**
 * L'en-tête, partagé par les DEUX tables de la file.
 *
 * Le groupe « ont déjà repris rendez-vous » en était dépourvu : une table
 * sans `thead` ne rend, pour un lecteur d'écran, que quatre cellules
 * anonymes. Un statut de rappel n'est pas une information à deviner.
 */
function MissedHead({ lastLabel }: { lastLabel: string }) {
  return (
    <thead className="ax-table__head">
      <tr>
        <th className="ax-table__th" scope="col">Patient</th>
        <th className="ax-table__th" scope="col">Rendez-vous</th>
        <th className="ax-table__th" scope="col">Dernier contact</th>
        <th className="ax-table__th" scope="col">{lastLabel}</th>
      </tr>
    </thead>
  );
}

function MissedQueue() {
  const { centerId } = useCenter();
  const today = todayIsoDate();
  const [from, setFrom] = useState(shiftIsoDate(today, -29));
  const [to, setTo] = useState(today);
  const [page, setPage] = useState(1);
  const [target, setTarget] = useState<ContactTarget | null>(null);
  const [flash, setFlash] = useScopedState<string>(String(centerId));

  const list = useAsync(
    () => listMissedAppointments(centerId, { from, to, page }),
    [centerId, from, to, page],
  );

  useEffect(() => {
    setPage(1);
  }, [centerId, from, to]);

  const rows: MissedAppointmentFollowup[] = list.data?.results ?? [];
  /*
   * `rebooked` sort la personne de la file de TRAVAIL : les deux groupes sont
   * séparés plutôt que mélangés, et le second n'a aucun bouton. C'est le
   * patron des « anciens liens repliés » de l'espace tuteur (S2).
   */
  const todo = rows.filter((r) => !r.rebooked);
  const settled = rows.filter((r) => r.rebooked);
  /* Toute la période tient-elle sur cet écran ? La réponse commande ce qu'on
     a le droit d'affirmer quand plus personne n'est à rappeler ICI. */
  const singlePage = (list.data?.count ?? 0) === rows.length;

  return (
    <section className="ax-card ax-col--12" role="region" aria-label="Personnes à recontacter">
      <div className="ax-card__header">
        <div className="ax-card__titles">
          <h2 className="ax-card__title">À recontacter</h2>
          <p className="ax-card__subtitle">
            Les rendez-vous qui n’ont pas eu lieu — pour proposer une nouvelle date.
          </p>
        </div>
        <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)', flexWrap: 'wrap' }}>
          <div className="ax-field" style={{ marginBottom: 0 }}>
            <label className="ax-label" htmlFor="mq-from">Du</label>
            <input
              id="mq-from"
              type="date"
              className="ax-input"
              style={{ width: 165 }}
              value={from}
              max={to}
              onChange={(e) => e.target.value && setFrom(e.target.value)}
            />
          </div>
          <div className="ax-field" style={{ marginBottom: 0 }}>
            <label className="ax-label" htmlFor="mq-to">Au</label>
            <input
              id="mq-to"
              type="date"
              className="ax-input"
              style={{ width: 165 }}
              value={to}
              min={from}
              max={today}
              onChange={(e) => e.target.value && setTo(e.target.value)}
            />
          </div>
        </div>
      </div>

      <FlashNotice message={flash} />

      {list.loading ? (
        <TableSkeleton rows={5} cols={4} />
      ) : list.error ? (
        <div style={{ padding: 'var(--ax-space-4)' }}>
          <ErrorAlert error={list.error} onRetry={list.reload} />
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          title="Personne à recontacter"
          message="Sur cette période, tous les rendez-vous ont eu lieu. Élargissez les dates pour regarder plus loin."
        />
      ) : (
        <>
          {todo.length > 0 ? (
            <div className="ax-table-wrap" tabIndex={0} role="region" aria-label="Tableau">
              <table className="ax-table ax-table--hover">
                <MissedHead lastLabel="À rappeler" />
                <tbody>
                  {todo.map((row) => (
                    <MissedRow key={row.id} row={row} onCall={setTarget} done={false} />
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="ax-card__body">
              {/* `rebooked` est trié PAR PAGE : « rien à faire sur cette
                  période » serait faux dès la page 2, et l'équipe cesserait
                  de regarder les suivantes. */}
              <p style={{ margin: 0, fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>
                {singlePage ? MISSED_NOTHING_TO_DO : MISSED_NOTHING_TO_DO_THIS_PAGE}
              </p>
            </div>
          )}

          {settled.length > 0 && (
            <>
              <div className="ax-card__body" style={{ paddingBottom: 0 }}>
                <h3
                  style={{
                    margin: 0,
                    fontSize: 'var(--ax-text-sm)',
                    color: 'var(--ax-text-strong)',
                    fontFamily: 'var(--ax-font-display)',
                  }}
                >
                  Ont déjà repris rendez-vous
                </h3>
                <p style={{ margin: '4px 0 0', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-muted)' }}>
                  {MISSED_REBOOKED_HINT}
                </p>
              </div>
              <div className="ax-table-wrap" tabIndex={0} role="region" aria-label="Tableau">
                <table className="ax-table">
                  <MissedHead lastLabel="État" />
                  <tbody>
                    {settled.map((row) => (
                      <MissedRow key={row.id} row={row} onCall={setTarget} done />
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {list.data && <Pagination count={list.data.count} page={page} onPage={setPage} />}
        </>
      )}

      {target && (
        <LogContactModal
          target={target}
          onClose={() => setTarget(null)}
          onDone={(name) => {
            setTarget(null);
            setFlash(contactLoggedNotice(name));
            list.reload();
          }}
        />
      )}
    </section>
  );
}

/* ── l'écran ─────────────────────────────────────────────────────────────── */

const MODES: Array<{ key: Mode; label: string }> = [
  { key: 'impayes', label: 'À relancer' },
  { key: 'rendez-vous', label: 'À recontacter' },
];

export function Followups() {
  const { roles } = useCenter();
  const billing = hasRole(roles, BILLING_ROLES);
  /*
   * Un rôle clinique n'a qu'un onglet utile : on l'y pose d'emblée plutôt que
   * de lui montrer un « réservé à… » comme première impression de l'écran.
   */
  const [mode, setMode] = useState<Mode>(billing ? 'impayes' : 'rendez-vous');
  const visibleModes = MODES.filter((m) => billing || m.key !== 'impayes');

  /*
   * Changer de centre actif peut changer les casquettes : un directeur ici
   * peut n'être qu'infirmier là-bas. Sans ce recalage, l'écran resterait sur
   * un onglet qui n'existe plus dans le segment, à afficher « réservé à… ».
   */
  useEffect(() => {
    if (!billing) setMode('rendez-vous');
  }, [billing]);

  return (
    <>
      <PageHead
        title={FOLLOWUPS_TITLE}
        subtitle={FOLLOWUPS_SUBTITLE}
        actions={
          visibleModes.length > 1 ? (
            <div className="ax-segment ax-segment--wrap" role="radiogroup" aria-label="File de travail">
              {visibleModes.map((m) => (
                <button
                  key={m.key}
                  type="button"
                  className={`ax-segment__option${mode === m.key ? ' is-active' : ''}`}
                  role="radio"
                  aria-checked={mode === m.key}
                  onClick={() => setMode(m.key)}
                >
                  {m.label}
                </button>
              ))}
            </div>
          ) : undefined
        }
      />

      <div className="ax-dash-grid">
        {/* La règle du produit, dite une fois en tête : on ne cherche pas un
            bouton d'envoi qui n'existe pas, et on comprend à quoi sert ce
            qu'on note ici. */}
        <div className="ax-col--12">
          <div className="ax-alert ax-alert--info" role="note">
            <div className="ax-alert__content">
              <p className="ax-alert__message" style={{ margin: 0, lineHeight: 1.7 }}>
                {FOLLOWUPS_NO_SMS_NOTICE}
              </p>
            </div>
          </div>
        </div>

        {mode === 'impayes' ? <UnpaidQueue /> : <MissedQueue />}
      </div>
    </>
  );
}

export default Followups;
