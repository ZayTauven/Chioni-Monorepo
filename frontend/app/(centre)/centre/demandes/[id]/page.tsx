'use client';
/*
 * Chioni — /centre/demandes/[id] : détail d'une demande (timeline, actions, reçu).
 */
import { useParams } from 'next/navigation';
import { PaymentRequestDetail } from '@/screens/centre/PaymentRequestDetail';

export default function Page() {
  const params = useParams<{ id: string }>();
  return <PaymentRequestDetail requestId={Number.parseInt(params.id, 10)} />;
}
