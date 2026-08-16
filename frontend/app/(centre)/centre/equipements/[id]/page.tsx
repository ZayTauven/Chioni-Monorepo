'use client';
/*
 * Chioni — /centre/equipements/[id] : la fiche d'un appareil (S8, ADR 0021).
 */
import { useParams } from 'next/navigation';
import { EquipmentDetail } from '@/screens/centre/EquipmentDetail';

export default function Page() {
  const params = useParams<{ id: string }>();
  return <EquipmentDetail equipmentId={Number.parseInt(params.id, 10)} />;
}
