'use client';
/*
 * Chioni — /centre/registre : le registre du personnel (S7, ADR 0020).
 * DIRECTEUR SEUL — la garde frontend reflète la permission backend.
 *
 * Quatre onglets sur UNE route, patron `Appointments.tsx` / `Inpatient.tsx`
 * (segment `ax-segment` en tête de page) plutôt que quatre entrées de menu :
 * la section GESTION de la sidebar en compte déjà six, et quatre de plus
 * auraient noyé « Tarifs » et « Personnel » sous de la RH. Chaque onglet ne
 * monte QUE ses propres appels — changer d'onglet ne charge pas les trois
 * autres.
 *
 * Le graphique des journées notées est chargé en `dynamic()` : les onglets
 * Congés, Dossiers et Organisation ne paient pas le poids d'ApexCharts, ce qui
 * compte sur une connexion comorienne.
 *
 * **Il n'y a pas de délégué RH en S7** (hors périmètre, décision 6) : les six
 * autres rôles reçoivent 403 sur la feuille, les congés, les dossiers et les
 * statistiques. Monter l'écran pour eux reviendrait à leur promettre un accès
 * que le serveur refusera — on rend donc un état vide explicite qui les
 * renvoie vers les deux choses qu'ils PEUVENT lire : le planning de l'équipe
 * et leur propre dossier.
 */
import { useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { PageHead } from '@/components/shell/PageHead';
import { useCenter } from '@/context/CenterContext';
import {
  HRM_DIRECTOR_ONLY_MESSAGE,
  HRM_DIRECTOR_ONLY_TITLE,
  HRM_REGISTER_SUBTITLE,
  HRM_REGISTER_TITLE,
} from '@/lib/labels';
import { HrFrozenBanner } from './HrShared';
import { HrAttendanceSheet } from './HrAttendanceSheet';
import { HrEmployments } from './HrEmployments';
import { HrLeaves } from './HrLeaves';
import { HrOrganisation } from './HrOrganisation';
import { CardSkeleton, EmptyState, hasRole } from './shared';

const HrAttendanceChart = dynamic(() => import('./HrAttendanceChart'), {
  ssr: false,
  loading: () => (
    <section className="ax-card ax-col--12">
      <CardSkeleton lines={5} />
    </section>
  ),
});

type Mode = 'feuille' | 'conges' | 'dossiers' | 'organisation';

const MODES: Array<{ key: Mode; label: string }> = [
  { key: 'feuille', label: 'Feuille de présence' },
  { key: 'conges', label: 'Congés' },
  { key: 'dossiers', label: 'Dossiers' },
  { key: 'organisation', label: 'Organisation' },
];

export function HrRegister() {
  const { centerId, roles } = useCenter();
  const director = hasRole(roles, ['directeur']);
  const [mode, setMode] = useState<Mode>('feuille');

  if (!director) {
    return (
      <>
        <PageHead title={HRM_REGISTER_TITLE} />
        <div className="ax-dash-grid">
          <section className="ax-card ax-col--12" role="region" aria-label={HRM_DIRECTOR_ONLY_TITLE}>
            <EmptyState
              title={HRM_DIRECTOR_ONLY_TITLE}
              message={HRM_DIRECTOR_ONLY_MESSAGE}
              action={
                <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)', justifyContent: 'center' }}>
                  <Link href="/centre/equipe" className="ax-btn ax-btn--primary">
                    <span className="ax-btn__label">Voir l&rsquo;équipe du jour</span>
                  </Link>
                  <Link href="/centre/profil/parametres" className="ax-btn ax-btn--secondary">
                    <span className="ax-btn__label">Mon dossier</span>
                  </Link>
                </div>
              }
            />
          </section>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHead
        title={HRM_REGISTER_TITLE}
        subtitle={HRM_REGISTER_SUBTITLE}
        actions={
          <div className="ax-segment ax-segment--wrap" role="radiogroup" aria-label="Section du registre">
            {MODES.map((m) => (
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
        }
      />

      {/* Ce qui continue AVANT ce qui est fermé — le bandeau ne grise aucun
          formulaire : la garde est côté serveur, et son refus est complet. */}
      <HrFrozenBanner centerId={centerId} />

      <div className="ax-dash-grid">
        {mode === 'feuille' && (
          <>
            <HrAttendanceSheet />
            <HrAttendanceChart />
          </>
        )}
        {mode === 'conges' && <HrLeaves />}
        {mode === 'dossiers' && <HrEmployments />}
        {mode === 'organisation' && <HrOrganisation />}
      </div>
    </>
  );
}

export default HrRegister;
