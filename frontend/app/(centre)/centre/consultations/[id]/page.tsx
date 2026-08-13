'use client';
/*
 * Chioni — /centre/consultations/[id] : détail (actes, ordonnances, carnet).
 */
import { useParams } from 'next/navigation';
import { ConsultationDetail } from '@/screens/centre/ConsultationDetail';

export default function Page() {
  const params = useParams<{ id: string }>();
  return <ConsultationDetail encounterId={Number.parseInt(params.id, 10)} />;
}
