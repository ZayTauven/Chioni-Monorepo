'use client';
/*
 * Chioni — /centre/equipements : le parc de matériel (S8, ADR 0021).
 *
 * Lecture ouverte à tout membre actif du centre : aucune garde de rôle sur la
 * route ni sur l'entrée de sidebar. Les gestes du directeur sont gardés DANS
 * l'écran, où le backend les refuse aussi.
 */
import { Equipment } from '@/screens/centre/Equipment';

export default function Page() {
  return <Equipment />;
}
