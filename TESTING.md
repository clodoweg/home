# Guide des tests

Deux niveaux, tous deux bloquants dans `npm run verify` avant chaque push. En CI, les unitaires
(`.github/workflows/ci.yml`) et les E2E (`e2e.yml`) tournent sur chaque PR et sur `main` après la
fusion :

| Niveau                    | Outil                                           | Où                       | Commande                                     |
| ------------------------- | ----------------------------------------------- | ------------------------ | -------------------------------------------- |
| Unitaires et composants   | Vitest + Testing Library + MSW (jsdom)          | `src/**/*.test.ts(x)`    | `npm run test:unit`, `npm run test:coverage` |
| Bout en bout, API mockées | Playwright (Chromium desktop, WebKit iPhone 14) | `e2e/approach-1-mocked/` | `npm test`, `npm run test:e2e:mocked:mobile` |

`npm run verify` enchaîne tout dans l'ordre de la CI. Aucun test n'appelle un vrai back, Home
Assistant ou Clerk.

---

## Tests unitaires (Vitest)

### Ce qui est déjà en place

- `src/test/setup.ts` : matchers jest-dom, `ResizeObserver` factice, `localStorage` vidé et
  handlers MSW remis à zéro après chaque test.
- `src/test/msw-server.ts` : serveur MSW partagé. **Toute requête sans handler fait échouer le
  test.** Chaque test déclare ce qu'il sert avec `server.use(http.get(...))`.
- `VITE_API_URL` vaut un hôte `.invalid` en test : une requête qui échapperait à MSW ne peut
  joindre ni le back local ni la prod. Construis les URL avec `API_URL` (`src/services/client.ts`).
- `src/test/query-wrapper.tsx` : `createTestQueryClient()` (sans nouvelle tentative) et
  `createQueryWrapper(client)` pour `renderHook` / `render`.
- `src/test/hooks/ha-fixtures.ts` (`makeHAState`), `src/test/services/helpers.ts`
  (`loadFreshServices` pour l'état de module de `client.ts`), `src/test/context/widget-stub.tsx`.

### Conventions

- Un fichier de test commence par `/** <Module> tests — ce qui est vérifié */`.
- Le contexte utilisateur se simule avec `vi.mock('../context/UserContext', () => ({ useUserProfile: () => profile }))`
  et un objet `profile` `vi.hoisted` que chaque test modifie (`token`, `profile`, droits).
- Le temps : `vi.useFakeTimers({ now: … })` (avec `shouldAdvanceTime: true` quand MSW ou React
  Query doivent avancer). Les fenêtres de temps suivent l'horloge via `useNow`.
- Un bug connu non corrigé s'écrit `it.fails('Bxx: …')` (numéro suivant le
  plus grand `Bxx` des tests, B33 en novembre 2026) ; quand il est corrigé, le
  test passe en `it` dans un bloc `fixed bugs (regressions)`. **Un correctif commence par un test
  qui échoue.**
- On teste le comportement visible (texte, rôles, appels réseau reçus par MSW), pas les détails
  d'implémentation.

### Seuils de couverture (bloquants)

Définis dans `vitest.config.mts` : 80 % de lignes et de branches **par fichier** sous
`src/services`, `src/hooks`, `src/utils`, `src/lib`, `src/context` ; 95 % sur les modules
sensibles (`client.ts`, `errors.ts`, `UserContext.tsx`, `SecureImage.tsx`, `permissions.ts`,
`user-data.ts`, `sw-cache-policy.ts`, `query-client.ts`). Un nouveau hook ou service arrive donc
avec ses tests.

---

## Tests E2E (Playwright, API mockées)

### Structure

```
e2e/
├── approach-1-mocked/
│   ├── widgets/       un spec par widget (+ captures visuelles *-snapshots/)
│   ├── actions/       actions utilisateur (lumières, spa, alarme, Petkit, prises…)
│   ├── api/           erreurs du back, reprise après 401
│   ├── permissions/   vues admin / user / children / non autorisé
│   ├── screens/       Réorganiser, Notifications
│   └── *.spec.ts      menu, purge de session, retour au premier plan
├── fixtures/
│   ├── api-mocks.ts   mockAllApis : toutes les routes du back, mêmes enveloppes que le back
│   ├── auth.ts        bypassClerkAuth : session simulée, aucun appel Clerk
│   ├── users.ts       ADMIN_PROFILE, USER_PROFILE, CHILDREN_PROFILE
│   └── mock-data/     données par source (états HA, Enedis, GRDF, Suez, Petkit)
├── helpers/
│   ├── assertions.ts       waitForDashboardReady, expectWidgetVisible
│   └── widget-selectors.ts sélecteurs data-testid centralisés
└── summary-reporter.ts
```

Les E2E construisent l'appli avec `VITE_TEST_MODE=true` (authentification simulée, constante de
build) dans `dist-e2e/` et la servent par `vite preview` (le build prend quelques secondes ; le
service worker est bloqué pour que `page.route` voie toutes les requêtes) : un `npm run dev`
ordinaire ne sert pas aux E2E, et un serveur déjà lancé sur le port est réutilisé hors CI.

### Deux projets

- `mocked` : Chromium desktop. `mocked-mobile` : WebKit, iPhone 14. **Les deux tournent en CI**,
  et le mobile a ses propres sélecteurs (navigation en barre basse, réglages en feuille fermée par
  `overlay-close-button-mobile` ; sur ordinateur, `overlay-close-button`).
- Les widgets vivent dans des sections : un spec ouvre celle de son widget (`page.goto('/#maison')`,
  voir `WIDGET_SECTION` dans `e2e/helpers/widget-selectors.ts`) ou y navigue (`openSection`,
  `showWidget` dans `e2e/helpers/assertions.ts`). L'accueil (`/`) ne montre que les tuiles
  de résumé `home-summary-today`,
  `home-summary-lights`, `home-summary-pets`, `home-summary-devices` (lignes `home-device-<id>`) et
  `home-summary-security` (`home-alarm-toggle`, vignettes `home-camera-<id>`), `home-summary-energy` (lignes `home-energy-<id>`, avec `-last`, `-day-trend`, `-week`, `-week-trend`), `home-summary-temperature` (cartes `home-room-<entity_id>`, avec `-temp`, `-humidity`), `home-summary-plugs` (lignes `home-plug-<pc|tv>`, avec `-state`, `-toggle`) (`screens/home.spec.ts` couvre les blocs affichés,
  les widgets masqués, « Tout allumer / éteindre », la bascule d'une pièce et la ration).
- Localement : `npx playwright install chromium webkit` une fois.

### Créer un widget

**Source de vérité : [`.claude/skills/new-widget/SKILL.md`](.claude/skills/new-widget/SKILL.md)**
(composant, enregistrement, préférences, sélecteurs, mocks, spec, permissions).

### Modifier un widget existant

| Modification                 | À mettre à jour                                                      |
| ---------------------------- | -------------------------------------------------------------------- |
| Titre ou texte visible       | `widgets/<widget>.spec.ts` (`getByText`)                             |
| Nouvelle section ou action   | un `test()` qui la vérifie (action : l'appel exact reçu par le mock) |
| `data-testid`                | `helpers/widget-selectors.ts` et les specs qui l'utilisent           |
| Format d'une réponse du back | `fixtures/mock-data/*` et `api-mocks.ts`, **et** le back             |
| Droits                       | `permissions/*-view.spec.ts`                                         |
| Rendu volontairement changé  | régénérer les captures Linux (ci-dessous)                            |

Trouver les tests concernés : `grep -r "widget-mon-widget\|MonWidget" e2e/`.

### Pièges fréquents

| Piège                                                                      | Solution                                                                     |
| -------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Le glob `**/api/foo` ne matche pas `**/api/foo?param=1`                    | Terminer par `**` : `**/api/foo**`                                           |
| Le mock ne renvoie pas la bonne enveloppe (`{ preferences }`, tableau nu…) | Recopier exactement la réponse du back                                       |
| Le widget ne s'affiche pas                                                 | `widgetOrder`, `useDashboardWidgets.tsx` et les droits du profil             |
| `actionCalls` vs `serviceCalls`                                            | `/api/ha/call` alimente les deux (`actionCalls` est l'ancien nom)            |
| Une surcharge de route doit gagner                                         | `mockAllApis(page, { overrides: { '/api/…': handler } })`                    |
| Attendre une réponse lente                                                 | Bloquer la route sur une promesse que le test libère, jamais un délai fixe   |
| Sélecteur ambigu (deux éléments)                                           | Cibler un `data-testid` ou un rôle dans un conteneur (`getByRole('dialog')`) |

### Captures visuelles

Deux tests comparent une capture (`lights.spec.ts`, `temperature.spec.ts`). Les références
n'existent que pour Linux (`*-linux.png`), produites dans l'image Docker de Playwright de la CI ;
ailleurs le test est sauté. Après un changement de rendu voulu :

1. GitHub → Actions → **« Update Linux snapshots »** → Run workflow, sur la branche du changement.
2. Télécharger l'artefact `linux-snapshots`, remplacer les `*-linux.png`, commiter.

Une capture générée hors de cette image diffère de quelques pixels (polices WebKit) : en local, la
capture « Température » mobile échoue d'1 px, et c'est normal. Si la CI échoue sur une capture,
télécharge l'artefact `playwright-report` du job `e2e`, copie le `*-actual.png` du test en échec à la
place du `*-linux.png`, et commite (c'est ainsi que la référence mobile a été corrigée).

La version de `@playwright/test` doit rester celle de l'image (`e2e.yml`, `update-snapshots.yml`) :
changer l'une impose de régénérer les captures.

### Commandes

```bash
npm test                                   # E2E desktop
npm run test:e2e:mocked:mobile             # E2E mobile
npx playwright test -g "LightsWidget" --project=mocked     # un test
npx playwright test -g "MonWidget" --project=mocked --headed --debug
npm run test:e2e:ui                        # interface Playwright
npm run test:e2e:report                    # dernier rapport HTML
```

## Environnement local (sessions distantes)

- **Node 24 est requis** (`.nvmrc`) : sous Node 22, les tests de `SecureImage` échouent déjà sur
  `main`. Si la machine n'a que Node 22 : `npx -y node@24 -v` le télécharge dans le cache npx ; mets
  son dossier `bin` en tête du `PATH`.
- `npx playwright install chromium webkit` puis `npx playwright install-deps webkit` (bibliothèques
  système de WebKit). Utilise `PW_PORT=<port>` si le port 5173 est pris.
- Pour une capture d'écran de contrôle, un spec jetable dans `e2e/approach-1-mocked/_tmp/` (supprimé
  ensuite) avec `mockAllApis` et `bypassClerkAuth` suffit ; `page.addInitScript` pose le thème
  (`localStorage['app-theme-preference']`).
- Une preview Vercel ne peut pas parler au back : `home-back` n'autorise que `home.psaltery.org` en
  CORS en production (« Erreur de profil / Failed to fetch » sur une URL `*.vercel.app`, comme sur
  `localhost:5173` : en local, lance aussi le back et vise-le avec `VITE_API_URL`).
