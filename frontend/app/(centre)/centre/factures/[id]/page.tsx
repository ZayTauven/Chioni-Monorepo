'use client';
/*
 * Chioni — /centre/factures/[id] : détail d'une facture (émission, demande de paiement).
 */
import { useParams } from 'next/navigation';
import { InvoiceDetail } from '@/screens/centre/InvoiceDetail';

export default function Page() {
  const params = useParams<{ id: string }>();
  return <InvoiceDetail invoiceId={Number.parseInt(params.id, 10)} />;
}
