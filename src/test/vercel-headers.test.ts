/** vercel.json tests — security headers served with the app (no browser check is possible locally). */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

interface VercelConfig {
  headers: { source: string; headers: { key: string; value: string }[] }[];
}

const config = JSON.parse(
  readFileSync(resolve(__dirname, '../../vercel.json'), 'utf8'),
) as VercelConfig;
const headers = new Map(config.headers[0].headers.map(({ key, value }) => [key, value]));
const csp = new Map(
  (headers.get('Content-Security-Policy') ?? '')
    .split(';')
    .map((directive) => directive.trim().split(/\s+/))
    .filter(([name]) => name)
    .map(([name, ...sources]) => [name, sources]),
);

describe('Content-Security-Policy', () => {
  it('allows no inline or eval script', () => {
    expect(csp.get('script-src')).not.toContain("'unsafe-inline'");
    expect(csp.get('script-src')).not.toContain("'unsafe-eval'");
  });

  it('locks down plugins, base, forms and framing', () => {
    expect(csp.get('object-src')).toEqual(["'none'"]);
    expect(csp.get('base-uri')).toEqual(["'self'"]);
    expect(csp.get('form-action')).toEqual(["'self'"]);
    expect(csp.get('frame-ancestors')).toEqual(["'none'"]);
    // Camera images are blob: URLs (SecureImage); nothing in the app needs data: images.
    expect(csp.get('img-src')).toEqual(["'self'", 'blob:', 'https://img.clerk.com']);
  });

  it('loads Clerk from its production domain, never from the development instance', () => {
    expect(csp.get('script-src')).toContain('https://clerk.home.psaltery.org');
    expect(csp.get('script-src')?.some((source) => source.includes('clerk.accounts.dev'))).toBe(
      false,
    );
  });

  it('lets Clerk bot protection load (script and frame)', () => {
    expect(csp.get('script-src')).toContain('https://challenges.cloudflare.com');
    expect(csp.get('frame-src')).toContain('https://challenges.cloudflare.com');
  });

  it('only talks to the backend and Clerk', () => {
    // Clerk production instance only: the development one serves local runs, never this CSP
    expect(csp.get('connect-src')).toEqual([
      "'self'",
      'https://home-back.psaltery.org',
      'https://clerk.home.psaltery.org',
      'https://*.protect.clerk.com:*',
    ]);
  });
});

describe('other security headers', () => {
  it('denies powerful features and enforces HTTPS', () => {
    expect(headers.get('Permissions-Policy')).toContain('camera=()');
    expect(headers.get('Permissions-Policy')).toContain('microphone=()');
    expect(headers.get('Permissions-Policy')).toContain('geolocation=()');
    expect(headers.get('Strict-Transport-Security')).toMatch(/max-age=\d{8,}/);
    expect(headers.has('X-XSS-Protection')).toBe(false);
  });
});
