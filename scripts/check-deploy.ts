/**
 * Gate: if the editor can be signed in to, the stack can serve the sign-in.
 *
 * `static/admin/config.yml` names a `backend.base_url`. That is not decoration
 * — Sveltia builds its whole OAuth handshake from it, asking for
 * `${base_url}/auth` and then `${base_url}/callback`. If nothing is listening
 * on that path, "Sign In with GitHub" opens a window that 404s, and the editor
 * is unreachable.
 *
 * That is exactly what shipped. The CMS was added; the staging stack was
 * scaffolded before it existed and still said, in two files, "No OAuth proxy —
 * there is no app yet". Nothing connected the two, because nothing was
 * watching the seam between a file in `static/` and a file in `deploy/`. Both
 * halves were individually correct and the site could not be edited.
 *
 * So this reads the config the EDITOR will actually use and checks the deploy
 * files can answer it: a proxy service in the compose file, a Caddy route that
 * strips the prefix, and the OAuth credentials documented in the env example
 * so whoever fills in the NAS copy knows they exist.
 *
 * It reads the deploy files as TEXT rather than reaching for the live origin.
 * A gate that needs the internet is a gate that fails on a train.
 *
 * Run strict on every path, including John's publish: none of it can be
 * tripped by anything he types. See scripts/run-gates.ts for that line.
 *
 *     node scripts/check-deploy.ts --self-test
 */
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { parse } from 'yaml';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p: string) => readFileSync(resolve(root, p), 'utf8');

const CMS_CONFIG = 'static/admin/config.yml';
const COMPOSE = 'deploy/compose.staging.yml';
const CADDYFILE = 'deploy/Caddyfile.staging';
const ENV_EXAMPLE = 'deploy/staging.env.example';

interface Problem {
  file: string;
  says: string;
}

/**
 * The path Sveltia will ask for, from the base_url it was given.
 *
 * Returns null when the backend needs no proxy at all — a `local` backend, or
 * no `base_url` — in which case there is nothing here to check.
 */
export function authPathFrom(baseUrl: string | undefined): string | null {
  if (!baseUrl) return null;
  try {
    const path = new URL(baseUrl).pathname.replace(/\/+$/, '');
    return path && path !== '/' ? path : null;
  } catch {
    return null;
  }
}

export function auditDeploy(files: {
  cms: string;
  compose: string;
  caddy: string;
  env: string;
}): Problem[] {
  const problems: Problem[] = [];

  const cms = parse(files.cms) as { backend?: { name?: string; base_url?: string } };
  const authPath = authPathFrom(cms.backend?.base_url);
  if (!authPath) return problems;

  // 1. A service to proxy to.
  const compose = parse(files.compose) as { services?: Record<string, unknown> };
  const services = Object.keys(compose.services ?? {});
  const proxy = services.find((n) => /auth/i.test(n));
  if (!proxy) {
    problems.push({
      file: COMPOSE,
      says: `the editor signs in through ${authPath}, and this stack declares no service to serve it — only ${services.join(', ')}. Sign In with GitHub will 404.`
    });
  }

  // 2. A route to it, and it must STRIP the prefix: the upstream serves
  //    /auth and /callback at its own root, so a plain `handle` forwarding
  //    /auth/auth would 404 on every sign-in.
  const caddy = files.caddy;
  const stripping = new RegExp(`handle_path\\s+${authPath}/\\*`).test(caddy);
  const forwarding = new RegExp(`handle\\s+${authPath}/\\*`).test(caddy);
  if (!stripping) {
    problems.push({
      file: CADDYFILE,
      says: forwarding
        ? `${authPath}/* is routed with \`handle\`, which keeps the prefix. The proxy serves /auth and /callback at its own root, so it needs \`handle_path\`, which strips it.`
        : `nothing routes ${authPath}/*, so the sign-in the editor starts has nowhere to go.`
    });
  } else if (proxy && !new RegExp(`${proxy}:\\d+`).test(caddy)) {
    problems.push({
      file: CADDYFILE,
      says: `${authPath}/* is routed, but not to \`${proxy}\`, which is the only auth service in the compose file.`
    });
  }

  // 3. The credentials, documented where the person filling in the NAS copy
  //    will look. An unset pair fails the container's own startup, which is a
  //    clear failure — but only if someone knew to set it.
  for (const key of ['OAUTH_CLIENT_ID', 'OAUTH_CLIENT_SECRET']) {
    if (!files.env.includes(key)) {
      problems.push({
        file: ENV_EXAMPLE,
        says: `${key} is not documented, so nobody filling in the NAS copy of this file knows the proxy needs it.`
      });
    }
  }

  return problems;
}

/** Proves it can SEE each fault before its silence is believed. */
function selfTest(): boolean {
  const good = {
    cms: 'backend:\n  name: github\n  base_url: https://x.example/auth\n',
    compose: 'services:\n  caddy: {}\n  site: {}\n  sveltia-auth: {}\n',
    caddy: ':80 {\n  handle_path /auth/* {\n    reverse_proxy sveltia-auth:3000\n  }\n}\n',
    env: 'OAUTH_CLIENT_ID=\nOAUTH_CLIENT_SECRET=\n'
  };

  const cases: { name: string; files: typeof good; expect: number }[] = [
    { name: 'a complete stack passes', files: good, expect: 0 },
    {
      name: 'a missing proxy service is caught',
      files: { ...good, compose: 'services:\n  caddy: {}\n  site: {}\n' },
      expect: 1
    },
    {
      name: 'a missing route is caught',
      files: { ...good, caddy: ':80 {\n  handle {\n    reverse_proxy site:8080\n  }\n}\n' },
      expect: 1
    },
    {
      name: 'handle instead of handle_path is caught',
      files: { ...good, caddy: ':80 {\n  handle /auth/* {\n    reverse_proxy sveltia-auth:3000\n  }\n}\n' },
      expect: 1
    },
    {
      name: 'undocumented credentials are caught',
      files: { ...good, env: 'CADDY_PORT=1\n' },
      expect: 2
    },
    {
      name: 'a local backend needs none of it',
      files: { ...good, cms: 'backend:\n  name: local\n', compose: 'services:\n  site: {}\n', caddy: '', env: '' },
      expect: 0
    }
  ];

  let ok = true;
  for (const c of cases) {
    const got = auditDeploy(c.files).length;
    if (got !== c.expect) {
      console.error(`check-deploy self-test FAILED: ${c.name} — expected ${c.expect} problem(s), got ${got}`);
      ok = false;
    }
  }
  if (ok) console.log(`check-deploy: self-test passed, ${cases.length} case(s).`);
  return ok;
}

if (process.argv.includes('--self-test')) process.exit(selfTest() ? 0 : 1);
if (!selfTest()) process.exit(1);

for (const f of [CMS_CONFIG, COMPOSE, CADDYFILE, ENV_EXAMPLE]) {
  if (!existsSync(resolve(root, f))) {
    console.error(`\ncheck-deploy: ${f} is missing.`);
    process.exit(1);
  }
}

const problems = auditDeploy({
  cms: read(CMS_CONFIG),
  compose: read(COMPOSE),
  caddy: read(CADDYFILE),
  env: read(ENV_EXAMPLE)
});

if (problems.length) {
  console.error(`\ncheck-deploy: the editor's sign-in has no working path on staging:\n`);
  for (const p of problems) console.error(`  ${p.file}\n    ${p.says}\n`);
  console.error(
    `The reference implementation is chrishemmings.co.uk's deploy/ directory, and\n` +
      `the rule is SC-8 in nas-sites/docs/SITE-CANON.md.\n`
  );
  process.exit(1);
}

const authPath = authPathFrom(
  (parse(read(CMS_CONFIG)) as { backend?: { base_url?: string } }).backend?.base_url
);
console.log(
  `check-deploy: the editor signs in through ${authPath}, and staging serves it — a proxy service, a prefix-stripping route to it, and both OAuth variables documented.`
);
