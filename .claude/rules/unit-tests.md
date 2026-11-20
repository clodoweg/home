---
paths:
  - 'src/**/*.test.ts'
  - 'src/**/*.test.tsx'
  - 'src/test/**'
  - 'vitest.config.mts'
---

# Tests unitaires (Vitest)

- Réseau uniquement par MSW (`src/test/msw-server.ts`, `server.use(...)`) avec `API_URL` : une
  requête sans handler fait échouer le test, n'en contourne jamais l'effet.
- Briques à réutiliser : `createTestQueryClient` / `createQueryWrapper` (`src/test/query-wrapper.tsx`),
  `makeHAState` (`src/test/hooks/ha-fixtures.ts`), `loadFreshServices` (`src/test/services/helpers.ts`).
- Contexte utilisateur simulé par `vi.mock('…/context/UserContext')` et un objet `vi.hoisted`.
- Un correctif de bug commence par un test qui échoue ; un bug connu non corrigé s'écrit
  `it.fails('Bxx: …')`, numéroté après le plus grand `Bxx` des tests.
- Les seuils de couverture de `vitest.config.mts` sont bloquants (80 % par fichier, 95 % sur les
  modules sensibles) : ne les baisse pas pour faire passer un changement.
- Détail et conventions : [`TESTING.md`](../../TESTING.md).
