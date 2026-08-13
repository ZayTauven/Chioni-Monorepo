/*
 * Chioni — /patient/paiements/[id] : payment request detail.
 * Next 15: `params` is a Promise in server components.
 */
import { notFound } from 'next/navigation';
import { PatientPaiementDetail } from '@/screens/patient/PatientPaiementDetail';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const requestId = Number.parseInt(id, 10);
  if (!Number.isInteger(requestId) || requestId <= 0) notFound();
  return <PatientPaiementDetail requestId={requestId} />;
}
