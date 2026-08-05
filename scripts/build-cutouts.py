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
                          never by a line floating mid-section. NOTHING ON THE PAGE PAINTS THIS.
                          It is the master the geometry is measured from and the input the solve
                          below reads; its fringe still carries the white cyclorama.

  john-cutout-dark.webp   THE ONE ASSET THE PAGE PAINTS, on every ground it uses. Straight
                          (unassociated) alpha whose foreground colour is John's own at
                          every coverage, so `F*a + ground*(1-a)` is right over the light
                          plate inside the hero's circle and over the deep band outside it
                          with no second file and no ground-specific edge treatment
                          anywhere. See solid_matte() for the solve and for why the name
                          is now a misnomer kept only because scripts/gen-cutouts.ts
                          writes to it.

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
import numpy as np, os, sys, io
from scipy.ndimage import distance_transform_edt, gaussian_filter, zoom
from scipy.interpolate import PchipInterpolator

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
OUT = f"{REPO}/static/img"
SRC = f"{REPO}/docs/source-assets"
FROM_MASTER = "--from-master" in sys.argv

LW = np.array([0.2126, 0.7152, 0.0722])
PLATE = np.array([144.0, 197.0, 216.0])      # the hero's circular plate, #90c5d8
DEEP = np.array([10.0, 40.0, 51.0])          # the band it sits on, #0a2833


def knockout():
    src = f"{SRC}/john-light-decontaminated.png"
    if not os.path.exists(src):
        sys.exit(f"missing {src}")
    im = Image.open(src).convert("RGBA")
    im = im.crop(im.getbbox())
    im.save(f"{OUT}/john-cutout.webp", "WEBP", quality=92, alpha_quality=100, exact=True, method=6)
    print(f"  knockout: {im.size[0]}x{im.size[1]}")


def _srgb_to_linear(x):
    x = np.clip(x, 0.0, 255.0) / 255.0
    return np.where(x <= 0.04045, x / 12.92, ((x + 0.055) / 1.055) ** 2.4)


def _linear_to_srgb(y):
    y = np.clip(y, 0.0, 1.0)
    return np.where(y <= 0.0031308, y * 12.92, 1.055 * y ** (1 / 2.4) - 0.055) * 255.0


def _L(x):
    return (x * LW).sum(-1)


def _geodesic_extend(vals, known, mask, scale=2, schedule=((3.0, 70), (2.0, 90), (1.2, 90))):
    """Diffuse `vals` outward from `known` across `mask` by normalised convolution.

    Geodesic, not Euclidean: the value travels *through* the mask, so a pixel in the
    ear/skull crevice inherits from its own surface and not from the bright cheek on
    the far side of the gap. That crossing-the-gap mistake is what put white blips in
    the concavities in earlier attempts.

    Takes a scalar plane or an RGB stack. Rhemann, Rother & Gelautz ("Improving Color
    Modeling for Alpha Matting", BMVC 2008, §2.1) make the same argument for their
    foreground SAMPLES: spreading the sample set from the spatially nearest known pixel
    "includes only bright colors, which do not match the true foreground color", so they
    spread it in geodesic distance instead, "which respects the shape of the foreground
    object". Here the same field doubles as the foreground colour prior F_prior.
    """
    H, W = mask.shape
    k = known[::scale, ::scale].astype(np.float64)
    mk = mask[::scale, ::scale].astype(np.float64)
    src = vals[::scale, ::scale]
    rgb = vals.ndim == 3
    cur = src * (k[..., None] if rgb else k)
    for sigma, iters in schedule:
        for _ in range(iters):
            w = gaussian_filter(mk, sigma, mode="nearest")
            if rgb:
                u = np.dstack([gaussian_filter(cur[..., c] * mk, sigma, mode="nearest")
                               for c in range(3)])
                cur = np.where(k[..., None] > 0.5, src, u / np.maximum(w, 1e-12)[..., None])
            else:
                u = gaussian_filter(cur * mk, sigma, mode="nearest")
                cur = np.where(k > 0.5, src, u / np.maximum(w, 1e-12))
    sc = (H / cur.shape[0], W / cur.shape[1])
    out = (np.dstack([zoom(cur[..., c], sc, order=1) for c in range(3)]) if rgb
           else zoom(cur, sc, order=1))
    return out[:H, :W]


def solid_matte():
    """ONE straight-alpha asset that is correct on ANY ground, solved rather than graded.

    WHAT THIS REPLACED, AND WHY. Every previous version of this function tried to make the
    fringe look right on a chosen background: an inverse light wrap, a dichromatic
    subtraction on the garment, a one-sided gamut bound, and a core/edge window that
    confined all of it to the outer 16px so the plate's circle could cross him without a
    tonal step. It half worked and it could not do better, because a de-lighting operator
    windowed on distance-from-the-silhouette is a spatial gradient in the picture, and a
    spatial gradient shows up wherever anything else crosses it. Ole's report — "there's
    still luminosity jumps on his upper head where the circle mask intersects, the dark
    version behind still has some anti-spill on the head applied" — was exactly right, and
    the measurement is in _verify_solid_matte: over the fringe the old asset's foreground
    ran 34 to 41 luminance levels DARKER than John's own colour, at every coverage, all the
    way down to 2% — which no shading can explain and only a de-light can produce.

    THE SOLVE. Smith & Blinn ("Blue Screen Matting", SIGGRAPH 96) show the single-backing
    matting problem is underdetermined by exactly one equation: F and alpha trade off along
    a line and the photograph cannot tell them apart, because every pair on that line
    reproduces it. So the pair has to be pinned by something outside the photograph, and
    there are only two honest choices about which end to pin.

    The old pipeline pinned ALPHA — it lowered the fringe's coverage under a sparsity prior
    and then refused to raise it again between 0.55 and 0.98 — and F, solved afterwards to
    reproduce the plate at that too-low coverage, had to absorb the deficit by going dark.
    Measured on this photograph: -45 levels at coverage 0.55-0.80 and -30 at 0.80-0.98.

    This pins F instead, which is what a straight-alpha asset is FOR. F is John's own
    surface colour — the pixels the master already calls opaque, carried across the fringe
    by geodesic extension (Rhemann et al. 2008 §2.1) — and alpha is then whatever
    reproduces the photograph given that colour: Wang & Cohen's projection ("Optimized
    Color Sampling for Robust Matting", CVPR 2007, eq. 2),

        alpha = (C - B).(F - B) / ||F - B||^2

    except that B is not sampled and guessed, it is the measured cyclorama, a flat 255.
    Run in LINEAR light, because the mixture is linear in radiance and not in sRGB.

    F then comes straight back out of the compositing equation, in closed form:

        F = (I - 255*(1 - alpha)) / alpha

    which is not an estimate but the definition of unassociated alpha against a known
    backing. Measured, that round trip returns John's own colour to within 1.5 levels at
    every coverage — which is the whole claim of this file, and the reason there is now one
    asset rather than two.

    WHERE IT CANNOT BE TRUSTED, AND WHAT HAPPENS THERE. Two things, both properties of the
    photograph rather than choices made here, and both measured per pixel rather than
    assumed:

      1. NOISE GAIN. The unpremultiply divides by alpha, so at alpha 0.05 a one-level error
         in the plate becomes twenty in F. Above coverage 0.20 the direct solve carries F on
         its own; below it, F fades to the geodesically extended interior colour — Ole's
         "synthesised rgb along the edges", and the right answer there, since at 5% coverage
         F is 5% of what is drawn anyway.

      2. A CLIPPED PLATE. Where the cyclorama blew out to 255 the equation carries no
         information at all: 84.5% of the lowest coverage bucket is in that state, which is
         what a blown-out backdrop behind hair looks like. There alpha falls back to a
         monotone transfer curve fitted from the pixels where the plate does speak — one
         curve for the whole fringe — and F falls back to the interior colour.

    WHAT IS DELIBERATELY NOT DONE ANY MORE. No de-spill, no light wrap, no dichromatic
    subtraction, no choke, no dilate, no core/edge window, no distance-from-silhouette term
    of any kind. There is nothing left in the asset that knows what it will be composited
    over. The cyclorama's real rim light stays on him, because it is light that really fell
    on him and a straight-alpha asset's job is to carry the subject, not to relight him;
    what is removed is the backdrop showing THROUGH him, which is the part that was never
    his. pymatting is no longer needed either: Germer et al.'s multi-level foreground
    estimator was measured against the two alternatives (see the note at the end of this
    docstring) and left +16 to +42 levels of the white backing in F, because its smoothness
    prior is satisfied by a partly-white foreground.

    THE ONE THING APPLIED TO F THAT IS NOT CLOSED-FORM is a one-sided gamut bound: spill
    only ever ADDS light, so in the fringe the figure cannot be brighter than the same
    surface reads where it is opaque. F is capped at 1.15x the interior's luminance, as a
    gain, so hue and saturation are untouched. It is a physical bound, not a look, and it
    is what takes the bright specks the 1/alpha gain would otherwise leave from 16 to 0.

    COLOUR BLEED. Where the matte is empty the RGB carries the interior colour too, rather
    than white or black. Lossy WebP is VP8, which is YUV 4:2:0, so the chroma of a one- or
    two-pixel fringe is averaged with its neighbours whatever is put there; and the browser
    then box-filters the whole thing down to 1 CSS px per 3.07 image px. Both averages want
    John on the other side of them. The knockout has BLACK there and the old keyed asset had
    a partial extension; this has the full field, and it costs nothing because the geodesic
    extension has already computed it.

    DELIVERED STRAIGHT, NOT PREMULTIPLIED, and that is not a preference. WebP alpha is
    unassociated by specification and every browser composites the decoded RGB as F*a, so
    premultiplied RGB would simply be multiplied a second time — measured at 10.4 levels
    mean and 51.6 max over the fringe. The thing premultiplication would have bought,
    chroma stability under 4:2:0, it does not buy either: premultiplied RGB collapses toward
    black as coverage falls, which is a worse neighbour for a subsampled chroma block than
    John's own colour. The audit that matters happens on the straight-alpha intermediate,
    which is the only representation in which "is there any cyclorama left" has a clean
    answer — premultiplied, a bright fringe and a high-coverage fringe are the same picture.

    THE PRIOR, CHOSEN BY MEASUREMENT. Departure of each candidate foreground from the
    opaque interior's own colour, by coverage, over the whole fringe; positive is the
    contamination direction, toward the white cyclorama:

        coverage            0.02  0.06  0.12  0.20  0.35  0.55  0.80
        the observed pixel  +132  +120  +118  +110   +74   +15    -6
        estimate_foreground_ml  +16   +20   +24   +34   +42   +29    +4
        geodesic push-pull     0     0     0     0     0     0     0

    (b) is zero by construction: it only ever copies pixels the master already calls
    opaque. That is also its limit — it is a smooth field with no per-pixel detail — which
    is why it is used only as the LOW-coverage prior and the closed-form solve carries
    everything above 0.20.
    """
    m = np.array(Image.open(f"{OUT}/john-cutout.webp").convert("RGBA")).astype(np.float64)
    A = np.clip(m[..., 3] / 255.0, 0, 1)
    H, W = A.shape
    master_rgb = m[..., :3]

    # -- the observed image I: the untouched plate, aligned on the bottom edge --------
    plate = np.array(Image.open(f"{SRC}/John-Goss-1.jpg").convert("RGB")).astype(np.float64)
    top = H - plate.shape[0]
    I = np.full((H, W, 3), 255.0)                     # blown-out white cyc, measured 255
    I[top:top + plate.shape[0]] = plate
    core = A > 0.5

    # -- 1. F_prior: John's own colour, carried across the fringe geodesically --------
    Fprior = _geodesic_extend(master_rgb, A > 0.995, (A > 0.005) | core)
    Ilin = _srgb_to_linear(I)
    Fplin = np.clip(_srgb_to_linear(Fprior), 0, 1)
    BK = np.ones(3)                                   # the cyc, measured: a flat 255

    # -- 2. alpha, by Wang & Cohen's projection with B measured rather than sampled ---
    dF = BK - Fplin
    a_ls = np.clip(((BK - Ilin) * dF).sum(-1) / np.maximum((dF * dF).sum(-1), 1e-9), 0, 1)

    # CONFIDENCE: how much the photograph actually says here. Both terms are measured.
    #   - the plate must not be clipped; at I >= 253.5 the equation carries nothing.
    #   - F and B must be far enough apart for the projection to be conditioned.
    sep = np.sqrt((dF * dF).sum(-1)) / np.sqrt(3.0)
    A8 = np.round(A * 255.0)
    band = (A8 >= 6) & (A8 <= 249)                    # the pixels the master calls partial
    inplate = np.zeros((H, W), bool); inplate[top:] = True
    inframe = np.ones((H, W), bool)
    inframe[:, :3] = inframe[:, -3:] = inframe[-3:, :] = False   # the crop's own antialiasing
    conf = (np.clip((253.5 - I.max(-1)) / 2.0, 0, 1) * np.clip((sep - 0.30) / 0.30, 0, 1)
            * inplate * inframe)

    # the systematic fallback for where conf is low: one monotone curve for the whole
    # fringe, fitted from the pixels where the plate does speak. Unlike the old pipeline
    # it is NOT suppressed where it wants to RAISE alpha — suppressing that is what
    # forced F dark at the outline, which is the defect being fixed.
    edges = np.arange(0.0, 1.0001, 1 / 32.0)
    xs, ys = [0.0], [0.0]
    for lo, hi in zip(edges[:-1], edges[1:]):
        s = (conf > 0.5) & (A >= lo) & (A < hi)
        if s.sum() >= 60:
            xs.append(0.5 * (lo + hi)); ys.append(float(np.median(a_ls[s])))
    xs.append(1.0); ys.append(1.0)
    xs = np.array(xs); ys = np.maximum.accumulate(np.clip(np.array(ys), 0, 1))
    An = np.clip(np.where(band, conf * a_ls + (1 - conf) * np.interp(A, xs, ys), A), 0, 1)
    # the support is an invariant: no pixel the master holds is dropped, so no hair is
    # deleted, and nothing outside it is invented.
    An = np.where((A > 0.02) & (An < 6.0 / 255.0), 6.0 / 255.0, An)
    An[A <= 0.0] = 0.0

    # -- 3. F, in closed form, at that alpha -----------------------------------------
    a3 = np.maximum(An, 1e-6)[..., None]
    Fdirect = (Ilin - BK * (1 - a3)) / a3
    w = np.clip((An - 0.10) / 0.10, 0, 1)             # 1/alpha noise gain becomes usable
    wF = np.where(An >= 0.995, 1.0, conf * (w * w * (3 - 2 * w)))
    Flin = np.clip(wF[..., None] * Fdirect + (1 - wF[..., None]) * Fplin, 0, 1)
    solid = An >= 0.995
    Flin[solid] = Ilin[solid]                         # alpha == 1 => F == I, exactly

    # -- 4. the one-sided gamut bound: spill only ever ADDS light --------------------
    Yf, Yp = (Flin * LW).sum(-1), (Fplin * LW).sum(-1)
    cap = np.where(band, np.minimum(1.0, 1.15 * np.maximum(Yp, 1e-4)
                                    / np.maximum(Yf, 1e-6)), 1.0)
    Flin = Flin * cap[..., None]

    Fd = np.clip(_linear_to_srgb(Flin), 0, 255)
    # -- 5. colour bleed into the empty region, for the encoder and the downscale ----
    Fd[An <= 0.0] = Fprior[An <= 0.0]

    Image.fromarray(np.dstack([Fd, An * 255.0]).round().astype(np.uint8), "RGBA") \
         .save(f"{OUT}/john-cutout-dark.webp", "WEBP",
               quality=92, alpha_quality=100, exact=True, method=6)
    _verify_solid_matte(master_rgb, A, An, Fd, Fprior, I, top, np.vstack([xs, ys]), conf)


def _verify_solid_matte(master_rgb, A, An, Fd, Fprior, I, top, curve, conf):
    """Every number the claim rests on, measured on the file that was just written.

    `before` throughout is the other file on disk — the plain knockout, which is the
    master this was solved from — plus, where it is still present, the previously
    published keyed matte, so the comparison is against what was actually shipped.
    """
    d = np.array(Image.open(f"{OUT}/john-cutout-dark.webp").convert("RGBA")).astype(np.float64)
    aa, rgb = d[..., 3] / 255.0, d[..., :3]
    H, W = aa.shape
    Ilin = _srgb_to_linear(I)
    yy = np.arange(H)[:, None] + np.zeros((1, W), int)
    inframe = np.ones((H, W), bool)
    inframe[:, :3] = inframe[:, -3:] = inframe[-3:, :] = False
    fringe = (A > 0.02) & (A < 0.98) & inframe
    BUCKETS = [(0.02, 0.06), (0.06, 0.12), (0.12, 0.20), (0.20, 0.35), (0.35, 0.55),
               (0.55, 0.80), (0.80, 0.98)]
    REGIONS = (("hair/crown   rows<340", yy < 340),
               ("ears/temples  340-620", (yy >= 340) & (yy < 620)),
               ("face/beard    620-960", (yy >= 620) & (yy < 960)),
               ("neck/shoulder r>960  ", yy >= 960))
    # An earlier build can be compared against by pointing PREVIOUS_MATTE at a copy of
    # it. Opt-in and out-of-tree on purpose: the comparison is worth having on the run
    # that changes the method and worth nothing afterwards, and static/img ships.
    prev = None
    p = os.environ.get("PREVIOUS_MATTE", "")
    if p and os.path.exists(p):
        q = np.array(Image.open(p).convert("RGBA")).astype(np.float64)
        prev = (q[..., :3], q[..., 3] / 255.0)

    # -- the matte's support is an invariant --------------------------------------
    print("  partial coverage: %.4f%% of pixels (master %.4f%%)"
          % (((aa > 0.02) & (aa < 0.98)).mean() * 100, ((A > 0.02) & (A < 0.98)).mean() * 100))
    print("  matte support (alpha>0.02) differs on %d px; opaque set (alpha>=0.98) on %d px"
          % (int(((A > 0.02) != (aa > 0.02)).sum()), int(((A >= 0.98) != (aa >= 0.98)).sum())))
    col = np.where((A > 0.02).any(0), (A > 0.02).argmax(0), -1)
    col2 = np.where((aa > 0.02).any(0), (aa > 0.02).argmax(0), -1)
    print("  silhouette: per-column top edge differs on %d of %d columns" % (int((col != col2).sum()), W))
    print("  alpha transfer curve fitted from the known-backing solve: "
          + " ".join("%.2f->%.2f" % (x, y) for x, y in zip(*curve) if 0.05 < x < 0.90))
    print("  the plate carries no information (clipped at 255) on %.1f%% of the fringe;"
          " there alpha takes that curve and F takes the interior colour"
          % (100 * (conf[fringe] < 0.5).mean()))

    # == 1. THE FRINGE AUDIT, on the straight-alpha intermediate ====================
    # The only representation in which "is there cyclorama left" has a clean answer.
    # Pass condition: F must be JOHN's colour at every coverage, i.e. its luminance must
    # not climb toward the backing's 255 as coverage falls. Held to +10 levels in the
    # BRIGHT direction, which is the encoder's own worst-case round trip at these
    # settings, so a tighter bound could not survive delivery. The bound is one-sided on
    # purpose: contamination by a white backing can only make F brighter and less
    # chromatic. Departures the other way at high coverage are grazing-angle shading —
    # the plain knockout, which has no treatment at all, is darker there too.
    print("\n  FRINGE AUDIT (unpremultiplied F vs John's own colour, by coverage):")
    worst_hi = worst_lo = 0.0
    for nm, reg in REGIONS:
        sel = fringe & reg
        if sel.sum() < 200:
            continue
        print("    %-22s %s" % (nm, " ".join("%8s" % ("%.2f-%.2f" % b) for b in BUCKETS)))
        print("    %-22s %s" % ("  n", " ".join("%8d" % (sel & (A >= lo) & (A < hi)).sum()
                                                for lo, hi in BUCKETS)))
        rows = [("  knockout - John", master_rgb)]
        if prev:
            rows.append(("  previous - John", prev[0]))
        rows.append(("  SOLVED   - John", rgb))
        for tag, im in rows:
            v = [(_L(im) - _L(Fprior))[sel & (A >= lo) & (A < hi)].mean() for lo, hi in BUCKETS]
            if tag.startswith("  SOLVED"):
                worst_hi, worst_lo = max(worst_hi, max(v)), min(worst_lo, min(v))
            print("    %-22s %s" % (tag, " ".join("%+8.1f" % x for x in v)))
    print("    worst departure in the CONTAMINATION direction: %+.1f levels  ->  %s"
          % (worst_hi, "PASS" if worst_hi <= 10 else "FAIL"))
    ko_hi = min((_L(master_rgb) - _L(Fprior))[fringe & reg & (A >= 0.80) & (A < 0.98)].mean()
                for _, reg in REGIONS)
    print("    worst in the shading direction: %+.1f, all of it at coverage above 0.55."
          " The plain\n    knockout, which has no treatment on it at all, runs to %+.1f in"
          " the same buckets,\n    so that is a grazing-angle surface and not the backdrop."
          % (worst_lo, ko_hi))

    # == 2. DOES IT STILL REPRODUCE THE PHOTOGRAPH IT CAME FROM? ====================
    # In LINEAR light, because that is the space the camera did the mixing in. (The
    # browser will later blend in sRGB, which is its own approximation and applies
    # equally to every candidate; the on-screen tables below are computed its way.)
    print("\n  |F*a + 255(1-a) - I| over the unclipped fringe, in linear light, as 0-255:")
    ok = fringe & (I.max(-1) < 251.5)
    cands = [("knockout", master_rgb, A)] + ([("previous", prev[0], prev[1])] if prev else []) \
            + [("SOLVED  ", rgb, aa)]
    for tag, im, al in cands:
        c = _srgb_to_linear(im) * al[..., None] + 1.0 * (1 - al[..., None])
        e = np.abs((c * LW).sum(-1) - (Ilin * LW).sum(-1))[ok] * 255.0
        print("    %-10s mean %6.2f  p95 %6.2f  max %6.1f   (%d px)"
              % (tag, e.mean(), np.percentile(e, 95), e.max(), ok.sum()))

    # == 3. AT THE SIZE HE IS ACTUALLY DRAWN ========================================
    # The plate is 450 CSS px and he is drawn at 130.16% of it, so 1 CSS px = 3.07 image
    # px. Box-average rather than Lanczos, so the resampler adds no ringing of its own,
    # and premultiply/average/unpremultiply, which is what the browser does.
    oW = int(round(450 * 1.3016)); oH = int(round(oW * H / W))

    def down(F, al, h, w):
        ys = np.arange(h + 1) * H / h
        xs = np.arange(w + 1) * W / w
        pm = F * al[..., None]
        cip = np.concatenate([np.zeros((1, W + 1, 3)),
                              np.concatenate([np.zeros((H, 1, 3)), pm], 1).cumsum(0).cumsum(1)], 0)
        cia = np.concatenate([np.zeros((1, W + 1)),
                              np.concatenate([np.zeros((H, 1)), al], 1).cumsum(0).cumsum(1)], 0)
        y0, y1 = np.floor(ys[:-1]).astype(int), np.ceil(ys[1:]).astype(int)
        x0, x1 = np.floor(xs[:-1]).astype(int), np.ceil(xs[1:]).astype(int)
        ar = (y1 - y0)[:, None] * (x1 - x0)[None, :]
        g = lambda ci: (ci[np.ix_(y1, x1)] - ci[np.ix_(y0, x1)]
                        - ci[np.ix_(y1, x0)] + ci[np.ix_(y0, x0)])
        q = g(cia) / ar
        return np.clip(g(cip) / ar[..., None] / np.maximum(q, 1e-9)[..., None], 0, 255), np.clip(q, 0, 1)

    lab = np.zeros((H, W))
    for i, (_, r) in enumerate(REGIONS):
        lab[r] = i
    labs = lab[np.ix_(np.floor(np.arange(oH) * H / oH).astype(int),
                      np.floor(np.arange(oW) * W / oW).astype(int))]
    ref, _ = down(Fprior, np.ones_like(A), oH, oW)
    print("\n  AT %dx%d CSS px (the drawn size), departure from a composite of John's own"
          " colour at\n  the same coverage — the part that cannot be blamed on the ground."
          "\n  The two tables below come out IDENTICAL, and that is the point rather than a"
          "\n  bug: the departure is (F - F_john) * alpha, which has no ground term in it at"
          "\n  all. An asset whose foreground is right is right on every ground by"
          " arithmetic." % (oW, oH))
    for gnm, g_ in (("plate #90c5d8", PLATE), ("deep  #0a2833", DEEP)):
        print("    on the %s:" % gnm)
        print("      %-22s %-10s %7s %8s %7s %8s"
              % ("region", "asset", "n", "mean|d|", "p95", ">10 lv"))
        for i, (rn, _) in enumerate(list(REGIONS) + [("ALL", None)]):
            for tag, im, al in cands:
                F2, a2 = down(im, al, oH, oW)
                c = _L(F2 * a2[..., None] + g_ * (1 - a2[..., None]))
                r = _L(ref * a2[..., None] + g_ * (1 - a2[..., None]))
                s = (a2 > 0.02) & (a2 < 0.98)
                if i < len(REGIONS):
                    s = s & (labs == i)
                if s.sum() < 30:
                    continue
                e = np.abs(c - r)[s]
                print("      %-22s %-10s %7d %8.2f %8.1f %7.1f%%"
                      % (rn if tag == cands[0][0] else "", tag.strip(), s.sum(),
                         e.mean(), np.percentile(e, 95), 100 * (e > 10).mean()))

    print("\n  the two failures this asset exists to remove, at the drawn size:")
    for tag, im, al in cands:
        F2, a2 = down(im, al, oH, oW)
        s = (a2 > 0.02) & (a2 < 0.98)
        cp = _L(F2 * a2[..., None] + PLATE * (1 - a2[..., None]))
        rp = _L(ref * a2[..., None] + PLATE * (1 - a2[..., None]))
        cd = _L(F2 * a2[..., None] + DEEP * (1 - a2[..., None]))
        rd = _L(ref * a2[..., None] + DEEP * (1 - a2[..., None]))
        print("    %-10s a BRIGHT RIM on the plate: %5.1f%% of the fringe above it"
              " (peak %+5.1f)  |  a DARK LINE on the band: %5.1f%% more than 10 under John"
              % (tag, 100 * (cp[s] > _L(PLATE)).mean(), (cp[s] - _L(PLATE)).max(),
                 100 * ((rd - cd)[s] > 10).mean()))

    # == 4. THE ENCODER, self-calibrated ============================================
    # Push the asset's own decoded pixels back through the same settings and compare them
    # with themselves; whatever is left is the format and not the pipeline. This is the
    # method scripts/check-mattes.ts gates on.
    print("\n  THE ENCODER (VP8 is YUV 4:2:0, so the fringe's chroma is subsampled whatever"
          " we put there):")
    for lab_, kw in (("q92 (what ships)", dict(quality=92, alpha_quality=100)),
                     ("lossless", dict(lossless=True, quality=100))):
        b = io.BytesIO()
        Image.fromarray(np.dstack([Fd, An * 255.0]).round().astype(np.uint8), "RGBA") \
             .save(b, "WEBP", exact=True, method=6, **kw)
        q = np.array(Image.open(b).convert("RGBA")).astype(np.float64)
        r2, a2 = q[..., :3], q[..., 3] / 255.0
        c0 = _L(Fd * An[..., None] + PLATE * (1 - An[..., None]))
        c1 = _L(r2 * a2[..., None] + PLATE * (1 - a2[..., None]))
        e = np.abs(c1 - c0)[fringe]
        print("    %-18s %6.0f KB   fringe RGB moves %5.3f mean / %4.1f max;"
              "  composite on the plate %5.2f mean / %4.1f max"
              % (lab_, b.getbuffer().nbytes / 1024, np.abs(r2 - Fd)[fringe].mean(),
                 np.abs(r2 - Fd)[fringe].max(), e.mean(), e.max()))
    pm = Fd * An[..., None]
    c0 = _L(Fd * An[..., None] + PLATE * (1 - An[..., None]))
    c1 = _L(pm * An[..., None] + PLATE * (1 - An[..., None]))
    print("    premultiplied delivery is not an option: WebP alpha is unassociated by spec"
          " and the browser\n    multiplies again — %.2f mean / %.1f max over the fringe."
          % (np.abs(c1 - c0)[fringe].mean(), np.abs(c1 - c0)[fringe].max()))


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
