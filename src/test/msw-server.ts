/** msw-server — Shared MSW server; each test registers the handlers it needs with `server.use`. */
import { setupServer } from 'msw/node';

export const server = setupServer();
