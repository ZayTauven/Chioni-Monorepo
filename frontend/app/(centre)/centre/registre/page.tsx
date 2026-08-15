'use client';
/*
 * Chioni — /centre/registre : le registre du personnel (S7, ADR 0020).
 * DIRECTEUR SEUL — l'écran s'auto-garde avant tout appel, comme « Mon
 * abonnement » : monter des fetchs pour récolter quatre 403 apprend à un
 * utilisateur à se méfier de son propre outil.
 */
import { HrRegister } from '@/screens/centre/HrRegister';

export default function Page() {
  return <HrRegister />;
}
