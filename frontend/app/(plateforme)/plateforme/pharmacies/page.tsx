'use client';
/*
 * Chioni — /plateforme/pharmacies : le reseau des officines (S9, ADR 0022).
 *
 * `admin` seul ecrit ; le `support` lit. Aucun patient, aucun medicament :
 * l'invariant du rail /platform/ tient ici comme ailleurs.
 */
import { PlatformPharmacies } from '@/screens/plateforme/Pharmacies';

export default function Page() {
  return <PlatformPharmacies />;
}
