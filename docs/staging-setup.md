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
- `deploy/compose.staging.yml` and `deploy/Caddyfile.staging` follow the
  chrishemmings.co.uk shape, minus the CMS and OAuth proxy — there is no app
  yet, only static prototypes — and minus the published host port, since the
  project reaches the front door over the shared network instead.
- Built and run locally: every route 200s, `/robots.txt` is Disallow-all, and
  missing detail-page routes 302 back to the picker.

The workflow's verify step **will fail until you have finished the steps below**
— it polls the staging URL for the commit SHA, and there is nothing serving yet.
The build, push and signature all succeed regardless; only the poll fails. Once
the NAS is configured, re-run the job (or push again) and it will go green.

---

## 1. Create the site directory on the NAS

Site directories on the NAS carry the apex domain, `.co.uk` included:

```bash
mkdir -p /volume1/docker/gosscounselling.co.uk/staging
cd /volume1/docker/gosscounselling.co.uk/staging
```

Copy in the two files from the repo (`deploy/compose.staging.yml` and
`deploy/Caddyfile.staging`), or let the deploy agent clone the repo the way it
does for the other sites — whichever matches how chrishemmings is set up on
this NAS. There is no env file: this stack publishes no host port and needs no
secrets.

## 2. Register the site with the deploy agent

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

## 3. DNS and the front door

- **DNS**: `gosscounselling-co-uk.stage.denfrievilje.dk` → the NAS, same as the
  other three staging hosts. Note the **dashes**: the Let's Encrypt wildcard
  matches one label only, so dots in the site name would break the cert.
- **Front door**: the stack publishes no host port. Its Caddy joins the shared
  `nas-deploy` network under the alias **`gosscounselling-staging`**, so the
  front door routes to `http://gosscounselling-staging:80` by name.

  If this NAS still proxies through DSM Web Station rather than a containerised
  front door, Web Station runs on the host and cannot resolve that alias — in
  that case add `ports: - "127.0.0.1:8083:80"` back to the caddy service and
  point the DSM rule at it. One line either way.
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
