#!/usr/bin/env python3
"""Crop the supplied logo artwork into the variants the site actually uses.

The source lockup carries ~22% empty width and ~60% empty height around the
ink, so dropping it straight into the header renders the mark far smaller than
its box suggests. This trims to the true ink bounds and also cuts a mark-only
version (the bar glyph) for the dark footer, where the navy wordmark would not
read.

Pure standard library — decodes via tools/palette.read_png and re-encodes here.

    python3 tools/crop_logo.py assets/logo.png
"""

import argparse
import colorsys
import os
import struct
import sys
import zlib

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from palette import read_png                                          # noqa: E402


def _chunk(kind, body):
    payload = kind + body
    return (struct.pack(">I", len(body)) + payload
            + struct.pack(">I", zlib.crc32(payload) & 0xFFFFFFFF))


def write_png(path, w, h, px):
    """Write 8-bit RGBA, filter type 0 (Up-filtering buys little on flat art)."""
    raw = bytearray()
    for y in range(h):
        raw.append(0)
        for x in range(w):
            raw += bytes(px[y * w + x])
    data = (b"\x89PNG\r\n\x1a\n"
            + _chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0))
            + _chunk(b"IDAT", zlib.compress(bytes(raw), 9))
            + _chunk(b"IEND", b""))
    with open(path, "wb") as fh:
        fh.write(data)


def ink_bounds(w, h, px, predicate):
    minx, miny, maxx, maxy = w, h, -1, -1
    for y in range(h):
        row = y * w
        for x in range(w):
            if predicate(px[row + x]):
                if x < minx: minx = x
                if x > maxx: maxx = x
                if y < miny: miny = y
                if y > maxy: maxy = y
    if maxx < 0:
        return None
    return minx, miny, maxx, maxy


def crop(w, h, px, box, pad=0):
    minx, miny, maxx, maxy = box
    minx, miny = max(0, minx - pad), max(0, miny - pad)
    maxx, maxy = min(w - 1, maxx + pad), min(h - 1, maxy + pad)
    cw, ch = maxx - minx + 1, maxy - miny + 1
    out = []
    for y in range(miny, maxy + 1):
        out.extend(px[y * w + minx: y * w + maxx + 1])
    return cw, ch, out


def is_ink(p):
    r, g, b, a = p
    return a >= 24 and not (r > 246 and g > 246 and b > 246)


def is_chromatic(p):
    """The bar glyph: saturated blue/green, as opposed to the navy wordmark."""
    r, g, b, a = p
    if a < 128:
        return False
    hh, ll, ss = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
    hue = hh * 360
    return ss > 0.45 and 0.30 < ll < 0.85 and 90 <= hue <= 215


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("source", nargs="?", default="assets/logo.png")
    ap.add_argument("--outdir", default="assets/img")
    args = ap.parse_args()

    w, h, px = read_png(args.source)
    print("source        %dx%d" % (w, h))

    full = ink_bounds(w, h, px, is_ink)
    if not full:
        sys.exit("no ink found in %s" % args.source)
    cw, ch, cpx = crop(w, h, px, full)
    out_full = os.path.join(args.outdir, "logo.png")
    write_png(out_full, cw, ch, cpx)
    print("lockup        %dx%d  aspect %.3f  -> %s (%d bytes)"
          % (cw, ch, cw / ch, out_full, os.path.getsize(out_full)))

    glyph = ink_bounds(w, h, px, is_chromatic)
    if glyph:
        # keep the glyph's full vertical extent from the lockup crop so the
        # bars are not clipped by the saturation test at their soft edges
        gx0, _gy0, gx1, _gy1 = glyph
        box = (gx0, full[1], gx1, full[3])
        mw, mh, mpx = crop(w, h, px, box)
        out_mark = os.path.join(args.outdir, "mark.png")
        write_png(out_mark, mw, mh, mpx)
        print("mark          %dx%d  aspect %.3f  -> %s (%d bytes)"
              % (mw, mh, mw / mh, out_mark, os.path.getsize(out_mark)))

        # square, transparent-padded favicon cut from the same pixels
        side = max(mw, mh)
        pad = int(side * 0.12)
        canvas = side + pad * 2
        ox, oy = (canvas - mw) // 2, (canvas - mh) // 2
        sq = [(0, 0, 0, 0)] * (canvas * canvas)
        for y in range(mh):
            for x in range(mw):
                sq[(y + oy) * canvas + (x + ox)] = mpx[y * mw + x]
        out_icon = os.path.join(args.outdir, "favicon.png")
        write_png(out_icon, canvas, canvas, sq)
        print("favicon       %dx%d  -> %s (%d bytes)"
              % (canvas, canvas, out_icon, os.path.getsize(out_icon)))
    else:
        print("mark          no chromatic glyph detected — skipped")


if __name__ == "__main__":
    main()
