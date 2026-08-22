/**
 * The editor's configuration, generated per build mode.
 *
 * `config.yml` is a single static file in Sveltia's eyes, but its `backend:`
 * block is a per-environment fact: the staging editor writes to the `staging`
 * branch through the NAS OAuth proxy, and the live editor writes to `main`
 * with a personal access token and no proxy anywhere. One committed file
 * cannot say both, and for a while it silently said only one — the staging
 * backend went wherever the build went.
 *
 * So the file became a PRERENDERED ROUTE, on the same reasoning as SC-1's
 * robots.txt: the artefact then cannot disagree with the mode it was built
 * in, because the route deploys atomically with the build. The authored
 * source — fields, collections, hints, everything John's editor is made of —
 * stays in `src/lib/cms/config.yml`, in git, where `check-cms` keeps it in
 * lockstep with the content. Only the backend block is decided here.
 *
 * PRODUCTION CARRIES NO `base_url`. That is the token decision, not an
 * omission: with no OAuth client configured, Sveltia's "Sign In Using Access
 * Token" is the working path, and John's manual walks him through exactly
 * that. VERIFY ON THE LIVE HOST whether the GitHub OAuth button still renders
 * beside it; if it does and misleads, hiding it is a Sveltia config question
 * to answer then, not a reason to grow an auth service now.
 *
 * The switch is `PUBLIC_CMS_BACKEND` (SC-2: committed, `PUBLIC_`-only, one
 * value per mode file). Fail-closed: anything except the literal
 * 'production' gets the staging backend, so a mistyped mode can never point
 * an editor at `main`.
 */
import { parse, stringify } from 'yaml';
import { PUBLIC_CMS_BACKEND } from '$env/static/public';
import authored from '$lib/cms/config.yml?raw';

export const prerender = true;

const BACKENDS: Record<string, Record<string, unknown>> = {
  staging: {
    name: 'github',
    repo: 'den-frie-vilje/gosscounselling.co.uk',
    branch: 'staging',
    base_url: 'https://gosscounselling-co-uk.stage.denfrievilje.dk/auth',
    site_domain: 'gosscounselling-co-uk.stage.denfrievilje.dk'
  },
  production: {
    name: 'github',
    repo: 'den-frie-vilje/gosscounselling.co.uk',
    branch: 'main'
  }
};

export function GET(): Response {
  const config = parse(authored) as Record<string, unknown>;
  config.backend =
    PUBLIC_CMS_BACKEND === 'production' ? BACKENDS.production : BACKENDS.staging;

  // The authored file's comments do not survive parse/stringify, and that is
  // fine: they are for the person editing the source, and this output is for
  // the machine loading it.
  return new Response(stringify(config), {
    headers: {
      'content-type': 'text/yaml; charset=utf-8',
      // The editor must always see the current config, not a cached one.
      'cache-control': 'no-cache, must-revalidate'
    }
  });
}
