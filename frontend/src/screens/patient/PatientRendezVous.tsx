'use client';
/*
 * Chioni — /patient/rendez-vous : « Mes rendez-vous » (S2).
 *
 * Lecture seule + annulation d'un rendez-vous encore prévu — la PRISE de
 * rendez-vous se fait au guichet (pas de self-booking dans l'API, l'écran le
 * dit honnêtement). Transversal tous centres. Le payload ne porte PAS de
 * motif (note de guichet, staff seulement) : aucun emplacement prévu.
 *
 * Mobile-first (Mariama) : cartes empilées, une info par ligne, jour en
 * toutes lettres, boutons ≥ 44 px, annulation confirmée sur un ton
 * bienveillant (« Prévenez le centre si vous pouvez »).
 */
import { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import { cancelMyAppointment, listMyAppointments } from '@/lib/endpoints/patients';
import {
  APPOINTMENT_STATUS_PATIENT,
  formatMinutes,
  formatWeekdayDateTime,
} from '@/lib/labels';
import type { AppointmentStatus, PatientAppointment } from '@/lib/types';
import { useLoadMore } from './useLoadMore';
import {
  ConfirmModal,
  EmptyState,
  ErrorAlert,
  LoadMoreButton,
  SkeletonCards,
  SuccessAlert,
} from './ui';

type BadgeTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

const STATUS_TONES: Record<AppointmentStatus, BadgeTone> = {
  prevu: 'info',
  arrive: 'info',
  honore: 'success',
  /* Amber, not red: « Manqué » is information in the patient's history, never
     a reproach — red would read as blame with no action to take. */
  manque: 'warning',
  annule: 'neutral',
};

/** Server definition of « à venir » : still `prevu` AND in the future —
 *  reused client-side to keep the history section free of duplicates. */
function isUpcoming(a: PatientAppointment): boolean {
  return a.status === 'prevu' && new Date(a.scheduled_at).getTime() > Date.now();
}

function AppointmentCard({
  appointment,
  onCancel,
}: {
  appointment: PatientAppointment;
  onCancel?: (a: PatientAppointment) => void;
}) {
  const a = appointment;
  return (
    <section className="ax-card" role="region" aria-label={`Rendez-vous à ${a.center.name}`}>
      <div className="ax-card__body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-2)' }}>
        <div className="ax-cluster" style={{ justifyContent: 'space-between', gap: 'var(--ax-space-2)', alignItems: 'flex-start' }}>
          <span style={{ fontWeight: 600, color: 'var(--ax-text-strong)', fontSize: 'var(--ax-text-md, var(--ax-text-sm))' }}>
            {formatWeekdayDateTime(a.scheduled_at)}
          </span>
          <span className={`ax-badge ax-badge--soft ax-badge--${STATUS_TONES[a.status]}`}>
            {APPOINTMENT_STATUS_PATIENT[a.status]}
          </span>
        </div>
        <span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)' }}>{a.center.name}</span>
        <span style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-muted)' }}>
          {[formatMinutes(a.duration_minutes), a.practitioner_display_name ? `Avec ${a.practitioner_display_name}` : '']
            .filter(Boolean)
            .join(' · ')}
        </span>
        {onCancel && a.status === 'prevu' && (
          <button
            type="button"
            className="ax-btn ax-btn--ghost ax-btn--lg ax-btn--block"
            style={{ marginTop: 'var(--ax-space-2)' }}
            onClick={() => onCancel(a)}
          >
            Annuler ce rendez-vous
          </button>
        )}
      </div>
    </section>
  );
}

export function PatientRendezVous() {
  const fetchUpcoming = useCallback(
    (page: number) => listMyAppointments({ page, upcoming: true }),
    [],
  );
  const fetchAll = useCallback((page: number) => listMyAppointments({ page }), []);

  const upcoming = useLoadMore<PatientAppointment>(fetchUpcoming);
  const all = useLoadMore<PatientAppointment>(fetchAll);

  const [cancelTarget, setCancelTarget] = useState<PatientAppointment | null>(null);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [cancelError, setCancelError] = useState<unknown>(null);
  const [cancelled, setCancelled] = useState(false);

  // History = everything that is NOT an upcoming appointment (same definition
  // as the server's `?upcoming=true`), so nothing shows twice.
  const history = useMemo(() => all.items.filter((a) => !isUpcoming(a)), [all.items]);

  async function confirmCancel() {
    if (!cancelTarget) return;
    setCancelBusy(true);
    setCancelError(null);
    try {
      await cancelMyAppointment(cancelTarget.id);
      setCancelTarget(null);
      setCancelled(true);
      upcoming.reload();
      all.reload();
    } catch (err) {
      setCancelError(err);
    } finally {
      setCancelBusy(false);
    }
  }

  return (
    <div className="pat-stack">
      <Link href="/patient" className="ax-link">← Accueil</Link>

      <header>
        <h2 className="pat-hello" style={{ fontSize: 'var(--ax-text-xl)' }}>Mes rendez-vous</h2>
        <p className="pat-hello-sub">
          Pour prendre ou déplacer un rendez-vous, adressez-vous au centre de santé.
        </p>
      </header>

      {cancelled && <SuccessAlert message="Le rendez-vous a été annulé. Merci d'avoir prévenu." />}

      {/* À VENIR */}
      <section aria-label="Rendez-vous à venir" className="pat-stack" style={{ gap: 'var(--ax-space-3)' }}>
        <h3 style={{ margin: 0, fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)', fontWeight: 600 }}>
          À venir
        </h3>
        {upcoming.loading && <SkeletonCards count={2} />}
        {!upcoming.loading && upcoming.error != null && (
          <ErrorAlert error={upcoming.error} onRetry={upcoming.reload} />
        )}
        {!upcoming.loading && upcoming.error == null && upcoming.items.length === 0 && (
          <EmptyState
            title="Aucun rendez-vous à venir"
            message="Quand un centre de santé vous donnera un rendez-vous, il apparaîtra ici. Un SMS de rappel vous est envoyé la veille."
          />
        )}
        {upcoming.items.map((a) => (
          <AppointmentCard
            key={a.id}
            appointment={a}
            onCancel={(target) => {
              setCancelError(null);
              setCancelled(false);
              setCancelTarget(target);
            }}
          />
        ))}
        <LoadMoreButton hasMore={upcoming.hasMore} loading={upcoming.loadingMore} onClick={upcoming.loadMore} />
      </section>

      {/* HISTORIQUE */}
      <section aria-label="Anciens rendez-vous" className="pat-stack" style={{ gap: 'var(--ax-space-3)' }}>
        <h3 style={{ margin: 0, fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)', fontWeight: 600 }}>
          Passés
        </h3>
        {all.loading && <SkeletonCards count={2} />}
        {!all.loading && all.error != null && <ErrorAlert error={all.error} onRetry={all.reload} />}
        {!all.loading && all.error == null && history.length === 0 && (
          <EmptyState
            title="Rien pour l'instant"
            message="Vos anciens rendez-vous apparaîtront ici."
          />
        )}
        {history.map((a) => (
          <AppointmentCard key={a.id} appointment={a} />
        ))}
        <LoadMoreButton hasMore={all.hasMore} loading={all.loadingMore} onClick={all.loadMore} />
      </section>

      <ConfirmModal
        open={cancelTarget !== null}
        title="Annuler ce rendez-vous ?"
        message="Prévenez le centre si vous pouvez — cela libère la place pour quelqu'un d'autre. Pour un nouveau rendez-vous, adressez-vous au centre."
        confirmLabel="Oui, annuler ce rendez-vous"
        cancelLabel="Garder mon rendez-vous"
        danger
        busy={cancelBusy}
        error={cancelError}
        onConfirm={() => void confirmCancel()}
        onClose={() => {
          if (!cancelBusy) setCancelTarget(null);
        }}
      />
    </div>
  );
}

export default PatientRendezVous;
