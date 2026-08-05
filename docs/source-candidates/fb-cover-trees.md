# fb-cover-trees.jpg — candidate, NOT cleared for use

Sidecar for `fb-cover-trees.jpg`. Assessed in `../social-profiles.md`.

## Where it came from

- **Source:** the Facebook Page `https://www.facebook.com/gosscounselling` (verified as John's —
  see `../social-profiles.md`). This is the trees image Ole spotted on the profile.
- **Direct asset URL:** `https://scontent-cph2-1.xx.fbcdn.net/v/t39.30808-6/473813797_1110108647573756_2349726035996167934_n.jpg?stp=dst-jpg_tt6&cstp=mx720x960&ctp=s720x960&…`
  (Meta media id `473813797_1110108647573756`; the URL is signed with `oh=`/`oe=` and will expire.)
- **Retrieved:** 2026-08-05, unauthenticated, from the public page.

## What it is

- **Dimensions: 720 × 960 px** (691,200 px). Portrait, **aspect ratio 0.750 (3:4)**.
- **File size: 166,361 bytes** → 0.241 bytes/px, 1.93 bits/px.
- JPEG quantisation table means 15.8 / 13.3 — approximately quality 85–90. Well encoded.
- **EXIF: stripped entirely** (Facebook removes it on upload). No camera, date or author.
- Subject: English woodland in spring. Large horse-chestnut trunk hard right, open grass mid-frame,
  bare-and-budding branches above, sun flare entering bottom-left.

## Why it is 720 px and cannot be made larger

Meta's CDN URLs are signed, and the signature covers the size parameters. Requests for larger
renditions — `cstp=mx2048x2048`, `stp=dst-jpg_p2048x2048_tt6`, and the URL with all size parameters
removed — each returned **HTTP 403**. 720 × 960 is the maximum obtainable from a public URL.

## Suitability as a hero background — assessed as NO

- Needs a **2.22× upscale** to reach a 1600 px hero, **3.33×** for 2400 px.
- A 16:9 crop yields **720 × 405** and throws away **58% of the height**, losing the canopy and the
  foreground detail.
- Composition is centre-weighted with the trunk hard right and a flare bottom-left; a figure placed
  to one side would cover the trunk or land in the flare.
- Compression is *not* the limiting factor — resolution and aspect ratio are.

## Provenance — UNRESOLVED. Do not use until answered.

It is **not established that this photograph is John's to license.** It has the look of his own phone
snapshot (handheld portrait, flare, casual framing), but EXIF is stripped and there is no other
metadata, so that is an impression and not evidence. It could equally be a stock image or another
person's photograph reposted to the page.

**Question for John: did you take this photograph?**

- **If yes** — ask for the original file off his phone. That will likely be ~3024 × 4032, which
  removes the resolution objection entirely (though not the portrait aspect ratio).
- **If no, or unsure** — it cannot be used at any size.

This repo previously assumed the former designer's stock library was licensed to John and it was
not, which is why the site carries no stock photography. Same caution applies here.

**Status: candidate only.** Deliberately not in `static/img/`, and not referenced by any code.
