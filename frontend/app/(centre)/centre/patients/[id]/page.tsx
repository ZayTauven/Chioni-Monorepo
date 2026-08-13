'use client';
/*
 * Chioni — /centre/patients/[id] : dossier administratif d'un patient.
 */
import { useParams } from 'next/navigation';
import { PatientDetail } from '@/screens/centre/PatientDetail';

export default function Page() {
  const params = useParams<{ id: string }>();
  return <PatientDetail patientId={Number.parseInt(params.id, 10)} />;
}
