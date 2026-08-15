'use client';
/*
 * Chioni — /plateforme/factures/[id] : une facture d'abonnement (papier + gestes).
 */
import { useParams } from 'next/navigation';
import { PlatformSubscriptionInvoiceDetail } from '@/screens/plateforme/SubscriptionInvoiceDetail';

export default function Page() {
  const params = useParams<{ id: string }>();
  return <PlatformSubscriptionInvoiceDetail invoiceId={Number.parseInt(params.id, 10)} />;
}
