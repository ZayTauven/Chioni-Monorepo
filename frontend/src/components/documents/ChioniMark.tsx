/*
 * Chioni — la marque, en un seul endroit.
 *
 * Le repo ne contient AUCUN fichier de logo Chioni (ni PNG, ni SVG, ni asset
 * de marque) : la seule identité visuelle existante est ce squircle en dégradé
 * dessiné inline dans les deux sidebars (`shell/Sidebar.tsx` et
 * `shell-platform/PlatformSidebar.tsx`). Le document imprimable a besoin d'un
 * émetteur « Chioni » — on RÉUTILISE cette marque-là plutôt que d'en fabriquer
 * une : inventer un branding dans un papier commercial serait pire qu'un
 * emplacement vide.
 *
 * `gradientId` est OBLIGATOIRE et doit être unique dans la page : deux <svg>
 * portant le même id de dégradé se volent leur peinture (c'est déjà pourquoi
 * les deux sidebars utilisent `axmk0` et `axmkplat`).
 *
 * Le jour où une vraie charte arrive, elle remplace ce fichier — et les trois
 * appelants suivent sans être touchés.
 */

export function ChioniMark({
  gradientId,
  size = 40,
}: {
  gradientId: string;
  size?: number;
}) {
  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      style={{ display: 'block', flex: '0 0 auto' }}
    >
      <defs>
        <linearGradient id={gradientId} x1={4} y1={4} x2={28} y2={28} gradientUnits="userSpaceOnUse">
          <stop stopColor="#2BC4B0" />
          <stop offset="0.55" stopColor="#1E9E96" />
          <stop offset="1" stopColor="#6D5CF0" />
        </linearGradient>
      </defs>
      <path
        d="M4 4 H16 A12 12 0 0 1 28 16 V28 A0 0 0 0 1 28 28 H16 A12 12 0 0 1 4 16 V4 Z"
        fill={`url(#${gradientId})`}
        stroke="none"
      />
      <circle cx="20.5" cy="11.5" r="2.6" fill="#0A0C11" fillOpacity="0.92" stroke="none" />
    </svg>
  );
}

export default ChioniMark;
