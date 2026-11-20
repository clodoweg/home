# DESIGN SYSTEM GUIDE - Home Sweet Home

Référence du design de l'application : des **tuiles « bento »** opaques, très arrondies, sur un fond
neutre ; la couleur est réservée aux **tons de domaine** (une couleur par domaine de la maison) et
aux états. Deux thèmes, clair et sombre.

Navigateurs : Safari ≥ 16.4, Chrome ≥ 111, Firefox ≥ 128.

---

## Structure de l'application

- **Accueil** (`HomeOverview`) : grille bento faite uniquement des **tuiles de
  résumé**, une par rangée jusqu'à 1280 px, puis en **masonry** sur deux colonnes (`useMasonryRows` :
  chaque tuile garde sa hauteur et la suivante se range sous la colonne la plus courte, sans trou) : « Aujourd'hui », « Lumières », « Animaux »,
  « Appareils », « Sécurité » (`HomeSummaryTiles`), « Énergie » (`EnergySummaryTile`),
  « Températures » (`TemperatureSummaryTile`) et « Prises » (`PlugsSummaryTile`), chacune dans le
  ton de son domaine. Leurs liens mènent à la section du widget, qui n'y déplie que ce widget
  sur téléphone (`widgetHref`, voir CLAUDE.md).
- **Sections** (`src/constants/sections.ts`) : Maison, Énergie, Sécurité, Animaux, Appareils. Une
  section affiche ses widgets (`BaseWidget`) en masonry (`WidgetGrid` : 1, 2 ou 3 colonnes selon la
  largeur) ; Lumières, Température et Caméras (`wide` dans `WIDGET_CONFIG`) y prennent deux
  colonnes dès qu'il y en a deux, une seule sur téléphone ; leurs étages ou caméras s'y rangent alors
  deux par ligne (`@container`, `@3xl:grid-cols-2`).
- **Historique** (`src/screens/history/`) : cartes `rounded-tile bg-card` (`HistoryCard`, pastille du
  ton du domaine), chiffres clés en panneaux `bg-muted` (`Stat`, écart à l'an passé en pastille :
  vert en baisse, rouge en hausse pour une consommation), choix en pilules (`Segmented`). Couleurs des
  séries : tokens sémantiques (`SERIES_COLORS` : électricité `warning`, gaz `info`, eau `success`,
  température `destructive`), la période de l'an passé en même couleur à 30 %.
- **Navigation** (`SectionNav`) : pilules dans l'en-tête sur ordinateur, barre flottante en bas de
  l'écran sur téléphone (icônes, libellé sur la section courante tant qu'il y a au plus six
  sections ; au-delà, icônes seules, le titre de la page nomme la section). La section est le hash de l'URL.
- **Réglages** (`OverlayMenu` + `NavigationMenu`) : dialogue centré sur ordinateur, feuille qui
  monte du bas sur téléphone.

---

## Système de couleurs

Thème déclaré en CSS (`@theme` dans `global.css`, Tailwind 4, pas de `tailwind.config.js`). Les
tokens sémantiques sont des variables HSL qui changent avec le thème (classe `dark` ou `light` sur
`<html>`) ; les tons de domaine sont fixes.

### Tokens sémantiques

| Token              | Sombre (défaut) | Clair (`.light`) | Usage                                          |
| :----------------- | :-------------- | :--------------- | :--------------------------------------------- |
| `background`       | `225 13% 6%`    | `220 12% 95%`    | Fond de l'application                          |
| `card`             | `223 12% 12%`   | `0 0% 100%`      | Tuiles, dialogues                              |
| `muted`            | `220 11% 16%`   | `220 14% 96%`    | Panneaux à l'intérieur d'une tuile (`Panel`)   |
| `secondary`        | `222 11% 19%`   | `220 11% 91%`    | Éléments posés sur un panneau, pistes, survols |
| `border`           | `220 11% 22%`   | `220 12% 87%`    | Séparateurs                                    |
| `foreground`       | `210 11% 96%`   | `210 13% 9%`     | Texte principal                                |
| `muted-foreground` | `217 11% 68%`   | `214 10% 38%`    | Texte secondaire                               |
| `primary`          | `210 11% 96%`   | `210 13% 9%`     | Neutre fort : pilule active, bouton principal  |
| `accent`           | `46 100% 62%`   | `46 100% 62%`    | État « allumé » (interrupteur, curseur)        |

`success`, `warning`, `info` et `destructive` portent les états ; leurs valeurs changent avec le
thème pour rester lisibles en texte sur une tuile.

Trois niveaux de surface s'emboîtent : `background` → `card` (tuile) → `muted` (panneau) →
`secondary` (élément dans un panneau). Pas de bordure pour séparer deux surfaces : le changement de
niveau suffit. `border-border` sert aux séparateurs (lignes de tableau, pied de section).

### Tons de domaine

Aplats identiques dans les deux thèmes ; le texte posé dessus est toujours `text-ink` (blanc sur
`cobalt`). `TONE_CLASSES` (`src/constants/widgets.ts`) donne le couple fond + texte de chaque ton.

| Ton         | Couleur   | Domaine                                           |
| :---------- | :-------- | :------------------------------------------------ |
| `sun`       | `#ffe600` | Lumières                                          |
| `tangerine` | `#ff8a00` | Animaux                                           |
| `coral`     | `#ff3d6e` | Sécurité                                          |
| `lime`      | `#a6ff00` | Énergie (électricité, gaz, eau, prises)           |
| `aqua`      | `#00e5d4` | Eau et air (spa, météo)                           |
| `lilac`     | `#c9b8ff` | Contrôles (bulles du spa, ventilation)            |
| `cobalt`    | `#5b2eff` | Climat (températures, climatisation), texte blanc |

Le ton d'un widget est déclaré dans `WIDGET_CONFIG` : `BaseWidget` en colore la pastille, l'accueil
la tuile entière. Un ton sert de **fond**, jamais de couleur de texte sur une tuile neutre (le jaune
ou le vert citron sont illisibles sur blanc) : pour du texte coloré, utilise `text-success`,
`text-warning`, `text-info`, `text-destructive`.

### Règles

- Tokens et tons plutôt que des hexadécimaux ou la palette nommée de Tailwind (`sky-400`…), qui ne
  s'adapte pas au thème.
- Graphiques recharts : `hsl(var(--info))`, `hsl(var(--success))`, `hsl(var(--warning))`,
  `hsl(var(--border))`.
- Exception : les couleurs d'état de la frise de l'alarme (`AlarmWidget`, `TimelineChart`), en
  hexadécimal.

```tsx
<div className="rounded-tile bg-card p-5">
  <p className="font-display text-lg font-semibold text-foreground">Titre</p>
  <div className="rounded-2xl bg-muted p-4">Panneau</div>
  <span className="rounded-full bg-sun px-3 py-1 text-ink">Allumé</span>
</div>
```

---

## Typographie

- `font-display` : **Bricolage Grotesque** (variable, hébergée avec l'application : la CSP n'autorise
  que `font-src 'self'`). Titres de tuile, titres d'écran, grands chiffres.
- `font-sans` : Inter, puis `system-ui`. Tout le reste. Aucun fichier chargé : Inter n'est rendue
  que si elle est installée sur l'appareil.

| Usage                     | Classes                                                      |
| :------------------------ | :----------------------------------------------------------- |
| Grand chiffre d'une tuile | `font-display text-5xl md:text-7xl font-bold tracking-tight` |
| Titre d'écran             | `font-display text-3xl md:text-4xl font-bold tracking-tight` |
| Titre de widget           | `font-display text-lg font-semibold`                         |
| Texte                     | `text-sm` / `text-base`                                      |
| Légende, métadonnée       | `text-xs text-muted-foreground`                              |

Les hauteurs de ligne des tailles de texte sont ramenées aux valeurs de Tailwind 3 dans `@theme`.

---

## Tuiles de résumé de l'accueil

Huit tuiles larges (`src/screens/HomeSummaryTiles.tsx`, `EnergySummaryTile.tsx`, `TemperatureSummaryTile.tsx`, `PlugsSummaryTile.tsx`), chacune dans son ton (« Aujourd'hui »
partage le `cobalt` des Températures : texte blanc, pastilles en `bg-white/10`, icônes météo en
`getWeatherIcon(…, true)`) :

| Tuile        | Ton         | Contenu                                                                           |
| :----------- | :---------- | :-------------------------------------------------------------------------------- |
| Aujourd'hui  | `cobalt`    | date, bonjour, météo et température extérieure (capteur), salon, vent, prévisions |
| Lumières     | `sun`       | allumées / total, un interrupteur par pièce, « Tout allumer / éteindre »          |
| Animaux      | `tangerine` | croquettes, fontaine, « Donner une ration » (un appui)                            |
| Appareils    | `aqua`      | spa (température, chauffe, marche, filtration, bulles), lave-linge, imprimante    |
| Sécurité     | `coral`     | alarme (Activer / Désactiver), une vignette par caméra (empilées dès 1280 px)     |
| Énergie      | `lime`      | électricité, gaz, eau : dernier jour vs veille, 7 jours vs semaine d'avant        |
| Températures | `cobalt`    | une carte par pièce : température, humidité, pastille de confort, par étage       |
| Prises       | `lime`      | une ligne par prise : état ou puissance, bouton Allumer / Éteindre                |

Sur un ton, les pastilles intérieures sont en `bg-ink/10`, les boutons en `bg-ink text-white`
(principal) ou `bg-white text-ink` (secondaire), et le focus utilise `ring-ink` avec
`ring-offset-<ton>`. Chaque tuile garde la hauteur de son contenu (grille en `items-start`) ; seule « Sécurité » s'étire, ses vignettes remplissent la hauteur. Des tons pastel ont été essayés puis écartés par l'utilisateur (trop fades) : garder les tons pleins. Une icône météo n'est lisible que sur fond neutre (ses couleurs sont celles du
widget) : sur un ton, dessine-la dans la couleur du texte.

---

## Formes

- `rounded-tile` (28 px) : tuiles de l'accueil, widgets, dialogues.
- `rounded-2xl` / `rounded-3xl` : panneaux et cartes à l'intérieur d'une tuile.
- `rounded-full` : boutons, pilules, pastilles d'icône, interrupteurs.
- Espacements en multiples de 4 ; 12 px entre deux tuiles sur téléphone, 16 px au-delà.
- Cibles tactiles d'au moins 44 px (`Button` : `h-11`).

---

## Bibliothèque de composants

Tous dans `src/components/ui/`. **Ne crée pas de composant redondant.**

- **Structure** : `AppHeader`, `SectionNav`, `WidgetGrid`, `OverlayMenu`, `NavigationMenu`.
- **Surfaces** : `BaseWidget` (`src/components/widgets/`, la tuile de tout widget : pastille au ton
  du domaine, titre, sous-titre, corps repliable **sur téléphone seulement** : dès 768 px, tous les
  widgets sont dépliés, sans chevron, et les replis enregistrés ne valent que pour le téléphone), `Card` (surface générique), `Panel` (panneau
  intérieur).
- **Actions** : `Button` (pilule), `PowerButton` (ON/OFF, jaune quand allumé), `Slider`.
- **Affichage** : `Skeleton`, `SecureImage`, `Toaster`.
- **Visualisation** : `BarChart`, `WidgetChart` (recharts, via `LazyCharts`), `TimelineChart` (SVG).
- **Réorganisation** : `ReorderItem` + `@dnd-kit`.

```tsx
<Button label="Enregistrer" icon={Save} onClick={handleSave} />
```

Un contrôle à deux états (mode de climatisation, commande du spa) est une pilule `bg-muted` au
repos et un aplat de ton quand il est actif (`bg-lime text-ink`, `bg-coral text-ink`…).

---

## Icônes (lucide-react)

- Taille : `size={20}` dans les listes et les pastilles, `size={24}` pour les commandes.
- Couleur : héritée (`currentColor`) ; `text-muted-foreground` au repos. Sur un aplat de ton,
  l'icône prend la couleur du texte de la tuile.

---

## Responsive

`useResponsive` (`isMobile` : largeur < 768 px) choisit la navigation (pilules ou barre basse) et la
forme des réglages (dialogue ou feuille). Le reste passe par les variantes Tailwind (`md:`).
L'accueil : 2 colonnes sur téléphone, 3 dès `md`, 6 dès `xl`.

---

## Animations

- **motion** (`motion/react`, composants `m` sous `LazyMotion strict`) : ouverture des réglages,
  dépliage d'un widget.
- Transitions rapides (200 ms). Une tuile de l'accueil se contracte légèrement à l'appui
  (`active:scale-[0.98]`).
- Graphiques : `isAnimationActive={false}` sur tous les composants recharts.
