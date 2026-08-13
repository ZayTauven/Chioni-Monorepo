/*
 * Chioni — /tuteur/demandes/[id] (detail + quote → pay → polling flow).
 * The screen reads the id itself via useParams (client-side data flow,
 * ADR 0011 — no server data fetching in the spaces).
 */
import { TuteurDemandeDetail } from '@/screens/tuteur/TuteurDemandeDetail';

export default function Page() {
  return <TuteurDemandeDetail />;
}
