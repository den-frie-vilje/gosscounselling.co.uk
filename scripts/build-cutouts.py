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

  john-cutout-dark.webp   the same figure, same matte, with the white cyclorama taken back
                          out of his COLOUR so `F*a + ground*(1-a)` is right on any ground.
                          Two published steps, both in solid_matte() below: fast multi-level
                          foreground estimation (Germer et al., ICPR 2020, via PyMatting) for
                          the partially covered pixels, then an inverse light wrap — a fitted
                          per-pixel gain 1/(1+psi) in linear light — for the real rim light the
                          backdrop threw onto his shoulders. The matte is the client's,
                          verbatim: no choke, no dilate, so the silhouette and the retouched
                          crown cannot move. Needs `python3 -m pip install pymatting`.

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


def _srgb_to_linear(x):
    x = np.clip(x, 0.0, 255.0) / 255.0
    return np.where(x <= 0.04045, x / 12.92, ((x + 0.055) / 1.055) ** 2.4)


def _linear_to_srgb(y):
    y = np.clip(y, 0.0, 1.0)
    return np.where(y <= 0.0031308, y * 12.92, 1.055 * y ** (1 / 2.4) - 0.055) * 255.0


def _geodesic_extend(vals, known, mask, scale=2, schedule=((3.0, 70), (2.0, 90), (1.2, 90))):
    """Diffuse `vals` outward from `known` across `mask` by normalised convolution.

    Geodesic, not Euclidean: the value travels *through* the mask, so a pixel in the
    ear/skull crevice inherits from its own surface and not from the bright cheek on
    the far side of the gap. That crossing-the-gap mistake is what put white blips in
    the concavities in earlier attempts.
    """
    H, W = mask.shape
    k = known[::scale, ::scale].astype(np.float64)
    mk = mask[::scale, ::scale].astype(np.float64)
    src = vals[::scale, ::scale]
    cur = src * k
    for sigma, iters in schedule:
        for _ in range(iters):
            u = gaussian_filter(cur * mk, sigma, mode="nearest")
            w = gaussian_filter(mk, sigma, mode="nearest")
            cur = np.where(k > 0.5, src, u / np.maximum(w, 1e-12))
    out = zoom(cur, (H / cur.shape[0], W / cur.shape[1]), order=1)
    return out[:H, :W]


def solid_matte():
    """The dark-ground cutout: straight alpha that is correct on ANY background.

    `out = F * alpha + ground * (1 - alpha)` is only right if F is the SUBJECT's own
    colour — not the colour he had in front of a white cyclorama. Two separate things
    contaminate F here, and the literature treats them as two separate problems:

    1. MATTE CONTAMINATION — partially covered pixels are a mixture of him and the
       backdrop. Solved by estimating F from the plate and the matte, using
       "Fast Multi-Level Foreground Estimation" (Germer, Uelwer, Conrad & Harmeling,
       ICPR 2020, arXiv:2006.14970), as shipped in PyMatting
       (`pymatting.estimate_foreground_ml`). It minimises Levin, Lischinski & Weiss's
       closed-form F/B colour cost ("A Closed-Form Solution to Natural Image Matting",
       PAMI 30(2) 2008, eq. 2) — the compositing residual plus alpha-gradient-weighted
       smoothness on F and B — as a 2x2 local solve run over an image pyramid, so
       foreground colour propagates a long way into the transparent region.

       This is what replaces the hand-rolled fills. It is not a fill: nothing is
       chosen by distance, so the earlobe/skull concavity cannot inherit the cheek
       across the gap, and nothing is blended toward a chosen ground, so the asset is
       not tuned to one background.

    2. BACKDROP RIM LIGHT — the white cyc is a large area source and threw real light
       onto his silhouette. It is in the plate, so unpremultiplying cannot touch it.
       Smith & Blinn ("Blue Screen Matting", SIGGRAPH 96, "Blue Spill") model exactly
       this as an extra additive layer alpha_s * C_k carried by the foreground, and
       leave it open. With a WHITE backing the usual Vlahos/Ultimatte channel-
       difference despill degenerates — the spill is achromatic, so there is no hue to
       key on — and only the SPATIAL signature is left. Nuke's LightWrap builds that
       signature the other way round: blur the matte, multiply by the backdrop, add.
       So we invert it.

       Illumination is additive and albedo is multiplicative, so in linear light
           F_observed = rho * (E_key + E_backdrop),  F_wanted = rho * E_key
           F_wanted = F_observed / (1 + psi),        psi = E_backdrop / E_key
       A per-pixel GAIN. That is the de-lighting formulation used for photogrammetry
       textures (Unity Labs / Lagarde, De-Lighting Tool) and the shading half of an
       intrinsic decomposition (Aksoy et al., "Colorful Diffuse Intrinsic Image
       Decomposition in the Wild", SIGGRAPH Asia 2024) — divide the illumination out,
       leave the albedo alone. Because it is a gain, hair and stubble keep their
       contrast and hue exactly; a blunt subtraction would flatten them.

       psi is fitted, not dialled: the excess of measured luminance over the interior
       shading (extrapolated geodesically out to the silhouette) is regressed onto two
       LightWrap kernels — Gaussian blurs of (1 - alpha) at 6px and 30px — with the
       amplitudes smoothed along the silhouette so only the low-frequency lighting
       term is taken and per-strand detail is not. psi is forced to zero by 55px in,
       so the interior of the shirt is bit-identical to the master.

    The matte itself is NOT touched: alpha is the client's, verbatim. No choke — hair
    lives at alpha 0.2-0.5 and a choke deletes it — and no dilate, so the silhouette
    and the retouched crown are unchanged by construction.
    """
    try:
        from pymatting import estimate_foreground_ml
    except ImportError:
        sys.exit("solid_matte needs pymatting:  python3 -m pip install pymatting")

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
    D = distance_transform_edt(core)
    DREF, SIG_NEAR, SIG_WIDE, SIG_FIT, PSI_MAX = 55.0, 6.0, 30.0, 40.0, 3.0
    # The client's file is the authority wherever the backdrop cannot have reached: on
    # solid pixels, deep inside the figure, and in the crown he painted above the plate.
    settled = (A > 0.995) | (D >= DREF)
    settled[:top] |= A[:top] > 0.02
    I[settled] = master_rgb[settled]

    # -- 1. foreground colour estimation (Germer et al. 2020) ------------------------
    F = estimate_foreground_ml(np.clip(I / 255.0, 0, 1), A,
                               regularization=5e-3, gradient_weight=0.1) * 255.0
    F[settled] = I[settled]                           # alpha == 1 => F == I, exactly

    # -- 2. inverse light wrap: fit psi = E_backdrop / E_key, divide it out -----------
    Flin = _srgb_to_linear(F)
    Y = (Flin * np.array([0.2126, 0.7152, 0.0722])).sum(-1)
    # what the shading would be with no backdrop: the interior, pushed out to the edge
    Ybase = np.maximum(_geodesic_extend(Y, core & (D >= DREF), core), 1e-6)
    excess = np.clip(np.where(core, Y / Ybase - 1.0, 0.0), -1.0, 8.0)

    W1 = np.clip(2.0 * gaussian_filter(1.0 - A, SIG_NEAR, mode="nearest"), 0, 1)
    W2 = np.clip(2.0 * gaussian_filter(1.0 - A, SIG_WIDE, mode="nearest"), 0, 1)
    fit = (core & (D < DREF * 2)).astype(np.float64)
    G = lambda x: gaussian_filter(x, SIG_FIT, mode="nearest")
    M11, M12, M22 = G(W1 * W1 * fit) + 1e-3, G(W1 * W2 * fit), G(W2 * W2 * fit) + 1e-3
    b1, b2 = G(excess * W1 * fit), G(excess * W2 * fit)
    det = M11 * M22 - M12 * M12
    a1 = np.where(np.abs(det) > 1e-12, (M22 * b1 - M12 * b2) / det, 0.0)
    a2 = np.where(np.abs(det) > 1e-12, (M11 * b2 - M12 * b1) / det, 0.0)
    psi = np.clip(a1 * W1 + a2 * W2, 0.0, PSI_MAX)
    t = np.clip((DREF - D) / (DREF * 0.35), 0, 1)      # hard off by DREF: interior untouched
    psi = gaussian_filter(psi, 8.0, mode="nearest") * (t * t * (3 - 2 * t))
    Fd = np.clip(_linear_to_srgb(Flin / (1.0 + psi)[..., None]), 0, 255)

    Image.fromarray(np.dstack([Fd, A * 255.0]).round().astype(np.uint8), "RGBA") \
         .save(f"{OUT}/john-cutout-dark.webp", "WEBP",
               quality=92, alpha_quality=100, exact=True, method=6)
    _verify_solid_matte(master_rgb, A, F, Fd, psi, D, core)


def _verify_solid_matte(master_rgb, A, F, Fd, psi, D, core):
    """Every number the brief asks for, measured on the file that was just written."""
    d = np.array(Image.open(f"{OUT}/john-cutout-dark.webp").convert("RGBA")).astype(np.float64)
    aa, rgb = d[..., 3] / 255.0, d[..., :3]
    H, W = aa.shape
    L = lambda x: 0.2126 * x[..., 0] + 0.7152 * x[..., 1] + 0.0722 * x[..., 2]

    # -- matte: kept verbatim, so hair survives and the silhouette cannot have moved --
    print("  partial coverage: %.2f%% of pixels (master %.2f%%) — the hair band is intact"
          % (((aa > 0.02) & (aa < 0.98)).mean() * 100, ((A > 0.02) & (A < 0.98)).mean() * 100))
    print("  alpha vs master: max abs difference %d/255 over %d px"
          % (np.abs(aa - A).max() * 255, aa.size))
    col = np.where((A > 0.02).any(0), (A > 0.02).argmax(0), -1)
    col2 = np.where((aa > 0.02).any(0), (aa > 0.02).argmax(0), -1)
    print("  silhouette + crown: per-column top edge differs on %d of %d columns (max %d px)"
          % (int((col != col2).sum()), W, int(np.abs(col - col2).max())))

    # -- bright specks in the fringe (pixel far brighter than its own 5x5) ------------
    def specks(img, alpha, region=None):
        fr = (alpha > 0.05) & (alpha < 0.95)
        if region is not None:
            fr = fr & region
        lum = L(img)
        loc = sum(np.roll(np.roll(lum, dy, 0), dx, 1)
                  for dy in (-2, -1, 0, 1, 2) for dx in (-2, -1, 0, 1, 2)) / 25.0
        return int((fr & (lum - loc > 45)).sum())

    ear = np.zeros((H, W), bool)                      # where the earlobes meet the skull
    ear[560:700, 480:760] = True
    ear[560:700, 1180:1460] = True
    print("  bright specks in the fringe: %d px (master %d)"
          % (specks(rgb, aa), specks(master_rgb, A)))
    print("  bright specks in the ear/skull concavities: %d px (master %d)"
          % (specks(rgb, aa, ear), specks(master_rgb, A, ear)))

    # -- composites: luminance by depth into the silhouette, three grounds ------------
    dd = distance_transform_edt(aa > 0.5)
    bands = [(1, 2), (2, 4), (4, 8), (8, 20)]
    for bg in [(7, 32, 40), (30, 98, 120), (247, 244, 238)]:
        for tag, img, al in (("master", master_rgb, A), ("new   ", rgb, aa)):
            cl = L(img * al[..., None] + np.array(bg, float) * (1 - al[..., None]))
            p = [float(cl[(dd >= lo) & (dd < hi) & (aa > 0.5)].mean()) for lo, hi in bands]
            print("    on rgb%-16s %s  1px %s  rim vs 8-20px %+6.1f"
                  % (str(tuple(bg)), tag, " ".join("%5.1f" % v for v in p), p[0] - p[-1]))

    # -- shoulder rim: measured on the shoulders only, before and after ---------------
    rows, cols = np.arange(H)[:, None], np.arange(W)[None, :]
    shoulder = (aa > 0.9) & (rows > 1010)
    print("  shoulder rim, mean luminance by depth (the backdrop's own rim light):")
    for name, sel in (("near shoulder (left of frame)", shoulder & (cols < 880)),
                      ("far shoulder                 ", shoulder & (cols >= 880))):
        for tag, img in (("before", F), ("after ", rgb)):
            p = [float(L(img)[sel & (dd >= lo) & (dd < hi)].mean())
                 for lo, hi in [(1, 4), (4, 8), (8, 20), (20, 55), (80, 200)]]
            print("    %s %s  %s   edge vs interior %+6.1f"
                  % (name, tag, " ".join("%5.1f" % v for v in p), p[0] - p[-1]))
    deep = shoulder & (dd > 80)
    buf = io.BytesIO()
    Image.fromarray(np.dstack([master_rgb, A * 255.0]).round().astype(np.uint8), "RGBA") \
         .save(buf, "WEBP", quality=92, alpha_quality=100, exact=True, method=6)
    floor = np.abs(np.array(Image.open(buf).convert("RGBA")).astype(np.float64)[..., :3]
                   - master_rgb)[deep]
    print("  shirt interior (>80px in): %.3f/255 mean before the encode (max %.1f);"
          " re-encoding the master alone already costs %.3f (max %.1f)"
          % (np.abs(Fd - master_rgb)[deep].mean(), np.abs(Fd - master_rgb)[deep].max(),
             floor.mean(), floor.max()))
    print("  rim gain applied to %.1f%% of the figure, strongest 1/(1+psi) = %.2f"
          % ((psi[core] > 0.02).mean() * 100, 1.0 / (1.0 + psi.max())))


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
