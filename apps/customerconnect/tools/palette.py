#!/usr/bin/env python3
"""Derive the site's brand palette from a logo image.

Pure standard library — this environment has no Pillow — so PNG is decoded here
directly (zlib + the five PNG scanline filters). SVG logos are read as text and
scanned for colour literals instead.

    python3 tools/palette.py assets/img/logo.png
    python3 tools/palette.py assets/img/logo.png --css   # emit the CSS token block

Output is the dominant ink colours of the mark, ranked by coverage, plus a
proposed `--wp-*` scale built from the strongest chromatic colour. Near-white,
near-black, and transparent pixels are ignored so the logo's background and
outlines don't drown out the brand hue.
"""

import argparse
import collections
import colorsys
import os
import re
import struct
import sys
import zlib

# --------------------------------------------------------------------------
# PNG decoding
# --------------------------------------------------------------------------

CHANNELS = {0: 1, 2: 3, 3: 1, 4: 2, 6: 4}


def _paeth(a, b, c):
    p = a + b - c
    pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
    if pa <= pb and pa <= pc:
        return a
    return b if pb <= pc else c


def read_png(path):
    """Return (width, height, [(r, g, b, a), ...]) for a non-interlaced PNG."""
    with open(path, "rb") as fh:
        data = fh.read()
    if data[:8] != b"\x89PNG\r\n\x1a\n":
        raise ValueError("not a PNG file")

    pos, idat, plte, trns, hdr = 8, [], None, None, None
    while pos < len(data):
        (length,) = struct.unpack(">I", data[pos:pos + 4])
        kind = data[pos + 4:pos + 8]
        body = data[pos + 8:pos + 8 + length]
        pos += 12 + length
        if kind == b"IHDR":
            hdr = struct.unpack(">IIBBBBB", body)
        elif kind == b"IDAT":
            idat.append(body)
        elif kind == b"PLTE":
            plte = body
        elif kind == b"tRNS":
            trns = body
        elif kind == b"IEND":
            break

    if hdr is None:
        raise ValueError("PNG has no IHDR")
    width, height, depth, color, _comp, _filt, interlace = hdr
    if interlace:
        raise ValueError("interlaced PNG is not supported — re-save without Adam7")
    if depth not in (8, 16):
        raise ValueError("unsupported bit depth %d — re-save as 8-bit" % depth)

    nch = CHANNELS[color]
    step = nch * (depth // 8)
    stride = width * step
    raw = zlib.decompress(b"".join(idat))

    # undo the per-scanline filters
    out, prev, pos = bytearray(), bytearray(stride), 0
    for _ in range(height):
        ftype = raw[pos]
        line = bytearray(raw[pos + 1:pos + 1 + stride])
        pos += 1 + stride
        if ftype == 1:
            for i in range(step, stride):
                line[i] = (line[i] + line[i - step]) & 0xFF
        elif ftype == 2:
            for i in range(stride):
                line[i] = (line[i] + prev[i]) & 0xFF
        elif ftype == 3:
            for i in range(stride):
                left = line[i - step] if i >= step else 0
                line[i] = (line[i] + ((left + prev[i]) >> 1)) & 0xFF
        elif ftype == 4:
            for i in range(stride):
                left = line[i - step] if i >= step else 0
                upleft = prev[i - step] if i >= step else 0
                line[i] = (line[i] + _paeth(left, prev[i], upleft)) & 0xFF
        elif ftype != 0:
            raise ValueError("unknown PNG filter type %d" % ftype)
        out += line
        prev = line

    # widen to RGBA
    px, skip = [], depth // 8
    for i in range(0, len(out), step):
        chunk = out[i:i + step]
        vals = [chunk[j * skip] for j in range(nch)]
        if color == 0:
            px.append((vals[0], vals[0], vals[0], 255))
        elif color == 4:
            px.append((vals[0], vals[0], vals[0], vals[1]))
        elif color == 2:
            px.append((vals[0], vals[1], vals[2], 255))
        elif color == 6:
            px.append((vals[0], vals[1], vals[2], vals[3]))
        elif color == 3:
            idx = vals[0]
            r, g, b = plte[idx * 3], plte[idx * 3 + 1], plte[idx * 3 + 2]
            a = trns[idx] if trns and idx < len(trns) else 255
            px.append((r, g, b, a))
    return width, height, px


def read_svg(path):
    """Pull colour literals out of an SVG so the same pipeline works on vectors."""
    with open(path, encoding="utf-8", errors="ignore") as fh:
        text = fh.read()
    px = []
    for hexv in re.findall(r"#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})", text):
        if len(hexv) == 3:
            hexv = "".join(c * 2 for c in hexv)
        px.append((int(hexv[0:2], 16), int(hexv[2:4], 16), int(hexv[4:6], 16), 255))
    for r, g, b in re.findall(r"rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)", text):
        px.append((int(r), int(g), int(b), 255))
    return 0, 0, px


# --------------------------------------------------------------------------
# Palette analysis
# --------------------------------------------------------------------------

def hexs(rgb):
    return "#%02x%02x%02x" % tuple(int(round(c)) for c in rgb[:3])


def relative_luminance(rgb):
    def lin(c):
        c /= 255.0
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    r, g, b = (lin(c) for c in rgb[:3])
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def contrast(a, b):
    la, lb = relative_luminance(a), relative_luminance(b)
    hi, lo = max(la, lb), min(la, lb)
    return (hi + 0.05) / (lo + 0.05)


def dominant(px, buckets=24, min_alpha=200):
    """Rank colours by coverage, ignoring transparency, near-white and near-black."""
    counter = collections.Counter()
    carrier = {}
    for r, g, b, a in px:
        if a < min_alpha:
            continue
        h, l, s = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
        if l > 0.94 or l < 0.06:      # paper and pure black carry no brand signal
            continue
        key = (r // (256 // buckets), g // (256 // buckets), b // (256 // buckets))
        counter[key] += 1
        # keep the most saturated representative of each bucket
        cur = carrier.get(key)
        if cur is None or s > cur[1]:
            carrier[key] = ((r, g, b), s)
    total = sum(counter.values()) or 1
    ranked = []
    for key, n in counter.most_common(40):
        rgb, sat = carrier[key]
        h, l, s = colorsys.rgb_to_hls(rgb[0] / 255, rgb[1] / 255, rgb[2] / 255)
        ranked.append(dict(rgb=rgb, hex=hexs(rgb), share=n / total,
                           hue=h * 360, sat=s, light=l))
    return ranked, total


def pick_brand(ranked):
    """The brand colour is the one that is both well-covered and actually chromatic."""
    scored = [c for c in ranked if c["sat"] >= 0.15]
    if not scored:
        scored = ranked
    return max(scored, key=lambda c: c["share"] * (0.35 + c["sat"])) if scored else None


def build_scale(base):
    """Derive the --wp-* ramp by moving lightness around the logo's own hue."""
    h, l, s = colorsys.rgb_to_hls(*[c / 255 for c in base["rgb"]])
    steps = {900: 0.07, 850: 0.10, 800: 0.16, 750: 0.22, 700: 0.28,
             600: 0.37, 500: 0.47, 400: 0.56, 300: 0.68, 200: 0.80,
             100: 0.89, 50: 0.95}
    out = {}
    for token, light in steps.items():
        # keep deep tones rich and light tones soft, like a hand-tuned ramp
        sat = s * (1.05 if light < 0.4 else 0.92 if light < 0.8 else 0.62)
        r, g, b = colorsys.hls_to_rgb(h, light, min(sat, 1.0))
        out[token] = hexs((r * 255, g * 255, b * 255))
    return out


def emit_css(scale, base, accent):
    lines = ["  /* Brand — derived from the logo (%s) */" % base["hex"]]
    for token in sorted(scale, reverse=True):
        lines.append("  --wp-%d: %s;" % (token, scale[token]))
    if accent:
        lines.append("")
        lines.append("  --gold-500: %s;  /* secondary logo colour */" % accent["hex"])
    return "\n".join(lines)


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("image", help="path to the logo (.png or .svg)")
    ap.add_argument("--css", action="store_true", help="print the CSS token block only")
    ap.add_argument("--top", type=int, default=8, help="how many colours to list")
    args = ap.parse_args()

    if not os.path.exists(args.image):
        sys.exit("no such file: %s" % args.image)

    ext = os.path.splitext(args.image)[1].lower()
    if ext == ".svg":
        w, h, px = read_svg(args.image)
    elif ext == ".png":
        w, h, px = read_png(args.image)
    else:
        sys.exit("unsupported format %s — PNG or SVG only (no imaging library here)" % ext)

    ranked, total = dominant(px)
    if not ranked:
        sys.exit("no brand-carrying pixels found — the image may be all white/black")

    base = pick_brand(ranked)
    others = [c for c in ranked if c["hex"] != base["hex"]]
    accent = None
    for c in others:
        if c["sat"] >= 0.3 and abs(c["hue"] - base["hue"]) > 40:
            accent = c
            break
    scale = build_scale(base)

    if args.css:
        print(emit_css(scale, base, accent))
        return

    print("%s — %s" % (args.image, ("%dx%d, " % (w, h) if w else "") +
                       "%d brand pixels sampled" % total))
    print()
    print("Dominant colours")
    for c in ranked[:args.top]:
        print("  %-9s %5.1f%%  hue %3.0f°  sat %.2f  light %.2f%s"
              % (c["hex"], c["share"] * 100, c["hue"], c["sat"], c["light"],
                 "   <- brand" if c["hex"] == base["hex"] else
                 "   <- accent" if accent and c["hex"] == accent["hex"] else ""))
    print()
    print("Contrast of the brand colour")
    print("  on white  %.2f:1 %s" % (contrast(base["rgb"], (255, 255, 255)),
                                     "(AA for normal text)" if contrast(base["rgb"], (255, 255, 255)) >= 4.5
                                     else "(large text only)"))
    print("  white on it %.2f:1" % contrast(base["rgb"], (255, 255, 255)))
    print()
    print("Proposed scale")
    print(emit_css(scale, base, accent))


if __name__ == "__main__":
    main()
