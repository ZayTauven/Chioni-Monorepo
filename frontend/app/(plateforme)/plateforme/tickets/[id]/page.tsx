'use client';
/*
 * Chioni — /plateforme/tickets/[id] : répondre à un centre.
 */
import { useParams } from 'next/navigation';
import { PlatformSupportTicketDetail } from '@/screens/plateforme/SupportTicketDetail';

export default function Page() {
  const params = useParams<{ id: string }>();
  return <PlatformSupportTicketDetail ticketId={Number.parseInt(params.id, 10)} />;
}
