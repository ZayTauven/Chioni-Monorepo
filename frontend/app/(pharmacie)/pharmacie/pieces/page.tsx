'use client';
/*
 * Chioni — /pharmacie/pieces : les pieces justificatives (S9, ADR 0022).
 *
 * Le chemin de sortie d'une officine en attente ou suspendue : c'est ce que
 * Chioni lit pour la valider. Stockage prive, archivage definitif.
 */
import { PharmacyDocuments } from '@/screens/pharmacie/PharmacyDocuments';

export default function Page() {
  return <PharmacyDocuments />;
}
