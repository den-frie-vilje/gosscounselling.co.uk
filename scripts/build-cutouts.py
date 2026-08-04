"""Rebuild John's cutout assets from the source photographs.

The light frame clips the top of his head, leaving a flat 137px chord. This restores it:

  1. fit the missing arc from the real edge slope either side of the gap (tangent-constrained,
     then scaled by CAP_SCALE because the full fitted height reads as a bump)
  2. fill the interior of the cap with his own scalp colour and grain
  3. CLONE-STAMP the silhouette edge: real patches of his own stubble edge, lifted from either
     side of the gap, rotated to match the local tangent of the new arc and blended along it.
     No synthetic ramp, no blur — the fuzz is his.
  4. derive a dark-ground variant with keyer-style edge treatment (colour edge-extend, matte
     choke, negative light wrap), because a matte pulled from a white backdrop carries light
     spill that glows when composited onto a dark band.

usage: python3 build-cutouts.py [CAP_SCALE=0.5]
"""
from PIL import Image
import numpy as np, os, sys
from scipy.ndimage import distance_transform_edt, map_coordinates

CAP_SCALE = float(sys.argv[1]) if len(sys.argv) > 1 else 0.5
R = "/Users/drexolek/git/github/den-frie-vilje/gosscounselling.co.uk/design/assets"
S = os.path.dirname(os.path.abspath(__file__))

a = np.array(Image.open(f"{S}/john-white-clean.png").convert("RGBA")).astype(np.float32)
H, W, _ = a.shape
al = a[..., 3] / 255.0
cx, cy, r, _ = np.load(f"{S}/crown_final.npy")
chord = np.where(al[0] > 0.5)[0]
L, Rt = int(chord.min()), int(chord.max())


def ytop(x):
    c = al[:, x]
    i = int(np.argmax(c > 0.5))
    if c[i] <= 0.5 or i == 0:
        return None
    return i - 1 + (0.5 - c[i - 1]) / max(c[i] - c[i - 1], 1e-9)


# ---------- 1. the arc, scaled
x = np.arange(W, dtype=float)
ins = r * r - (x - cx) ** 2
arc = np.where(ins > 0, cy - np.sqrt(np.maximum(ins, 0)), np.inf)
rise = np.where(np.isfinite(arc), np.maximum(-arc, 0), 0) * CAP_SCALE
cap = rise.max()
PAD = int(np.ceil(cap)) + 16
span = np.where(rise > 0)[0]

out = np.zeros((H + PAD, W, 4), np.float32)
out[PAD:] = a
edge_y = PAD - rise                      # target edge, in padded coordinates

# ---------- 2. interior fill: his own scalp colour and grain
band = a[3:6, :, :3]
bw = (a[3:6, :, 3] >= 250).astype(np.float32)
C0 = (band * bw[..., None]).sum(0) / np.maximum(bw.sum(0), 1e-3)[..., None]
ok = bw.sum(0) > 0
idx = np.where(ok)[0]
for xi in np.where(~ok)[0]:
    C0[xi] = C0[idx[np.argmin(np.abs(idx - xi))]]
grain = a[6:6 + PAD + 20, :, :3] - a[6:6 + PAD + 20, :, :3].mean(axis=0, keepdims=True)
for y in range(PAD + 6):
    m = (y >= edge_y) & np.isin(np.arange(W), span)
    if not m.any():
        continue
    newc = C0 + grain[PAD + 5 - y]
    if y < PAD:
        out[y, m, :3] = newc[m]
        out[y, m, 3] = 255.0
    else:
        rep = m & (out[y, :, 3] < 250)
        out[y, rep, :3] = newc[rep]
        out[y, rep, 3] = 255.0

# ---------- 3. clone-stamp the edge from his real silhouette
srcs = []
for xs_ in list(range(L - 300, L - 8)) + list(range(Rt + 8, Rt + 301)):
    t = ytop(xs_)
    if t is None or t < 2:
        continue
    t2 = ytop(xs_ + 3)
    t0 = ytop(xs_ - 3)
    if t2 is None or t0 is None:
        continue
    srcs.append((xs_, t + PAD, np.arctan2(t2 - t0, 6.0)))     # x, y (padded), tangent angle

HALF = 7
acc_pm = np.zeros((H + PAD, W, 3), np.float32)   # premultiplied colour
acc_a = np.zeros((H + PAD, W), np.float32)
acc_w = np.zeros((H + PAD, W), np.float32)
src_pm = a[..., :3] * (a[..., 3:4] / 255.0)
src_a = a[..., 3]
rng = np.random.default_rng(11)
uu, vv = np.meshgrid(np.arange(-HALF, HALF + 1), np.arange(-HALF, HALF + 1))
feather = np.cos(np.clip(np.hypot(uu, vv) / (HALF + 1), 0, 1) * np.pi / 2)  # less overlap-averaging

step = 8
targets = np.arange(span.min(), span.max() + 1, step)
for tx in targets:
    ty = edge_y[tx]
    tx2 = min(tx + 3, W - 1); tx0 = max(tx - 3, 0)
    tang = np.arctan2(edge_y[tx2] - edge_y[tx0], float(tx2 - tx0))
    sx, sy, sang = srcs[int(rng.integers(len(srcs)))]
    dth = tang - sang + float(rng.normal(0, 0.05))            # match tangent, jitter slightly
    c_, s_ = np.cos(-dth), np.sin(-dth)
    su = sx + c_ * uu - s_ * vv
    sv = (sy - PAD) + s_ * uu + c_ * vv                        # source is unpadded
    coords = np.array([sv.ravel(), su.ravel()])
    pm = np.stack([map_coordinates(src_pm[..., k], coords, order=1, mode="nearest").reshape(uu.shape)
                   for k in range(3)], axis=-1)
    aa = map_coordinates(src_a, coords, order=1, mode="nearest").reshape(uu.shape)
    y0, y1 = int(round(ty)) - HALF, int(round(ty)) + HALF + 1
    x0, x1 = tx - HALF, tx + HALF + 1
    ys0, ys1 = max(y0, 0), min(y1, H + PAD)
    xs0, xs1 = max(x0, 0), min(x1, W)
    py0, px0 = ys0 - y0, xs0 - x0
    ph, pw = ys1 - ys0, xs1 - xs0
    f = feather[py0:py0 + ph, px0:px0 + pw]
    acc_pm[ys0:ys1, xs0:xs1] += pm[py0:py0 + ph, px0:px0 + pw] * f[..., None]
    acc_a[ys0:ys1, xs0:xs1] += aa[py0:py0 + ph, px0:px0 + pw] * f
    acc_w[ys0:ys1, xs0:xs1] += f

hit = acc_w > 1e-3
stamp_a = np.zeros_like(acc_a)
stamp_a[hit] = acc_a[hit] / acc_w[hit]
stamp_rgb = np.zeros_like(acc_pm)
nz = hit & (stamp_a > 1e-3)
stamp_rgb[nz] = acc_pm[nz] / np.maximum(acc_a[nz] / 255.0, 1e-3)[..., None] / np.maximum(acc_w[nz], 1e-3)[..., None]

# the stamped band governs only the outer edge; deeper in, the interior fill stands
depth = np.zeros((H + PAD, W), np.float32)
for xi in span:
    depth[:, xi] = np.arange(H + PAD) - edge_y[xi]
outer = hit & (depth > -3.0) & (depth < HALF * 0.9)   # stamped material may not float
                                                     # more than the natural fuzz above the arc
w_edge = np.clip((HALF * 0.55 - depth) / (HALF * 0.55), 0, 1) * outer
out[..., 3] = np.where(outer, np.maximum(out[..., 3] * (1 - w_edge), stamp_a * w_edge + out[..., 3] * (1 - w_edge)), out[..., 3])
for k in range(3):
    out[..., k] = np.where(outer & (stamp_a > 8), stamp_rgb[..., k] * w_edge + out[..., k] * (1 - w_edge), out[..., k])

# nothing survives above the arc beyond the fuzz band
for xi in span:
    cut = int(np.floor(edge_y[xi])) - 3
    if cut > 0:
        out[:cut, xi, 3] = 0
out[..., 3] = np.where(out[..., 3] < 6, 0, out[..., 3])

im = Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), "RGBA")
im = im.crop(im.getbbox())
im.save(f"{R}/john-cutout.webp", "WEBP", quality=92, alpha_quality=100, exact=True, method=6)

# ---------- 4. dark-ground variant
m = np.array(Image.open(f"{R}/john-cutout.webp").convert("RGBA")).astype(np.float32)
A = m[..., 3:4] / 255.0
RGB = m[..., :3]
core = A[..., 0] >= 0.97
_, ind = distance_transform_edt(~core, return_indices=True)
ext = RGB[ind[0], ind[1]]
w = np.clip((A[..., 0] - 0.05) / 0.92, 0, 1)[..., None]
RGB2 = RGB * w + ext * (1 - w)
A2 = np.clip((A - 0.16) / 0.84, 0, 1)
dist = distance_transform_edt(A2[..., 0] > 0.5)
wrap = np.clip((2.2 - dist) / 2.2, 0, 1) * (A2[..., 0] > 0.02)
RGB3 = RGB2 * (1 - 0.18 * wrap)[..., None]
Image.fromarray(np.dstack([np.clip(RGB3, 0, 255), np.clip(A2 * 255, 0, 255)]).astype(np.uint8),
                "RGBA").save(f"{R}/john-cutout-dark.webp", "WEBP",
                             quality=92, alpha_quality=100, exact=True, method=6)

# ---------- verification: the stamped edge should carry the same statistics as the real one
ba = np.array(Image.open(f"{R}/john-cutout.webp").convert("RGBA")).astype(np.float32)[..., 3] / 255.0
def stats(cols):
    rr = []
    for xi in cols:
        c = ba[:, xi]
        def cr(l):
            i = int(np.argmax(c > l))
            return None if c[i] <= l or i == 0 else i - 1 + (l - c[i - 1]) / max(c[i] - c[i - 1], 1e-9)
        v = (cr(.15), cr(.85), cr(.5))
        if None not in v:
            rr.append((v[1] - v[0], v[2]))
    rr = np.array(rr)
    sm = np.poly1d(np.polyfit(np.arange(len(rr)), rr[:, 1], 5))(np.arange(len(rr)))
    return rr[:, 0].mean(), (rr[:, 1] - sm).std()
print("CAP_SCALE %.2f -> crown %.2f px tall over %d px, %d stamped patches"
      % (CAP_SCALE, cap, len(span), len(targets)))
print("  stamped edge: ramp %.2f px, roughness %.3f px" % stats(range(L + 12, Rt - 12)))
print("  real edge   : ramp %.2f px, roughness %.3f px" % stats(range(L - 190, L - 10)))
ws = [int(np.ptp(np.where(ba[y] > 0.5)[0]) + 1) if (ba[y] > 0.5).sum() > 1 else 0 for y in range(14)]
print("  widths:", ws)
print("  light %.0f KB | dark %.0f KB"
      % (os.path.getsize(f"{R}/john-cutout.webp") / 1024,
         os.path.getsize(f"{R}/john-cutout-dark.webp") / 1024))
