'use client';
/*
 * Chioni — /centre/abonnement/factures/[id] : la facture d'abonnement en
 * papier imprimable (directeur seul, lecture seule).
 */
import { useParams } from 'next/navigation';
import { SubscriptionInvoiceScreen } from '@/screens/centre/SubscriptionInvoice';

export default function Page() {
  const params = useParams<{ id: string }>();
  return <SubscriptionInvoiceScreen invoiceId={Number.parseInt(params.id, 10)} />;
}
