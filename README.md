# Home Sweet Home — tableau de bord domotique

Application web (SPA **Vite 8 + React 19**, installable en **PWA**) pour piloter la maison via Home
Assistant : lumières, climat, spa, prises, caméras, alarme, distributeur et fontaine Petkit, suivi
électricité/gaz/eau, météo. Interface Tailwind 4 en tuiles « bento » : un accueil qui résume la maison, puis une section par
domaine. Thème clair et sombre.

Le front parle uniquement au back [`home-back`](../home-back) (Next.js), qui fait office de proxy
sécurisé vers Home Assistant et les API tierces. Authentification : Clerk.

- Production : https://home.psaltery.org (Vercel, déployée depuis `main`)
- API : https://home-back.psaltery.org

## Démarrage

Prérequis : Node.js 24 (`.nvmrc`).

```bash
npm install
npm run dev          # http://localhost:5173
```

Créer `.env.local` avec `VITE_CLERK_PUBLISHABLE_KEY` et, pour viser un back local,
`VITE_API_URL=http://localhost:3000` (sinon l'API de production est utilisée).

Navigateurs pris en charge : Safari / iOS 16.4+, Chrome 111+, Firefox 128+ (Vite 8, Tailwind 4).

## Qualité

`npm run verify` lance toute la chaîne, la même qu'en CI (`.github/workflows/ci.yml`) :
types, ESLint, code mort (knip), tests unitaires avec seuils de couverture, build (sans sourcemap
ni code de test), budget de taille, tests E2E desktop et mobile. Un pre-commit Husky lance `tsc`
puis ESLint et Prettier sur les fichiers indexés. `security-audit.yml` refuse toute vulnérabilité
haute ou critique des dépendances de production (`npm audit --omit=dev`), aussi chaque semaine ; le
rapport complet, outils de dev compris, reste en artefact.

## Documentation

- [`CLAUDE.md`](CLAUDE.md) — commandes, architecture, pièges (lu par Claude Code, utile à tous).
- [`TESTING.md`](TESTING.md) — tests unitaires et E2E, captures visuelles.
- [`STYLE-GUIDE.md`](STYLE-GUIDE.md) — design system (tokens, tons, typographie, tuiles).
- [`.claude/`](.claude) — règles par domaine et procédure d'ajout d'un widget.
