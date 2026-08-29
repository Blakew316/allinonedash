"""Regenerate PWA app icons: the official bar-mark (cropped from the user's own
logo file, never redrawn) shrunk to sit above the wording "WPI Track".

Masters are built at 1024 and downsampled, so small sizes stay crisp.
The maskable icon keeps all content inside the 80% safe zone.
"""
from PIL import Image, ImageChops, ImageDraw, ImageFont
import numpy as np

SRC = "/home/user/wpimaverickappts/assets/logo.png"
OUT = "/home/user/wpimaverickappts/assets/icons"
NAVY = (22, 32, 79, 255)          # #16204F — brand navy
WHITE = (255, 255, 255, 255)
FONT = "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"

# ---- crop the bar mark out of the official logo -------------------------
im = Image.open(SRC).convert("RGBA")
a = np.array(im)
alpha = a[..., 3].astype(int)
rgb = a[..., :3].astype(int)
content = (alpha > 16) & (rgb.sum(axis=2) < 3 * 245)

cols = content.any(axis=0)
rows = content.any(axis=1)
x0, x1 = np.argmax(cols), len(cols) - np.argmax(cols[::-1])
y0, y1 = np.argmax(rows), len(rows) - np.argmax(rows[::-1])

# mark/wordmark separator = widest blank column run in the left half
col_has = cols[x0:x1]
runs, start = [], None
for i, c in enumerate(col_has):
    if not c and start is None:
        start = i
    elif c and start is not None:
        runs.append((start, i - start)); start = None
left = [r for r in runs if r[0] < len(col_has) * 0.5]
sep = max(left, key=lambda r: r[1])
mark_x1 = x0 + sep[0]

mrows = content[:, x0:mark_x1].any(axis=1)
my0, my1 = np.argmax(mrows), len(mrows) - np.argmax(mrows[::-1])
mark = im.crop((x0, my0, mark_x1, my1))
print("mark crop:", mark.size, "aspect(w/h): %.3f" % (mark.size[0] / mark.size[1]))


def fit_font(text, target_w):
    """Largest font size whose rendered text width is <= target_w."""
    lo, hi = 8, 400
    while lo < hi:
        mid = (lo + hi + 1) // 2
        f = ImageFont.truetype(FONT, mid)
        if ImageDraw.Draw(Image.new("RGB", (1, 1))).textbbox((0, 0), text, font=f)[2] <= target_w:
            lo = mid
        else:
            hi = mid - 1
    return ImageFont.truetype(FONT, lo)


def build(size, fill, text="WPI Track", rounded=False):
    """Mark above wording, the pair centred as one block on the navy tile.
    `fill` = fraction of the tile width the wording spans."""
    font = fit_font(text, int(size * fill))
    probe = ImageDraw.Draw(Image.new("RGB", (1, 1)))
    tb = probe.textbbox((0, 0), text, font=font)
    tw, th = tb[2] - tb[0], tb[3] - tb[1]

    mark_h = int(th * 2.5)                      # mark reads taller than the word
    mw, mh = mark.size
    mark_w = max(1, int(mw * mark_h / mh))
    gap = int(th * 0.60)

    # compose on transparency, then centre by the block's TRUE ink bounds
    layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    ld = ImageDraw.Draw(layer)
    y = (size - (mark_h + gap + th)) // 2
    art = mark.resize((mark_w, mark_h), Image.LANCZOS)
    layer.paste(art, ((size - mark_w) // 2, y), art)
    ld.text(((size - tw) // 2 - tb[0], y + mark_h + gap - tb[1]), text, font=font, fill=WHITE)

    bb = layer.getbbox()
    layer = ImageChops.offset(layer, (size - bb[0] - bb[2]) // 2, (size - bb[1] - bb[3]) // 2)

    img = Image.new("RGBA", (size, size), NAVY)
    img.paste(layer, (0, 0), layer)

    if rounded:                                  # apple-touch: soft square corners
        r = int(size * 0.22)
        m = Image.new("L", (size, size), 0)
        ImageDraw.Draw(m).rounded_rectangle([0, 0, size - 1, size - 1], radius=r, fill=255)
        out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        out.paste(img, (0, 0), m)
        img = out
    return img


M = 1024
regular = build(M, 0.70)                 # standard icons
maskable = build(M, 0.62)                # content inside the 80% safe circle
apple = build(M, 0.70)                   # iOS applies its own mask; keep square art

for name, master, size in [
    ("icon-512.png", regular, 512),
    ("icon-192.png", regular, 192),
    ("icon-maskable-512.png", maskable, 512),
    ("apple-touch-icon.png", apple, 180),
]:
    master.resize((size, size), Image.LANCZOS).convert("RGB").save(f"{OUT}/{name}")
    print("wrote", name, size)

# safe-zone check for the maskable icon: every lit pixel inside the centre circle
chk = np.array(maskable.convert("RGB")).astype(int)
bg = np.array(NAVY[:3])
lit = (np.abs(chk - bg).sum(axis=2) > 40)
ys, xs = np.nonzero(lit)
cx = cy = M / 2
rad = np.sqrt(((xs - cx) ** 2 + (ys - cy) ** 2)).max()
# safe zone = circle of radius 40% of the icon size (= 80% of the half-width)
pct = 100 * rad / (M * 0.4)
print("maskable: furthest content at %.1f%% of the safe-zone radius (must be <100%%)" % pct)
assert pct < 100, "maskable content escapes the safe zone"
