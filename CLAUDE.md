# CLAUDE.md — home (front)

Tableau de bord domotique : SPA **Vite 8 + React 19** installable en PWA, qui pilote Home Assistant
via le back `home-back` (lumières, climat, spa, prises, caméras Arlo, alarme, Petkit, énergie
Enedis/GRDF/Suez, météo). UI Tailwind 4 en tuiles « bento » (thèmes clair et sombre), auth Clerk (Core 3), déployée sur
Vercel depuis `main`. Navigateurs : Safari / iOS 16.4+, Chrome 111+, Firefox 128+.

## Commandes

```bash
npm run dev                    # Vite sur http://localhost:5173
npm run build                  # Build de prod → dist/ (lance check:dist)
npm run preview                # Sert le build de prod
npm run typecheck              # tsc --noEmit (Vite ne vérifie pas les types)
npm run lint                   # ESLint (sans --fix)
npm run test:unit              # Tests unitaires et composants (Vitest + Testing Library + MSW)
npm run test:coverage          # Idem avec couverture (v8)
npm run check:dist             # Après build : ni .map ni code de test dans dist/
npm run check:size             # Après build : budget gzip (JS au démarrage, chunks, CSS)
npm run knip                   # Fichiers, exports et dépendances morts (config : knip.json)
npm run format                 # Prettier sur tout le dépôt
npm test                       # E2E Playwright mockés (= test:e2e:mocked)
npm run test:e2e:mocked:mobile # E2E mockés, profil iPhone 14
npx playwright test -g "Nom" --project=mocked   # Un seul test
npm run verify                 # Toute la chaîne ci-dessous, dans l'ordre de la CI
```

## Vérifier ton travail

Avant de considérer une tâche terminée : `npm run verify`, soit `typecheck`, `lint`, `knip`,
`test:coverage` (seuils bloquants), `build` (avec `check:dist`), `check:size`, puis les E2E mockés
desktop et mobile (WebKit requis pour le mobile : `npx playwright install webkit` ; le mobile a
ses propres sélecteurs : navigation en barre basse, menu en feuille, bouton de fermeture). Tout doit passer ; knip ne doit signaler aucun fichier, export ni dépendance (son indice sur les `.css`
est attendu : `global.css` n'exporte rien). Un budget dépassé (`scripts/check-size.mjs`) se relève
volontairement, dans le même changement, avec la raison. Le pre-commit husky lance `tsc` puis
lint-staged (`eslint --fix`, `prettier --write` sur les fichiers indexés).

## Architecture

- `App.tsx` et `global.css` sont **à la racine**, pas dans `src/`. Point d'entrée : `src/main.tsx`
  (enregistre aussi le service worker `src/sw.ts` à la main).
- `src/services/` : un client par domaine (`ha.ts`, `energy.ts`, `petkit.ts`, `user.ts`), tous
  écrits avec `request<T>()` (`request.ts` : jeton, délai, annulation, `ApiError`), qui passe par
  `traceApi` (`client.ts` : retry 401 avec refresh de token partagé). Chaque requête demande son
  jeton à Clerk (`setTokenProvider`, posé par `UserContext`) : un jeton de session Clerk dure 60 s
  par défaut. Celui du contexte est fixé à la connexion (garde des requêtes et repli) : aucun
  minuteur ne le renouvelle, et un refresh après 401 ne change pas la valeur du contexte.
  `api.ts` n'est qu'un barrel de ré-export.
- `src/hooks/` : hooks TanStack Query par domaine ; clés dans `src/lib/query-keys.ts` (hiérarchiques,
  préfixe = domaine). Les calculs des widgets vivent dans des hooks (`useGasWidgetData`,
  `useFountainDay`…) ou des modules purs (`energy-series.ts`, `petkit/feeder-records.ts`,
  `lib/floors.ts`). `useDashboardWidgets.tsx` construit la map `id → widget` et applique les droits.
- `src/context/` : `UserContext` (Clerk, profil, droits), `WidgetPreferencesContext` (ordre,
  visibilité, seuils : lus dans le profil `/api/user/me`, enregistrés côté back avec rollback),
  `ThemeContext`, `QueryProvider`.
- `src/constants/entities.ts` : les `entity_id` Home Assistant dont dépend le tableau de bord ; un
  renommage dans HA se reporte là.
- `src/screens/DashboardScreen.tsx` : écran principal. Pas de routeur : la section affichée est le
  hash de l'URL (`#maison`, lu par `useSection`), les liens de navigation sont de simples `<a href>`.
  Un lien `#maison/lights` (`widgetHref`, plusieurs ids joints par `+`) ouvre la section, n'y déplie
  que ces widgets (`unfoldOnly`, enregistré comme un repli manuel), fait défiler jusqu'au premier
  puis ramène le hash à `#maison`.
  `src/constants/sections.ts` range chaque widget dans une section (Maison, Énergie, Sécurité,
  Animaux, Appareils) ; l'accueil (`HomeOverview`, sans hash) montre des tuiles de résumé
  (`HomeSummaryTiles` : jour et météo, sécurité, lumières, animaux, appareils ; `EnergySummaryTile`, `TemperatureSummaryTile`, `PlugsSummaryTile`), et rien d'autre : chaque bloc
  ou partie de bloc n'apparaît que pour un widget visible, à partir des états déjà chargés
  (`lib/home-summary.ts`, hooks des widgets). Une section sans widget visible
  (droits, widgets masqués) disparaît de la navigation.
- Onglet **Historique** (`#historique`, droit `history`, `screens/history/`) : semaine, mois, année ou
  12 mois glissants (`rolling` : les 12 derniers mois complets, avancent d'un mois), comparaison avec
  la même période un an plus tôt (`lib/history/period.ts`), quantités ou euros
  (`lib/history/tariffs.ts` : Base réglementé, prix repère CRE du gaz, prix Suez de l'eau ; part
  consommation, abonnements exclus ; une nouvelle grille s'y ajoute à sa date d'effet). Vues Énergie
  (Enedis sur 3 ans, GRDF, Suez ; gaz par degré-jour et nuage gaz/température, carte horaire et talon
  de nuit depuis la courbe de charge, calendrier de l'année), Appareils, Climat, Animaux, Sécurité et
  Croiser. Les mesures longues viennent des statistiques HA (`GET /api/ha/statistics`), les usages
  (heures, cycles, détections, repas, alertes) des compteurs quotidiens du back
  (`GET /api/history/usage`, enregistrés chaque nuit depuis la mise en service : pas de passé). Une
  vue ne montre que les domaines dont le widget est visible, avec les mêmes capteurs et pièces
  masqués. Un jour à 0 d'Enedis, GRDF ou Suez n'est pas encore relevé : il est inconnu (ni dans les
  totaux, ni dans les moyennes « par jour ») ; l'écart à N-1 se calcule jour par jour sur les seuls
  jours connus des deux côtés (`comparableDayTotals`), quelle que soit la vue. L'écran est statique (en chunk à la demande, il cassait `check:dist`) ; ses graphiques
  recharts passent par `LazyHistoryCharts`. Clés `history` non persistées.
- `src/components/ui/` : primitives réutilisables ; `src/components/widgets/` : widgets par domaine.
- `e2e/` : Playwright, `approach-1-mocked/` (seule suite ; projets desktop et mobile).
- Design system : `STYLE-GUIDE.md`. Guide des tests (unitaires et E2E) : `TESTING.md`.

## Pièges non évidents

- Performance : un widget mémoïsé ne doit recevoir que ses entités, avec une référence stable
  (`useStableValue`, ou une entité trouvée dans le cache, déjà stable) ; un callback passé à un
  widget doit être stable (`useCallback` sur des dépendances stables, jamais sur l'objet renvoyé
  par `useMutation`). Les graphiques passent par `components/ui/LazyCharts.tsx` (recharts chargé
  au premier affichage) ; les animations (paquet `motion`, import `motion/react`) utilisent `m`
  (pas `motion`) sous `LazyMotion strict`.
  Une donnée affichée seulement dans le corps d'un widget ne se charge que widget déplié.
- `refetchOnWindowFocus` vaut **false** : le rafraîchissement au retour au premier plan est orchestré
  par `DashboardScreen` via `visibilitychange`, **en arrière-plan** : plus de voile bloquant, quel
  que soit l'âge des données (l'en-tête montre « MAJ hh:mm » et une icône qui tourne).
- Premier affichage : seul Home Assistant le retient ; Petkit (souvent lent) arrive après, le bloc
  Animaux montre un squelette en attendant (`home-summary-pets-loading`).
- Le cache React Query est **persisté dans localStorage** (`src/lib/query-client.ts`), par
  utilisateur et seulement pour les domaines de `PERSISTABLE_ROOT_KEYS`. Si tu changes la forme d'une
  donnée en cache, incrémente `CACHE_BUSTER`, sinon les clients relisent l'ancien format. Le cache
  relu a au plus **7 jours** (`MAX_AGE_MS`, `gcTime` au moins égal). Les états
  HA y sont écrits sans leurs groupes (`serializeCache`) ; le tableau de bord attend la relecture
  (`useIsRestoring`) avant de se peindre.
- Données utilisateur sur l'appareil : tout est purgé au logout et au changement de compte
  (`src/lib/user-data.ts`). Une nouvelle clé localStorage contenant des données utilisateur doit
  commencer par `hsh` ; jamais de jeton en localStorage.
- Mises à jour de la PWA (`lib/app-update.ts`, branché dans `main.tsx`) : l'appli cherche une
  nouvelle version toutes les 30 min quand elle est à l'écran et à chaque retour au premier plan ;
  le nouveau service worker prend la main tout de suite, la page se recharge aussitôt si elle est
  cachée, sinon au prochain retour ou après 30 s sans interaction (jamais en plein usage).
- Alertes (admins seulement, comme côté back) : la cloche de l'en-tête (`AppHeader`, badge des non
  lues) ouvre `screens/AlertsScreen.tsx` : les alertes des 30 derniers jours (`GET /api/notifications` ;
  cloche et push sont le seul canal, Telegram a été retiré), lues à l'ouverture, chacune ouvrant son widget
  (`lib/alert-notifications.ts`, partagé avec le service worker) ; et l'interrupteur des
  notifications push de l'appareil (`usePushSubscription`, clé VAPID du back). Le service worker
  affiche le push et prévient la page (`hsh-push-received`), qui recharge la liste ; la liste se
  relit aussi toutes les 60 s. Sans `VAPID_*` côté back, la cloche marche, le push non.
- Service worker (`src/sw.ts`) : seules les lectures lentes du back (historique, énergie) passent par
  le cache API, décidé par `src/lib/sw-cache-policy.ts`. N'y ajoute ni profil, ni préférences, ni
  états temps réel, ni images.
- Permissions : `canAccessHistory` / `canAccessCameras` sont calculés dans `UserContext` par
  `hasPermission` (`src/utils/permissions.ts`), qui reproduit la règle du back (drapeau du groupe ou
  groupe admin). Un widget refusé renvoie `null` dans `useDashboardWidgets`.
- Tests unitaires (Vitest + Testing Library + MSW, `src/**/*.test.ts(x)`) : le réseau passe par
  MSW (`src/test/msw-server.ts`, toute requête non gérée échoue) et `VITE_API_URL` vaut un hôte
  `.invalid`. Seuils de couverture bloquants dans `vitest.config.mts` (80 % par fichier, 95 % sur les
  modules sensibles). Un bug connu non corrigé se documente par un `it.fails` nommé `Bxx: …`.
- Les services lèvent une `ApiError` sur toute réponse non OK (jamais un `{ success: false }`
  silencieux) : c'est ce qui déclenche le retry 401 de `traceApi` et le rollback des mutations. Une
  écriture qui échoue est annulée à l'écran et expliquée par un toast (`lib/action-feedback.ts`).
- Home Assistant en lecture : métadonnées par `GET /api/ha/metadata`, prévisions météo par
  `GET /api/ha/forecast`. `POST /api/ha/template` est réservé aux admins côté back : le front ne
  l'appelle plus. `POST /api/ha/call` ne sert qu'aux actions.
- Images servies par le back (`/api/ha/media`, `/api/ha/image`, caméras) : elles exigent l'en-tête
  `Authorization`, le back refuse `?token=`. Utilise `SecureImage` (fetch + URL blob, relance après un
  401, `keepPrevious` pour garder l'image pendant le rechargement), jamais un `<img src>` direct ni
  le jeton dans l'URL. La CSP n'autorise plus `data:` en `img-src`.
- Le projet vient d'une app Expo / React Native : il n'en reste **aucune** dépendance, n'en
  réintroduis pas (ni `lucide-react-native`, ni props `onPress`/`onLayout` sur les primitives).
- Tailwind 4 : pas de `tailwind.config.js`, le thème est dans `global.css` (`@theme`, couleurs
  `--color-*` sur les variables HSL, variante `dark` par `@custom-variant`). Les hauteurs de ligne
  des tailles de texte y sont ramenées aux valeurs de v3, et le curseur « main » des boutons y est
  rétabli : ne les retire pas sans comparer les captures. Classes triées par
  `prettier-plugin-tailwindcss` ; classes inconnues ou en conflit refusées par ESLint
  (`better-tailwindcss`).
- ESLint 10, configuration flat (`eslint.config.mjs`), `--max-warnings 0`. Les règles React Hooks /
  React Compiler viennent de `eslint-plugin-react-hooks` ; leurs copies `@eslint-react` sont
  éteintes. Écriture React 19 imposée : `ref` en prop (pas de `forwardRef`), `<Context>` comme
  fournisseur, `use(Context)`, refs nommées `…Ref`.
- `eslint-plugin-sonarjs` (règles de SonarQube, sans service externe) : complexité cognitive au plus
  15 par fonction ; les fichiers qui dépassaient à son adoption ont leur plafond dans
  `COGNITIVE_COMPLEXITY_BASELINE` (`eslint.config.mjs`), à baisser quand on les refactore, jamais à
  relever. Ternaires imbriqués admis. Un faux positif se coupe sur sa ligne avec la raison
  (`// eslint-disable-next-line sonarjs/… -- raison`).
- Vite 8 (Rolldown) : le découpage se règle par `build.rolldownOptions.output.codeSplitting`.
  Toucher à ce découpage peut laisser du code de test dans le build : `check:dist` le détecte, ne
  le contourne pas.
- Clerk Core 3 (`@clerk/react`) : la connexion Google passe par `useSignIn` de
  `@clerk/react/legacy` (la nouvelle API `signIn.sso` change la redirection, non vérifiable en E2E) ; `getToken` lève `ClerkOfflineError` hors
  ligne, à distinguer d'une session expirée. Les E2E simulent Clerk : tout changement d'auth se
  recette sur une preview Vercel.
- Deux instances Clerk (depuis le 22 novembre 2026). **Production** : application « secondaire »
  de `psaltery.org`, Frontend API sur `clerk.home.psaltery.org` (enregistrements DNS Cloudflare en
  _DNS only_), accès **Invite-only** (comptes créés à la main dans Clerk), connexion Google avec les
  identifiants OAuth du propriétaire (Google Cloud Console), clé `pk_live_…` dans la variable Vercel
  `VITE_CLERK_PUBLISHABLE_KEY` (environnement Production) ; c'est le seul domaine Clerk de la CSP.
  **Développement** (`eager-penguin-61.clerk.accounts.dev`, `pk_test_…`) : `.env.local` seulement.
  Changer d'instance = clé ici + clés du back + domaine dans `vercel.json`, et chaque utilisateur
  se reconnecte (le back rattache ses données par e-mail).
- Variables d'env dans `.env.local` : `VITE_CLERK_PUBLISHABLE_KEY`, `VITE_API_URL` (défaut : prod).
  `VITE_TEST_MODE=true` active l'auth simulée utilisée par Playwright. C'est une constante de build
  (`__APP_TEST_MODE__`, `vite.config.mts`) : rien ne l'active à l'exécution et le build de prod n'en
  contient rien (`npm run check:dist`). Un `npm run dev` sans cette variable ne sert pas aux E2E.
- En-têtes de sécurité (CSP, HSTS, Permissions-Policy) : `vercel.json`, vérifiés par
  `src/test/vercel-headers.test.ts`. Une nouvelle origine (API, Clerk) doit y être ajoutée.
- CI GitHub (Node de `.nvmrc`, sauf dans l'image Playwright). Le dépôt est **public** : les runners
  GitHub standard ne consomment aucune minute du quota du compte (les restrictions de novembre 2026,
  quand le dépôt était privé, ont été levées le 22 novembre 2026). Chaque workflow tourne sur les PR
  vers `main` et sur `main` après la fusion (une fusion squash sur une base ancienne produit un arbre
  qu'aucune PR n'a vérifié), pas pour un changement limité aux `.md` ; un nouveau push annule le run
  en cours ; `workflow_dispatch` permet un run à la main. `ci.yml` (job `checks` : la chaîne
  ci-dessus sans les E2E) ; `e2e.yml` (E2E desktop et mobile dans l'image Docker de Playwright, à
  garder à la version de `@playwright/test`, comme dans `update-snapshots.yml` : changer de version
  impose de régénérer les captures Linux). Les E2E tournent sur un build de test
  (`vite build --outDir dist-e2e` + `vite preview`, service worker bloqué), 4 workers : 2,7 au lieu
  de 5 min en local, 6,6 au lieu de 7,9 min sur le runner GitHub, plus lent ; `security-audit.yml`
  (`npm audit --package-lock-only --omit=dev --audit-level=high`, sans `npm ci` : seules les
  dépendances de prod bloquent, le rapport complet reste en artefact ; plus Dependency Review ; sur
  les PR qui touchent `package.json` / `package-lock.json`, et chaque semaine) ;
  `update-snapshots.yml` (manuel : régénère les captures Linux des tests visuels). CodeQL (analyse
  de sécurité du TypeScript et des workflows, suite « Extended ») tourne en **configuration par
  défaut** de GitHub (Settings → Code security), sans fichier : n'ajoute pas de `codeql.yml`, les
  deux configurations ne coexistent pas. Résultats dans Security → Code scanning.

## Refonte UI de novembre 2026 : état et reprise

L'interface a été entièrement refaite (PR #6 à #18, toutes fusionnées dans `main`, que Vercel déploie).
Direction retenue : « Bento », thèmes clair et sombre (maquettes : canevas Claude « Refonte Home —
maquettes », non versionné). Le back, les services, hooks, permissions et le cache n'ont pas bougé.

**Ce qui existe**

- Navigation par sections (`constants/sections.ts`, hash d'URL) ; accueil sans hash.
- Sections : `WidgetGrid` en masonry (grille CSS, `useMasonryRows`, placement dense) ; les widgets
  `wide` de `WIDGET_CONFIG` (Lumières, Température, Caméras) prennent deux colonnes sur ordinateur,
  une sur téléphone. Dans ces widgets larges, les étages (Lumières, Température) et les caméras se
  rangent deux par ligne dès que le widget fait 768 px (requête de conteneur `@3xl`).
- Les widgets ne se replient que sur téléphone (< 768 px, `canFold` de `WidgetPreferencesContext`) :
  sur ordinateur, ils sont toujours dépliés, sans chevron, et les replis enregistrés (préférences,
  `unfoldOnly`) restent ceux du téléphone, sans y toucher.
- Un clic sur une tuile ouvre la section de son widget avec **seulement ce widget déplié** (sur
  téléphone ; sur ordinateur, il fait seulement défiler jusqu'au widget) ; dans
  les tuiles de résumé, chaque bloc (appareil, compteur, animal, caméra, alarme) ouvre son widget
  et la flèche ouvre ceux de la tuile.
- Accueil (`screens/HomeOverview.tsx`, en masonry sur deux colonnes dès 1280 px : `useMasonryRows`) : tuiles de résumé (`screens/HomeSummaryTiles.tsx` :
  `TodayTile` (en `cobalt` comme Températures), `LightsSummaryTile`, `PetsSummaryTile`, `DevicesSummaryTile`, `SecuritySummaryTile` ; `screens/EnergySummaryTile.tsx`, `screens/TemperatureSummaryTile.tsx`, `screens/PlugsSummaryTile.tsx`), seuls depuis le 15 novembre 2026 : les petites tuiles par widget
  ont été retirées à la demande de l'utilisateur. Les calculs sont dans `lib/home-summary.ts`.
- Design : tokens et tons dans `global.css` ; `Tone`, `TONE_CLASSES` et `WIDGET_CONFIG` dans
  `constants/widgets.ts` ; détails dans `STYLE-GUIDE.md`. Tons actuels : lumières `sun`, animaux
  `tangerine`, sécurité `coral`, énergie `lime`, météo/spa `aqua`, climat `cobalt` ; `lilac` n'a plus
  de domaine (contrôles seulement).
  Les tuiles de l'accueil gardent ces tons pleins : des variantes pastel ont été essayées (PR #27,
  #28) puis retirées à la demande de l'utilisateur. Depuis le 19 novembre 2026, palette « néon »
  choisie par l'utilisateur parmi cinq (valeurs dans `global.css` et `STYLE-GUIDE.md`).

**Règles décidées avec l'utilisateur (à respecter)**

- Une tuile ne montre **que des données que son widget affiche aussi**, avec les mêmes exclusions
  (capteurs et pièces masqués). Le code de sélection est partagé, pas dupliqué :
  `lib/temperature-sensors.ts` (`listTemperatureSensors`) sert le widget Température et l'accueil,
  `lib/printer.ts` (statut et temps restant) le widget Imprimante et l'accueil, `lib/arlo.ts`
  (caméras et URL de leur dernière image) le widget Caméras et l'accueil, `lib/comfort.ts` (niveau de
  confort d'une température ou d'une humidité selon les seuils) le widget Température et l'accueil.
  Un nouveau chiffre d'accueil se calcule dans `lib/home-summary.ts` ou par un hook de widget.
- Les pièces masquées sont exclues partout : compteur de lumières, interrupteurs de pièce,
  « Tout allumer / éteindre » (ils n'agissent que sur les pièces visibles).
- Tuile « Aujourd'hui » : la température « Dehors » est celle du capteur extérieur de la maison
  (capteur visible dont l'étage ou la pièce s'appelle « Extérieur »), la météo seulement à défaut ;
  le salon est le capteur de la pièce « Salon », à défaut le premier capteur intérieur visible. Les prévisions se chargent dès l'ouverture de l'accueil.
- « Donner une ration » sert la ration en un seul appui, comme « Nourrir » dans le widget (PR #17,
  qui a retiré la confirmation en deux appuis) ; la ration apparaît aussitôt (`useOptimisticFeed`).
- Tuile « Sécurité » : bouton Activer / Désactiver de l'alarme en un appui (activer = mode absence,
  `alarm_arm_away`) ; une vignette par caméra, qui montre la dernière image connue sans déclencher
  de capture (seul le widget Caméras en déclenche). Sans le droit caméras, seule l'alarme apparaît.
- Tuile « Énergie » : électricité, gaz et eau, chacun avec son dernier jour connu (hausse ou baisse
  par rapport à la veille, ±2 % = stable) et ses 7 derniers jours contre la semaine d'avant. Les
  chiffres viennent des hooks des widgets (vue semaine et sous-titre) via `lib/energy-summary.ts` ;
  la comparaison des semaines ne retient que les jours connus des deux côtés (un jour à 0 = pas encore
  relevé ou estimation écartée). Un compteur masqué quitte la tuile ; sans le droit historique, pas de tuile.
- Tuile « Températures » : une carte par capteur du widget Température (mêmes capteurs et pièces
  masqués, même ordre), groupées par étage, avec température, humidité et une pastille de confort
  par valeur (seuils de l'utilisateur : vert, orange, rouge). Des étages consécutifs à un seul capteur
  (Cave, Extérieur) partagent une rangée sous un titre commun (« Cave · Extérieur »). Dès 1280 px (et
  avec le droit historique), chaque carte trace ses 24 dernières heures sous ses valeurs, un point par heure
  (`lib/hourly-readings.ts` : la valeur en vigueur à chaque heure, puis la valeur actuelle) : une courbe libellée par mesure
  (température, humidité) avec min et max du jour, point sur la valeur actuelle, repères « il y a
  24 h » / « maintenant » (`ui/Sparkline`, même requête
  `useHABatchHistory` que les tendances du widget) ; rien n'est chargé sur téléphone.
- Tuile « Prises » : une ligne par prise du widget (PC, TV ; données de `home-summary.ts`), état et
  puissance, bouton Allumer / Éteindre en un appui (état optimiste, comme le widget).
- Un appareil dont le widget est visible mais qui ne remonte rien (spa, lave-linge, imprimante) a
  une ligne « Indisponible » dans la tuile Appareils.
- Les couleurs ne s'écrivent plus en dur : tokens et tons uniquement (exceptions : frise de
  l'alarme, `TimelineChart`).

**Flux de travail utilisé** (à reprendre)

1. Partir de `origin/main` : `git fetch origin main && git checkout -B claude/<branche> origin/main`.
2. `npm run verify` (Node 24) avant de pousser ; voir `TESTING.md` pour l'environnement local.
3. Pousser sans `--force` : la branche distante garde l'historique des PR déjà fusionnées, d'où un
   commit `git merge -s ours origin/<branche>` avant le push (le diff reste celui du changement).
4. PR vers `main`, CI verte (`ci.yml`, `e2e.yml`, CodeQL), puis fusion **squash**. Un échec
   d'un run sur `main` après la fusion se corrige en priorité.
   Demande de l'utilisateur (15 novembre 2026) : un changement terminé et vérifié est poussé, mis en
   PR et fusionné **automatiquement** dès que la CI est verte, sans lui redemander.

**Pas encore fait / à vérifier en production**

- Tout a été vu avec les données simulées des E2E. À contrôler sur `home.psaltery.org` avec les
  vraies données : interrupteurs par pièce (pièces avec groupe et ampoules), « Donner une ration »,
  salon, prévisions, tuile Sécurité (vignettes des deux caméras, bouton de l'alarme), tuile Énergie (dates des derniers relevés Enedis, GRDF, Suez), tuile Appareils (lave-linge absent des données E2E par défaut), connexion Google (non couverte par les E2E).
- Une preview Vercel ne sert pas à recetter (CORS du back, voir `TESTING.md`) ; ajouter l'origine de
  preview à `home-back` permettrait de le faire.
- Changer la couleur d'un domaine se fait
  dans `WIDGET_CONFIG`, `SECTIONS`, la tuile de résumé concernée et `STYLE-GUIDE.md`.

## Projet multi-dépôts

- Ce dépôt est le front. Le back est `../home-back` (Next.js API + Prisma + Vitest), avec son propre
  `CLAUDE.md`.
- Back de prod : `https://home-back.psaltery.org` ; front de prod : `https://home.psaltery.org`.
  En production, le back n'autorise que l'origine du front dans sa liste CORS ; `localhost:5173`
  seulement hors production : `npm run dev` vise donc un back local (`VITE_API_URL`).
- Contrat : chaque appel envoie `Authorization: Bearer <JWT Clerk>`. Les erreurs du back ont la forme
  `{ error, details, code }` ; le front réagit aux codes `USER_NOT_FOUND` et `IP_RESTRICTED`.
- **Toute nouvelle route du back implique son client dans `src/services/<domaine>.ts`** (ré-exporté
  par `api.ts`) **et son mock dans `e2e/fixtures/api-mocks.ts`** ; inversement, tout appel ajouté ici
  doit exister côté back. Une modification de format de réponse se fait dans les deux dépôts.
- Actions Home Assistant : le back n'accepte des comptes non admin (la famille) que les services
  listés dans `DASHBOARD_ACTIONS` (`../home-back/lib/permissions.ts`), ceux qu'appelle
  `performAction` aujourd'hui. Un nouveau domaine ou service appelé ici s'y ajoute dans le même
  changement, sinon la famille reçoit un 403 (seul l'admin passe).
