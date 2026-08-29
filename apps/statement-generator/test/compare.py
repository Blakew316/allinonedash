#!/usr/bin/env python3
"""Compare a generated statement PDF against a reference statement PDF.

Usage: python3 test/compare.py <reference.pdf> <generated.pdf> [--tol 0.8]

Compares, page by page:
  - every word's text, x0, top, x1 and font style (bold/light/regular suffix)
  - every visible rule/rect (non-white fills)

Exits non-zero when position mismatches exceed tolerance.
"""
import sys
import pdfplumber

TOL = 0.8

def style(fontname):
    n = fontname.split("+")[-1]
    for suffix in ("ExtraLight", "Bold"):
        if suffix in n:
            return suffix
    return "Regular"

def words_of(page):
    out = []
    for w in page.extract_words(extra_attrs=["fontname", "size"]):
        out.append({
            "text": w["text"],
            "x0": w["x0"], "x1": w["x1"], "top": w["top"],
            "style": style(w["fontname"]), "size": round(w["size"], 1),
        })
    return out

def rects_of(page):
    out = []
    for r in page.rects:
        fill = r.get("non_stroking_color")
        if fill is None:
            continue
        if isinstance(fill, (int, float)):
            fill = (fill,)
        # skip white/near-white backgrounds
        if all(c >= 0.99 for c in fill):
            continue
        out.append({
            "x0": r["x0"], "x1": r["x1"], "top": r["top"], "bottom": r["bottom"],
            "fill": tuple(round(c, 3) for c in fill),
        })
    return out

def close(a, b, tol=TOL):
    return abs(a - b) <= tol

def main():
    ref_path, gen_path = sys.argv[1], sys.argv[2]
    tol = TOL
    if "--tol" in sys.argv:
        tol = float(sys.argv[sys.argv.index("--tol") + 1])

    issues = 0
    with pdfplumber.open(ref_path) as ref, pdfplumber.open(gen_path) as gen:
        if len(ref.pages) != len(gen.pages):
            print(f"PAGE COUNT: ref={len(ref.pages)} gen={len(gen.pages)}")
            issues += 1
        for pi in range(min(len(ref.pages), len(gen.pages))):
            rw, gw = words_of(ref.pages[pi]), words_of(gen.pages[pi])
            rr, gr = rects_of(ref.pages[pi]), rects_of(gen.pages[pi])
            page_issues = []

            gw_pool = list(gw)
            for w in rw:
                # exact text match near expected position
                best = None
                for cand in gw_pool:
                    if cand["text"] != w["text"]:
                        continue
                    d = abs(cand["x0"] - w["x0"]) + abs(cand["top"] - w["top"])
                    if best is None or d < best[0]:
                        best = (d, cand)
                if best is None:
                    # same position, different text?
                    for cand in gw_pool:
                        if close(cand["x0"], w["x0"], tol) and close(cand["top"], w["top"], tol):
                            page_issues.append(
                                f"TEXT  ({w['x0']:.1f},{w['top']:.1f}) ref='{w['text']}' gen='{cand['text']}'")
                            gw_pool.remove(cand)
                            break
                    else:
                        page_issues.append(
                            f"MISS  ref word '{w['text']}' at ({w['x0']:.1f},{w['top']:.1f})")
                    continue
                d, cand = best
                if not (close(cand["x0"], w["x0"], tol) and close(cand["top"], w["top"], tol)):
                    page_issues.append(
                        f"POS   '{w['text']}' ref=({w['x0']:.2f},{w['top']:.2f}) "
                        f"gen=({cand['x0']:.2f},{cand['top']:.2f}) "
                        f"d=({cand['x0']-w['x0']:+.2f},{cand['top']-w['top']:+.2f})")
                elif not close(cand["x1"], w["x1"], max(tol, 1.2)):
                    page_issues.append(
                        f"WIDTH '{w['text']}' ref_x1={w['x1']:.2f} gen_x1={cand['x1']:.2f}")
                if cand["style"] != w["style"]:
                    page_issues.append(
                        f"STYLE '{w['text']}' ref={w['style']} gen={cand['style']}")
                gw_pool.remove(cand)
            for cand in gw_pool:
                page_issues.append(
                    f"EXTRA gen word '{cand['text']}' at ({cand['x0']:.1f},{cand['top']:.1f})")

            gr_pool = list(gr)
            for r in rr:
                best = None
                for cand in gr_pool:
                    d = (abs(cand["x0"] - r["x0"]) + abs(cand["top"] - r["top"]) +
                         abs(cand["x1"] - r["x1"]) + abs(cand["bottom"] - r["bottom"]))
                    if best is None or d < best[0]:
                        best = (d, cand)
                if best is None or best[0] > tol * 4:
                    got = f" closest d={best[0]:.2f}" if best else ""
                    page_issues.append(
                        f"RECT  ref ({r['x0']:.1f},{r['top']:.1f})-({r['x1']:.1f},{r['bottom']:.1f}) "
                        f"fill={r['fill']}{got}")
                    continue
                gr_pool.remove(best[1])
            for cand in gr_pool:
                page_issues.append(
                    f"XRECT gen ({cand['x0']:.1f},{cand['top']:.1f})-({cand['x1']:.1f},{cand['bottom']:.1f}) fill={cand['fill']}")

            status = "OK" if not page_issues else f"{len(page_issues)} issue(s)"
            print(f"--- page {pi+1}: words ref={len(rw)} gen={len(gw)}, "
                  f"rects ref={len(rr)} gen={len(gr)} -> {status}")
            for line in page_issues[:60]:
                print("   ", line)
            issues += len(page_issues)

    print(f"\nTOTAL ISSUES: {issues}")
    sys.exit(0 if issues == 0 else 1)

main()
