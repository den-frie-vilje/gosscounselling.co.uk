"""Build John's portrait assets.

  python3 scripts/build-cutouts.py                # rebuild everything from the source files
  python3 scripts/build-cutouts.py --from-master  # keep design/assets/john-cutout.webp exactly
                                                  # as it is (e.g. after a hand retouch of the
                                                  # crown) and only re-derive what depends on it

TO RETOUCH THE CROWN: edit `docs/source-assets/john-light-decontaminated.png` — RGBA, lossless,
background already removed and decontaminated against the white backdrop. The source frame clips
the top of his head, so the canvas has to grow upward; the version in the repo has been retouched
by hand and now stands 1800x1460. Run this script with no arguments and everything downstream is
rebuilt from it. (To work on the WebP directly instead, edit `design/assets/john-cutout.webp` and
run with --from-master.)

Three assets come out in design/assets/:

  john-cutout.webp        the light studio frame, knocked out. His shoulders run off the edges of
                          the original photograph, so in layout it always sits in a frame
                          narrower than the image: the crop is made by the frame or the viewport,
                          never by a line floating mid-section.

  john-cutout-dark.webp   the same figure with a hard, honest matte: subject
                          colour in every pixel and almost no partial coverage,
                          so it composites correctly against any ground rather
                          than being tuned to one. A matte pulled from a white
                          backdrop carries light wrap on the silhouette, which glows when
                          composited onto a dark band — the same problem as green spill. Treated
                          the standard keyer way: colour edge-extend (partially covered pixels
                          take the nearest fully opaque colour, so no backdrop-contaminated
                          colour survives), a ~0.6px matte choke, and a narrow negative light
                          wrap. Verified by compositing on the real band colour and profiling
                          luminance inward: it rises monotonically, so no halo, no dark outline.

  john-portrait-round.webp  the dark studio frame, which KEEPS its own background, graded and
                          cropped square on his face for circular use at small sizes.

                          TO GRADE IT BY HAND: put a full-size version at
                          `docs/source-assets/john-dark-levelled.png` (same pixel dimensions as
                          John-Goss-038.jpg, 1800x1440) and it is used verbatim. Without it, a
                          fallback tone curve is applied to luminance only — RGB scaled by the
                          ratio, so hue and saturation are untouched — lifting the mids
                          (median 38 -> 55) and leaving the highlights where they were.
"""
from PIL import Image
import numpy as np, os, sys
from scipy.ndimage import distance_transform_edt
from scipy.interpolate import PchipInterpolator

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
OUT = f"{REPO}/design/assets"
SRC = f"{REPO}/docs/source-assets"
FROM_MASTER = "--from-master" in sys.argv


def knockout():
    src = f"{SRC}/john-light-decontaminated.png"
    if not os.path.exists(src):
        sys.exit(f"missing {src}")
    im = Image.open(src).convert("RGBA")
    im = im.crop(im.getbbox())
    im.save(f"{OUT}/john-cutout.webp", "WEBP", quality=92, alpha_quality=100, exact=True, method=6)
    print(f"  knockout: {im.size[0]}x{im.size[1]}")


def solid_matte():
    """One asset that composites correctly against ANY ground.

    The earlier variants blended their edge toward a specific destination
    colour, which meant one asset per background — and Clear Water has two. The
    fix is to make the matte honest instead of tuned:

      1. colour edge-extend  every partially covered pixel takes the colour of
         the nearest fully opaque pixel, so no backdrop colour survives anywhere
         in the fringe — the RGB is the subject's own, everywhere
      2. choke               pull the matte in past the contaminated coverage
      3. harden the alpha    compress the remaining ramp to about a pixel, so
         there is almost no partial coverage left to carry a wrong colour

    Then `out = subject x alpha + ground x (1 - alpha)` is simply correct for
    whatever ground it lands on. At display size the browser resamples the hard
    edge back to a smooth one, using the subject's colour rather than a guess at
    the background's.
    """
    m = np.array(Image.open(f"{OUT}/john-cutout.webp").convert("RGBA")).astype(np.float32)
    A = m[..., 3:4] / 255.0
    RGB = m[..., :3]
    core = A[..., 0] >= 0.97
    _, ind = distance_transform_edt(~core, return_indices=True)
    RGB2 = RGB[ind[0], ind[1]]                           # 1. subject colour everywhere
    A2 = np.clip((A - 0.30) / 0.55, 0, 1)                # 2. choke
    A3 = np.clip((A2 - 0.5) * 6.0 + 0.5, 0, 1)           # 3. harden to ~1px of ramp
    Image.fromarray(np.dstack([np.clip(RGB2, 0, 255), np.clip(A3 * 255, 0, 255)]).astype(np.uint8),
                    "RGBA").save(f"{OUT}/john-cutout-dark.webp", "WEBP",
                                 quality=92, alpha_quality=100, exact=True, method=6)
    d = np.array(Image.open(f"{OUT}/john-cutout-dark.webp").convert("RGBA")).astype(np.float32)
    aa = d[..., 3:4] / 255.0
    partial = ((aa > 0.02) & (aa < 0.98)).mean() * 100
    print("  solid matte: %.2f%% of pixels carry partial coverage (was ~2.8%%)" % partial)
    for bg in [(7, 32, 40), (30, 98, 120), (247, 244, 238)]:
        bgv = np.array(bg, float)
        comp = d[..., :3] * aa + bgv * (1 - aa)
        cl = 0.2126 * comp[..., 0] + 0.7152 * comp[..., 1] + 0.0722 * comp[..., 2]
        dd = distance_transform_edt(aa[..., 0] > 0.5)
        prof = [float(cl[(dd >= lo) & (dd < hi) & (aa[..., 0] > 0.5)].mean())
                for lo, hi in [(1, 2), (2, 4), (4, 8), (8, 20)]]
        bgl = 0.2126 * bg[0] + 0.7152 * bg[1] + 0.0722 * bg[2]
        print("    on rgb%-16s (lum %3.0f): edge %s  -> rim vs interior %+.1f"
              % (str(tuple(bg)), bgl, " ".join(f"{v:.0f}" for v in prof), prof[0] - prof[-1]))


def round_portrait():
    """If a hand-graded file is present it is used verbatim; otherwise a tone curve
    is applied to luminance only (RGB scaled by the ratio, so hue and saturation
    are untouched), lifting the mids and leaving the highlights alone."""
    graded = f"{SRC}/john-dark-levelled.png"
    o = np.array(Image.open(f"{SRC}/John-Goss-038.jpg").convert("RGB")).astype(np.float32)
    L = 0.2126 * o[..., 0] + 0.7152 * o[..., 1] + 0.0722 * o[..., 2]
    if os.path.exists(graded):
        g = np.array(Image.open(graded).convert("RGB")).astype(np.float32)
        if g.shape[:2] != o.shape[:2]:
            sys.exit(f"{graded} is {g.shape[1]}x{g.shape[0]}, expected {o.shape[1]}x{o.shape[0]}")
        print("  round portrait: using the hand-graded john-dark-levelled.png")
    else:
        X = np.array([0, 12, 30, 55, 95, 130, 165, 200, 255], float)
        Y = np.array([0, 13, 42, 80, 125, 152, 172, 200, 255], float)
        Lp = np.clip(PchipInterpolator(X, Y)(np.clip(L, 0, 255)), 0, 255)
        g = np.clip(o * np.where(L > 1.0, Lp / np.maximum(L, 1e-3), 1.0)[..., None], 0, 255)
    lev = Image.fromarray(g.astype(np.uint8), "RGB")
    side = int(o.shape[0] * 0.93)
    cxh, cyh = 908, int(46 + side * 0.44)               # measured from the subject mask
    left = max(0, min(o.shape[1] - side, cxh - side // 2))
    topc = max(0, min(o.shape[0] - side, cyh - side // 2))
    lev.crop((left, topc, left + side, topc + side)).resize((620, 620), Image.LANCZOS) \
       .save(f"{OUT}/john-portrait-round.webp", "WEBP", quality=90, method=6)
    fh0, fh = o[250:420, 820:1120], g[250:420, 820:1120]
    print("  round portrait: mids %.1f -> %.1f | forehead %.1f -> %.1f (max %.1f)"
          % (np.median(L), np.median(0.2126 * g[..., 0] + 0.7152 * g[..., 1] + 0.0722 * g[..., 2]),
             fh0.mean(), fh.mean(), fh.max()))


if FROM_MASTER:
    print("  keeping design/assets/john-cutout.webp as it stands")
else:
    knockout()
solid_matte()
round_portrait()
for f in ("john-cutout.webp", "john-cutout-dark.webp", "john-portrait-round.webp"):
    print("  %-26s %6.0f KB" % (f, os.path.getsize(f"{OUT}/{f}") / 1024))
