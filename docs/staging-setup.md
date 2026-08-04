# Staging setup — what you need to do on the NAS

Everything in CI is done and pushed. What remains is operator work on the NAS and
in DSM, which I can't do from here. Roughly fifteen minutes.

The target: **https://gosscounselling-co-uk.stage.denfrievilje.dk** — the design
picker at `/`, the four directions one click away.

---

## What is already in place

- `staging` and `main` both pushed to `den-frie-vilje/gosscounselling.co.uk`.
- `.github/workflows/deploy-staging.yml` calls the shared `build-and-sign.yml`
  in `nas-sites` on every push to `staging`, and signs the image with Sigstore
  keyless — the same trust path the other three sites use.
- Image: `ghcr.io/den-frie-vilje/gosscounselling:staging-latest`.
- `deploy/compose.staging.yml`, `deploy/Caddyfile.staging` and
  `deploy/staging.env.example` follow the chrishemmings.co.uk shape, minus the
  CMS and OAuth proxy — there is no app yet, only static prototypes.
- Built and run locally: every route 200s, `/robots.txt` is Disallow-all, and
  missing detail-page routes 302 back to the picker.

The workflow's verify step **will fail until you have finished the steps below**
— it polls the staging URL for the commit SHA, and there is nothing serving yet.
The build, push and signature all succeed regardless; only the poll fails. Once
the NAS is configured, re-run the job (or push again) and it will go green.

---

## 1. Run the agent's bootstrap script

Everything on the NAS side is one interactive script. From a root shell:

```sh
sudo /volume1/docker/nas-sites/repo/tools/bootstrap-site.sh
```

Answer:

| Prompt | Value |
| --- | --- |
| domain | `gosscounselling.co.uk` |
| environment | `staging` |
| repo | `den-frie-vilje/gosscounselling.co.uk` |
| branch | `staging` |
| compose file | `deploy/compose.staging.yml` |

It then creates `/volume1/docker/gosscounselling.co.uk/{repo,staging}/` owned by
`deploy:users`, clones the repo at `staging`, writes the two config files with
the right `root:docker 0640` permissions, and offers a one-off agent fire as a
smoke test. Take the smoke test — it is the fastest way to find out whether the
signature verifies.

Two of its prompts open `$EDITOR`:

- **the per-stack `staging.env`** — this is where `CADDY_PORT` goes. Fill it
  from `deploy/staging.env.example`. **This is the file the port lives in** —
  not the agent's `sites.d/` config, which is why grepping `sites.d/` for
  `CADDY_PORT` turns up nothing. Check what is actually taken before settling
  on a number:

  ```sh
  grep -rh CADDY_PORT /volume1/docker/*/*/*.env
  docker ps --format '{{.Names}}\t{{.Ports}}' | grep 127.0.0.1
  ```

  Allocation starts at **18080** — the 80xx range collides with Jitsi on this
  NAS. The example proposes `18084`. Don't trust the `*.env.example` files in
  the sibling repos as an allocation table: they contradict each other
  (skovbyesexologi and chrishemmings both claim 18080 for staging), so the
  running NAS is the only source of truth.
- **`CF_API_TOKEN` / `CF_ZONE_IDS`** in the sites.d file — Cloudflare cache
  purge. Staging is not behind Cloudflare, so leave both empty and the agent
  skips purging entirely.

Nothing else in the sites.d file needs touching. `SITE_SERVICE` defaults to
`site`, which is what the compose file calls the container.

## 2. What the agent will do

On its next fire, and every 5–15 minutes after:

1. pull `staging` in `/volume1/docker/gosscounselling.co.uk/repo`,
2. cosign-verify `ghcr.io/den-frie-vilje/gosscounselling:staging-latest`
   against the `den-frie-vilje/*` build-and-sign workflow identity,
3. if the digest moved, `docker compose pull && up -d --wait`, then recreate
   just the `site` service.

It fails closed: an unverifiable signature deploys nothing. So if the stack
never comes up, read the agent log before suspecting the image —
`/volume1/docker/nas-sites/` holds the agent state and its log.

## 3. DNS and the front door

- **DNS**: `gosscounselling-co-uk.stage.denfrievilje.dk` → the NAS, same as the
  other three staging hosts. Note the **dashes**: the Let's Encrypt wildcard
  matches one label only, so dots in the site name would break the cert.
- **DSM → Web Station**: new vhost for
  `gosscounselling-co-uk.stage.denfrievilje.dk`, proxying to
  `http://127.0.0.1:${CADDY_PORT}`, bound to the `*.stage.denfrievilje.dk`
  wildcard cert. GUI only — Web Station's APIs are too unstable to script.

  Web Station terminates TLS on the host, which is why the stack publishes a
  loopback port rather than being reached by container name over `nas-deploy`.
  The Caddy service does still carry the alias `gosscounselling-staging` on that
  shared network, so if the front door ever becomes containerised, the port can
  be dropped and the vhost pointed at the alias instead.
- The wildcard certificate should cover it; if DSM has a per-host cert list,
  add this host to it.

## 4. Check it

```bash
curl -sI https://gosscounselling-co-uk.stage.denfrievilje.dk/ | grep -i x-robots-tag
curl -s  https://gosscounselling-co-uk.stage.denfrievilje.dk/_meta.json
```

The first must return `noindex, nofollow, noarchive, nosnippet`. The second
returns the deployed commit SHA — that is what the workflow polls for, so if it
matches the head of `staging`, the whole chain is working.

Then re-run the failed deploy job so the verify step goes green and stays that
way for future pushes.

After this, the loop is: push to `staging` → CI builds and signs → the agent
picks it up within about five minutes. Nothing else to do per deploy.

---

## Before you send John the link

- **It is a public hostname.** Three separate noindex straps are in place
  (robots.txt in the image, `X-Robots-Tag` from nginx, and again at the Caddy
  front door), but anyone with the URL can read it. His phone number, fees and
  qualifications are on it — all already public on his current site, so this is
  not a new disclosure, but the link should not be posted anywhere.
- **The photographs in direction D are CC BY-SA 2.0** (Geograph). Attribution is
  in that page's footer and share-alike applies. That is a different bargain
  from the Pexels licence, and it is a decision to make before launch rather
  than after: either keep them and carry the credit, or replace them with
  licensed or commissioned photography.
- **The detail-page links go nowhere yet** — `/counselling/individual` and its
  siblings 302 back to the picker. That is deliberate, so John can see where the
  structure is heading without meeting a 404.

## When a direction is chosen

`deploy/Dockerfile` has no builder stage because there is nothing to build. When
the SvelteKit app is scaffolded, it gains one (copy the shape from
chrishemmings.co.uk) and the `COPY design/` line becomes `COPY --from=builder
/app/build/`. Nothing else in the deploy chain has to change.
