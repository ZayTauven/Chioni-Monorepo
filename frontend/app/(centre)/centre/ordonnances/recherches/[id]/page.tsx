'use client';
/*
 * Chioni — /centre/ordonnances/recherches/[id] : une recherche et ses reponses
 * (S9, ADR 0022).
 */
import { useParams } from 'next/navigation';
import { AvailabilityRequestDetail } from '@/screens/centre/AvailabilityRequestDetail';

export default function Page() {
  const params = useParams<{ id: string }>();
  return <AvailabilityRequestDetail requestId={Number.parseInt(params.id, 10)} />;
}
