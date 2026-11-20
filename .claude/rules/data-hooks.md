---
paths:
  - 'src/hooks/**'
  - 'src/services/**'
  - 'src/context/**'
---

# Données, hooks et services

- Toute donnée serveur passe par TanStack Query, dans un hook par domaine (`useHAData`,
  `usePetkitData`, `useEnedisData`…). Les transformations restent dans les hooks, pas dans les
  composants.
- Les appels HTTP vivent dans `src/services/<domaine>.ts`, écrits avec `request<T>()`
  (`src/services/request.ts`), puis ré-exportés par `api.ts`. Pas de `fetch` ni de `useQuery`
  directement dans un composant (seule exception : `SecureImage`, qui charge les images en blob).
- Requête qui dépend du token Clerk : utilise la fabrique `createTokenQuery`.
- Clés de query : toujours via `queryKeys` (`src/lib/query-keys.ts`), hiérarchiques par domaine
  (`['ha', 'states']`, `['energy', 'gas']`) pour pouvoir rafraîchir tout un domaine par son préfixe.
- Pas de `setInterval` pour charger des données : `refetchInterval`.
- Mutation qui écrit dans le cache Query : mise à jour optimiste et rollback obligatoires, sur le
  modèle de `useHAState` (`onMutate` : `cancelQueries` + snapshot ; `onError` : restauration ;
  `onSettled` : invalidation).
