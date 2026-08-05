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

  john-cutout-dark.webp   the same figure, same silhouette, with the white cyclorama taken
                          back out of BOTH his colour and his matte, so `F*a + ground*(1-a)`
                          is right on any ground. Six published steps, all in solid_matte()
                          below: a known-backing re-solve of alpha in the fringe (Wang &
                          Cohen 2007 eq. 2 with B measured rather than sampled, under the
                          sparsity prior of Rhemann et al. 2008); fast multi-level foreground
                          estimation (Germer et al., ICPR 2020, via PyMatting); a one-sided
                          foreground-gamut bound; and an inverse light wrap for the real rim
                          light the backdrop threw onto him. That last step is TWO operators,
                          because the rim light is two things: on skin and hair it is light
                          reflected by the albedo, so it comes out as a fitted per-pixel gain
                          1/(1+psi) in linear light; on the navy tee it is the dichromatic
                          INTERFACE term (Shafer 1985), illuminant-coloured and additive, so
                          it comes out as a measured per-pixel SUBTRACTION. Using the gain on
                          the tee was what made the shoulders read as desaturated rather than
                          darkened. Both de-lighting operators are then confined to an EDGE
                          BAND — a core/edge split through a C2 transition window, off by
                          16px — so the interior is the plain knockout's own pixels and the
                          sand plate's circle can cross him anywhere without a tonal step.
                          No choke and no dilate: the matte's support, its
                          per-column top edge and the retouched crown's shape are
                          bit-identical to the master, and partial coverage stays at 1.872%.
                          Needs `python3 -m pip install pymatting`.

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
from scipy.ndimage import distance_transform_edt, gaussian_filter, zoom, binary_dilation
from scipy.interpolate import PchipInterpolator

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
OUT = f"{REPO}/static/img"
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

    3. ALPHA CONTAMINATION — the one that (1) and (2) cannot reach. Where the backdrop
       shows BETWEEN hairs, the true answer is a low alpha over a dark F. If the matte
       instead says high alpha, the backdrop's luminance has been baked into the MATTE,
       and no foreground estimator can take it out again: alpha is an input to both of
       the steps above. Measured here on the client's master, over the fringe pixels
       where the plate is not clipped: at alpha 0.10-0.30 the photograph implies a
       median alpha of 0.03, at 0.30-0.50 it implies 0.15. The matte is a soft ramp
       where the picture is nearly binary — the "blurry artifacts" that Rhemann, Rother
       & Gelautz (BMVC 2008, §2.3) counter with a SPARSITY PRIOR, "a sparsity prior
       that pushes alpha towards 0 or 1", on the grounds that "mixed pixels are very
       likely to occur only at the boundary of an object and most parts of the image
       belong to either exclusively fore- or background".

       Here that prior does not have to be guessed at, because the backing is KNOWN.
       Smith & Blinn show the single-backing matting problem is underdetermined by
       exactly one equation; supply one and it closes. The one supplied is the local
       foreground colour F_prior, taken by geodesic extension of the pixels the client
       already calls opaque (Rhemann et al. §2.1). Alpha then follows from Wang &
       Cohen's projection ("Optimized Color Sampling for Robust Matting", CVPR 2007,
       eq. 2), alpha = (C - B).(F - B) / ||F - B||^2 — except that B is not sampled and
       guessed, it is the measured cyclorama, a flat 255. Run in LINEAR light, because
       the mixture is linear in radiance and not in sRGB.

       Applied as: a monotone transfer curve fitted from that solve (the systematic
       softness, one curve for the whole fringe), times a spatially smoothed local
       residual (the departure from it, e.g. a crevice). Never raised, only lowered;
       floored so that every pixel with alpha > 0.02 keeps alpha > 0.02. So this is
       NOT a choke: no pixel is removed from the matte, the support and the silhouette
       are bit-identical, and partial coverage stays at 1.872% of the image. It is a
       re-shaping of the ramp, at a fixed composite against the cyclorama the picture
       was actually shot on.

       Two things are deliberately NOT done. The fitted curve also wants to RAISE alpha
       between 0.6 and 0.98; that is suppressed, because hardening the edge would move
       the opaque set. And where the plate is clipped at 255 the equation carries no
       information at all, so alpha is left alone there and only F is corrected.

    4. FOREGROUND GAMUT — spill only ever ADDS light. So in the fringe the figure
       cannot be brighter than the same surface reads where it is opaque. F is capped
       at 1.15x F_prior in luminance (a gain, so hue and saturation are untouched).
       This is the achromatic-backing analogue of the Vlahos/Ultimatte despill rule,
       which is a one-sided clamp for the same physical reason.

    4b. THE GARMENT — where the gain in (2) is the WRONG OPERATOR, and is replaced by a
       subtraction. The client's note was "the shoulders look like a desaturation rather
       than a darkening ... maybe a bit too aggressive, or can be coloured with the
       t-shirt's hue". All three observations are the same defect, and the plate proves it.

       Step (2) assumes the backdrop's contribution is rho * E_backdrop — light that is
       reflected by the albedo, hence multiplicative, hence removable by a gain. On skin
       and hair that holds. On the navy tee it does not: a cotton dielectric also returns
       an INTERFACE (specular / sheen) component that carries the ILLUMINANT's spectrum,
       not the albedo's. Shafer ("Using Color to Separate Reflection Components", Color
       Research & Application 10(4), 1985) splits the two, L = m_b(g) c_b + m_s(g) c_s,
       body plus interface; Klinker, Shafer & Kanade ("A Physical Approach to Color Image
       Understanding", IJCV 4(1) 1990, 7-38) show the resulting colour cluster is a skewed
       T whose highlight arm runs along the illuminant colour, and that an image can be
       separated into "an image of just the highlights, and the original image with the
       highlights removed".

       The plate says the shoulder rim is almost ENTIRELY interface. Measured on the near
       shoulder (frame-left, the side that faces the cyc), by depth into the silhouette,
       decomposing the linear plate onto the deep-shirt direction u and the measured cyc
       direction w = (1,1,1)/sqrt(3):

           depth px       2     5     8    13    20    29    40    53    75   deep
           m_b  x1e3   48.2  48.0  49.3  45.6  45.2  47.5  51.5  55.3  59.1   62.2
           m_s  x1e3  533.5 211.6 124.0  72.3  45.1  34.0  26.0  19.2  11.4    1.5

       The body term is FLAT. Every bit of the rim's excess is the achromatic interface
       term. Equivalently: the rim is brighter than the interior and at the same time
       LESS chromatic — its chromaticity marches monotonically to the illuminant's,
       (0.225,0.246,0.530) deep to (0.325,0.326,0.349) at the edge. A multiplicative gain
       cannot produce that and cannot undo it: dividing by (1+psi) scales the interface
       term down along with the body term, so the pixel keeps the washed-out chromaticity
       it started with and merely gets darker. Dark AND desaturated — the client's words.

       Note this is also the faithful inverse of the operator being undone. Foundry's
       LightWrap ADDS: its Highlight Merge defaults to "plus", which "adds the elements
       together". Inverting an additive operator with a division was the error.

       So on the garment the correction is a subtraction, in linear light:

           u(x)  = the local body direction: the interior colour carried out to the
                   silhouette by the same geodesic extension used for F_prior above
                   (Rhemann et al. 2008 §2.1). Because u is extended FROM the interior it
                   already carries the interior's own sheen, so no baseline term is
                   needed and none is used — m_s measures against it as ~0 deep in
                   (measured: -0.1e-3).
           w     = the cyclorama, measured, a flat 255 -> (1,1,1)/sqrt(3) in linear light.
           m_s   = the component of F along w once u is projected out (the 2x2 dichromatic
                   solve; the residual off the u-w plane is fabric detail and is kept).
           F    <- F - s * w,   s = clip(m_s, 0, (Y - Y_base) * sqrt(3)) * smoothstep(D)

       The upper clip is the same one-sided argument as (4): the backdrop only ever ADDED
       light, so de-lighting must not take the surface below what the interior
       extrapolation Y_base says it is. It is what stops the far shoulder — which the cyc
       barely reached — from being touched at all. The smoothstep is the same one psi
       uses, so s is exactly zero by DREF and the shirt's interior is untouched.

       Nothing is dialled and nothing is smoothed: s is measured per pixel and used as
       measured. Applied only where the geodesically extended opaque colour is actually
       the tee (B - R > 2, ramped over 8) and below the collar (rows 960-1040, ramped),
       blended by that weight with the gain of (2) so there is no seam at the neck. Above
       row 960 — the whole head, hair, ears, crown and face — the output is bit-identical.

    5. HOLDOUT / CORE MATTE — the ear/skull corner. Compositors trim a core matte where
       it demonstrably covers backdrop; that is what a holdout is for. Pixels the master
       calls opaque (alpha >= 250/255) whose plate colour the known-backing solve reads
       as mostly backdrop (alpha_ls < 0.5), at high conditioning, within 4px of the
       fringe: in the whole 2.6-megapixel image that test selects EIGHT pixels, all of
       them in one blob at x 594-597, y 439-441 — the left ear/skull corner the client
       flagged. They are re-solved. Everything else the client calls opaque stays
       opaque. This is the only place the matte's opaque set is touched, and the script
       prints the blob list so it can be checked or vetoed.

    6. THE EDGE BAND — how far in (2) and (4b) are allowed to reach. Both of them are
       de-lighting operators, and the rim light they undo is genuinely wide: the m_s
       table in 4b still reads 26 x1e-3 at 40px and 11 at 75px. So the fitted psi and
       the fitted subtraction were carried to DREF = 55px, and the asset's interior
       differed from the plain knockout's out to about 40px — measured by
       scripts/check-mattes.ts over the 1,376,739 pixels opaque in both, the mean worst
       channel ran 13.00 at 0-2px in from the opaque boundary, 8.55 at 5-10, 6.42 at
       10-20 and 3.63 at 20-40.

       That is fine while the asset is used alone, and it is what the mobile hero does:
       below 880px he goes full-bleed on the deep gradient and the wide de-light is
       simply correct. From 880px up he is composited BOTH ways at once — the plain
       knockout inside the sand plate's circle, this matte outside it, two masked
       layers of the same photograph at the same size. Wherever the circle's edge
       crosses his body the two must agree pixel for pixel, and a grade that reaches
       40px inside put a tonal step across him.

       The fix is the oldest device in the keyer's book: a CORE / EDGE split. A
       three-pass key builds an edge matte that carries the soft, treated pixels and a
       core matte that is left alone, joins them through a transition mask, and adjusts
       "erodes and blurs ... to get the right falloff between core matte and edge
       matte". The de-lighting belongs to the edge matte. Foundry's own LightWrap says
       the same thing in one parameter: the wrap's reach IS its blur radius, and the
       background is blurred precisely so that only light, and not background detail,
       reaches the figure. Nothing about the operator entitles it to the core.

       So psi and the dichromatic subtraction are both multiplied by a transition
       window on D, the distance into the master's own silhouette: 1 out to EDGE_IN,
       smootherstep down, exactly 0 from EDGE_OUT inward. Perlin's C2 quintic rather
       than the C1 smoothstep the DREF ramp used, because a C1 window leaves a slope
       discontinuity at a fixed distance from the silhouette and that is what the eye
       reads as a ring; with C2 both value and slope match at the handover.

       EDGE_IN = 2, EDGE_OUT = 16 were SWEPT, not chosen. Widths swept at EDGE_IN = 2,
       against three numbers: what survives of the edge grade (scripts/check-mattes.ts's
       0-2px mean, 13.00 with the whole grade), what is left of the step on the
       path the circle's edge actually takes across him (2,276 opaque pixels, from
       scripts/check-portrait-fit.ts's geometry; mean/max luminance step over the 97% of
       that path lying 10px or more inside, 0.65/34.4 before), and the residual halo on
       the near shoulder over #0a2833 (crest minus interior; 7.0 with the whole grade,
       43.1 with none). The fourth row is what check-mattes.ts gates on:

           EDGE_OUT        8      10      14      16      18      20      24      30
           0-2px grade   5.07    7.80   10.61   11.28   11.72   12.06   12.40   12.63
           join step   .33/5.0 .33/5.0 .33/5.0 .33/5.0 .33/5.0 .35/4.5 .35/ 11 .40/ 19
           halo         37.4    32.7    24.1    21.4    18.9    16.6    13.0     9.7
           10-20px     .70/  7 .72/  7 .74/  7 .79/  7 .84/ 12 1.02/14 1.60/23 2.76/30

       (the old asset, for the same four rows: 13.00 — 0.65/34.4 — 7.0 — 6.42/48.)

       16 is the knee, and the encoder picks it. The last row is the gate's own metric,
       and its floor is not zero: re-encode the plain knockout's decoded pixels at these
       WebP settings and compare them with themselves and you get mean 0.42 max 7 at
       10-20px, 0.44 max 10 at 80px+. Lossy WebP is VP8, which is YUV 4:2:0 — the chroma
       subsampling is an irreducible error that quality does not buy off (measured: q92
       max 10, q95 max 10, q98 max 8, q100 max 9, lossless max 0, at 4.4x the bytes). So
       MAX_LIMIT = 5 in that gate is below the floor and cannot be met by any lossy
       dark matte, however perfect; the mean limit is real and is what these were chosen
       against. 16 is the widest window whose worst case at 10-20px is still exactly the
       encoder's own (7 and 7): from 10px in, this asset differs from the knockout by
       nothing that is distinguishable from the encode. 18 and 20 buy 2 and 5 points of
       halo but put measurable grade back in the interior, and 20 fails the mean limit
       outright at 1.02. EDGE_IN was swept too: 0 costs a point of grade for nothing, 6
       buys one and takes the join's worst step from 4.5 to 10, and the join is the
       defect being fixed — so 2.

       What this does NOT do, and it should be looked at rather than taken on trust:
       the wide, low-frequency half of the cyc's rim light now STAYS on the near
       shoulder, because the plain knockout has it and the two must agree. Composited
       over #0a2833 the shoulder's luminance still rises out of the outline with no
       halo of its own and no dark line, but it now crests at 67.3 against a 45.9
       interior instead of 52.9 — a +21.4 shoulder sheen where the old asset had +7.0
       and the raw knockout has +43.1. Past the crest it falls away over ~100px, which
       is the photograph's own shoulder and not a ring: the knockout falls the same way
       three pixels across the mask join, which is the whole point. Whether that sheen
       reads as modelling or as a glow is a picture judgement and the numbers cannot
       make it. If it reads as a glow, the honest fix is not a wider window — that
       brings the step back — but a lossless dark matte, which would let the gate's max
       limit be met and the window be widened; it costs 1.38 MB against 319 KB, on the
       hero's LCP image.

    The silhouette is NOT touched: no choke, no dilate; the outer support of the matte
    and its per-column top edge are bit-identical to the client's master, including the
    hand-painted crown, whose shape is unchanged (its alpha VALUES take the same global
    curve as the rest of the fringe — see the verification block).
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

    # -- 6. THE TRANSITION MASK: how far in the de-lighting is allowed to reach --------
    # See §6 of the docstring. A core/edge split: the edge band carries the treatment,
    # the core is left exactly as the master has it, and this window is the transition
    # between them. EDGE_OUT is the erode, EDGE_IN..EDGE_OUT the feather; beyond
    # EDGE_OUT the window is EXACTLY zero, so the plate's edge can cross him there
    # without a step. smootherstep (Perlin's C2 quintic), not the C1 smoothstep that
    # was here before: its derivative is zero at BOTH ends, so the treated band hands
    # over to the untreated core with matching slope as well as matching value, and
    # there is no slope discontinuity at a fixed distance from the silhouette for the
    # eye to read as a ring.
    EDGE_IN, EDGE_OUT = 2.0, 16.0
    te = np.clip((EDGE_OUT - D) / (EDGE_OUT - EDGE_IN), 0.0, 1.0)
    ts = te * te * te * (10.0 + te * (te * 6.0 - 15.0))
    # The client's file is the authority wherever the backdrop cannot have reached: on
    # solid pixels, past the edge band, and in the crown he painted above the plate.
    # Past the band rather than past DREF, so that "outside the window the asset IS the
    # knockout" is exact rather than nearly so. It moves 3,504 pixels, all of them in
    # the cutout's last two rows, where he was cut off by the source frame and the
    # matte ramps out to alpha 252-253 instead of ending: opaque enough to count, not
    # opaque enough to have been settled, and 20px or more inside the silhouette
    # sideways, so the foreground estimator rather than the master was speaking for
    # them. Everywhere else in 20..DREF is already solid and already settled.
    settled = (A > 0.995) | (D >= EDGE_OUT)
    settled[:top] |= A[:top] > 0.02
    I[settled] = master_rgb[settled]

    # -- 1. the local foreground colour prior, by geodesic extension -----------------
    Fprior = _geodesic_extend(master_rgb, A > 0.995, (A > 0.005) | core)

    # -- the garment, measured rather than drawn: the geodesically extended opaque colour
    #    is bluer than it is red exactly on the navy tee, and the row ramp keeps the neck,
    #    the beard and the collar shadow out of it. Both terms are soft, so GW is a weight
    #    and not a stencil: the dichromatic branch of delight() fades into the gain branch
    #    across the collar instead of meeting it at a line.
    _rows = np.arange(H)[:, None] + np.zeros((1, W))
    _rr = np.clip((_rows - 960.0) / 80.0, 0, 1)
    GW = gaussian_filter(np.clip((Fprior[..., 2] - Fprior[..., 0] - 2.0) / 8.0, 0, 1)
                         * (_rr * _rr * (3 - 2 * _rr)), 3.0, mode="nearest") * core
    GW = np.where(GW < 0.01, 0.0, GW)                 # hard zero off the garment
    GAR = GW > 0.0
    WV = np.ones(3) / np.sqrt(3.0)                    # the cyc's direction in linear light

    # -- 2. known-backing re-solve of alpha in the fringe ----------------------------
    BK = np.array([1.0, 1.0, 1.0])                    # the cyc, measured: a flat 255
    Ilin, Fplin = _srgb_to_linear(I), np.clip(_srgb_to_linear(Fprior), 0, 1)
    dF = BK - Fplin
    a_ls = np.clip(((BK - Ilin) * dF).sum(-1) / np.maximum((dF * dF).sum(-1), 1e-9), 0, 1)
    sep = np.sqrt((dF * dF).sum(-1)) / np.sqrt(3.0)   # |B - F|: how well conditioned
    A8 = np.round(A * 255.0)
    band = (A8 >= 6) & (A8 <= 249)                    # the pixels the client calls partial
    inplate = np.zeros((H, W), bool); inplate[top:] = True
    inframe = np.ones((H, W), bool)
    inframe[:, :3] = inframe[:, -3:] = inframe[-3:, :] = False   # the crop's own antialiasing
    conf = ((I.max(-1) < 253.5) * np.clip((sep - 0.30) / 0.30, 0, 1)
            * band * inplate * inframe)               # 0 where the plate is clipped

    edges = np.arange(0.0, 1.0001, 1 / 32.0)          # the systematic part: one curve
    xs, ys = [0.0], [0.0]
    for lo, hi in zip(edges[:-1], edges[1:]):
        s = (conf > 0.5) & (A >= lo) & (A < hi)
        if s.sum() >= 60:
            xs.append(0.5 * (lo + hi)); ys.append(float(np.median(a_ls[s])))
    xs.append(1.0); ys.append(1.0)
    xs = np.array(xs); ys = np.minimum(np.maximum.accumulate(np.array(ys)), xs)
    gA = np.interp(A, xs, ys)
    rho = np.clip(a_ls / np.maximum(gA, 1e-3), 0.0, 1.5)          # the local part
    wg = conf * np.clip(4.0 * A * (1.0 - A), 0, 1)
    sm = lambda x: gaussian_filter(x, 1.5, mode="nearest")
    rho_s = np.clip((sm(rho * wg) + 0.15) / (sm(wg) + 0.15), 0.0, 1.5)
    An = np.where(band, np.maximum(np.minimum(gA * rho_s, A), 6.0 / 255.0), A)

    # holdout: the client's core matte, trimmed only where it covers demonstrable backdrop
    near = binary_dilation(band, np.ones((9, 9), bool))
    hold = (A8 >= 250) & (a_ls < 0.5) & (sep > 0.60) & inplate & inframe & near
    An = np.clip(np.where(hold, a_ls, An), 0, 1)

    # -- 3. foreground colour estimation (Germer et al. 2020), then the gamut bound ---
    def delight(alpha, gamut=True, dichro=True):
        F = estimate_foreground_ml(np.clip(I / 255.0, 0, 1), alpha,
                                   regularization=5e-3, gradient_weight=0.1) * 255.0
        lw = np.array([0.2126, 0.7152, 0.0722])
        F[settled] = I[settled]                       # alpha == 1 => F == I, exactly
        if gamut:
            # after the settled overwrite, so it also reaches the hand-painted crown,
            # whose fuzz was synthesised while the figure still sat on white
            Yf = (_srgb_to_linear(F) * lw).sum(-1)
            Yp = (Fplin * lw).sum(-1)
            cap = np.where(band | hold, np.minimum(
                1.0, 1.15 * np.maximum(Yp, 1e-4) / np.maximum(Yf, 1e-6)), 1.0)
            F = np.clip(_linear_to_srgb(_srgb_to_linear(F) * cap[..., None]), 0, 255)

        # -- 4. inverse light wrap: fit psi = E_backdrop / E_key, divide it out -------
        Flin = _srgb_to_linear(F)
        Y = (Flin * lw).sum(-1)
        # what the shading would be with no backdrop: the interior, pushed out to the edge
        Ybase = np.maximum(_geodesic_extend(Y, core & (D >= DREF), core), 1e-6)
        excess = np.clip(np.where(core, Y / Ybase - 1.0, 0.0), -1.0, 8.0)

        W1 = np.clip(2.0 * gaussian_filter(1.0 - alpha, SIG_NEAR, mode="nearest"), 0, 1)
        W2 = np.clip(2.0 * gaussian_filter(1.0 - alpha, SIG_WIDE, mode="nearest"), 0, 1)
        fit = (core & (D < DREF * 2)).astype(np.float64)
        G = lambda x: gaussian_filter(x, SIG_FIT, mode="nearest")
        M11, M12, M22 = G(W1 * W1 * fit) + 1e-3, G(W1 * W2 * fit), G(W2 * W2 * fit) + 1e-3
        b1, b2 = G(excess * W1 * fit), G(excess * W2 * fit)
        det = M11 * M22 - M12 * M12
        a1 = np.where(np.abs(det) > 1e-12, (M22 * b1 - M12 * b2) / det, 0.0)
        a2 = np.where(np.abs(det) > 1e-12, (M11 * b2 - M12 * b1) / det, 0.0)
        psi = np.clip(a1 * W1 + a2 * W2, 0.0, PSI_MAX)
        psi = gaussian_filter(psi, 8.0, mode="nearest") * ts
        out = Flin / (1.0 + psi)[..., None]

        # -- 5. the garment: the same light wrap, inverted as a SUBTRACTION ------------
        # On the tee the backdrop's contribution is the dichromatic INTERFACE term
        # (Shafer 1985; Klinker, Shafer & Kanade, IJCV 4(1) 1990) — illuminant-coloured
        # and additive, not albedo-coloured and multiplicative. See 4b in the docstring:
        # measured on the plate, the body coefficient m_b is flat from the silhouette to
        # deep inside while m_s runs 533 -> 1.5, so the rim's excess is interface almost
        # in full. A gain scales it instead of removing it; that is the desaturation.
        if dichro and GAR.any():
            U = _geodesic_extend(Flin, GAR & (D >= DREF), GAR)   # the body direction, from
            U /= np.maximum(np.linalg.norm(U, axis=-1, keepdims=True), 1e-9)  # the interior
            kk = np.clip((U * WV).sum(-1), -0.999, 0.999)
            m_s = ((Flin @ WV) - kk * (Flin * U).sum(-1)) / np.maximum(1.0 - kk * kk, 1e-3)
            # one-sided, exactly as in 4: the backdrop only ADDED light, so never take the
            # surface below the interior's own extrapolated luminance. L(WV) = 1/sqrt(3).
            s = np.clip(m_s, 0.0, np.maximum(Y - Ybase, 0.0) * np.sqrt(3.0)) * ts * GW
            g = GW[..., None]
            out = np.clip(Flin - s[..., None] * WV, 0.0, None) * g + out * (1.0 - g)
        return F, np.clip(_linear_to_srgb(out), 0, 255), psi

    # three foregrounds, all recomputed from the same inputs so nothing depends on disk:
    #   Fd0  the method of two rounds ago (client's alpha, no gamut bound) — the baseline
    #        the hair/ear/crown numbers have always been quoted against
    #   Fdp  the CURRENTLY PUBLISHED asset: re-solved alpha, gamut bound, and the
    #        multiplicative light wrap everywhere. This is "before" for the shoulder.
    #   Fd   the new asset: as Fdp, but the garment gets the dichromatic subtraction.
    _, Fd0, _ = delight(A, gamut=False, dichro=False)
    _, Fdp, _ = delight(An, dichro=False)
    _, Fd, psi = delight(An)

    Image.fromarray(np.dstack([Fd, An * 255.0]).round().astype(np.uint8), "RGBA") \
         .save(f"{OUT}/john-cutout-dark.webp", "WEBP",
               quality=92, alpha_quality=100, exact=True, method=6)
    _verify_solid_matte(master_rgb, A, An, Fd, Fd0, Fdp, psi, D, core, top,
                        np.vstack([xs, ys]), hold, I, GW, (EDGE_IN, EDGE_OUT))


def _verify_solid_matte(master_rgb, A, An, Fd, Fd0, Fdp, psi, D, core, top, curve, hold, I, GW,
                        edge):
    """Every number the brief asks for, measured on the file that was just written.

    `before` throughout is a PREVIOUS published method recomputed from scratch on the
    same inputs, so the comparison is reproducible and does not depend on whatever
    happens to be on disk. For the hair, ears and crown that is Fd0 (the method of two
    rounds ago); for the shoulder tables it is Fdp, the asset as published today.
    """
    d = np.array(Image.open(f"{OUT}/john-cutout-dark.webp").convert("RGBA")).astype(np.float64)
    aa, rgb = d[..., 3] / 255.0, d[..., :3]
    H, W = aa.shape
    L = lambda x: 0.2126 * x[..., 0] + 0.7152 * x[..., 1] + 0.0722 * x[..., 2]

    # -- matte: the support is bit-identical, so hair survives and nothing moved -----
    print("  partial coverage: %.4f%% of pixels (master %.4f%%) — the hair band is intact"
          % (((aa > 0.02) & (aa < 0.98)).mean() * 100, ((A > 0.02) & (A < 0.98)).mean() * 100))
    print("  matte support (alpha>0.02) differs on %d px; opaque set (alpha>=0.98) on %d px"
          % (int(((A > 0.02) != (aa > 0.02)).sum()), int(((A >= 0.98) != (aa >= 0.98)).sum())))
    col = np.where((A > 0.02).any(0), (A > 0.02).argmax(0), -1)
    col2 = np.where((aa > 0.02).any(0), (aa > 0.02).argmax(0), -1)
    row = np.where((A > 0.02).any(1), (A > 0.02).argmax(1), -1)
    row2 = np.where((aa > 0.02).any(1), (aa > 0.02).argmax(1), -1)
    print("  silhouette + crown: per-column top edge differs on %d of %d columns (max %d px);"
          " per-row left edge on %d of %d rows"
          % (int((col != col2).sum()), W, int(np.abs(col - col2).max()),
             int((row != row2).sum()), H))
    print("  crown (the %d hand-painted rows above the plate): shape unchanged, alpha values"
          " remapped by the same global curve, max %d/255" % (top, np.abs(A - aa)[:top].max() * 255))
    print("  alpha transfer curve fitted from the known-backing solve: "
          + " ".join("%.2f->%.2f" % (x, y) for x, y in zip(*curve) if 0.05 < x < 0.75))
    ys, xs = np.nonzero(hold)
    print("  holdout (core matte trimmed where it covers backdrop): %d px, x %d-%d y %d-%d"
          % (hold.sum(), xs.min(), xs.max(), ys.min(), ys.max()) if hold.any()
          else "  holdout: no pixel qualified")

    # == THE EDGE BAND: only the edge may differ from the plain knockout ==============
    # From 880px up the hero paints BOTH mattes at once — the plain knockout inside the
    # sand plate's circle, this one outside it — so wherever the circle's edge crosses
    # his body the two have to agree pixel for pixel. Depth is measured from the OPAQUE
    # boundary (alpha >= 250 in both files), which is the metric the comparison has
    # always been quoted in; it sits about 5px inside the alpha > 0.5 silhouette that
    # EDGE_OUT is measured from, so the grade should be gone by roughly EDGE_OUT - 5
    # in this table. `pre` is the same difference BEFORE the WebP encode, where the
    # claim is exact: outside the window the pixels are the master's, bit for bit.
    EDGE_IN, EDGE_OUT = edge
    buf0 = io.BytesIO()
    Image.fromarray(np.dstack([master_rgb, A * 255.0]).round().astype(np.uint8), "RGBA") \
         .save(buf0, "WEBP", quality=92, alpha_quality=100, exact=True, method=6)
    floor_rgb = np.abs(np.array(Image.open(buf0).convert("RGBA"))
                       .astype(np.float64)[..., :3] - master_rgb)
    solid = (A >= 250 / 255.0) & (aa >= 250 / 255.0)
    Dop = distance_transform_edt(solid)
    post, pre = np.abs(rgb - master_rgb), np.abs(Fd - master_rgb)
    print("  EDGE BAND: the de-lighting is windowed off between %.0f and %.0fpx into the"
          " silhouette (smootherstep, C2)" % (EDGE_IN, EDGE_OUT))
    print("    light vs dark over the %d px opaque in both, by depth from that boundary:"
          % solid.sum())
    print("      %-9s %9s | %8s %7s | %8s %7s | %8s %7s"
          % ("depth", "n", "mean|d|", "max", "pre-enc", "max", "encode", "max"))
    for lo, hi in [(0, 2), (2, 5), (5, 10), (10, 20), (20, 40), (40, 80), (80, 1e9)]:
        s = solid & (Dop >= lo) & (Dop < hi)
        if not s.any():
            continue
        print("      %-9s %9d | %8.2f %7.1f | %8.3f %7.1f | %8.3f %7.1f"
              % ("%d-%dpx" % (lo, hi) if hi < 1e8 else "80px+", s.sum(),
                 post[s].mean(), post[s].max(), pre[s].mean(), pre[s].max(),
                 floor_rgb[s].mean(), floor_rgb[s].max()))
    off = solid & (D >= EDGE_OUT)
    print("    beyond the window (%d px): |dark - master| before the encode  max %.6f/255"
          "  —  the interior IS the knockout" % (off.sum(), pre[off].max()))
    print("    the residue past it is the WebP encode alone: q92 costs the master"
          " %.3f mean (max %.1f) against itself" % (floor_rgb[solid].mean(),
                                                    floor_rgb[solid].max()))

    # -- and what that leaves at the outline: luminance inward, on the deep band ------
    # Rising = no halo, and no drawn-on dark line either. The far column is the figure's
    # own interior, so `peak - interior` is what is left of the cyc's rim light.
    rr0 = np.arange(H)[:, None] + np.zeros((1, W), int)
    cc0 = np.arange(W)[None, :] + np.zeros((H, 1), int)
    Dc = distance_transform_edt(core)
    DEPS = [(0, 2), (2, 4), (4, 6), (6, 8), (8, 10), (10, 14), (14, 20), (20, 28),
            (28, 40), (40, 55), (55, 80), (80, 120)]
    print("    composited on the deep band rgb(10,40,51) = #0a2833, luminance inward"
          " from the outline:")
    print("      %-24s %s" % ("", " ".join("%6s" % ("%d-%d" % b) for b in DEPS)))
    for nm, sel in (("crown + hair  rows<420 ", core & (rr0 < 420)),
                    ("face + beard  420-960  ", core & (rr0 >= 420) & (rr0 < 960)),
                    ("NEAR shoulder r>1010   ", core & (rr0 > 1010) & (cc0 < 880)),
                    ("FAR  shoulder r>1010   ", core & (rr0 > 1010) & (cc0 >= 880)),
                    ("lower body    rows>1200", core & (rr0 > 1200))):
        for lab, im, al in (("knockout", master_rgb, A), ("dark    ", rgb, aa)):
            c = L(im * al[..., None] + np.array((10.0, 40.0, 51.0)) * (1 - al[..., None]))
            p = np.array([c[sel & (Dc >= lo) & (Dc < hi)].mean()
                          if (sel & (Dc >= lo) & (Dc < hi)).sum() > 30 else np.nan
                          for lo, hi in DEPS])
            note = ""
            if lab.startswith("dark"):
                q = p[:7][~np.isnan(p[:7])]
                note = ("  rises to +%.1f over its interior; %s out to 20px"
                        % (np.nanmax(p) - p[-1],
                           "monotone" if (np.diff(q) > -0.5).all()
                           else "dips %+.1f" % np.diff(q).min()))
            print("      %-24s %s%s" % (nm + " " + lab,
                  " ".join("     -" if np.isnan(v) else "%6.1f" % v for v in p), note))

    # -- THE HAIR BAND, specifically: composite luminance by depth, two dark grounds --
    Din, Dout = distance_transform_edt(core), distance_transform_edt(~core)
    sd = np.where(core, Din, -Dout)                   # signed depth, MASTER reference
    rr = np.arange(H)[:, None] + np.zeros((1, W))
    hairband = (np.abs(sd) <= 8) & (rr >= top) & (rr < 640) & (A > 0.02)
    dep = [(-6, -4), (-4, -2), (-2, 0), (0, 2), (2, 4), (4, 8)]
    print("  HAIR BAND = alpha>0.02 pixels within 8px of the master silhouette, rows %d-640"
          " (skull, temples and both ears): %d px" % (top, hairband.sum()))
    for bg in [(7, 32, 40), (22, 75, 93)]:
        print("    on rgb%-15s depth px %s" % (str(tuple(bg)),
              " ".join("%7s" % ("%d..%d" % b) for b in dep)))
        for tag, img, al in (("before", Fd0, A), ("after ", rgb, aa)):
            c = L(img * al[..., None] + np.array(bg, float) * (1 - al[..., None]))
            print("      %s              %s" % (tag,
                  " ".join("%7.1f" % c[hairband & (sd >= lo) & (sd < hi)].mean() for lo, hi in dep)))

    # -- THE EAR/SKULL CONCAVITIES, with the boxes stated so they can be checked ------
    for name, (y0, y1, x0, x1) in (("right ear / skull corner", (355, 410, 1275, 1325)),
                                   ("left  ear / skull corner", (415, 470, 575, 620))):
        out = []
        for tag, img, al in (("before", Fd0, A), ("after", rgb, aa)):
            c = L(img * al[..., None] + np.array((7, 32, 40), float)
                  * (1 - al[..., None]))[y0:y1, x0:x1]
            out.append("%s mean %5.1f p95 %5.1f max %5.1f" % (tag, c.mean(),
                                                              np.percentile(c, 95), c.max()))
        print("  %s  box x %d-%d y %d-%d, on rgb(7,32,40):  %s  ->  %s"
              % (name, x0, x1, y0, y1, out[0], out[1]))

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
    print("  bright specks in the fringe:               master %4d  before %3d  after %3d"
          % (specks(master_rgb, A), specks(Fd0, A), specks(rgb, aa)))
    print("  bright specks in the ear/skull concavities: master %4d  before %3d  after %3d"
          % (specks(master_rgb, A, ear), specks(Fd0, A, ear), specks(rgb, aa, ear)))

    # -- composites: luminance by depth into the silhouette, three grounds ------------
    dd = distance_transform_edt(aa > 0.5)
    bands = [(1, 2), (2, 4), (4, 8), (8, 20)]
    for bg in [(7, 32, 40), (22, 75, 93), (247, 244, 238)]:
        for tag, img, al in (("master", master_rgb, A), ("new   ", rgb, aa)):
            cl = L(img * al[..., None] + np.array(bg, float) * (1 - al[..., None]))
            p = [float(cl[(dd >= lo) & (dd < hi) & (aa > 0.5)].mean()) for lo, hi in bands]
            print("    on rgb%-16s %s  1px %s  rim vs 8-20px %+6.1f"
                  % (str(tuple(bg)), tag, " ".join("%5.1f" % v for v in p), p[0] - p[-1]))

    # == THE SHOULDER, IN CHROMA FIRST ================================================
    # The client reported a DESATURATION, not a darkening, so the headline measurement is
    # chroma, in a perceptually uniform space, binned by depth from the silhouette — the
    # same binning the hair got last round. Luminance is printed underneath so the two can
    # be read against each other: a luma-only check passes this defect straight through.
    # OKLCh C (Ottosson 2020) on the COMPOSITE, over both grounds the asset actually sits
    # on. `target` is the garment's own colour carried out to the silhouette geodesically
    # and rescaled to the interior's extrapolated luminance — i.e. what the tee would read
    # as at that depth if the cyclorama had never been there.
    rows, cols = np.arange(H)[:, None], np.arange(W)[None, :]
    M1 = np.array([[0.4122214708, 0.5363325363, 0.0514459929],
                   [0.2119034982, 0.6806995451, 0.1073969566],
                   [0.0883024619, 0.2817188376, 0.6299787005]])
    M2 = np.array([[0.2104542553, 0.7936177850, -0.0040720468],
                   [1.9779984951, -2.4285922050, 0.4505937099],
                   [0.0259040371, 0.7827717662, -0.8086757660]])

    def okC(x):                                       # OKLCh chroma, x1000, from sRGB 0-255
        ab = (np.cbrt(np.maximum(_srgb_to_linear(x) @ M1.T, 0.0)) @ M2.T)[..., 1:]
        return np.hypot(ab[..., 0], ab[..., 1]) * 1000.0

    Din, Dout2 = distance_transform_edt(core), distance_transform_edt(~core)
    sdep = np.where(core, Din, -Dout2)                # signed depth, MASTER reference
    gm = GW > 0.5
    sb = [(1, 3), (3, 6), (6, 10), (10, 16), (16, 24), (24, 34), (34, 46), (46, 60), (60, 90)]
    Fl = _srgb_to_linear(Fd)
    Ub = _geodesic_extend(Fl, gm & (D >= 55.0), gm)
    Yb = np.maximum(_geodesic_extend((Fl * np.array([0.2126, 0.7152, 0.0722])).sum(-1),
                                     core & (D >= 55.0), core), 1e-6)
    tgt = _linear_to_srgb(Ub * (Yb / np.maximum(
        (Ub * np.array([0.2126, 0.7152, 0.0722])).sum(-1), 1e-9))[..., None])
    print("  GARMENT = geodesically-extended opaque colour bluer than red, below the"
          " collar: %d px, rows %d-%d" % (gm.sum(), rows[:, 0][gm.any(1)].min(),
                                          rows[:, 0][gm.any(1)].max()))
    for side, msk in (("NEAR shoulder (frame-left, faces the cyc)", gm & (cols < 880)),
                      ("FAR  shoulder (frame-right)              ", gm & (cols >= 880))):
        for bg in [(7, 32, 40), (22, 75, 93)]:
            cmp_ = lambda im, al: im * al[..., None] + np.array(bg, float) * (1 - al[..., None])
            print("  %s  on rgb%s" % (side, str(tuple(bg))))
            print("      depth px      %s" % " ".join("%7s" % ("%d-%d" % b) for b in sb))
            for lab, fn in (("OKLCh C x1e3", okC), ("luminance   ", L)):
                for tag, img, al in (("before", Fdp, An), ("after ", rgb, aa),
                                     ("target", tgt, An)):
                    if tag == "target" and lab.startswith("lum"):
                        continue
                    v = fn(cmp_(img, al))
                    print("      %s %s  %s" % (lab if tag == "before" else " " * 12, tag,
                          " ".join("%7.2f" % v[msk & (sdep >= lo) & (sdep < hi)].mean()
                                   for lo, hi in sb)))
    print("  chroma restored: %.1f%% of target before, %.1f%% after (near shoulder, 1-46px)"
          % tuple(100 * okC(img * An[..., None] + np.array((7, 32, 40), float)
                            * (1 - An[..., None]))[gm & (cols < 880) & (sdep >= 1) & (sdep < 46)].mean()
                  / okC(tgt * An[..., None] + np.array((7, 32, 40), float)
                        * (1 - An[..., None]))[gm & (cols < 880) & (sdep >= 1) & (sdep < 46)].mean()
                  for img in (Fdp, rgb)))

    # -- the head must not have moved at all: bit-identity against today's published build
    head = rows + np.zeros((1, W), int) < 960
    print("  EVERYTHING ABOVE ROW 960 (crown, hair, ears, face): |after - published| max"
          " %.4f/255 on %d px — hair and ears are untouched by this round"
          % (np.abs(Fd - Fdp)[head].max(), int(head.sum())))

    # -- shoulder rim: measured on the shoulders only, before and after ---------------
    shoulder = (aa > 0.9) & (rows > 1010)
    print("  shoulder rim, mean luminance by depth (the backdrop's own rim light):")
    for name, sel in (("near shoulder (left of frame)", shoulder & (cols < 880)),
                      ("far shoulder                 ", shoulder & (cols >= 880))):
        for tag, img in (("before", Fdp), ("after ", rgb)):
            p = [float(L(img)[sel & (dd >= lo) & (dd < hi)].mean())
                 for lo, hi in [(1, 4), (4, 8), (8, 20), (20, 55), (80, 200)]]
            print("    %s %s  %s   edge vs interior %+6.1f"
                  % (name, tag, " ".join("%5.1f" % v for v in p), p[0] - p[-1]))
    deep = shoulder & (dd > 80)
    floor = floor_rgb[deep]
    print("  shirt interior (>80px in): %.3f/255 mean before the encode (max %.1f);"
          " re-encoding the master alone already costs %.3f (max %.1f)"
          % (np.abs(Fd - master_rgb)[deep].mean(), np.abs(Fd - master_rgb)[deep].max(),
             floor.mean(), floor.max()))
    print("  rim gain applied to %.1f%% of the figure, strongest 1/(1+psi) = %.2f"
          % ((psi[core] > 0.02).mean() * 100, 1.0 / (1.0 + psi.max())))

    # -- the invariant: no hair was deleted, because nothing was removed from the matte
    fr = (A > 0.02) & (A < 0.98) & (np.arange(H)[:, None] + np.zeros((1, W)) >= top)
    for tag, img, al in (("before", Fd0, A), ("after ", rgb, aa)):
        e = np.abs(L(img * al[..., None] + 255.0 * (1 - al[..., None])) - L(I))[fr]
        print("  %s: put back on the white cyc it was shot on, |dLuma| over the fringe:"
              " mean %5.2f  p95 %5.2f" % (tag, e.mean(), np.percentile(e, 95)))


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
