---
name: new-widget
description: Ajoute un nouveau widget au tableau de bord (composant, enregistrement, préférences, permissions, sélecteurs et test E2E mocké). À utiliser quand on crée un widget ou qu'on l'expose sur le dashboard.
argument-hint: '<id-du-widget> [description]'
---

# Ajouter un widget au dashboard

Widget demandé : $ARGUMENTS. Choisis un `id` en snake_case (ex. `bambu_lab`) ; il sert de clé partout.

## 1. Composant

- Crée `src/components/widgets/<Nom>Widget.tsx` (ou dans le sous-dossier du domaine : `lights/`,
  `petkit/`, `spa/`…), enveloppé dans `<BaseWidget id="<id>" …>`. Sans prop `testID`, BaseWidget
  rend `data-testid="widget-<id>"` : ne passe `testID` que si tu as une raison de dévier.
- Données : un hook par domaine dans `src/hooks/` (`createTokenQuery` ou `useQuery`, clé ajoutée à
  `src/lib/query-keys.ts`, calculs dans le hook ou un module pur, pas dans le composant). Une route
  back nécessaire → client `request<T>()` dans `src/services/<domaine>.ts` (route vérifiée dans
  `../home-back`, mock E2E ajouté).
- Une donnée affichée seulement dans le corps du widget ne se charge que widget déplié
  (`!useWidgetPreferences().isCollapsed('<id>')` dans `enabled`) ; l'en-tête replié doit rester
  juste sans elle.
- Graphiques par `src/components/ui/LazyCharts.tsx`, animations par `m` de `motion/react`.
- `entity_id` Home Assistant fixes dans `src/constants/entities.ts`.
- Gère chargement (`Skeleton`), absence de données et erreur. Composant `memo`, en-tête de fichier et
  JSDoc sur les exports (`.claude/rules/code-comments.md`).

## 2. Enregistrement

1. `src/hooks/useDashboardWidgets.tsx` : ajoute l'entrée `<id>: (<WidgetErrorBoundary widgetName="…"><…/></WidgetErrorBoundary>)`.
   Si le widget dépend d'un droit, renvoie `null` quand `stableRights.history` / `stableRights.cameras`
   est faux (voir `electricity` ou `arlo`). S'il reçoit des entités Home Assistant, passe-lui
   **seulement les siennes**, filtrées puis stabilisées par `useStableValue` (voir `arloEntities`),
   jamais `all` : sinon il se re-rend à chaque poll. Ajoute-les au tableau de dépendances du `useMemo`.
   Un callback passé au widget doit être stable.
2. `src/context/WidgetPreferencesContext.tsx` : ajoute `<id>` dans `DEFAULT_ORDER`. Les ordres déjà
   sauvegardés côté back sont complétés automatiquement par les clés manquantes.
3. `src/constants/widgets.ts` : ajoute l'entrée `WIDGET_CONFIG` (`title`, `icon` lucide, `tone` : le
   ton de son domaine).
4. `src/constants/sections.ts` : ajoute `<id>` aux `widgets` de sa section (un test vérifie que chaque
   widget est dans une section, et une seule). Ajoute sa tuile d'accueil dans
   `src/screens/HomeOverview.tsx` (données dérivées dans `src/lib/home-summary.ts`).

## 3. Tests unitaires

Le hook de données (et toute logique pure extraite) a ses tests Vitest dans le même dossier
(`<hook>.test.ts(x)`, réseau par MSW) : les seuils de couverture de `src/hooks/**` sont bloquants.
Voir `.claude/rules/unit-tests.md`.

## 4. Tests E2E (mocked)

1. `e2e/helpers/widget-selectors.ts` : ajoute `<id>: '[data-testid="widget-<id>"]'` dans `WIDGET` et
   sa section dans `WIDGET_SECTION`.
2. Données mock :
   - widget fondé sur des entités Home Assistant : ajoute-les dans `e2e/fixtures/mock-data/ha-states.ts`
     (un tableau `<ID>_STATES`, inclus dans `ALL_HA_STATES`) ;
   - widget fondé sur une route dédiée : fichier `e2e/fixtures/mock-data/<source>-data.ts` (cas nominal
     - cas vide).
3. Si le widget appelle une route : ajoute-la dans `mockAllApis` (`e2e/fixtures/api-mocks.ts`) avec une
   option pour surcharger les données ; glob terminé par `**` si la route a des query params.
4. Optionnel : `e2e/fixtures/users.ts`, ajoute `<id>` dans `widgetOrder` pour fixer sa position (un
   widget absent est de toute façon ajouté en fin de liste).
5. Crée `e2e/approach-1-mocked/widgets/<id>.spec.ts` : `bypassClerkAuth(page, ADMIN_PROFILE)`,
   `mockAllApis(page, {...})`, `page.goto('/#<section>')`, `waitForDashboardReady(page)`, puis visibilité,
   contenu et cas vide. Inspire-toi d'un spec existant du même dossier.
6. Permissions : mets à jour `e2e/approach-1-mocked/permissions/*-view.spec.ts` pour que chaque profil
   voie ou ne voie pas le widget selon ses droits.

## 5. Vérification

```bash
npx playwright test -g "<NomDuDescribe>" --project=mocked --project=mocked-mobile
npm run verify   # typecheck, lint, knip, unitaires + couverture, build, budget, E2E desktop et mobile
```
