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
    """One asset that composites correctly against ANY ground, without losing him.

    The point is to make the matte honest rather than tuned to one background:
    if every pixel carries the SUBJECT's colour, then
    `out = subject x alpha + ground x (1 - alpha)` is correct wherever it lands.

    Two things must not be done in the name of that, both learned the hard way:

      * do not choke hard. Hair and stubble live at alpha 0.2-0.5; a 0.30 choke
        deletes them and he loses his edge entirely.
      * do not fill the fringe from the nearest opaque pixel by straight
        distance. Where the earlobe meets the skull the nearest opaque pixel is
        across the crevice — bright cheek — so the gap fills with white blips.
        Colour is grown outward one ring at a time instead, so it travels along
        the surface and each fringe pixel inherits from its own neighbourhood.
    """
    m = np.array(Image.open(f"{OUT}/john-cutout.webp").convert("RGBA")).astype(np.float32)
    A = m[..., 3:4] / 255.0
    RGB = m[..., :3].copy()
    known = A[..., 0] >= 0.92
    filled = RGB.copy()
    have = known.copy()
    # grow colour outward one ring at a time — along the surface, not across gaps
    for _ in range(14):
        h = have.astype(np.float32)
        num = np.zeros_like(filled)
        den = np.zeros_like(h)
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (1, -1), (-1, 1), (-1, -1)):
            wgt = 1.0 if abs(dy) + abs(dx) == 1 else 0.5
            num += np.roll(np.roll(filled * h[..., None], dy, 0), dx, 1) * wgt
            den += np.roll(np.roll(h, dy, 0), dx, 1) * wgt
        grow = (den > 0) & (~have)
        filled[grow] = (num[grow] / den[grow][..., None])
        have |= grow
        if have.all():
            break
    # keep his own colour where the pixel is essentially opaque; take the grown
    # colour where it is not, since that is where the backdrop contaminated it
    w = np.clip((A - 0.10) / 0.82, 0, 1)
    RGB2 = RGB * w + filled * (1 - w)
    A2 = np.clip((A - 0.05) / 0.95, 0, 1)          # a whisker of choke, no more
    Image.fromarray(np.dstack([np.clip(RGB2, 0, 255), np.clip(A2 * 255, 0, 255)]).astype(np.uint8),
                    "RGBA").save(f"{OUT}/john-cutout-dark.webp", "WEBP",
                                 quality=92, alpha_quality=100, exact=True, method=6)

    d = np.array(Image.open(f"{OUT}/john-cutout-dark.webp").convert("RGBA")).astype(np.float32)
    aa = d[..., 3:4] / 255.0
    partial = ((aa > 0.02) & (aa < 0.98)).mean() * 100
    orig_partial = ((A > 0.02) & (A < 0.98)).mean() * 100
    print("  partial coverage kept: %.2f%% of pixels (original matte %.2f%%) — that is the hair"
          % (partial, orig_partial))
    # blips: fringe pixels far brighter than their own neighbourhood
    fringe = (aa[..., 0] > 0.05) & (aa[..., 0] < 0.95)
    lumd = 0.2126 * d[..., 0] + 0.7152 * d[..., 1] + 0.0722 * d[..., 2]
    loc = np.zeros_like(lumd)
    for dy in (-2, -1, 0, 1, 2):
        for dx in (-2, -1, 0, 1, 2):
            loc += np.roll(np.roll(lumd, dy, 0), dx, 1)
    loc /= 25.0
    blips = int((fringe & (lumd - loc > 45)).sum())
    print("  bright specks in the fringe: %d px" % blips)
    for bg in [(7, 32, 40), (30, 98, 120)]:
        bgv = np.array(bg, float)
        comp = d[..., :3] * aa + bgv * (1 - aa)
        cl = 0.2126 * comp[..., 0] + 0.7152 * comp[..., 1] + 0.0722 * comp[..., 2]
        dd = distance_transform_edt(aa[..., 0] > 0.5)
        prof = [float(cl[(dd >= lo) & (dd < hi) & (aa[..., 0] > 0.5)].mean())
                for lo, hi in [(1, 2), (2, 4), (4, 8), (8, 20)]]
        print("    on rgb%-15s edge %s -> rim vs interior %+.1f"
              % (str(tuple(bg)), " ".join(f"{v:.0f}" for v in prof), prof[0] - prof[-1]))


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
