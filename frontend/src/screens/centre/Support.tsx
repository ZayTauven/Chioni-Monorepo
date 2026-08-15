'use client';
/*
 * Chioni — /centre/support : les demandes d'aide du centre (S5 lot 3, ADR 0018).
 *
 * **Ouvert à TOUT STAFF ACTIF**, et ce n'est pas un détail : c'est la
 * secrétaire qui rencontre le bug, pas le directeur. Aucune garde de rôle
 * n'est posée ici, ni sur l'écran, ni sur l'entrée de sidebar.
 *
 * **JAMAIS gelé par l'abonnement** : un centre suspendu ouvre un ticket et
 * dépose une capture. C'est précisément le moment où il en a besoin
 * (« pourquoi suis-je gelé ? ») — fermer le canal qui répond à la question
 * ferait une boucle sans sortie. Aucun écran de support ne se verrouille sur
 * `is_frozen`, et la carte d'aide le dit à voix haute.
 *
 * **L'AVERTISSEMENT DE CONFIDENTIALITÉ vit à côté du champ de saisie**, jamais
 * dans une aide repliée : c'est l'unique parade informationnelle d'un risque
 * assumé (un ticket est du texte libre qu'un exploitant Chioni lira). La
 * phrase vient du backend (`SUPPORT_PRIVACY_NOTICE`) et est reprise à la
 * lettre pour que les deux côtés ne dérivent pas.
 *
 * Base Vireo : la liste filtrable de `tables/DataTables` (déjà adaptée pour la
 * caisse, les impayés et le journal) et la modale du socle.
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PageHead } from '@/components/shell/PageHead';
import { useCenter } from '@/context/CenterContext';
import type { ApiError } from '@/lib/api';
import { createSupportTicket, listSupportTickets } from '@/lib/endpoints/centers';
import {
  SUPPORT_ALWAYS_OPEN_NOTICE,
  SUPPORT_CATEGORIES,
  SUPPORT_CATEGORY_LABELS,
  SUPPORT_EMPTY_MESSAGE,
  SUPPORT_EMPTY_TITLE,
  SUPPORT_NO_NOTIFICATION_NOTICE,
  SUPPORT_PRIORITIES,
  SUPPORT_PRIORITY_LABELS,
  SUPPORT_STATUSES,
  SUPPORT_STATUS_LABELS,
  SUPPORT_STATUS_READONLY_NOTICE,
  SUPPORT_VISIBILITY_NOTICE,
  formatDateTime,
} from '@/lib/labels';
import type { SupportCategory, SupportPriority, SupportTicketStatus } from '@/lib/types';
import {
  EmptyState,
  ErrorAlert,
  FieldError,
  IconChevronRight,
  IconPlus,
  Modal,
  Pagination,
  SUPPORT_PRIORITY_TONES,
  SUPPORT_TONES,
  StatusBadge,
  SupportPrivacyNotice,
  TableSkeleton,
  toApiError,
  useAsync,
} from './shared';

/* ── ouverture d'un ticket ── */

function NewTicketModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (ticketId: number) => void;
}) {
  const { centerId } = useCenter();
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState<SupportCategory>('bug');
  const [priority, setPriority] = useState<SupportPriority>('normale');
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      const ticket = await createSupportTicket(centerId, {
        subject: subject.trim(),
        category,
        priority,
        body: body.trim() || undefined,
      });
      onCreated(ticket.id);
    } catch (err) {
      setError(toApiError(err));
      setSaving(false);
    }
  };

  return (
    <Modal
      title="Demander de l’aide"
      onClose={onClose}
      width={620}
      busy={saving}
      footer={
        <>
          <button type="button" className="ax-btn ax-btn--ghost" onClick={onClose} disabled={saving}>
            Annuler
          </button>
          <button
            type="submit"
            form="support-new-form"
            className="ax-btn ax-btn--primary"
            disabled={saving || subject.trim().length === 0}
          >
            {saving ? 'Envoi…' : 'Envoyer ma demande'}
          </button>
        </>
      }
    >
      <form
        id="support-new-form"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}
      >
        {error && error.messages.length > 0 && <ErrorAlert error={error} />}

        {/* L'avertissement AVANT les champs : on le lit en écrivant, pas après. */}
        <SupportPrivacyNotice />

        <div className="ax-field">
          <label className="ax-label" htmlFor="ticket-subject">
            Objet <span className="ax-field__required" aria-hidden="true">*</span>
          </label>
          <input
            id="ticket-subject"
            type="text"
            className={`ax-input${error?.fieldErrors.subject ? ' is-invalid' : ''}`}
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            maxLength={200}
            placeholder="En quelques mots"
            required
            data-autofocus=""
          />
          <FieldError error={error} field="subject" />
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 'var(--ax-space-4)',
          }}
        >
          <div className="ax-field">
            <label className="ax-label" htmlFor="ticket-category">
              De quoi s’agit-il&nbsp;?
            </label>
            <select
              id="ticket-category"
              className="ax-select"
              value={category}
              onChange={(e) => setCategory(e.target.value as SupportCategory)}
            >
              {SUPPORT_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {SUPPORT_CATEGORY_LABELS[c]}
                </option>
              ))}
            </select>
            <FieldError error={error} field="category" />
          </div>
          <div className="ax-field">
            <label className="ax-label" htmlFor="ticket-priority">
              Est-ce urgent&nbsp;?
            </label>
            <select
              id="ticket-priority"
              className="ax-select"
              value={priority}
              onChange={(e) => setPriority(e.target.value as SupportPriority)}
              aria-describedby="ticket-priority-help"
            >
              {SUPPORT_PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {SUPPORT_PRIORITY_LABELS[p]}
                </option>
              ))}
            </select>
            {/* La priorité se déclare ici et ne se change plus : le dire
                maintenant vaut mieux que le découvrir en la cherchant. */}
            <p id="ticket-priority-help" className="ax-field__message">
              À indiquer maintenant&nbsp;: elle ne sera plus modifiable ensuite.
            </p>
            <FieldError error={error} field="priority" />
          </div>
        </div>

        <div className="ax-field">
          <label className="ax-label" htmlFor="ticket-body">
            Votre message
          </label>
          <textarea
            id="ticket-body"
            className={`ax-input${error?.fieldErrors.body ? ' is-invalid' : ''}`}
            rows={6}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={5000}
            placeholder="Que s’est-il passé ? Sur quel écran ? À quel moment ?"
            aria-describedby="ticket-body-help"
          />
          {/* L'attente est dite AU MOMENT d'envoyer : aucune notification
              n'existe (vigilance ADR 0018 lot 3), et quelqu'un qui attendrait
              un SMS attendrait pour rien. */}
          <p id="ticket-body-help" className="ax-field__message">
            {SUPPORT_VISIBILITY_NOTICE} {SUPPORT_NO_NOTIFICATION_NOTICE}
          </p>
          <FieldError error={error} field="body" />
        </div>
      </form>
    </Modal>
  );
}

/* ── écran ── */

export function Support() {
  const { centerId } = useCenter();
  const router = useRouter();
  const [status, setStatus] = useState<'' | SupportTicketStatus>('');
  const [category, setCategory] = useState<'' | SupportCategory>('');
  const [page, setPage] = useState(1);
  const [newOpen, setNewOpen] = useState(false);

  /*
   * `/centre/support?nouveau=1` ouvre directement le formulaire.
   *
   * Revue UX care S5 : la sortie d'un ticket FERMÉ disait « Ouvrir un nouveau
   * ticket » et déposait la personne sur la liste, à elle de retrouver le
   * bouton. Quand on renvoie quelqu'un vers un geste, on l'y amène.
   *
   * Ouverture APRÈS montage, et non dans l'initialiseur `useState` : cet
   * initialiseur tourne aussi pendant l'hydratation, le serveur rendrait la
   * modale fermée et le client ouverte — mismatch React, avec un piège de
   * focus qui se monte sur un DOM non réconcilié. Le patron voisin
   * (`/centre/factures?encounter=N`) porte la même latence : à solder dans le
   * même passage.
   */
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('nouveau') === '1') setNewOpen(true);
  }, []);

  const tickets = useAsync(
    () =>
      listSupportTickets(centerId, {
        status: status || undefined,
        category: category || undefined,
        page,
      }),
    [centerId, status, category, page],
  );
  const rows = tickets.data?.results ?? [];

  return (
    <>
      <PageHead
        title="Support"
        subtitle="Vos échanges avec l’équipe Chioni — une demande, un fil de discussion."
        actions={
          <button type="button" className="ax-btn ax-btn--primary" onClick={() => setNewOpen(true)}>
            <IconPlus />
            <span className="ax-btn__label">Demander de l’aide</span>
          </button>
        }
      />

      <div className="ax-dash-grid">
        <section className="ax-card ax-col--12" role="region" aria-label="Mes demandes d'aide">
          <div
            className="ax-card__body"
            style={{ paddingBottom: 'var(--ax-space-3)', display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-3)' }}
          >
            <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div className="ax-field" style={{ minWidth: 220, flex: '1 1 220px' }}>
                <label className="ax-label" htmlFor="sup-status">
                  État
                </label>
                <select
                  id="sup-status"
                  className="ax-select ax-select--sm"
                  value={status}
                  onChange={(e) => {
                    setStatus(e.target.value as '' | SupportTicketStatus);
                    setPage(1);
                  }}
                >
                  <option value="">Tous les états</option>
                  {SUPPORT_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {SUPPORT_STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="ax-field" style={{ minWidth: 260, flex: '1 1 260px' }}>
                <label className="ax-label" htmlFor="sup-category">
                  Sujet
                </label>
                <select
                  id="sup-category"
                  className="ax-select ax-select--sm"
                  value={category}
                  onChange={(e) => {
                    setCategory(e.target.value as '' | SupportCategory);
                    setPage(1);
                  }}
                >
                  <option value="">Tous les sujets</option>
                  {SUPPORT_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {SUPPORT_CATEGORY_LABELS[c]}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <p style={{ margin: 0, fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-muted)', lineHeight: 1.7 }}>
              {SUPPORT_ALWAYS_OPEN_NOTICE} {SUPPORT_STATUS_READONLY_NOTICE}{' '}
              {SUPPORT_NO_NOTIFICATION_NOTICE}
            </p>
          </div>

          {tickets.loading ? (
            <TableSkeleton rows={5} cols={4} />
          ) : tickets.error ? (
            <div style={{ padding: 'var(--ax-space-4)' }}>
              <ErrorAlert error={tickets.error} onRetry={tickets.reload} />
            </div>
          ) : rows.length === 0 ? (
            <EmptyState
              title={SUPPORT_EMPTY_TITLE}
              message={SUPPORT_EMPTY_MESSAGE}
              action={
                <button type="button" className="ax-btn ax-btn--secondary" onClick={() => setNewOpen(true)}>
                  <IconPlus />
                  <span className="ax-btn__label">Demander de l’aide</span>
                </button>
              }
            />
          ) : (
            <>
              <div className="ax-table-wrap">
                <table className="ax-table ax-table--hover">
                  <thead className="ax-table__head">
                    <tr>
                      <th className="ax-table__th" scope="col">
                        Objet
                      </th>
                      <th className="ax-table__th" scope="col">
                        Sujet
                      </th>
                      <th className="ax-table__th" scope="col">
                        Ouvert par
                      </th>
                      <th className="ax-table__th" scope="col">
                        Dernier échange
                      </th>
                      <th className="ax-table__th" scope="col">
                        État
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((ticket) => (
                      <tr key={ticket.id} className="ax-table__row">
                        <td className="ax-table__td">
                          <Link
                            href={`/centre/support/${ticket.id}`}
                            className="ax-link"
                            style={{ fontWeight: 'var(--ax-weight-medium)' }}
                          >
                            {ticket.subject}
                          </Link>
                          {/* `--ax-text-subtle` (4,32:1) est sous AA : dès que
                              la ligne porte du SENS — combien d'échanges, y
                              a-t-il une pièce jointe — elle passe en
                              `--ax-text-muted`. */}
                          <div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-muted)' }}>
                            {ticket.message_count} message{ticket.message_count > 1 ? 's' : ''}
                            {ticket.attachment_count > 0
                              ? ` · ${ticket.attachment_count} pièce${ticket.attachment_count > 1 ? 's' : ''} jointe${ticket.attachment_count > 1 ? 's' : ''}`
                              : ''}
                          </div>
                        </td>
                        <td className="ax-table__td" style={{ color: 'var(--ax-text-muted)' }}>
                          {SUPPORT_CATEGORY_LABELS[ticket.category]}
                          {ticket.priority !== 'normale' && ticket.priority !== 'basse' && (
                            <div style={{ marginTop: 4 }}>
                              <StatusBadge
                                tone={SUPPORT_PRIORITY_TONES[ticket.priority]}
                                label={SUPPORT_PRIORITY_LABELS[ticket.priority]}
                              />
                            </div>
                          )}
                        </td>
                        <td className="ax-table__td" style={{ color: 'var(--ax-text-muted)' }}>
                          {ticket.opened_by_display ?? '—'}
                        </td>
                        <td className="ax-table__td" style={{ color: 'var(--ax-text-muted)', whiteSpace: 'nowrap' }}>
                          {formatDateTime(ticket.last_message_at ?? ticket.created_at)}
                        </td>
                        <td className="ax-table__td">
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--ax-space-2)' }}>
                            <StatusBadge
                              tone={SUPPORT_TONES[ticket.status]}
                              label={SUPPORT_STATUS_LABELS[ticket.status]}
                            />
                            <IconChevronRight className="" />
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {tickets.data && <Pagination count={tickets.data.count} page={page} onPage={setPage} />}
            </>
          )}
        </section>
      </div>

      {newOpen && (
        <NewTicketModal
          onClose={() => setNewOpen(false)}
          onCreated={(ticketId) => {
            // On emmène la personne sur SON fil : elle vient de décrire un
            // problème, voir le message parti est la confirmation qui compte.
            setNewOpen(false);
            router.push(`/centre/support/${ticketId}`);
          }}
        />
      )}
    </>
  );
}

export default Support;
