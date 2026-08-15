'use client';
/*
 * Chioni — /plateforme/abonnements/[id] : la fiche d'un contrat.
 */
import { useParams } from 'next/navigation';
import { PlatformSubscriptionDetail } from '@/screens/plateforme/SubscriptionDetail';

export default function Page() {
  const params = useParams<{ id: string }>();
  return <PlatformSubscriptionDetail subscriptionId={Number.parseInt(params.id, 10)} />;
}
