'use client';
/*
 * Chioni — /pharmacie : la boîte de réception de l'officine (S9, ADR 0022).
 *
 * L'accueil du 5e espace. Il dit l'etat de l'officine AVANT la liste : une
 * boite vide sans phrase se lit « ca ne marche pas ».
 */
import { PharmacyInbox } from '@/screens/pharmacie/Inbox';

export default function Page() {
  return <PharmacyInbox />;
}
