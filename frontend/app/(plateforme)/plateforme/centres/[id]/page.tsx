'use client';
/*
 * Chioni — /plateforme/centres/[id] : la fiche d'un tenant.
 */
import { useParams } from 'next/navigation';
import { PlatformCenterDetail } from '@/screens/plateforme/CenterDetail';

export default function Page() {
  const params = useParams<{ id: string }>();
  return <PlatformCenterDetail centerId={Number.parseInt(params.id, 10)} />;
}
