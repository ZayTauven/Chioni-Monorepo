'use client';
/*
 * Chioni — /pharmacie/demandes/[id] : repondre a une demande (S9, ADR 0022).
 *
 * L'identifiant de l'URL est celui de la LIGNE DE DIFFUSION, jamais celui de
 * la demande : deux officines ne peuvent pas rapprocher leurs ecrans par lui.
 */
import { useParams } from 'next/navigation';
import { PharmacyInboxRequestDetail } from '@/screens/pharmacie/InboxRequestDetail';

export default function Page() {
  const params = useParams<{ id: string }>();
  return <PharmacyInboxRequestDetail recipientId={Number.parseInt(params.id, 10)} />;
}
