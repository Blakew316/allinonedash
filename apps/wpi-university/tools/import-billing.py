#!/usr/bin/env python3
"""
Build assets/js/billing.js from a WPI billing history export.

    python3 tools/import-billing.py path/to/WPI_Billing_Records

The folder is the one unpacked from WPI_Billing_Records.zip, containing
invoices.csv, payments.csv and an invoice_records/ directory of PDFs. The
.xlsx in the same packet holds the same two tables plus a summary of formulas,
so the CSVs are read instead and every total is recomputed here.

Invoice PDFs are copied to assets/billing/invoices/ so each row can link to
one. Per the export's own README these were generated from the account's
records rather than issued by the billing provider, and the Billing page says
so — they are a convenience copy, not a vendor document.

Payments carry no invoice reference, so they are matched to invoices by
billing window. That inference is recorded in the output as `matched: false`
wherever a payment could not be placed, and the page reports the count.
"""

import argparse
import csv
import json
import os
import shutil
import sys
from collections import Counter
from datetime import datetime

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, '..'))
OUT_JS = os.path.join(ROOT, 'assets', 'js', 'billing.js')
PDF_DIR = os.path.join(ROOT, 'assets', 'billing', 'invoices')


def money(value):
    try:
        return round(float(value or 0), 2)
    except ValueError:
        return 0.0


def date(value):
    value = (value or '').strip()
    if not value:
        return None
    for fmt in ('%Y-%m-%d', '%m/%d/%Y', '%Y-%m-%dT%H:%M:%S'):
        try:
            return datetime.strptime(value[:len(fmt) + 2], fmt).strftime('%Y-%m-%d')
        except ValueError:
            continue
    return value[:10]


def read_csv(path):
    with open(path, newline='', encoding='utf-8-sig') as fh:
        return list(csv.DictReader(fh))


def main():
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('folder', help='unpacked WPI_Billing_Records folder')
    parser.add_argument('--no-pdfs', action='store_true',
                        help='skip copying invoice PDFs into the site')
    args = parser.parse_args()

    inv_path = os.path.join(args.folder, 'invoices.csv')
    pay_path = os.path.join(args.folder, 'payments.csv')
    for path in (inv_path, pay_path):
        if not os.path.isfile(path):
            sys.exit('Missing %s — point this at the unpacked WPI_Billing_Records folder.'
                     % os.path.basename(path))

    raw_invoices = read_csv(inv_path)
    raw_payments = read_csv(pay_path)

    pdf_src = os.path.join(args.folder, 'invoice_records')
    pdfs = {}
    if os.path.isdir(pdf_src):
        for name in os.listdir(pdf_src):
            if not name.lower().endswith('.pdf'):
                continue
            # invoice_<number>_<date>.pdf
            parts = name.split('_')
            if len(parts) >= 2:
                pdfs[parts[1]] = name

    invoices = []
    for row in raw_invoices:
        number = (row.get('invoice_number') or '').strip()
        amount = money(row.get('amount'))
        paid = money(row.get('paid'))
        remaining = money(row.get('remaining'))
        invoices.append({
            'number': number,
            'issued': date(row.get('issued')),
            'due': date(row.get('due')),
            'amount': amount,
            'paid': paid,
            'remaining': remaining,
            'status': 'paid' if remaining <= 0 and paid >= amount else (
                'partial' if paid > 0 else 'open'),
            'autoCharge': (row.get('auto_charge') or '').strip().lower() == 'yes',
            'description': (row.get('description') or '').strip(),
            'period': (row.get('service_period') or '').strip(),
            'pdf': ('assets/billing/invoices/' + pdfs[number]) if number in pdfs else None,
        })
    invoices.sort(key=lambda i: (i['issued'] or '', i['number']))

    payments = []
    for row in raw_payments:
        status = (row.get('status') or '').strip()
        payments.append({
            'date': date(row.get('date')),
            'processedAt': (row.get('processed_at') or '').strip(),
            'amount': money(row.get('amount')),
            'applied': money(row.get('applied')),
            'status': status,
            'ok': status.lower() == 'complete',
            'txn': (row.get('gateway_transaction_id') or '').strip(),
            'invoice': None,
        })
    payments.sort(key=lambda p: (p['date'] or '', p['processedAt']))

    # The export publishes no invoice-to-payment link, so a successful payment
    # is attributed to the most recent invoice issued on or before it.
    unmatched = 0
    for payment in payments:
        if not payment['ok'] or not payment['date']:
            continue
        candidates = [i for i in invoices if i['issued'] and i['issued'] <= payment['date']]
        if candidates:
            payment['invoice'] = candidates[-1]['number']
        else:
            unmatched += 1

    invoiced = round(sum(i['amount'] for i in invoices), 2)
    paid = round(sum(i['paid'] for i in invoices), 2)
    outstanding = round(sum(i['remaining'] for i in invoices), 2)
    applied = round(sum(p['applied'] for p in payments), 2)
    declined = [p for p in payments if not p['ok']]

    # Group declines into runs so the page can talk about clusters rather
    # than eight isolated failures.
    clusters, current = [], []
    for payment in declined:
        if current and (datetime.strptime(payment['date'], '%Y-%m-%d')
                        - datetime.strptime(current[-1]['date'], '%Y-%m-%d')).days > 45:
            clusters.append(current)
            current = []
        current.append(payment)
    if current:
        clusters.append(current)

    rates = Counter()
    for i in invoices:
        rates[i['amount']] += 1

    payload = {
        'account': {
            'name': 'Wholesale Payments (WPI University / ISO Amp)',
            'portal': 'www.wpiuniversity.com/isoamp',
            'billingEmail': 'ap@wholesalepayments.com',
            'plan': 'Custom Training $500',
            'planAmount': 500,
            'termStart': '2026-01-12',
            'termEnd': '2026-09-12',
            'autoRenew': True,
        },
        'totals': {
            'invoices': len(invoices),
            'invoiced': invoiced,
            'paid': paid,
            'outstanding': outstanding,
            'attempts': len(payments),
            'complete': sum(1 for p in payments if p['ok']),
            'declined': len(declined),
            'applied': applied,
            'first': invoices[0]['issued'] if invoices else None,
            'last': invoices[-1]['issued'] if invoices else None,
            'unmatchedPayments': unmatched,
            'declineClusters': [
                {'from': c[0]['date'], 'to': c[-1]['date'], 'count': len(c)}
                for c in clusters
            ],
        },
        'invoices': invoices,
        'payments': payments,
    }

    if not args.no_pdfs and os.path.isdir(pdf_src):
        os.makedirs(PDF_DIR, exist_ok=True)
        for name in pdfs.values():
            shutil.copy2(os.path.join(pdf_src, name), os.path.join(PDF_DIR, name))
        print('copied %d invoice PDFs to %s' % (len(pdfs), os.path.relpath(PDF_DIR, ROOT)))

    with open(OUT_JS, 'w', encoding='utf-8') as fh:
        fh.write('/* Generated by tools/import-billing.py from the account billing export.\n'
                 '   Real financial records for this account — keep this repository private.\n\n'
                 '   Payments carry no invoice reference in the source, so each successful\n'
                 '   charge is attributed to the most recent invoice issued on or before it.\n'
                 '   That is an inference, not something the platform states. */\n')
        fh.write('window.WPI_BILLING = ')
        json.dump(payload, fh, ensure_ascii=False, separators=(',', ':'))
        fh.write(';\n')

    print('wrote %s' % os.path.relpath(OUT_JS, ROOT))
    print('  %d invoices, %s invoiced, %s paid, %s outstanding'
          % (len(invoices), '${:,.2f}'.format(invoiced),
             '${:,.2f}'.format(paid), '${:,.2f}'.format(outstanding)))
    print('  %d charge attempts, %d complete, %d declined in %d cluster(s)'
          % (len(payments), payload['totals']['complete'], len(declined), len(clusters)))
    if invoiced != paid:
        print('  NOTE: invoiced and paid differ by %s'
              % '${:,.2f}'.format(round(invoiced - paid, 2)))
    if applied != paid:
        print('  NOTE: payments applied (%s) differ from invoices paid (%s)'
              % ('${:,.2f}'.format(applied), '${:,.2f}'.format(paid)))
    if unmatched:
        print('  NOTE: %d payment(s) could not be matched to an invoice' % unmatched)


if __name__ == '__main__':
    main()
