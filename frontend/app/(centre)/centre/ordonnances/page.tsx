'use client';
/*
 * Chioni — /centre/ordonnances : le comptoir du pharmacien (S9, ADR 0022).
 *
 * Roles cliniques + pharmacien. L'ecran s'auto-garde AVANT tout fetch : le
 * staff administratif recoit 403 cote API, il n'a rien a monter ici.
 */
import { Prescriptions } from '@/screens/centre/Prescriptions';

export default function Page() {
  return <Prescriptions />;
}
