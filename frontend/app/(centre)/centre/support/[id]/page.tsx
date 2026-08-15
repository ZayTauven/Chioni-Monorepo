'use client';
/*
 * Chioni — /centre/support/[id] : le fil d'une demande d'aide.
 */
import { useParams } from 'next/navigation';
import { SupportTicketScreen } from '@/screens/centre/SupportTicket';

export default function Page() {
  const params = useParams<{ id: string }>();
  return <SupportTicketScreen ticketId={Number.parseInt(params.id, 10)} />;
}
