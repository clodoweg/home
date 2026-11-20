---
paths:
  - 'e2e/**'
  - 'playwright.config.ts'
---

# Tests E2E Playwright

- Mocked d'abord : toute fonctionnalité visible a un test dans `e2e/approach-1-mocked/`. Les
  projets `mocked` (desktop) et `mocked-mobile` (iPhone 14) tournent tous deux en CI : vérifie les
  deux.
- Briques à réutiliser plutôt que réécrire : `bypassClerkAuth` (`fixtures/auth.ts`), `mockAllApis`
  (`fixtures/api-mocks.ts`), profils `ADMIN_PROFILE` / `USER_PROFILE` / `CHILDREN_PROFILE` (`fixtures/users.ts`), données dans
  `fixtures/mock-data/`, `waitForDashboardReady` (`helpers/assertions.ts`).
- Les sélecteurs sont centralisés dans `helpers/widget-selectors.ts` et ciblent `data-testid`.
- Un mock reproduit exactement l'enveloppe de la vraie réponse du back.
- Visibilité selon les droits : si un widget ou une vue change, mets à jour
  `approach-1-mocked/permissions/` (`admin-view`, `user-view`, `children-view`, `unauthorized`).
- Pas de délai fixe pour attendre une réponse : bloque la route sur une promesse que le test libère.
- Pièges de glob et de mocks, captures visuelles Linux : voir [`TESTING.md`](../../TESTING.md).
