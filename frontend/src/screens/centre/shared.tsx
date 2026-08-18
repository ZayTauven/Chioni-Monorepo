'use client';
/*
 * Chioni — shared primitives of the CENTRE space screens.
 *
 * Everything here builds on the Vireo ax-* design system (components.css) and
 * the central API client. No screen of src/screens/centre/ talks to fetch()
 * directly: data flows through useAsync + the endpoints of lib/endpoints/centers.ts,
 * errors are ApiError normalised by the client.
 */
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { useAuth } from '@/context/AuthContext';
import { useCenter } from '@/context/CenterContext';
import { ApiError } from '@/lib/api';
import { getPatient } from '@/lib/endpoints/centers';
import {
  SUPPORT_PRIVACY_EXAMPLE,
  SUPPORT_PRIVACY_HOWTO,
  SUPPORT_PRIVACY_NOTICE,
  SUPPORT_PRIVACY_TITLE,
} from '@/lib/labels';
import type {
  AppointmentStatus,
  AttendanceStatus,
  ClaimStatus,
  DisputeStatus,
  EncounterStatus,
  EquipmentStatus,
  InvoiceStatus,
  KycStatus,
  LeaveStatus,
  PaymentRequestStatus,
  PublicAttendanceStatus,
  StaffRole,
  StayPriority,
  StayStatus,
  SubscriptionInvoiceStatus,
  SubscriptionStatus,
  SupportPriority,
  SupportTicketStatus,
} from '@/lib/types';

/* ── constants ── */

/** DRF PageNumberPagination — 20 items per page (api-contract.md). */
export const PAGE_SIZE = 20;

/* ── roles (mirror of backend trustbridge/medical views) ── */

export const BILLING_ROLES: StaffRole[] = ['directeur', 'secretaire', 'caissier'];
export const CLINICAL_ROLES: StaffRole[] = ['medecin', 'infirmier', 'sage_femme'];
export const PRESCRIBER_ROLES: StaffRole[] = ['medecin', 'sage_femme'];
export const PRESCRIPTION_READ_ROLES: StaffRole[] = [...CLINICAL_ROLES, 'pharmacien'];
export const CARE_CONFIRM_ROLES: StaffRole[] = ['directeur', 'medecin', 'infirmier', 'sage_femme', 'pharmacien'];
export const TARIFF_WRITE_ROLES: StaffRole[] = ['directeur', 'caissier'];

/**
 * Multi-roles (S2): a member can hold SEVERAL roles in the same center
 * (directeur + médecin). Gates pass `roles` from useCenter() so cumulating
 * hats only ever WIDENS access — a single role still works for spot checks.
 */
export function hasRole(
  roles: StaffRole | readonly StaffRole[],
  allowed: readonly StaffRole[],
): boolean {
  const held: readonly StaffRole[] = typeof roles === 'string' ? [roles] : roles;
  return held.some((r) => allowed.includes(r));
}

/**
 * Une clé d'idempotence pour un geste d'argent (encaissement guichet,
 * facturation des journées d'hospitalisation).
 *
 * `crypto.randomUUID()` n'existe QUE dans un contexte sécurisé : sur une
 * installation servie en `http://` — un intranet de centre, une démo sur IP
 * locale, un partage de connexion mal configuré — l'appel lève, et il levait
 * dans un initialiseur de `useState`, c'est-à-dire au MONTAGE de la modale :
 * le caissier n'avait plus de formulaire du tout, sans un mot d'explication.
 * Le repli n'a pas besoin d'être cryptographique (la clé n'est qu'un jeton
 * anti-doublon, unique par centre) mais il doit être unique en pratique.
 */
export function newIdempotencyKey(): string {
  const c: Crypto | undefined = typeof crypto === 'undefined' ? undefined : crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  if (c && typeof c.getRandomValues === 'function') {
    const bytes = c.getRandomValues(new Uint8Array(16));
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  }
  return `k-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

/* ── async data hook ── */

export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: ApiError | null;
  reload: () => void;
}

export function toApiError(err: unknown): ApiError {
  if (err instanceof ApiError) return err;
  return new ApiError(0, ['Connexion impossible. Vérifiez votre réseau puis réessayez.']);
}

/**
 * Run an async fetcher tied to `deps`; cancelled on unmount / deps change.
 * `reload()` re-runs with the same deps (after a mutation).
 */
export function useAsync<T>(fn: () => Promise<T>, deps: readonly unknown[]): AsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  const [tick, setTick] = useState(0);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  /*
   * ── La fenêtre d'affichage, fermée à la RACINE (revue guardian S9) ──
   *
   * `data` décrit ce que les DEPS demandaient : le centre actif, l'officine
   * active, l'id de la route, la date. Quand une dep change, la donnée en
   * mémoire ne décrit plus ce que l'écran affiche — mais l'effet ci-dessous
   * ne s'exécute qu'APRÈS la peinture, et il ne remplace `data` qu'au retour
   * du réseau. Entre les deux, tout écran qui garde sa donnée pendant un
   * rechargement (`loading && !data ? squelette : …`, patron des écrans de
   * détail) peint l'objet PRÉCÉDENT sous le nouveau nom — pendant des
   * centaines de millisecondes sur une connexion comorienne.
   *
   * C'est le défaut relevé aux revues S5, S6, S7 puis S9, corrigé jusqu'ici
   * écran par écran. Il est fermé ici pour toutes : dès le rendu où les deps
   * changent, `data` et `error` tombent et `loading` remonte — l'écran montre
   * son squelette, jamais la donnée d'un autre centre, d'une autre officine
   * ou d'une autre date.
   *
   * `tick` (`reload()`) est délibérément HORS de la comparaison : recharger
   * après une écriture doit garder la liste à l'écran, sans clignotement.
   *
   * Patron React documenté (« ajuster l'état quand les props changent ») :
   * un `setState` pendant le rendu du MÊME composant, garanti conditionnel,
   * que React traite par un re-rendu immédiat avant de peindre les enfants.
   * La comparaison est faite ÉLÉMENT PAR ÉLÉMENT (le tableau littéral est
   * recréé à chaque rendu) : elle converge donc au rendu suivant.
   *
   * **Contrainte d'appel, inchangée mais désormais sanctionnée deux fois** :
   * les deps doivent être des valeurs STABLES (primitives, ou références qui
   * ne changent qu'à l'arrivée d'une donnée). Un objet littéral en dep
   * bouclait déjà en refetch infini via l'effet ; il bouclerait maintenant en
   * rendu — la faute est la même, elle se voit simplement plus tôt.
   */
  const [seenDeps, setSeenDeps] = useState<readonly unknown[]>(deps);
  if (
    seenDeps.length !== deps.length ||
    deps.some((dep, index) => !Object.is(dep, seenDeps[index]))
  ) {
    setSeenDeps(deps);
    setData(null);
    setError(null);
    setLoading(true);
  }

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fnRef.current().then(
      (result) => {
        if (cancelled) return;
        setData(result);
        setLoading(false);
      },
      (err) => {
        if (cancelled) return;
        setError(toApiError(err));
        setLoading(false);
      },
    );
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { data, loading, error, reload };
}

/** Debounce a changing value (search inputs → server `?q=`). */
export function useDebounced<T>(value: T, delayMs = 400): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}

/**
 * Un état OPTIMISTE qui meurt avec la portée qui l'a produit (guardian S9).
 *
 * `useAsync` ferme désormais la fenêtre pour la donnée VENUE DU SERVEUR ;
 * restait l'autre moitié du problème, celle que les revues S5/S6/S7 ont
 * corrigée écran par écran : la ligne fraîche gardée après une écriture
 * (`patched`) et le message de succès (`flash`). Ils ne décrivent QUE le
 * couple (tenant actif, id de route) sous lequel ils ont été obtenus — et le
 * sélecteur de centre ou d'officine, lui, ne quitte pas la page.
 *
 * La portée est vérifiée **au rendu**, pas dans un effet : un effet laisserait
 * une frame où l'objet précédent s'affiche sous le nouveau nom, et sur le
 * chemin d'une écriture cette frame suffit à cliquer.
 *
 * `scope` : toute chaîne qui identifie la portée, p. ex. `` `${centerId}:${id}` ``.
 */
export function useScopedState<T>(
  scope: string,
): [T | null, (value: T | null) => void] {
  const [held, setHeld] = useState<{ scope: string; value: T } | null>(null);
  const value = held !== null && held.scope === scope ? held.value : null;
  const set = useCallback(
    (next: T | null) => setHeld(next === null ? null : { scope, value: next }),
    [scope],
  );
  return [value, set];
}

/* ── patient-name cache (staff serializers carry patient ids only) ── */

const patientNameCache = new Map<string, string>();

/**
 * Resolve patient display names for a set of ids (one fetch per unknown id,
 * cached for the session). Honest data — every name comes from
 * GET /centers/{c}/patients/{id}/ ; unresolved ids show as « Patient n° X ».
 */
export function usePatientNames(centerId: number, ids: number[]): Record<number, string> {
  const [names, setNames] = useState<Record<number, string>>({});
  const key = ids.slice().sort((a, b) => a - b).join(',');

  useEffect(() => {
    let cancelled = false;
    const wanted = key ? key.split(',').map(Number) : [];
    const resolved: Record<number, string> = {};
    const missing: number[] = [];
    for (const id of wanted) {
      const cached = patientNameCache.get(`${centerId}:${id}`);
      if (cached) resolved[id] = cached;
      else missing.push(id);
    }
    setNames(resolved);
    if (missing.length === 0) return;
    Promise.allSettled(
      missing.map(async (id) => {
        const patient = await getPatient(centerId, id);
        const name = `${patient.first_name} ${patient.last_name}`.trim() || `Patient n° ${id}`;
        patientNameCache.set(`${centerId}:${id}`, name);
        return [id, name] as const;
      }),
    ).then((settled) => {
      if (cancelled) return;
      setNames((prev) => {
        const next = { ...prev };
        for (const item of settled) {
          if (item.status === 'fulfilled') next[item.value[0]] = item.value[1];
        }
        return next;
      });
    });
    return () => {
      cancelled = true;
    };
  }, [centerId, key]);

  return names;
}

export function patientLabel(names: Record<number, string>, id: number): string {
  return names[id] ?? `Patient n° ${id}`;
}

/* ── status → tone maps ── */

export type BadgeTone = 'success' | 'warning' | 'danger' | 'info' | 'accent' | 'neutral';

export const PAYMENT_REQUEST_TONES: Record<PaymentRequestStatus, BadgeTone> = {
  brouillon: 'neutral',
  envoyee: 'info',
  payee: 'success',
  soin_confirme: 'accent',
  cloturee: 'neutral',
  litige: 'danger',
};

export const INVOICE_TONES: Record<InvoiceStatus, BadgeTone> = {
  brouillon: 'neutral',
  emise: 'info',
  payee: 'success',
  annulee: 'danger',
};

export const ENCOUNTER_TONES: Record<EncounterStatus, BadgeTone> = {
  en_cours: 'info',
  terminee: 'success',
  annulee: 'neutral',
};

export const CLAIM_TONES: Record<ClaimStatus, BadgeTone> = {
  non_revendique: 'neutral',
  invite: 'warning',
  actif: 'success',
};

export const KYC_TONES: Record<KycStatus, BadgeTone> = {
  en_attente: 'warning',
  actif: 'success',
  suspendu: 'danger',
};

export const DISPUTE_TONES: Record<DisputeStatus, BadgeTone> = {
  ouvert: 'danger',
  resolu: 'success',
};

export const APPOINTMENT_TONES: Record<AppointmentStatus, BadgeTone> = {
  prevu: 'info',
  arrive: 'accent',
  honore: 'success',
  manque: 'danger',
  annule: 'neutral',
};

/**
 * S6 — le séjour. `sortie` est un `success` (le patient est rentré chez lui,
 * c'est l'issue normale) et `annule` reste NEUTRE : une admission annulée est
 * une correction de saisie, jamais un incident — le rouge apprendrait au
 * service à redouter un geste qui répare.
 */
export const STAY_TONES: Record<StayStatus, BadgeTone> = {
  en_cours: 'info',
  sortie: 'success',
  annule: 'neutral',
};

/**
 * La priorité de triage. `normale` n'a PAS de couleur (sinon les trois se
 * valent visuellement et le tableau ne dit plus rien d'un cas critique).
 */
export const STAY_PRIORITY_TONES: Record<StayPriority, BadgeTone> = {
  normale: 'neutral',
  urgente: 'warning',
  critique: 'danger',
};

/**
 * S8 — l'état d'un appareil (ADR 0021).
 *
 * **`en_panne` n'est PAS un `danger`**, et c'est l'arbitrage de ton du sprint :
 * un appareil en panne est une **information de service**, pas une faute. Le
 * rouge d'alarme dirait « quelque chose a mal tourné » à côté d'un constat
 * qu'on veut au contraire voir posé sans hésiter — c'est le même raisonnement
 * que « Manqué » jamais rouge sur un rendez-vous, et qu'`annule` neutre sur un
 * séjour. `warning` dit ce qu'il faut : quelque chose attend un geste.
 *
 * `reforme` est NEUTRE : l'appareil est sorti du parc, il n'y a plus rien à
 * faire — le signaler en couleur ferait clignoter une page d'histoire.
 */
export const EQUIPMENT_TONES: Record<EquipmentStatus, BadgeTone> = {
  en_service: 'success',
  en_panne: 'warning',
  reforme: 'neutral',
};

/**
 * S5 — l'abonnement. Le ton SUIT l'arbitrage produit, il ne le trahit pas :
 * `impaye` est un `warning` parce que ça appelle un geste, PAS un `danger`
 * (rien n'est fermé) ; `suspendu` et `resilie` sont des `danger` parce que
 * quelque chose est réellement gelé. Confondre les deux apprendrait à un
 * directeur à ignorer la couleur.
 */
export const SUBSCRIPTION_TONES: Record<SubscriptionStatus, BadgeTone> = {
  essai: 'info',
  actif: 'success',
  impaye: 'warning',
  suspendu: 'danger',
  resilie: 'neutral',
};

/** Une facture d'abonnement : « à régler » informe, il n'alarme pas. */
export const SUBSCRIPTION_INVOICE_TONES: Record<SubscriptionInvoiceStatus, BadgeTone> = {
  emise: 'info',
  payee: 'success',
  annulee: 'neutral',
};

/** Un ticket de support — `ferme` est définitif, donc neutre et non rouge. */
export const SUPPORT_TONES: Record<SupportTicketStatus, BadgeTone> = {
  ouvert: 'info',
  en_cours: 'accent',
  resolu: 'success',
  ferme: 'neutral',
};

/** L'urgence déclarée à l'ouverture — jamais re-priorisable ensuite. */
export const SUPPORT_PRIORITY_TONES: Record<SupportPriority, BadgeTone> = {
  basse: 'neutral',
  normale: 'neutral',
  haute: 'warning',
  urgente: 'danger',
};

/**
 * S7 — une journée de la feuille de présence.
 *
 * **Aucun statut n'est un `danger`, et c'est la décision de design du module.**
 * Une absence n'est pas un incident : on ne sait pas pourquoi la personne
 * n'est pas là (maladie, deuil, enfant malade) et la feuille n'a pas mandat
 * de le juger. Peindre `absent` en rouge apprendrait à toute une équipe à lire
 * la couleur comme un reproche, et transformerait un registre en instrument de
 * contrôle — exactement ce que l'ADR 0020 refuse d'inventer.
 *
 * `conge` reste `info` et non `warning` : un congé pris est un droit exercé.
 */
export const ATTENDANCE_TONES: Record<AttendanceStatus, BadgeTone> = {
  present: 'success',
  absent: 'neutral',
  conge: 'info',
  repos: 'neutral',
  ferie: 'accent',
};

/**
 * Le planning collectif — même palette, amputée de `conge` qui n'existe pas
 * dans ce payload (et n'y existera jamais : le backend le fond dans `absent`).
 */
export const PUBLIC_ATTENDANCE_TONES: Record<PublicAttendanceStatus, BadgeTone> = {
  present: 'success',
  absent: 'neutral',
  repos: 'neutral',
  ferie: 'accent',
};

/**
 * Une demande de congé. `refuse` est un `neutral`, PAS un `danger` : le rouge
 * dirait « quelque chose ne va pas », alors qu'un refus est une décision
 * d'organisation ordinaire — et c'est la personne concernée qui lit ce badge
 * sur son propre écran. `annule` = « Retiré », son propre geste : neutre aussi.
 */
export const LEAVE_TONES: Record<LeaveStatus, BadgeTone> = {
  demande: 'warning',
  approuve: 'success',
  refuse: 'neutral',
  annule: 'neutral',
};

/**
 * S5 — l'avertissement de confidentialité du module Support, AU CONTACT du
 * champ de saisie (ADR 0018 décision 5, parade (b) du risque assumé).
 *
 * Il vit dans le socle et non dans un écran : les DEUX portes d'écriture le
 * montent (la modale d'ouverture et le champ de réponse du fil), et le faire
 * descendre d'un écran vers l'autre embarquerait la liste complète des tickets
 * dans le bundle du détail — sur une connexion comorienne, ce n'est pas un
 * détail.
 *
 * **Revue UX care S5 — deux correctifs, aucun sur le texte du backend :**
 *
 * 1. Le bloc était un `ax-alert--warning`, soit le poids visuel exact de
 *    « Gestion administrative suspendue ». Sur l'écran où l'on vient DEMANDER
 *    de l'aide, un panneau jaune en tête de formulaire se lit comme un
 *    reproche avant d'avoir écrit un mot, et le premier réflexe est de
 *    refermer. Ton `info` + un titre qui annonce de l'AIDE : la consigne reste
 *    aussi visible, elle n'intimide plus.
 * 2. La phrase du backend renvoie au « numéro de dossier » — introuvable :
 *    aucun écran du centre n'affiche de numéro de dossier patient. On ajoute
 *    donc ce qui EST recopiable à l'écran (numéro de facture, de reçu, date,
 *    nom de la page) et un exemple : c'est l'exemple qui débloque la
 *    rédaction, pas la règle.
 *
 * `SUPPORT_PRIVACY_NOTICE` reste repris à la lettre (parité avec
 * `apps/support/models.py`) : seul le cadrage change.
 */
export function SupportPrivacyNotice() {
  return (
    <div className="ax-alert ax-alert--info" role="note">
      <div className="ax-alert__content">
        <p className="ax-alert__title">{SUPPORT_PRIVACY_TITLE}</p>
        <p className="ax-alert__message" style={{ lineHeight: 1.7 }}>
          {SUPPORT_PRIVACY_HOWTO}
        </p>
        <p className="ax-alert__message" style={{ lineHeight: 1.7 }}>
          {SUPPORT_PRIVACY_NOTICE}
        </p>
        <p className="ax-alert__message" style={{ lineHeight: 1.7 }}>
          {SUPPORT_PRIVACY_EXAMPLE}
        </p>
      </div>
    </div>
  );
}

export function StatusBadge({ tone, label }: { tone: BadgeTone; label: string }) {
  return (
    <span className={`ax-badge ax-badge--soft ax-badge--${tone} ax-badge--pill`}>
      <span className="ax-badge__dot" />
      {label}
    </span>
  );
}

/* ── icons (Tabler outlines, same stroke contract as Vireo screens) ── */

interface IconProps {
  className?: string;
}

function icon(paths: ReactNode) {
  return function Icon({ className = 'ax-btn__icon' }: IconProps) {
    return (
      /*
       * SV — `width/height="1em"` : la taille INTRINSÈQUE de l'icône. Hors
       * d'un bouton, ni `ax-btn__icon` (son `--_btn-icon` n'existe que sous
       * `.ax-btn`) ni `className=""` ne dimensionnaient le SVG — il prenait
       * la taille par défaut d'un élément remplacé. Avec 1em, une icône suit
       * le texte qui l'entoure partout ; les contextes stylés (`.ax-btn`,
       * `.ax-field__affix`, `.ax-alert__icon`…) continuent de gagner, le CSS
       * primant sur les attributs de présentation.
       */
      <svg
        className={className}
        viewBox="0 0 24 24"
        width="1em"
        height="1em"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {paths}
      </svg>
    );
  };
}

export const IconPlus = icon(<><path d="M12 5l0 14" /><path d="M5 12l14 0" /></>);
export const IconSearch = icon(<><path d="M3 10a7 7 0 1 0 14 0a7 7 0 1 0 -14 0" /><path d="M21 21l-6 -6" /></>);
export const IconClose = icon(<><path d="M18 6l-12 12" /><path d="M6 6l12 12" /></>);
export const IconChevronRight = icon(<path d="M9 6l6 6l-6 6" />);
export const IconArrowLeft = icon(<><path d="M5 12l14 0" /><path d="M5 12l6 6" /><path d="M5 12l6 -6" /></>);
export const IconEdit = icon(<><path d="M4 20h4l10.5 -10.5a2.828 2.828 0 1 0 -4 -4l-10.5 10.5v4" /><path d="M13.5 6.5l4 4" /></>);
export const IconCheck = icon(<path d="M5 12l5 5l10 -10" />);
export const IconSend = icon(<><path d="M10 14l11 -11" /><path d="M21 3l-6.5 18a.55 .55 0 0 1 -1 0l-3.5 -7l-7 -3.5a.55 .55 0 0 1 0 -1l18 -6.5" /></>);
export const IconMerge = icon(<><path d="M7 7m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" /><path d="M7 17m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" /><path d="M17 12m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" /><path d="M7 9v6" /><path d="M9 7.5l6 3" /><path d="M9 16.5l6 -3" /></>);
export const IconRefresh = icon(<><path d="M20 11a8.1 8.1 0 0 0 -15.5 -2m-.5 -4v4h4" /><path d="M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4" /></>);
export const IconReceipt = icon(<path d="M5 21v-16a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2v16l-3 -2l-2 2l-2 -2l-2 2l-2 -2l-3 2" />);
export const IconAlertTriangle = icon(<><path d="M12 9v4" /><path d="M10.363 3.591l-8.106 13.534a1.914 1.914 0 0 0 1.636 2.871h16.214a1.914 1.914 0 0 0 1.636 -2.871l-8.106 -13.534a1.914 1.914 0 0 0 -3.274 0z" /><path d="M12 16h.01" /></>);
export const IconStethoscope = icon(<><path d="M6 4h-1a2 2 0 0 0 -2 2v3.5h0a5.5 5.5 0 0 0 11 0v-3.5a2 2 0 0 0 -2 -2h-1" /><path d="M8 15a6 6 0 1 0 12 0v-3" /><path d="M11 3v2" /><path d="M6 3v2" /><path d="M20 10m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" /></>);
export const IconUserOff = icon(<><path d="M8.18 8.189a4.01 4.01 0 0 0 2.616 2.627m3.507 -.545a4 4 0 1 0 -5.59 -5.552" /><path d="M6 21v-2a4 4 0 0 1 4 -4h4c.412 0 .81 .062 1.183 .178m2.633 2.618c.12 .38 .184 .785 .184 1.204v2" /><path d="M3 3l18 18" /></>);
/* S6 — le lit vient du KPI « Bed Occupancy » du dashboard healthcare de Vireo ;
   l'échange de flèches est déjà dans le registre d'icônes du shell (nav). */
export const IconBed = icon(<><path d="M5 9a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" /><path d="M22 17v-3h-20" /><path d="M2 8v9" /><path d="M12 14h10v-2a3 3 0 0 0 -3 -3h-7v5" /></>);
export const IconExchange = icon(<><path d="M7 10h14l-4 -4" /><path d="M17 14h-14l4 4" /></>);
export const IconLogout = icon(<><path d="M14 8v-2a2 2 0 0 0 -2 -2h-7a2 2 0 0 0 -2 2v12a2 2 0 0 0 2 2h7a2 2 0 0 0 2 -2v-2" /><path d="M9 12h12l-3 -3" /><path d="M18 15l3 -3" /></>);
/* S7 — le registre du personnel. Tabler outline, même contrat de trait que
   les précédentes : `trash` (retirer un jour férié), `paperclip` (un
   justificatif), `download` (le lire), `archive` (le ranger définitivement). */
export const IconTrash = icon(<><path d="M4 7l16 0" /><path d="M10 11l0 6" /><path d="M14 11l0 6" /><path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12" /><path d="M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3" /></>);
export const IconPaperclip = icon(<path d="M15 7l-6.5 6.5a1.5 1.5 0 0 0 3 3l6.5 -6.5a3 3 0 0 0 -6 -6l-6.5 6.5a4.5 4.5 0 0 0 9 9l6.5 -6.5" />);
export const IconDownload = icon(<><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2" /><path d="M7 11l5 5l5 -5" /><path d="M12 4l0 12" /></>);
export const IconArchive = icon(<><path d="M3 4m0 2a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v1a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2z" /><path d="M5 9v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-9" /><path d="M10 13h4" /></>);

/* ── error rendering ── */

/**
 * 404 companion: the resource may be invisible because the caller's accesses
 * changed (revoked membership, switched center). Re-fetch /auth/me/ and, if
 * the active center is no longer among the memberships, leave for /espaces.
 */
function RefreshAccessButton() {
  const { refreshMe } = useAuth();
  const { centerId } = useCenter();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const onClick = async () => {
    setBusy(true);
    try {
      const fresh = await refreshMe();
      if (!fresh.staff_memberships.some((m) => m.center.id === centerId)) {
        router.replace('/espaces');
        return;
      }
    } catch {
      /* session-level failures are handled by the auth guard */
    }
    setBusy(false);
  };

  return (
    <button
      type="button"
      className="ax-btn ax-btn--secondary ax-btn--sm"
      onClick={() => void onClick()}
      disabled={busy}
    >
      <IconRefresh />
      <span className="ax-btn__label">{busy ? 'Vérification…' : 'Actualiser mes accès'}</span>
    </button>
  );
}

/** Card-level error: global messages of an ApiError in a danger alert. */
export function ErrorAlert({ error, onRetry }: { error: ApiError; onRetry?: () => void }) {
  const messages =
    error.messages.length > 0
      ? error.messages
      : ['Une erreur est survenue. Réessayez dans un instant.'];
  return (
    <div className="ax-alert ax-alert--danger" role="alert">
      {/* La classe va sur le SVG lui-même (patron du socle patient) : c'est
          `.ax-alert__icon` qui porte les 20 px, pas un span d'enrobage. */}
      <IconAlertTriangle className="ax-alert__icon" />
      <div className="ax-alert__content">
        {messages.map((m) => (
          <p key={m} className="ax-alert__message">
            {m}
          </p>
        ))}
        {error.status === 403 && (
          <p className="ax-alert__message">Votre rôle dans ce centre ne permet pas cette action.</p>
        )}
        {error.status === 404 && (
          <div className="ax-alert__actions" style={{ marginTop: 'var(--ax-space-2)' }}>
            <RefreshAccessButton />
          </div>
        )}
      </div>
      {onRetry && (
        <div className="ax-alert__actions">
          <button type="button" className="ax-btn ax-btn--secondary ax-btn--sm" onClick={onRetry}>
            <IconRefresh />
            <span className="ax-btn__label">Réessayer</span>
          </button>
        </div>
      )}
    </div>
  );
}

/** Field-level serializer error, rendered under its input. */
/**
 * Le refus d'un champ, rendu par le backend.
 *
 * `role="alert"` (correctif de la revue a11y S5) : le composant apparaît APRÈS
 * une soumission refusée, et sans région live il n'existait tout simplement
 * pas pour un lecteur d'écran — la personne restait sur le bouton d'envoi avec
 * un formulaire qui n'avait « rien fait ». Il est monté par TOUS les
 * formulaires des quatre espaces : la réparation vaut pour tous.
 *
 * Reste ouvert, repo-wide : `aria-invalid` sur les `input`/`select`/`textarea`
 * concernés (aujourd'hui seule la classe `is-invalid` marque le champ) et le
 * déplacement du focus vers le premier champ refusé.
 */
/*
 * SV — le patron générique `aria-invalid` + focus sur la PREMIÈRE erreur,
 * posé dans le socle et non écran par écran (dette a11y S5).
 *
 * Chaque FieldError monté marque son champ (le contrôle voisin dans le même
 * `.ax-field`) `aria-invalid="true"`, et se déclare candidat au focus. Un
 * ordonnanceur de module attend la micro-fenêtre du rendu puis focalise le
 * candidat le plus HAUT dans le document — une seule fois par soumission
 * refusée (l'instance d'ApiError change à chaque refus, les re-rendus avec la
 * même instance ne re-volent jamais le focus).
 */
let focusCandidates: HTMLElement[] = [];
let focusTimer: number | null = null;

function claimErrorFocus(control: HTMLElement) {
  focusCandidates.push(control);
  if (focusTimer !== null) return;
  focusTimer = window.setTimeout(() => {
    focusTimer = null;
    const list = focusCandidates.filter((el) => el.isConnected);
    focusCandidates = [];
    if (list.length === 0) return;
    list.sort((a, b) =>
      a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1,
    );
    list[0].focus({ preventScroll: false });
  }, 0);
}

export function FieldError({ error, field }: { error: ApiError | null; field: string }) {
  const messages = error?.fieldErrors[field];
  const active = !!messages && messages.length > 0;
  const selfRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!active) return;
    const control = selfRef.current
      ?.closest('.ax-field')
      ?.querySelector<HTMLElement>('input, select, textarea');
    if (!control) return;
    control.setAttribute('aria-invalid', 'true');
    claimErrorFocus(control);
    return () => control.removeAttribute('aria-invalid');
    // `error` (l'instance) et non `active` : un NOUVEAU refus refocalise,
    // un simple re-rendu ne le fait pas.
  }, [error, active]);

  if (!active) return null;
  return (
    <span ref={selfRef} className="ax-field__message ax-field__message--error" role="alert">
      {messages.join(' ')}
    </span>
  );
}

/* ── loading / empty states ── */

/*
 * SV — les squelettes S'ANNONCENT (dette a11y S5) : ils restaient
 * `aria-hidden`, donc filtrer ou paginer ne disait rien à un lecteur d'écran.
 * Le conteneur est une région `status` polie avec un libellé masqué ; les
 * lignes miroitantes, purement décoratives, restent hors de l'arbre.
 */
export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div role="status" aria-live="polite" aria-busy="true">
      <span className="visually-hidden">Chargement en cours…</span>
      <div aria-hidden="true" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-3)', padding: 'var(--ax-space-4)' }}>
        {Array.from({ length: rows }, (_, r) => (
          <div key={r} style={{ display: 'grid', gridTemplateColumns: `repeat(${cols},1fr)`, gap: 'var(--ax-space-4)' }}>
            {Array.from({ length: cols }, (_, c) => (
              <span key={c} className="ax-skeleton ax-skeleton--line ax-skeleton--shimmer" style={{ height: 14 }} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function CardSkeleton({ lines = 4 }: { lines?: number }) {
  return (
    <div role="status" aria-live="polite" aria-busy="true">
      <span className="visually-hidden">Chargement en cours…</span>
      <div aria-hidden="true" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-3)', padding: 'var(--ax-space-4)' }}>
        {Array.from({ length: lines }, (_, i) => (
          <span
            key={i}
            className="ax-skeleton ax-skeleton--line ax-skeleton--shimmer"
            style={{ height: 14, width: `${100 - i * 12}%` }}
          />
        ))}
      </div>
    </div>
  );
}

export function EmptyState({
  title,
  message,
  action,
}: {
  title: string;
  message: string;
  action?: ReactNode;
}) {
  return (
    <div style={{ textAlign: 'center', padding: 'var(--ax-space-8) var(--ax-space-4)' }}>
      {/* SV — un `p` stylé et non un `h3` : l'état vide se pose n'importe où
          (parfois directement sous le `h1` de la page) et un titre d'état
          vide n'est pas un jalon de navigation. */}
      <p style={{ color: 'var(--ax-text-strong)', fontFamily: 'var(--ax-font-display)', fontSize: 'var(--ax-text-lg)', fontWeight: 'var(--ax-weight-semibold)', margin: `0 0 var(--ax-space-2)` }}>
        {title}
      </p>
      <p style={{ color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-sm)', marginBottom: action ? 'var(--ax-space-4)' : 0 }}>
        {message}
      </p>
      {action}
    </div>
  );
}

/* ── server-side pagination (DRF ?page=) ── */

function pageList(current: number, total: number): Array<number | '…'> {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: Array<number | '…'> = [1];
  if (current > 3) pages.push('…');
  for (let p = Math.max(2, current - 1); p <= Math.min(total - 1, current + 1); p += 1) pages.push(p);
  if (current < total - 2) pages.push('…');
  pages.push(total);
  return pages;
}

export function Pagination({
  count,
  page,
  onPage,
}: {
  count: number;
  page: number;
  onPage: (page: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));
  if (totalPages <= 1) return null;
  const start = (page - 1) * PAGE_SIZE + 1;
  const end = Math.min(count, page * PAGE_SIZE);
  return (
    <div
      className="ax-card__footer"
      style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--ax-space-3)', borderTop: '1px solid var(--ax-border)' }}
    >
      <span className="ax-pagination__summary ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-xs)' }}>
        {start}–{end} sur {count}
      </span>
      <nav className="ax-pagination" aria-label="Pagination">
        <button
          type="button"
          className="ax-pagination__prev"
          disabled={page === 1}
          onClick={() => onPage(page - 1)}
          aria-label="Page précédente"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 6l-6 6l6 6" /></svg>
        </button>
        <ul className="ax-pagination__pages">
          {pageList(page, totalPages).map((p, i) => (
            <li key={`${p}-${i}`}>
              {p === '…' ? (
                <span className="ax-pagination__ellipsis">…</span>
              ) : (
                <button
                  type="button"
                  className={`ax-pagination__page${page === p ? ' is-active' : ''}`}
                  aria-current={page === p ? 'page' : undefined}
                  onClick={() => onPage(p)}
                >
                  {p}
                </button>
              )}
            </li>
          ))}
        </ul>
        <button
          type="button"
          className="ax-pagination__next"
          disabled={page === totalPages}
          onClick={() => onPage(page + 1)}
          aria-label="Page suivante"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l6 6l-6 6" /></svg>
        </button>
      </nav>
    </div>
  );
}

/* ── modal (Contacts pattern: backdrop + centered card) ── */

export function Modal({
  title,
  onClose,
  children,
  footer,
  width = 520,
  labelledById,
  busy = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
  labelledById?: string;
  /**
   * Une écriture est EN VOL : les trois sorties involontaires (Échap, clic
   * sur le fond, croix) sont neutralisées le temps de l'appel — seuls les
   * boutons du pied, déjà `disabled`, gouvernent.
   *
   * Sans ça, un clic à côté pendant une anonymisation RGPD ou une suspension
   * KYC démonte la modale : la requête aboutit quand même côté serveur, mais
   * ni le succès ni l'erreur ne sont rendus et la liste n'est pas rechargée —
   * l'exploitant croit son geste perdu et le rejoue. Sur un geste
   * irréversible, « je ne sais pas si ça a été fait » est le pire état.
   * Défaut `false` : comportement inchangé pour les modales de lecture.
   */
  busy?: boolean;
}) {
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, busy]);

  // Keyboard care: focus enters the dialog on open (a [data-autofocus]
  // element wins over the first focusable) and returns to the trigger on
  // close — the trap itself mirrors core/focus-trap.js.
  useFocusTrap(cardRef, true);
  useEffect(() => {
    /*
     * SV — transposition du correctif S4 grand public : `focus()` fait
     * DÉFILER son conteneur pour montrer l'élément visé. La sortie sûre étant
     * souvent en fin de DOM, toute modale plus haute que 90 vh s'ouvrait déjà
     * défilée vers le bas — on lisait la fin d'un formulaire, jamais sa
     * première phrase. `preventScroll` + remise à zéro : le focus reste où il
     * doit, le contenu se lit par le début, et les boutons du pied restent
     * visibles grâce à la barre d'actions collante ci-dessous.
     */
    cardRef.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus({ preventScroll: true });
    if (cardRef.current) cardRef.current.scrollTop = 0;
  }, []);

  return (
    <div>
      {/* SV — `--ax-z-modal` (1200) > `--ax-z-header` (200) : l'en-tête, le
          sélecteur de centre et ⌘K passent SOUS une modale ouverte. Les 50/51
          en dur laissaient tout le chrome cliquable par-dessus l'écriture en
          cours, sur les quatre espaces à shell, depuis les premiers sprints.
          Les toasts (1300) et la palette (1400) restent au-dessus — voulu. */}
      <div
        className="ax-backdrop"
        onClick={busy ? undefined : onClose}
        style={{ position: 'fixed', inset: 0, zIndex: 'var(--ax-z-modal)', background: 'rgba(0,0,0,.4)' }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={labelledById ? undefined : title}
        aria-labelledby={labelledById}
        style={{ position: 'fixed', inset: 0, zIndex: 'var(--ax-z-modal)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--ax-space-4)', pointerEvents: 'none' }}
      >
        <div
          ref={cardRef}
          className="ax-card"
          onClick={(e) => e.stopPropagation()}
          style={{ width: `min(${width}px,100%)`, maxHeight: '90vh', overflow: 'auto', pointerEvents: 'auto' }}
        >
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <h2 className="ax-card__title" id={labelledById}>
                {title}
              </h2>
            </div>
            <button
              type="button"
              className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm"
              onClick={onClose}
              disabled={busy}
              aria-label="Fermer"
            >
              <IconClose />
            </button>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}>
            {children}
          </div>
          {footer && (
            /* SV — barre d'actions COLLANTE : la carte est le conteneur de
               défilement (maxHeight 90vh). Sans elle, le correctif de focus
               ci-dessus mettrait la sortie sûre hors de vue sur une modale
               haute — un défaut d'accessibilité en remplacerait un autre.
               Fond opaque (`--ax-surface-solid`) : le verre translucide
               laisserait lire le formulaire à travers les boutons. */
            <div
              className="ax-card__footer"
              style={{ position: 'sticky', bottom: 0, background: 'var(--ax-surface-solid)', display: 'flex', justifyContent: 'flex-end', gap: 'var(--ax-space-2)', borderTop: '1px solid var(--ax-border)' }}
            >
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── small display helpers ── */

/**
 * Detail row: label above value — used by every detail screen.
 *
 * Le libellé était en `--ax-text-subtle` : 11 px, capitales, interlettrage
 * élargi, 4,32:1 en clair et 3,55:1 en sombre — la pire combinaison de
 * lisibilité du produit, et elle nomme la valeur juste en dessous (« Échéance »,
 * « Urgence déclarée », « Reste à régler »). Sans le libellé, la valeur ne veut
 * rien dire : ce n'est pas de la décoration. Passé en `--ax-text-muted` (AA
 * dans les deux thèmes) — correctif de la revue a11y S5, qui vaut pour tous
 * les écrans de détail des quatre espaces.
 */
export function DetailItem({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div
        style={{ fontSize: 'var(--ax-text-2xs)', color: 'var(--ax-text-muted)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 2 }}
      >
        {label}
      </div>
      <div style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)' }}>{children}</div>
    </div>
  );
}

/** Initials for an avatar chip. */
export function initialsOf(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .map((w) => w[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() || '?'
  );
}

const AVATAR_COLORS = ['var(--ax-viz-cyan)', 'var(--ax-viz-violet)', 'var(--ax-viz-pink)', 'var(--ax-viz-amber)', 'var(--ax-viz-emerald)'];

export function avatarColor(seed: number | string): string {
  const n = typeof seed === 'number' ? seed : seed.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return AVATAR_COLORS[Math.abs(n) % AVATAR_COLORS.length];
}

export function AvatarChip({ name, seed, size = 'sm' }: { name: string; seed: number | string; size?: 'sm' | 'md' }) {
  const color = avatarColor(seed);
  return (
    <span
      className={`ax-avatar ax-avatar--${size === 'sm' ? 'sm' : 'md'} ax-avatar--squircle`}
      style={{ background: `color-mix(in oklab,${color} 18%,transparent)`, color, fontWeight: 600, flex: '0 0 auto' }}
    >
      {initialsOf(name)}
    </span>
  );
}
