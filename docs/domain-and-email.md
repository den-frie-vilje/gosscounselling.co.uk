# Domains, DNS and email — findings

Measured 2026-08-04 with `dig` and `curl`. John believes a friend "did something" with
`gosscounselling.co.uk` and that their business closed down. Here is what is actually true.

## gosscounselling.co.uk — the target domain

| | |
| --- | --- |
| Nameservers | `ns1/ns2/ns3.livedns.co.uk` (Namesco / names.co.uk) |
| A record | `88.208.252.9` (Namesco hosting) |
| `www` | same `88.208.252.9` |
| MX | `10 mailserver.livemail.co.uk` (Namesco mail) |
| HTTP | `302 Found` → `https://goss-counselling.co.uk` (nginx, ASP.NET behind it) |
| HTTPS | fails — TLS handshake alert; no valid certificate is served |

**So it is not lost.** The domain is live at Namesco and already forwards to the hyphenated
site over plain HTTP. What is missing is a certificate, which is why it looks dead in a browser.
The "friend" is not in the path any more; Namesco is.

**This is also where his email lives.** `info@gosscounselling.co.uk` is delivered by
`mailserver.livemail.co.uk`, i.e. Namesco mail on the same DNS zone.

> When we move the site, change only the `A` / `AAAA` / `CNAME` records. Leave `MX` and any
> `TXT` (SPF/DKIM) alone, or his email stops. This is the single highest-risk step in the
> migration and it is worth saying to him in exactly those words.

Access needed from John: his Namesco (names.co.uk) login, or a DNS delegation to a zone we
control. Ask which he prefers once a design direction is agreed.

## goss-counselling.co.uk — the current site

| | |
| --- | --- |
| Nameservers | `ns1–ns4.healthhosts.net` |
| A record | `185.151.30.220` |
| Platform | WordPress 7.0.2, Beaver Builder theme + plugin, HealthHosts-specific plugins |
| Content | fully captured → [content-scrape.md](content-scrape.md) |

Recommendation: keep this domain registered and 301 it to `gosscounselling.co.uk` for at least
a year after launch. It is the address currently on his directory listings, in his email
signature and in other people's referrals; dropping it turns those into dead ends. Renewing a
`.co.uk` is a few pounds a year — much cheaper than the referrals it protects.

## Migration order (draft, for when a direction is signed off)

1. Build and stage the new site on `gosscounselling-co-uk.stage.denfrievilje.dk`.
2. John reviews and signs off the content.
3. Get Namesco DNS access. Lower the TTL on the `A` record first.
4. Point `A` / `www` at the new host. **Touch nothing else in the zone.**
5. Verify TLS and that mail to `info@gosscounselling.co.uk` still lands — send a test both ways.
6. Only then: set the HealthHosts site to 301 → the new domain, and close the account.
7. Keep the old WordPress export and this scrape as the archive.
