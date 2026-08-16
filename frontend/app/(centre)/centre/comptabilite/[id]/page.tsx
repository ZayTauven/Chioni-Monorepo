'use client';
/*
 * Chioni — /centre/comptabilite/[id] : une pièce comptable figée (BILLING).
 */
import { useParams } from 'next/navigation';
import { AccountingExportDetail } from '@/screens/centre/AccountingExportDetail';

export default function Page() {
  const params = useParams<{ id: string }>();
  return <AccountingExportDetail exportId={Number.parseInt(params.id, 10)} />;
}
