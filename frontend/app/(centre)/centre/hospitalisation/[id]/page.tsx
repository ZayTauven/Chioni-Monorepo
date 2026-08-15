'use client';
/*
 * Chioni — /centre/hospitalisation/[id] : le détail d'un séjour (S6).
 */
import { useParams } from 'next/navigation';
import { InpatientStayDetail } from '@/screens/centre/InpatientStayDetail';

export default function Page() {
  const params = useParams<{ id: string }>();
  return <InpatientStayDetail stayId={Number.parseInt(params.id, 10)} />;
}
