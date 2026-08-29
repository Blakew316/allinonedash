#!/usr/bin/env python3
"""Row-level comparison for the card-processing statement (template 2).

Usage: python3 test/compare2.py <reference.pdf> <generated.pdf> [--tol 0.8]

The reference generator mixes positioned words and real spaces, so word
tokenization differs from ours; rows are therefore compared as clusters:
squished text (spaces removed), first x0, last x1 and top must match.
Band/line geometry is compared with stroke color and width.
Excluded: the left print-margin (x<32) and the page-1 IMb barcode zone
(drawn as font glyphs in the reference, as rects in ours).
"""
import sys
import pdfplumber

TOL = 0.8

def rows_of(page, page_no):
    # space glyphs (some trailing runs of them pad reference lines) are
    # invisible — drop them; the gap-based text join re-inserts word breaks
    chars = [c for c in page.chars if c["x0"] > 32 and c["text"] != " "]
    if page_no == 1:
        chars = [c for c in chars if not (193 < c["top"] < 209)]
    rows = []
    for c in sorted(chars, key=lambda c: (c["top"], c["x0"])):
        if rows and abs(c["top"] - rows[-1]["top"]) <= 2.0:
            rows[-1]["chars"].append(c)
        else:
            rows.append({"top": c["top"], "chars": [c]})
    out = []
    for r in rows:
        cs = sorted(r["chars"], key=lambda c: c["x0"])
        text = "".join(c["text"] for c in cs).replace(" ", "")
        if not text:
            continue
        out.append({
            "text": text,
            "x0": cs[0]["x0"],
            "x1": max(c["x1"] for c in cs),
            "top": min(c["top"] for c in cs),
            "size": round(cs[0]["size"], 1),
        })
    return out

def lines_of(page):
    out = []
    for l in page.lines:
        col = l.get("stroking_color")
        col = tuple(round(c, 2) for c in col) if isinstance(col, (list, tuple)) else (col,)
        # skip corner/registration ticks outside content
        if l["x1"] < 32 or l["x0"] > 596 or l["top"] > 780:
            continue
        out.append({
            "x0": l["x0"], "x1": l["x1"],
            "top": round((l["top"] + l["bottom"]) / 2, 2),
            "lw": round(l.get("linewidth") or 0, 2),
            "col": col,
        })
    return out

def close(a, b, tol):
    return abs(a - b) <= tol

def main():
    ref_path, gen_path = sys.argv[1], sys.argv[2]
    tol = TOL
    if "--tol" in sys.argv:
        tol = float(sys.argv[sys.argv.index("--tol") + 1])

    issues = 0
    with pdfplumber.open(ref_path) as ref, pdfplumber.open(gen_path) as gen:
        if len(ref.pages) != len(gen.pages):
            print(f"PAGE COUNT ref={len(ref.pages)} gen={len(gen.pages)}")
            issues += 1
        for pi in range(min(len(ref.pages), len(gen.pages))):
            rr = rows_of(ref.pages[pi], pi + 1)
            gr = rows_of(gen.pages[pi], pi + 1)
            rl = lines_of(ref.pages[pi])
            gl = lines_of(gen.pages[pi])
            page_issues = []

            pool = list(gr)
            for r in rr:
                best = None
                for cand in pool:
                    if cand["text"] != r["text"]:
                        continue
                    d = abs(cand["top"] - r["top"]) + abs(cand["x0"] - r["x0"])
                    if best is None or d < best[0]:
                        best = (d, cand)
                if best is None:
                    near = [c for c in pool if close(c["top"], r["top"], 2.5) and close(c["x0"], r["x0"], 3)]
                    if near:
                        page_issues.append(f"TEXT top={r['top']:.1f} ref='{r['text'][:60]}' gen='{near[0]['text'][:60]}'")
                        pool.remove(near[0])
                    else:
                        page_issues.append(f"MISS row '{r['text'][:60]}' at ({r['x0']:.1f},{r['top']:.1f})")
                    continue
                d, cand = best
                dx, dy, dw = cand["x0"] - r["x0"], cand["top"] - r["top"], cand["x1"] - r["x1"]
                if not (close(cand["x0"], r["x0"], tol) and close(cand["top"], r["top"], tol)):
                    page_issues.append(f"POS  '{r['text'][:40]}' d=({dx:+.2f},{dy:+.2f})")
                elif not close(cand["x1"], r["x1"], max(tol, 1.5)):
                    page_issues.append(f"WID  '{r['text'][:40]}' ref_x1={r['x1']:.1f} gen_x1={cand['x1']:.1f}")
                pool.remove(cand)
            for cand in pool:
                page_issues.append(f"XTRA row '{cand['text'][:60]}' at ({cand['x0']:.1f},{cand['top']:.1f})")

            gpool = list(gl)
            for l in rl:
                best = None
                for cand in gpool:
                    d = (abs(cand["x0"] - l["x0"]) + abs(cand["x1"] - l["x1"]) +
                         abs(cand["top"] - l["top"]) + abs(cand["lw"] - l["lw"]))
                    if best is None or d < best[0]:
                        best = (d, cand)
                if best is None or best[0] > tol * 4 + 0.6:
                    page_issues.append(
                        f"LINE ref ({l['x0']:.1f},{l['top']:.1f})-({l['x1']:.1f}) lw={l['lw']} col={l['col']}"
                        + (f" closest_d={best[0]:.2f}" if best else ""))
                    continue
                if best[1]["col"] != l["col"]:
                    page_issues.append(f"LCOL at ({l['x0']:.1f},{l['top']:.1f}) ref={l['col']} gen={best[1]['col']}")
                gpool.remove(best[1])
            for cand in gpool:
                page_issues.append(f"XLIN gen ({cand['x0']:.1f},{cand['top']:.1f})-({cand['x1']:.1f}) lw={cand['lw']}")

            status = "OK" if not page_issues else f"{len(page_issues)} issue(s)"
            print(f"--- page {pi+1}: rows ref={len(rr)} gen={len(gr)}, lines ref={len(rl)} gen={len(gl)} -> {status}")
            for line in page_issues[:70]:
                print("   ", line)
            issues += len(page_issues)

    print(f"\nTOTAL ISSUES: {issues}")
    sys.exit(0 if issues == 0 else 1)

main()
