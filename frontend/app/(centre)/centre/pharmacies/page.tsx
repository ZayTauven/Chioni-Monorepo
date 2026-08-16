'use client';
/*
 * Chioni — /centre/pharmacies : l'annuaire du reseau (S9, ADR 0022).
 *
 * Lecture ouverte a TOUT staff actif : savoir quelles officines existent n'est
 * pas une information clinique. Aucune garde de role, ni sur la route ni sur
 * l'entree de sidebar.
 */
import { PharmacyDirectory } from '@/screens/centre/PharmacyDirectory';

export default function Page() {
  return <PharmacyDirectory />;
}
