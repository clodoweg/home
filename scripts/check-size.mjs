/**
 * check-size — Size budget of the production build (gzip, as served). Fails when the JavaScript
 * loaded at startup, any single chunk or the CSS grows past its budget. Run after `npm run build`.
 * Budgets sit about 15 % above the sizes measured at the end of the audit (lot 6): raise them
 * deliberately, in the same change that explains why.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const DIST = new URL('../dist/', import.meta.url).pathname;

/** Budgets in KB (gzip). */
const BUDGETS = {
  // index-*.js and the modulepreloaded chunks (Clerk), measured at 188 KB.
  startupJs: 215,
  // Largest lazy chunk: recharts, measured at 106 KB.
  chunk: 125,
  // 9.7 KB with Tailwind 4 (6.8 with v3: v4 adds its theme variables and @property rules).
  css: 12,
};

const gzipKb = (path) => gzipSync(readFileSync(path), { level: 9 }).length / 1024;

const html = readFileSync(join(DIST, 'index.html'), 'utf8');
const startupFiles = [
  ...html.matchAll(/<script[^>]+src="\/(assets\/[^"]+\.js)"/g),
  ...html.matchAll(/<link[^>]+rel="modulepreload"[^>]+href="\/(assets\/[^"]+\.js)"/g),
].map((match) => match[1]);

const assets = readdirSync(join(DIST, 'assets'));
const problems = [];
const report = [];

const startupKb = startupFiles.reduce((sum, file) => sum + gzipKb(join(DIST, file)), 0);
report.push(`startup JS ${startupKb.toFixed(1)} KB (budget ${BUDGETS.startupJs})`);
if (startupFiles.length === 0) problems.push('no startup script found in index.html');
if (startupKb > BUDGETS.startupJs) {
  problems.push(`startup JS ${startupKb.toFixed(1)} KB > ${BUDGETS.startupJs} KB`);
}

for (const file of assets) {
  const kb = gzipKb(join(DIST, 'assets', file));
  // Startup files are covered by the startup budget above.
  if (file.endsWith('.js') && !startupFiles.includes(`assets/${file}`) && kb > BUDGETS.chunk) {
    problems.push(`${file} ${kb.toFixed(1)} KB > ${BUDGETS.chunk} KB`);
  }
  if (file.endsWith('.css')) {
    report.push(`${file} ${kb.toFixed(1)} KB (budget ${BUDGETS.css})`);
    if (kb > BUDGETS.css) problems.push(`${file} ${kb.toFixed(1)} KB > ${BUDGETS.css} KB`);
  }
}

if (problems.length > 0) {
  console.error(`check-size: over budget\n  ${problems.join('\n  ')}`);
  process.exit(1);
}
console.log(`check-size: OK (${report.join(', ')})`);
