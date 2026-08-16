'use client';
/*
 * Chioni — /plateforme/pharmacies/[id] : la fiche d'une officine (S9).
 *
 * Les pieces justificatives sont montees AVANT le bloc de decision : valider
 * une officine sans avoir lu sa licence est du theatre.
 */
import { useParams } from 'next/navigation';
import { PlatformPharmacyDetail } from '@/screens/plateforme/PharmacyDetail';

export default function Page() {
  const params = useParams<{ id: string }>();
  return <PlatformPharmacyDetail pharmacyId={Number.parseInt(params.id, 10)} />;
}
