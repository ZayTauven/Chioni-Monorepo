# Chioni — Frontend

Frontend Next.js 15 (App Router, React 19, Tailwind v4) du SaaS Chioni : gestion des centres de santé aux Comores et « Pont de Confiance » pour le financement des soins par la diaspora.

## Démarrer

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # build de production
```

## Configuration

Copier `.env.example` vers `.env.local` et ajuster si besoin :

```env
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
```

Le backend est une API Django (DRF) servie sur `http://localhost:8000`.

## Repères

- Ce projet est une copie adaptée du template **Vireo** ; la référence source (lecture seule) vit dans `../vireo template/`. Toujours y chercher un écran ou composant existant avant d'écrire du neuf.
- Design system : tokens `--ax-*` (`src/styles/tokens`) — ne pas introduire d'autre système.
- Textes UI en français ; i18n prévue (shikomori en phase 2).
- Document de cadrage : `../docs/etude-des-besoins.md`.
