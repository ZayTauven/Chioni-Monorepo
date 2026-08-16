'use client';
/*
 * Chioni — /patient/carnet : the patient's health record.
 *
 * Four pill tabs (Consultations / Ordonnances / Documents / Ma santé), each
 * loading lazily on first visit to keep the page light on a weak connection.
 * S3 additions: the « Documents » tab (photos of results, authenticated
 * download — never a static file URL), the medical file at the top of
 * « Ma santé » (blood group in plain words), the vital-signs readings, and
 * the three new record-entry shelves. The intro line states the ownership
 * rule in one sentence.
 */
import { useEffect, useState } from 'react';
import {
  downloadMyDocument,
  getMyMedicalFile,
  listEncounters,
  listMyDocuments,
  listMyStays,
  listMyVitalSigns,
  listPrescriptions,
  listRecordEntries,
} from '@/lib/endpoints/patients';
import {
  BLOOD_GROUP_LABELS,
  DOC_TYPE_LABELS,
  formatDate,
  formatKmf,
  GENERIC_CATEGORY_LABELS,
  RECORD_ENTRY_TYPE_LABELS,
  patientDeliveredOn,
  STAY_CANCELLED_PATIENT_HINT,
  STAY_PATIENT_ENCOUNTER_LINK,
  STAY_PATIENT_ONGOING_HINT,
  STAY_PATIENT_SECTION_TITLE,
  stayPatientEncounterNote,
  stayPatientPeriod,
  vitalSummary,
} from '@/lib/labels';
import type { PatientMedicalFile, RecordEntry, RecordEntryType } from '@/lib/types';
import { PatientAvailabilityPanel } from './PatientAvailability';
import { useLoadMore } from './useLoadMore';
import {
  EmptyState,
  EncounterStatusBadge,
  ErrorAlert,
  LoadMoreButton,
  PrescriptionStatusBadge,
  SkeletonCards,
  StayStatusBadge,
} from './ui';

type TabKey = 'consultations' | 'ordonnances' | 'documents' | 'sante';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'consultations', label: 'Consultations' },
  { key: 'ordonnances', label: 'Ordonnances' },
  { key: 'documents', label: 'Documents' },
  { key: 'sante', label: 'Ma santé' },
];

/** Display order of « Ma santé » groups (per the needs study, S3 extended). */
const ENTRY_ORDER: RecordEntryType[] = [
  'antecedent',
  'allergie',
  'traitement_en_cours',
  'vaccination',
  'chirurgie',
  'antecedent_familial',
  'observation',
];

function ConsultationsTab({ enabled }: { enabled: boolean }) {
  const list = useLoadMore(listEncounters, enabled);
  /*
   * S6 — les hospitalisations vivent dans CE panneau plutôt que dans un
   * cinquième onglet : un séjour EST un épisode de soin, adossé à une
   * consultation qui figure déjà dans la liste ci-dessous. Un onglet de plus
   * aurait coupé l'histoire en deux et allongé une barre d'onglets qui passe
   * déjà à la ligne sur un petit écran.
   *
   * La carte du séjour vient donc EN TÊTE, et la consultation correspondante
   * porte une PHRASE entière (« Cette visite couvre votre hospitalisation
   * du 3 au 8 août 2026 ») — c'est elle qui répond à la seule question que la
   * personne se pose devant une visite de plusieurs jours. Le renvoi
   * réciproque n'est écrit sur le séjour que si la consultation est
   * effectivement chargée : sinon il désignerait le vide.
   */
  const stays = useLoadMore(listMyStays, enabled);
  const stayByEncounter = new Map(stays.items.map((stay) => [stay.encounter, stay]));
  const shownEncounters = new Set(list.items.map((enc) => enc.id));

  /* Le squelette suit les CONSULTATIONS seules. Les séjours arrivent par un
     second appel : le faire gouverner l'écran laissait le carnet entier blanc
     quand ce petit appel traînait — or il ne concerne qu'une minorité de
     personnes, et jamais celles qui attendent le plus leur liste de visites. */
  if (list.loading) return <SkeletonCards />;
  if (list.error != null && list.items.length === 0)
    return <ErrorAlert error={list.error} onRetry={list.reload} />;

  if (list.items.length === 0) {
    // Rien à afficher tant que les séjours n'ont pas répondu : mieux vaut le
    // squelette qu'un « carnet vide » démenti une seconde plus tard.
    if (stays.loading) return <SkeletonCards />;
    if (stays.items.length === 0) {
      /* Les séjours ont ÉCHOUÉ et il n'y a aucune consultation : annoncer un
         carnet vide serait un mensonge — la personne a peut-être un séjour que
         le réseau n'a pas rendu. On montre le seul état honnête : l'échec, et
         le bouton pour réessayer. */
      if (stays.error != null) return <ErrorAlert error={stays.error} onRetry={stays.reload} />;
      return (
        <EmptyState
          title="Aucune consultation pour le moment"
          message="Vos visites dans un centre de santé apparaîtront ici."
        />
      );
    }
  }

  return (
    <div className="pat-stack">
      {stays.items.length > 0 && (
        <section className="ax-card" role="region" aria-label={STAY_PATIENT_SECTION_TITLE}>
          <div className="ax-card__body pat-gate__body">
            <h3 className="pat-row__title" style={{ margin: 0 }}>
              {STAY_PATIENT_SECTION_TITLE}
            </h3>
            {/*
              L'état vient EN PREMIER et sur sa propre ligne. Deux raisons :
              c'est la réponse à la question que la personne se pose (« suis-je
              encore hospitalisée ? »), et « Vous êtes hospitalisé(e) » est une
              PHRASE dans une pastille `white-space: nowrap` — en fin de ligne
              flex, elle écrasait le nom du centre sur un écran de 320 px.
            */}
            <ul className="pat-stays">
              {stays.items.map((stay) => (
                <li key={stay.id} className="pat-stay">
                  <StayStatusBadge status={stay.status} />
                  <span className="pat-row__title">{stay.center_name}</span>
                  <span className="pat-row__meta">
                    {stayPatientPeriod(stay.admitted_at, stay.discharged_at, stay.status)}
                  </span>
                  {stay.status === 'en_cours' && (
                    <span className="pat-row__meta">{STAY_PATIENT_ONGOING_HINT}</span>
                  )}
                  {stay.status === 'annule' && (
                    <span className="pat-row__meta">{STAY_CANCELLED_PATIENT_HINT}</span>
                  )}
                  {/* Le renvoi n'est écrit que si la consultation est VRAIMENT
                      dans la liste chargée — sinon il désignerait le vide. */}
                  {stay.status !== 'annule' && shownEncounters.has(stay.encounter) && (
                    <span className="pat-row__meta">{STAY_PATIENT_ENCOUNTER_LINK}</span>
                  )}
                </li>
              ))}
            </ul>
            <LoadMoreButton
              hasMore={stays.hasMore}
              loading={stays.loadingMore}
              onClick={stays.loadMore}
            />
          </div>
        </section>
      )}

      {/* Les séjours n'ont pas pu charger : on le dit, la liste reste lisible. */}
      {stays.error != null && <ErrorAlert error={stays.error} onRetry={stays.reload} />}

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
            {/*
              La réponse à « pourquoi cette visite dure-t-elle plusieurs
              jours ? », en une phrase entière plutôt qu'en étiquette
              « Hospitalisation : … » — un fragment de formulaire n'explique
              rien à qui n'a jamais utilisé d'application. Un séjour ANNULÉ
              n'annote rien : il n'a jamais eu lieu, le dire ici
              contredirait sa propre carte.
            */}
            {stayByEncounter.get(enc.id) !== undefined &&
              stayByEncounter.get(enc.id)!.status !== 'annule' && (
                <p className="pat-row__meta" style={{ margin: 0 }}>
                  {stayPatientEncounterNote(
                    stayByEncounter.get(enc.id)!.admitted_at,
                    stayByEncounter.get(enc.id)!.discharged_at,
                  )}
                </p>
              )}
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
            {/*
              S9 — deux ajouts, et le second est le bénéfice du sprint :

              - `delivered_at` en une phrase entière (« vos médicaments vous ont
                été remis le … ») plutôt qu'une étiquette. Il n'y a PAS de
                `delivered_by` dans ce payload, et il ne faut pas en chercher :
                aucune identité de personnel ne traverse une vue patient ;
              - « Où trouver mes médicaments ? », replié et chargé à la demande
                — le carnet se consulte en 2G sur un téléphone d'entrée de
                gamme, on ne précharge pas les recherches de toute une vie.
            */}
            {presc.delivered_at ? (
              /* Les médicaments sont dans la main de la personne : « où
                 trouver mes médicaments ? » n'a plus d'objet, et le proposer
                 quand même enverrait chercher ce qu'on a déjà — en dépensant
                 une requête au passage. Même règle que côté centre, où le
                 bouton de recherche disparaît sur une ordonnance remise. */
              <p className="pat-row__meta" style={{ margin: 0 }}>
                {patientDeliveredOn(presc.delivered_at)}
              </p>
            ) : (
              <PatientAvailabilityPanel prescriptionId={presc.id} />
            )}
          </div>
        </section>
      ))}
      {list.error != null && <ErrorAlert error={list.error} />}
      <LoadMoreButton hasMore={list.hasMore} loading={list.loadingMore} onClick={list.loadMore} />
    </div>
  );
}

/* ── S3 — « Documents » : photos de résultats, téléchargement authentifié ── */

function DocumentsTab({ enabled }: { enabled: boolean }) {
  const list = useLoadMore(listMyDocuments, enabled);
  const [busyId, setBusyId] = useState<number | null>(null);
  // The failure message lives IN the card whose button was pressed — on a
  // small screen an alert at the top of the list would be off-screen.
  const [failed, setFailed] = useState<{ id: number; error: unknown } | null>(null);

  const download = async (id: number) => {
    setBusyId(id);
    setFailed(null);
    try {
      await downloadMyDocument(id);
    } catch (err) {
      setFailed({ id, error: err });
    }
    setBusyId(null);
  };

  if (list.loading) return <SkeletonCards />;
  if (list.error != null && list.items.length === 0)
    return <ErrorAlert error={list.error} onRetry={list.reload} />;
  if (list.items.length === 0)
    return (
      <EmptyState
        title="Aucun document pour le moment"
        message="Les photos de vos résultats d'analyses et comptes rendus ajoutées par les centres apparaîtront ici."
      />
    );

  return (
    <div className="pat-stack">
      {list.items.map((doc) => (
        <section key={doc.id} className="ax-card" role="region" aria-label="Document">
          <div className="ax-card__body pat-gate__body">
            <div className="pat-row" style={{ minHeight: 0 }}>
              <div className="pat-row__main">
                <span className="pat-row__title">{doc.title}</span>
                <span className="pat-row__meta">
                  {DOC_TYPE_LABELS[doc.doc_type]} · {doc.center_name} · {formatDate(doc.created_at)}
                </span>
              </div>
            </div>
            <button
              type="button"
              className={`ax-btn ax-btn--secondary ax-btn--lg ax-btn--block${busyId === doc.id ? ' is-loading' : ''}`}
              onClick={() => void download(doc.id)}
              disabled={busyId === doc.id}
              aria-busy={busyId === doc.id}
            >
              <span className="ax-btn__spinner" aria-hidden="true"></span>
              <span className="ax-btn__label">Télécharger</span>
            </button>
            {failed?.id === doc.id && <ErrorAlert error={failed.error} />}
          </div>
        </section>
      ))}
      {list.error != null && <ErrorAlert error={list.error} />}
      <LoadMoreButton hasMore={list.hasMore} loading={list.loadingMore} onClick={list.loadMore} />
    </div>
  );
}

/* ── « Ma santé » : fiche santé + carnet + mesures ── */

function SanteTab({ enabled }: { enabled: boolean }) {
  const entries = useLoadMore(listRecordEntries, enabled);
  const vitals = useLoadMore(listMyVitalSigns, enabled);

  // The medical file is one small read-only object: fetched once when the tab
  // opens, shown when it holds something. On failure the card simply stays
  // away — the record list below carries the connectivity error if any.
  const [file, setFile] = useState<PatientMedicalFile | null>(null);
  useEffect(() => {
    if (!enabled || file !== null) return;
    let cancelled = false;
    getMyMedicalFile()
      .then((data) => {
        if (!cancelled) setFile(data);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [enabled, file]);

  if (entries.loading || vitals.loading) return <SkeletonCards />;
  if (entries.error != null && entries.items.length === 0)
    return <ErrorAlert error={entries.error} onRetry={entries.reload} />;

  const hasFileInfo = file !== null && (file.blood_group !== '' || file.notes !== '');
  if (entries.items.length === 0 && vitals.items.length === 0 && !hasFileInfo) {
    // Nothing else to show and the measures failed to load: say so honestly
    // instead of pretending the record is empty.
    if (vitals.error != null) return <ErrorAlert error={vitals.error} onRetry={vitals.reload} />;
    return (
      <EmptyState
        title="Rien pour le moment"
        message="Les soignants noteront ici vos allergies, traitements, vaccins et mesures au fil de vos visites."
      />
    );
  }

  const groups = new Map<RecordEntryType, RecordEntry[]>();
  for (const entry of entries.items) {
    const group = groups.get(entry.entry_type);
    if (group) group.push(entry);
    else groups.set(entry.entry_type, [entry]);
  }

  return (
    <div className="pat-stack">
      {/* S3 — la fiche santé en tête, en mots simples. */}
      {hasFileInfo && file !== null && (
        <section className="ax-card" role="region" aria-label="Ma fiche santé">
          <div className="ax-card__body pat-gate__body">
            <h3 className="pat-row__title" style={{ margin: 0 }}>Ma fiche santé</h3>
            {file.blood_group !== '' && (
              <p className="pat-row__meta" style={{ margin: 0 }}>
                <b>Groupe sanguin&nbsp;:</b>{' '}
                <span style={{ color: 'var(--ax-text-strong)', fontWeight: 'var(--ax-weight-semibold)' }}>
                  {BLOOD_GROUP_LABELS[file.blood_group]}
                </span>
              </p>
            )}
            {file.notes !== '' && (
              <p className="pat-row__meta" style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                {file.notes}
              </p>
            )}
          </div>
        </section>
      )}

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

      {/* S3 — les mesures prises en consultation (tension, poids…). */}
      {vitals.items.length > 0 && (
        <section className="ax-card" role="region" aria-label="Mes mesures">
          <div className="ax-card__body pat-gate__body">
            <h3 className="pat-row__title" style={{ margin: 0 }}>Mes mesures</h3>
            <ul className="pat-lines">
              {vitals.items.map((reading) => (
                <li key={reading.id}>
                  <span className="pat-line__label">
                    {/* plain: « Tension 120/80 », « Oxygène 96 % » — pas de jargon. */}
                    <span className="pat-line__name">{vitalSummary(reading, { plain: true }).join(' · ')}</span>
                    <span className="pat-line__cat">{formatDate(reading.measured_at)}</span>
                  </span>
                </li>
              ))}
            </ul>
            <LoadMoreButton
              hasMore={vitals.hasMore}
              loading={vitals.loadingMore}
              onClick={vitals.loadMore}
            />
          </div>
        </section>
      )}

      {/* Les mesures n'ont pas pu charger (ou charger plus) : on le dit,
          sans faire disparaître la carte en silence. */}
      {vitals.error != null && <ErrorAlert error={vitals.error} onRetry={vitals.reload} />}

      {entries.error != null && <ErrorAlert error={entries.error} />}
      <LoadMoreButton
        hasMore={entries.hasMore}
        loading={entries.loadingMore}
        onClick={entries.loadMore}
      />
    </div>
  );
}

export function PatientCarnet() {
  const [tab, setTab] = useState<TabKey>('consultations');
  // Lazy tabs: a panel only starts loading on its first visit.
  const [visited, setVisited] = useState<Record<TabKey, boolean>>({
    consultations: true,
    ordonnances: false,
    documents: false,
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
      <nav className="ax-tabs ax-tabs--pill pat-tabs pat-tabs--wrap" aria-label="Sections du carnet">
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
      <div hidden={tab !== 'documents'}>
        <DocumentsTab enabled={visited.documents} />
      </div>
      <div hidden={tab !== 'sante'}>
        <SanteTab enabled={visited.sante} />
      </div>
    </div>
  );
}

export default PatientCarnet;
