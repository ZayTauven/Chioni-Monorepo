/*
 * Chioni — /plateforme : l'accueil du back-office EST le registre des centres.
 *
 * Choix assumé : pas de tableau de bord exploitant en S4 (il viendrait vide,
 * et le module Support riche est S5). L'objet gouverné par la plateforme est
 * le tenant — la liste des centres est donc la page d'accueil.
 */
import { PlatformCenters } from '@/screens/plateforme/Centers';

export default function Page() {
  return <PlatformCenters />;
}
