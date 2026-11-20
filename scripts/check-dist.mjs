/**
 * check-dist — Fails when the production build ships what it must not: source maps,
 * simulated-auth code (fake JWT, mock providers) or the debug `window.queryClient` hook.
 * Run after `npm run build` (not on a VITE_TEST_MODE build).
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const DIST = new URL('../dist/', import.meta.url).pathname;

const FORBIDDEN = [
  // Payload of the fake test JWT ({"sub":"user_test",…}).
  'eyJzdWIiOiJ1c2VyX3Rlc3Qi',
  'Mock sign out',
  'mock_session',
  '__TEST_MODE__',
  'X-Test-User-Id',
  'window.queryClient',
  'sourceMappingURL=',
];

const listFiles = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? listFiles(path) : [path];
  });

const files = listFiles(DIST);
const problems = [];

for (const file of files) {
  const name = relative(DIST, file);
  if (file.endsWith('.map')) problems.push(`${name}: source map published`);
  if (!/\.(js|mjs|html)$/.test(file)) continue;
  const content = readFileSync(file, 'utf8');
  for (const marker of FORBIDDEN) {
    if (content.includes(marker)) problems.push(`${name}: contains "${marker}"`);
  }
}

if (problems.length > 0) {
  console.error(`check-dist: ${problems.length} problem(s)\n- ${problems.join('\n- ')}`);
  process.exit(1);
}
console.log(`check-dist: OK (${files.length} files, no source map, no test-only code)`);
