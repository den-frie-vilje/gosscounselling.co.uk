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
- `deploy/compose.staging.yml`, `deploy/Caddyfile.staging`,
  `deploy/staging.env.example` follow the chrishemmings.co.uk shape, minus the
  CMS and OAuth proxy — there is no app yet, only static prototypes.
- Built and run locally: every route 200s, `/robots.txt` is Disallow-all, and
  missing detail-page routes 302 back to the picker.

The workflow's verify step **will fail until you have finished the steps below**
— it polls the staging URL for the commit SHA, and there is nothing serving yet.
The build, push and signature all succeed regardless; only the poll fails. Once
the NAS is configured, re-run the job (or push again) and it will go green.

---

## 1. Pick a port

The agent runs one Caddy per site and each needs its own loopback port. Check
what is taken:

```bash
grep -rh CADDY_PORT /volume1/docker/nas-sites/sites.d/ 2>/dev/null | sort
```

`deploy/staging.env.example` proposes `8083`. If that collides, choose a free
one — it only has to be consistent between `staging.env` and the DSM rule below.

## 2. Create the site directory on the NAS

```bash
mkdir -p /volume1/docker/gosscounselling/staging
cd /volume1/docker/gosscounselling/staging
```

Copy in the two files from the repo (`deploy/compose.staging.yml` and
`deploy/Caddyfile.staging`), or let the deploy agent clone the repo the way it
does for the other sites — whichever matches how chrishemmings is set up on
this NAS. Then write the env file, which is **not** in git:

```bash
printf 'CADDY_PORT=8083\n' > staging.env
```

## 3. Register the site with the deploy agent

Create `/volume1/docker/nas-sites/sites.d/gosscounselling-staging.env` from
`nas-sites/nas-agent/sites.env.example`. It needs the repo, the branch, the
compose file and the working directory — copy the chrishemmings staging entry
and change the names. The agent will then, on its next 5-minute fire:

1. pull `staging`,
2. cosign-verify `ghcr.io/den-frie-vilje/gosscounselling:staging-latest`
   against the `den-frie-vilje/*` workflow identity,
3. `docker compose pull && up -d --wait` if the digest moved.

Nothing deploys if the signature does not verify — that is the point of the
model, so if it stays down, check the agent log before assuming the image is
bad.

## 4. DNS and the DSM front door

- **DNS**: `gosscounselling-co-uk.stage.denfrievilje.dk` → the NAS, same as the
  other three staging hosts. Note the **dashes**: the Let's Encrypt wildcard
  matches one label only, so dots in the site name would break the cert.
- **DSM → Login Portal → Reverse Proxy**: new rule,
  `https://gosscounselling-co-uk.stage.denfrievilje.dk` → `http://127.0.0.1:8083`,
  with WebSocket off (not needed) and HSTS as per the other rules.
- The wildcard certificate should cover it; if DSM has a per-host cert list,
  add this host to it.

## 5. Check it

```bash
curl -sI https://gosscounselling-co-uk.stage.denfrievilje.dk/ | grep -i x-robots-tag
curl -s  https://gosscounselling-co-uk.stage.denfrievilje.dk/_meta.json
```

The first must return `noindex, nofollow, noarchive, nosnippet`. The second
returns the deployed commit SHA — that is what the workflow polls for, so if it
matches the head of `staging`, the whole chain is working.

Then re-run the failed deploy job so the verify step goes green and stays that
way for future pushes.

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
