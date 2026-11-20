---
paths:
  - 'src/components/**'
  - 'src/screens/**'
  - 'App.tsx'
  - 'global.css'
---

# UI et design system

Le détail (tokens, tons, typographie, tuiles, rayons, animations) est dans `STYLE-GUIDE.md` :
consulte-le avant toute modification visuelle. Règles essentielles :

- Réutilise les primitives de `src/components/ui/` avant d'en créer une. Un widget s'enveloppe dans
  `BaseWidget` (`src/components/widgets/BaseWidget.tsx`).
- Nouveau code : couleurs via les tokens sémantiques (`bg-card`, `bg-muted`, `text-foreground`…) et les tons de domaine (`bg-sun`, `bg-lime`…),
  avec les seules exceptions listées dans la section « Système de couleurs » de STYLE-GUIDE.
  Ne réécris pas les couleurs du code existant hors du périmètre de ta tâche.
- Tout rendu doit fonctionner en thème clair **et** sombre (classe `light`/`dark` sur `<html>`).
- Chargement des données d'un widget : `Skeleton` à la forme du contenu final. Un spinner (`Loader2`)
  reste acceptable pour une action en cours sur un bouton.
- Animations JS : motion (`motion/react`, composants `m`) (jamais react-native-reanimated). Les transitions et animations CSS
  Tailwind (`transition-*`, `animate-*`) restent autorisées.
- Identifiants de test : `BaseWidget`, `Card`, `Slider` et `NavigationMenu` acceptent une prop
  `testID` qu'ils rendent en `data-testid` (BaseWidget utilise `widget-<id>` par défaut). Sur un
  élément HTML brut et sur `Button` / `PowerButton`, écris directement `data-testid`.
