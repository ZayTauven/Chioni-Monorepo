'use client';
/*
 * Chioni — /patient/carnet : the patient's health record.
 *
 * Three pill tabs (Consultations / Ordonnances / Ma santé), each loading
 * lazily on first visit to keep the page light on a weak connection.
 * The intro line states the ownership rule in one sentence.
 */
import { useState } from 'react';
import {
  listEncounters,
  listPrescriptions,
  listRecordEntries,
} from '@/lib/endpoints/patients';
import {
  formatDate,
  formatKmf,
  GENERIC_CATEGORY_LABELS,
  RECORD_ENTRY_TYPE_LABELS,
} from '@/lib/labels';
import type { RecordEntry, RecordEntryType } from '@/lib/types';
import { useLoadMore } from './useLoadMore';
import {
  EmptyState,
  EncounterStatusBadge,
  ErrorAlert,
  LoadMoreButton,
  PrescriptionStatusBadge,
  SkeletonCards,
} from './ui';

type TabKey = 'consultations' | 'ordonnances' | 'sante';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'consultations', label: 'Consultations' },
  { key: 'ordonnances', label: 'Ordonnances' },
  { key: 'sante', label: 'Ma santé' },
];

/** Display order of « Ma santé » groups (per the needs study). */
const ENTRY_ORDER: RecordEntryType[] = [
  'antecedent',
  'allergie',
  'traitement_en_cours',
  'vaccination',
];

function ConsultationsTab({ enabled }: { enabled: boolean }) {
  const list = useLoadMore(listEncounters, enabled);

  if (list.loading) return <SkeletonCards />;
  if (list.error != null && list.items.length === 0)
    return <ErrorAlert error={list.error} onRetry={list.reload} />;
  if (list.items.length === 0)
    return (
      <EmptyState
        title="Aucune consultation pour le moment"
        message="Vos visites dans un centre de santé apparaîtront ici."
      />
    );

  return (
    <div className="pat-stack">
      {list.items.map((enc) => (
        <section key={enc.id} className="ax-card" role="region" aria-label="Consultation">
          <div className="ax-card__body pat-gate__body">
            <div className="pat-row" style={{ minHeight: 0 }}>
              <div className="pat-row__main">
                <span className="pat-row__title">{enc.center_name}</span>
                <span className="pat-row__meta">{formatDate(enc.occurred_at)}</span>
              </div>
              <EncounterStatusBadge status={enc.status} />
            </div>
            {enc.reason && (
              <p className="pat-row__meta" style={{ margin: 0 }}>
                <b>Motif&nbsp;:</b> {enc.reason}
              </p>
            )}
            {enc.diagnosis && (
              <p className="pat-row__meta" style={{ margin: 0 }}>
                <b>Diagnostic&nbsp;:</b> {enc.diagnosis}
              </p>
            )}
            {enc.acts.length > 0 && (
              <ul className="pat-lines">
                {enc.acts.map((act) => (
                  <li key={act.id}>
                    <span className="pat-line__label">
                      <span className="pat-line__name">{act.label_snapshot}</span>
                      <span className="pat-line__cat">
                        {GENERIC_CATEGORY_LABELS[act.generic_category]}
                      </span>
                    </span>
                    <span className="pat-amount">{formatKmf(act.price_kmf_snapshot)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      ))}
      {list.error != null && <ErrorAlert error={list.error} />}
      <LoadMoreButton hasMore={list.hasMore} loading={list.loadingMore} onClick={list.loadMore} />
    </div>
  );
}

function OrdonnancesTab({ enabled }: { enabled: boolean }) {
  const list = useLoadMore(listPrescriptions, enabled);

  if (list.loading) return <SkeletonCards />;
  if (list.error != null && list.items.length === 0)
    return <ErrorAlert error={list.error} onRetry={list.reload} />;
  if (list.items.length === 0)
    return (
      <EmptyState
        title="Aucune ordonnance pour le moment"
        message="Les ordonnances de vos consultations apparaîtront ici."
      />
    );

  return (
    <div className="pat-stack">
      {list.items.map((presc) => (
        <section key={presc.id} className="ax-card" role="region" aria-label="Ordonnance">
          <div className="ax-card__body pat-gate__body">
            <div className="pat-row" style={{ minHeight: 0 }}>
              <div className="pat-row__main">
                <span className="pat-row__title">
                  Ordonnance du {formatDate(presc.created_at)}
                </span>
              </div>
              <PrescriptionStatusBadge status={presc.status} />
            </div>
            <ul className="pat-lines">
              {presc.items.map((item) => (
                <li key={item.id}>
                  <span className="pat-line__label">
                    <span className="pat-line__name">{item.medication}</span>
                    {item.dosage && <span className="pat-line__cat">{item.dosage}</span>}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ))}
      {list.error != null && <ErrorAlert error={list.error} />}
      <LoadMoreButton hasMore={list.hasMore} loading={list.loadingMore} onClick={list.loadMore} />
    </div>
  );
}

function SanteTab({ enabled }: { enabled: boolean }) {
  const list = useLoadMore(listRecordEntries, enabled);

  if (list.loading) return <SkeletonCards />;
  if (list.error != null && list.items.length === 0)
    return <ErrorAlert error={list.error} onRetry={list.reload} />;
  if (list.items.length === 0)
    return (
      <EmptyState
        title="Rien pour le moment"
        message="Les soignants noteront ici vos allergies, traitements et vaccins au fil de vos visites."
      />
    );

  const groups = new Map<RecordEntryType, RecordEntry[]>();
  for (const entry of list.items) {
    const group = groups.get(entry.entry_type);
    if (group) group.push(entry);
    else groups.set(entry.entry_type, [entry]);
  }

  return (
    <div className="pat-stack">
      {ENTRY_ORDER.filter((type) => groups.has(type)).map((type) => (
        <section key={type} className="ax-card" role="region" aria-label={RECORD_ENTRY_TYPE_LABELS[type]}>
          <div className="ax-card__body pat-gate__body">
            <h3 className="pat-row__title" style={{ margin: 0 }}>
              {RECORD_ENTRY_TYPE_LABELS[type]}
            </h3>
            <ul className="pat-lines">
              {(groups.get(type) ?? []).map((entry) => (
                <li key={entry.id}>
                  <span className="pat-line__label">
                    <span className="pat-line__name">{entry.content}</span>
                    <span className="pat-line__cat">{formatDate(entry.created_at)}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ))}
      {list.error != null && <ErrorAlert error={list.error} />}
      <LoadMoreButton hasMore={list.hasMore} loading={list.loadingMore} onClick={list.loadMore} />
    </div>
  );
}

export function PatientCarnet() {
  const [tab, setTab] = useState<TabKey>('consultations');
  // Lazy tabs: a panel only starts loading on its first visit.
  const [visited, setVisited] = useState<Record<TabKey, boolean>>({
    consultations: true,
    ordonnances: false,
    sante: false,
  });

  function select(key: TabKey) {
    setTab(key);
    setVisited((cur) => (cur[key] ? cur : { ...cur, [key]: true }));
  }

  return (
    <div className="pat-stack">
      <p className="pat-hello-sub" style={{ margin: 0 }}>
        Votre carnet vous appartient. Seuls vous et les soignants le voient.
      </p>

      {/* Honest pattern: plain toggle buttons (aria-pressed), not an
          incomplete ARIA tabs composite. Same choice as PatientPaiements. */}
      <nav className="ax-tabs ax-tabs--pill pat-tabs" aria-label="Sections du carnet">
        <div className="ax-tabs__list">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              className={`ax-tabs__tab${tab === t.key ? ' is-active' : ''}`}
              aria-pressed={tab === t.key}
              onClick={() => select(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </nav>

      <div hidden={tab !== 'consultations'}>
        <ConsultationsTab enabled={visited.consultations} />
      </div>
      <div hidden={tab !== 'ordonnances'}>
        <OrdonnancesTab enabled={visited.ordonnances} />
      </div>
      <div hidden={tab !== 'sante'}>
        <SanteTab enabled={visited.sante} />
      </div>
    </div>
  );
}

export default PatientCarnet;
