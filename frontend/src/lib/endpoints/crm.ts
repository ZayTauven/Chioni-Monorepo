/*
 * Chioni — les deux files de travail du centre (S10, ADR 0023).
 *
 * Un domaine à part plutôt qu'un bloc de `centers.ts` : le module a ses
 * propres audiences (BILLING sur les impayés, tout staff actif sur les
 * rendez-vous non honorés) et sa propre règle de produit — **aucune route
 * d'envoi**. Chioni n'envoie jamais de message de dette à un patient ; le
 * seul geste écrivable ici est « j'ai appelé », et c'est volontaire.
 *
 * Il n'y a donc PAS de `sendReminder()` dans ce fichier, et il n'y en aura
 * pas : le backend n'expose rien de tel (décision 3 de l'ADR — personne, dans
 * aucun écran, ne compose de SMS).
 */

import { apiFetch } from '../api';
import type {
  ContactKind,
  ContactLogEntry,
  ContactOutcome,
  ContactRecipient,
  HumanContactChannel,
  MissedAppointmentFollowup,
  Paginated,
  UnpaidFollowup,
  UnpaidFollowupOrdering,
} from '../types';

/**
 * La file « à relancer » — rôles BILLING.
 *
 * Volontairement SANS fenêtre de dates : un impayé est un état, pas un
 * événement. Une fenêtre de 30 jours ferait disparaître la facture de l'an
 * dernier que personne n'a réglée, c'est-à-dire exactement celle qu'il faut
 * voir. Le tri, lui, est borné : une valeur inconnue → 400 par champ.
 */
export function listUnpaidFollowups(
  centerId: number,
  { ordering = '-age', page = 1 }: { ordering?: UnpaidFollowupOrdering; page?: number } = {},
): Promise<Paginated<UnpaidFollowup>> {
  const query = new URLSearchParams({ page: String(page), ordering });
  return apiFetch(`/centers/${centerId}/crm/unpaid-followups/?${query.toString()}`);
}

/**
 * La file « à recontacter » — TOUT staff actif.
 *
 * Fenêtre de jours locaux inclusifs (contrat commun `apps.common.periods` :
 * 30 jours par défaut, 366 maximum).
 */
export function listMissedAppointments(
  centerId: number,
  { from, to, page = 1 }: { from?: string; to?: string; page?: number } = {},
): Promise<Paginated<MissedAppointmentFollowup>> {
  const query = new URLSearchParams({ page: String(page) });
  if (from) query.set('from', from);
  if (to) query.set('to', to);
  return apiFetch(`/centers/${centerId}/crm/missed-appointments/?${query.toString()}`);
}

/**
 * « J'ai appelé » — le geste humain, journalisé sans un mot de texte.
 *
 * `channel` n'accepte QUE les canaux humains : `sms` est refusé en 400 par le
 * backend (un SMS n'est pas un geste qu'on journalise, c'est un envoi, et le
 * seul émetteur est l'automate). Le type l'interdit ici pour que la faute se
 * voie à la compilation plutôt qu'au serveur.
 *
 * `invoice` et `appointment` s'excluent : c'est le motif qui commande, et le
 * patient est déduit de l'objet référencé — d'où l'absence de champ `patient`
 * dans ce payload (le sérialiseur backend ne l'accepte pas non plus).
 * Référence étrangère au centre → **400 explicite**, jamais 404.
 */
export interface ContactLogPayload {
  kind: ContactKind;
  channel: HumanContactChannel;
  recipient: ContactRecipient;
  outcome: ContactOutcome;
  invoice?: number;
  appointment?: number;
}

export function logContact(
  centerId: number,
  payload: ContactLogPayload,
): Promise<ContactLogEntry> {
  return apiFetch(`/centers/${centerId}/crm/contacts/`, { method: 'POST', body: payload });
}
