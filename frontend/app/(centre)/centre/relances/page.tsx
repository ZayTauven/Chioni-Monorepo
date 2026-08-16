'use client';
/*
 * Chioni — /centre/relances : les deux files de travail (S10, ADR 0023).
 *
 * Pas de garde de rôle ICI : l'onglet « À recontacter » est ouvert à tout
 * staff actif, seul « À relancer » est BILLING — et l'écran s'auto-garde
 * avant le fetch. C'est le même arbitrage que « Équipements » (S8) et
 * « Équipe du jour » (S7) : une entrée ouverte, une garde interne.
 */
import { Followups } from '@/screens/centre/Followups';

export default function Page() {
  return <Followups />;
}
