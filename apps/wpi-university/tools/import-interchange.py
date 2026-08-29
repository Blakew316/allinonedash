#!/usr/bin/env python3
"""
Build assets/js/interchange.js from the Appendix G interchange rate/fee schedule.

    python3 tools/import-interchange.py path/to/Appendix_G_Interchange_Rate_Fee_Schedule.pdf

The PDF is the processor's published "Fee Schedule — Interchange Plus Merchants"
(Fiserv RSA.S22.IC). Every interchange rate the proposal generator quotes comes
from this file, so the parse is strict: a line that does not match the table
shape exactly is reported, never guessed at.

Layout notes that drive the parser
----------------------------------
Each table page prints two columns side by side, and text extraction joins them
onto one line:

    005 VI-DOMESTIC CASH ADVANCE 0.00% $2.00 069 INTERREGIONAL STANDARD 1.60% $0.00

Entries are therefore read left to right, anchored: each must begin exactly
where the previous one ended. Free-floating search would latch onto code-shaped
tokens inside program names ("MC-B2B VIP 12" contains "B2B"), which is how a
name gets silently truncated.

A long program name wraps, leaving a code and a partial name dangling at the end
of one line and its rate on the next:

    ... 1.85% $0.00 K18 Intraregional Consumer Rate III: Base – Enhanced Super
    Premium 1.00% $0.00

so any unmatched tail that starts with a program code is carried forward.

Brand comes from the program name where it is prefixed (VI-, MC-, DSCVR-, PSL).
Seventy network-neutral programs carry no prefix at all ("INTERREGIONAL
STANDARD", "Intraregional Consumer Rate II: Card Present - Core", "Key Entry
(Rewards)"), and those inherit the brand of the nearest prefixed program in the
same column.

Nearest neighbour rather than a per-page or per-column majority, because a
section can change brand part way down a column: page 14 runs Mastercard
prepaid down the right hand side and then starts Discover credit below it, so
any majority vote mislabels one half of the column.
"""

import argparse
import json
import os
import re
import sys
from collections import Counter, defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, '..'))
OUT_JS = os.path.join(ROOT, 'assets', 'js', 'interchange.js')

# A program code is three characters: three digits, or a letter then two
# alphanumerics (A06, H71, J02, K14, N07, P09). Large ticket per-item runs to
# $39.00, so the item amount is not capped.
CODE = r'(?:[0-9]{3}|[A-Z][0-9A-Z]{2})'
ENTRY = re.compile(r'\s*(' + CODE + r')\s+'          # program code
                   r'(\S.*?)\s+'                     # program name
                   r'([0-9]+\.[0-9]{2})%\s+'         # rate
                   r'\$([0-9]+\.[0-9]{2})')          # per item
DANGLING = re.compile(r'^\s*' + CODE + r'\s+\S')

# Column headers and banners that the extractor mixes into the table text.
HEADER = re.compile(r'PC\s+Interchange Program\s+Rate\s+Per\s+Item')
BANNER = re.compile(r'^(RSA\.|Fee Schedule|Refer to the|Mastercard, Visa and Discover|'
                    r'PC\s+Interchange|Visa Credit|MasterCard Credit|Mastercard Credit|'
                    r'Discover Network Credit|Visa \(DB\)|MasterCard \(DB\)|'
                    r'Mastercard \(DB\)|Discover Network \(DB\)|\*Non-PIN|'
                    r'INTERCHANGE RATE|Your Credit Card|A significant|Interchange Fee|'
                    r'Each Interchange|The amount|Please note|the schedule|'
                    r'[0-9]{4} Fiserv|respective owners|than the intended|'
                    r'distributed in any)')

PREFIX_BRAND = (
    ('VI-', 'visa'), ('VI ', 'visa'),
    ('MC-', 'mastercard'), ('MC ', 'mastercard'),
    ('DSCVR', 'discover'), ('PSL', 'discover'), ('DISCOVER', 'discover'),
)


def brand_prefix(name):
    upper = name.upper()
    for prefix, brand in PREFIX_BRAND:
        if upper.startswith(prefix):
            return brand
    return None


# The schedule is inconsistent about how it marks a non-credit program. Most
# carry a parenthesised (DB) or (PP), but forty-eight use a bare suffix instead
# — "MC-CHARITIES DB", "DSCVR PSL PETRO PP", "MC-AUTO RENTAL DEBIT" — so the
# marker is matched on a word boundary rather than by its parentheses.
DEBIT = re.compile(r'(?:^|[\s(])(?:DB|DEBIT)(?:$|[\s)(])')
PREPAID = re.compile(r'(?:^|[\s(])(?:PP|PREPAID|PRE[\s-]?PAID)(?:$|[\s)(])')


def kind_of(name):
    """Credit, non-PIN debit, or prepaid."""
    upper = name.upper()
    if PREPAID.search(upper):
        return 'prepaid'
    if DEBIT.search(upper):
        return 'debit'
    return 'credit'


def parse_line(line):
    """Read entries left to right, anchored. Returns (entries, unmatched tail)."""
    entries, pos = [], 0
    while pos < len(line):
        m = ENTRY.match(line, pos)
        if not m:
            break
        name = re.sub(r'\s+', ' ', m.group(2)).strip().rstrip('*').strip()
        entries.append((m.group(1), name, float(m.group(3)), float(m.group(4))))
        pos = m.end()
    return entries, line[pos:].strip()


def main():
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('pdf', help='Appendix G interchange schedule PDF')
    parser.add_argument('--report', action='store_true',
                        help='print every parsed program instead of a summary')
    args = parser.parse_args()

    try:
        from pypdf import PdfReader
    except ImportError:
        sys.exit('pypdf is required: pip install pypdf')

    reader = PdfReader(args.pdf)
    pages = [(p.extract_text() or '') for p in reader.pages]

    raw = []          # (page, column, code, name, rate, item, brand-or-None)
    unparsed = []

    for page_no, text in enumerate(pages, start=1):
        # Pages without the column header carry the cover and closing prose, not
        # rates. Skipping them keeps the unparsed report meaningful.
        if not HEADER.search(text):
            continue
        carry = ''
        for line in text.split('\n'):
            line = HEADER.sub(' ', line).strip()
            if not line:
                continue
            if BANNER.match(line) and not carry:
                continue
            if carry:
                line = carry + ' ' + line
                carry = ''
            entries, tail = parse_line(line)
            if tail:
                if DANGLING.match(tail):
                    carry = tail          # name wrapped onto the next line
                elif entries:
                    unparsed.append((page_no, 'trailing: ' + tail))
                else:
                    unparsed.append((page_no, line))
            for column, (code, name, rate, item) in enumerate(entries):
                raw.append([page_no, column, code, name, round(rate, 4),
                            round(item, 4), brand_prefix(name)])
        if carry:
            unparsed.append((page_no, 'unterminated: ' + carry))

    # Network-neutral programs inherit the brand of the nearest prefixed program
    # in the same column, scanning outward from their own position. Distance is
    # measured in rows, and a tie goes to the program above.
    columns = defaultdict(list)
    for index, row in enumerate(raw):
        columns[(row[0], row[1])].append(index)
    unresolved = []
    for indexes in columns.values():
        brands = [raw[i][6] for i in indexes]
        for slot, brand in enumerate(brands):
            if brand:
                continue
            found = None
            for step in range(1, len(brands)):
                above = brands[slot - step] if slot - step >= 0 else None
                below = brands[slot + step] if slot + step < len(brands) else None
                if above:
                    found = above
                    break
                if below:
                    found = below
                    break
            if found:
                raw[indexes[slot]][6] = found
            else:
                unresolved.append(raw[indexes[slot]])

    seen, rows = set(), []
    repeats = 0
    for page_no, column, code, name, rate, item, brand in raw:
        key = (brand, code, name)
        if key in seen:
            continue
        seen.add(key)
        if any(k[0] == brand and k[1] == code for k in seen if k != key):
            repeats += 1
        rows.append({'code': code, 'name': name, 'rate': rate, 'item': item,
                     'brand': brand, 'kind': kind_of(name), 'page': page_no})

    order = {'credit': 0, 'debit': 1, 'prepaid': 2}
    rows.sort(key=lambda e: (e['brand'], order[e['kind']], e['code'], e['name']))

    by_brand = Counter(e['brand'] for e in rows)
    by_kind = Counter((e['brand'], e['kind']) for e in rows)

    payload = {
        'source': {
            'document': 'Interchange Rate/Fee Schedule (Appendix G)',
            'reference': 'RSA.S22.IC — US.IC.ACTUAL INTERCHANGE',
            'scope': 'Fee Schedule — Interchange Plus Merchants',
            'note': ('Interchange only. Network dues and assessments are charged '
                     'in addition, per the schedule itself.'),
            'programs': len(rows),
        },
        'programs': rows,
    }

    with open(OUT_JS, 'w', encoding='utf-8') as fh:
        fh.write("/* Generated by tools/import-interchange.py from the processor's\n"
                 '   Interchange Rate/Fee Schedule (Appendix G, RSA.S22.IC).\n\n'
                 '   Every interchange rate the proposal generator quotes comes from\n'
                 '   here. Do not hand-edit: re-run the importer against a newer\n'
                 '   schedule when the networks publish one.\n\n'
                 '   Interchange only — network dues and assessments are charged in\n'
                 '   addition, and are configured in assets/js/pricing.js. */\n')
        fh.write('window.WPI_INTERCHANGE = ')
        json.dump(payload, fh, ensure_ascii=False, separators=(',', ':'))
        fh.write(';\n')

    print('wrote %s' % os.path.relpath(OUT_JS, ROOT))
    print('  %d interchange programs from %d pages' % (len(rows), len(pages)))
    for brand in ('visa', 'mastercard', 'discover'):
        parts = ', '.join('%d %s' % (by_kind[(brand, k)], k)
                          for k in ('credit', 'debit', 'prepaid') if by_kind[(brand, k)])
        print('  %-11s %4d  (%s)' % (brand, by_brand[brand], parts))
    print('  rate range %.2f%%–%.2f%%, per item $%.2f–$%.2f'
          % (min(e['rate'] for e in rows), max(e['rate'] for e in rows),
             min(e['item'] for e in rows), max(e['item'] for e in rows)))
    if repeats:
        print('  note: %d program code(s) appear twice within a brand under '
              'different names (both kept, as printed)' % repeats)
    if unresolved:
        print('  WARNING: %d program(s) could not be assigned a brand' % len(unresolved))
        for row in unresolved[:10]:
            print('    p%-3d col%d %s %s' % (row[0], row[1], row[2], row[3][:60]))
    if unparsed:
        print('  WARNING: %d line(s) did not parse cleanly:' % len(unparsed))
        for page_no, line in unparsed[:20]:
            print('    p%-3d %s' % (page_no, line[:150]))
    if not unparsed and not unresolved:
        print('  every table line parsed and every program resolved to a brand')

    if args.report:
        for e in rows:
            print('%-4s %-11s %-8s %-56s %6.2f%%  $%8.2f  p%d'
                  % (e['code'], e['brand'], e['kind'], e['name'][:56],
                     e['rate'], e['item'], e['page']))


if __name__ == '__main__':
    main()
