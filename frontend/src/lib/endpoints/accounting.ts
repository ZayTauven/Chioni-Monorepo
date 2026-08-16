/*
 * Chioni — l'export comptable du centre (S10, ADR 0023 décisions 6 et 7).
 *
 * Rôles BILLING : c'est la caisse du centre qui sort de l'application, même
 * casquette que `stats/finances`, `cash-journal` et `invoices/unpaid/`.
 *
 * Deux propriétés portent tout le domaine, et les écrans doivent les dire :
 *
 * 1. **une pièce est figée** — le détail relit le snapshot stocké, jamais un
 *    recalcul ; deux lectures du même export rendent le même octet, même si
 *    la caisse a bougé ;
 * 2. **rien ne se ferme derrière** — une même période peut être exportée deux
 *    fois, et la réponse de création porte alors `previous_export`. Ce n'est
 *    pas une erreur : c'est une annonce.
 */

import { apiDownload, apiFetch } from '../api';
import type {
  AccountingExport,
  AccountingExportCreated,
  AccountingExportDetail,
  Paginated,
} from '../types';
import { exportFallbackFilename } from '../labels';

/** Les pièces émises, la plus récente d'abord (en-têtes seuls). */
export function listAccountingExports(
  centerId: number,
  page = 1,
): Promise<Paginated<AccountingExport>> {
  const query = new URLSearchParams({ page: String(page) });
  return apiFetch(`/centers/${centerId}/accounting/exports/?${query.toString()}`);
}

/**
 * Émettre une pièce sur une période de jours locaux INCLUSIFS.
 *
 * Geste **audité** (`accounting.export_generated`) qui remonte au journal du
 * directeur — d'où la modale de confirmation côté écran. Throttle dédié
 * `accounting_export` côté serveur : un 429 arrive normalisé avec son
 * `Retry-After` par le client API.
 */
export function createAccountingExport(
  centerId: number,
  period: { period_start: string; period_end: string },
): Promise<AccountingExportCreated> {
  return apiFetch(`/centers/${centerId}/accounting/exports/`, {
    method: 'POST',
    body: period,
  });
}

/** Le détail : l'en-tête PLUS le snapshot, tel qu'il a été figé. */
export function getAccountingExport(
  centerId: number,
  exportId: number,
): Promise<AccountingExportDetail> {
  return apiFetch(`/centers/${centerId}/accounting/exports/${exportId}/`);
}

/**
 * Le CSV de la pièce, par `apiDownload` (blob authentifié) — **jamais** un
 * `<a href>` direct : la route exige le Bearer, et l'octet ne doit pas
 * transiter par une URL devinable, mêmes règles que les documents patients.
 *
 * Le nom du fichier vient du `Content-Disposition` neutre du serveur (exposé
 * par CORS depuis S3) ; le repli local ne sert que si l'en-tête manque.
 */
export function downloadAccountingExport(
  centerId: number,
  exportId: number,
  number: string,
): Promise<void> {
  return apiDownload(
    `/centers/${centerId}/accounting/exports/${exportId}/download/`,
    exportFallbackFilename(number),
  );
}
