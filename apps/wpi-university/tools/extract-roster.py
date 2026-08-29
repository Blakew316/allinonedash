#!/usr/bin/env python3
"""
Build assets/js/roster.js from a wpiuniversity.com site archive.

The People page reads the real roster - names, addresses, teams and training
progress - from the archive rather than from anything hand-written. Point this
at the unpacked archive and it regenerates that file:

    python3 tools/extract-roster.py path/to/wpiuniversity.com

Two sources are combined:
  users.html        the full roster: name, email, admin flag, sales team
  users/<id>.html   per-rep detail: user name, phone, permissions, learning
                    plans, and every course/lesson completion with its date

The roster contains personal data about real people. Treat the generated file
the way you would treat any export of your user table.
"""

import html
import json
import os
import re
import sys
from datetime import datetime

"""Cards are split on their own opening tag rather than matched against a
closing marker: a handful of rows in the archive have no Details link, and
anchoring on one lets a card without it swallow the card that follows."""
CARD_SPLIT_RE = re.compile(r'<div id="user_(\d+)" class="card my-3">')
FIELD_RE = re.compile(
    r'<div class="col-md-2 font-weight-bold">([^<]+)</div>\s*'
    r'<div class="col-md-10">(.*?)</div>', re.S)
COURSE_RE = re.compile(
    r'<div class="card my-3" id="training_course_([0-9a-f-]+)">(.*?)\n      </div>', re.S)
DETAIL_RE = re.compile(r'<dt>(.*?)</dt>\s*<dd>(.*?)</dd>', re.S)
PENDING_RE = re.compile(r'\(pending acceptance\)')
INVITED_RE = re.compile(
    r'<div class="col-md-2 font-weight-bold">Invited At</div>\s*'
    r'<div class="col-md-10">\s*(\d{2})/(\d{2})/(\d{4})', re.S)
PLAN_RE = re.compile(
    r'<div class="card my-3" id="learning_plan_[^"]*">\s*'
    r'<div class="card-header">(.*?)</div>\s*'
    r'<div class="card-body">(.*?)</div>', re.S)
DATE_RE = re.compile(r'(\d{2})/(\d{2})/(\d{4})')


def text(fragment):
    """Strip tags and collapse whitespace from a fragment of the archive."""
    return re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]*>', ' ', fragment))).strip()


def parse_roster(root):
    """The full list, in the order the archive presents it."""
    path = os.path.join(root, 'users.html')
    with open(path, encoding='utf-8', errors='replace') as fh:
        source = fh.read()

    marks = list(CARD_SPLIT_RE.finditer(source))
    people = []
    for n, mark in enumerate(marks):
        uid = mark.group(1)
        end = marks[n + 1].start() if n + 1 < len(marks) else len(source)
        body = source[mark.end():end]
        title = re.search(r'<h6 class="card-title">(.*?)</h6>', body, re.S)
        heading = text(title.group(1)) if title else ''
        record = {
            'id': int(uid),
            'name': heading,
            'email': '',
            'admin': False,
            'team': None,
            'pending': False,
            'invitedAt': None,
        }

        # An outstanding invitation is a different card: the heading is the
        # invited address, and there is no team, admin flag or detail page yet.
        if PENDING_RE.search(heading):
            record['pending'] = True
            record['email'] = PENDING_RE.sub('', heading).strip()
            record['name'] = record['email'].split('@')[0].replace('.', ' ').title()
            stamp = INVITED_RE.search(body)
            if stamp:
                record['invitedAt'] = '%s-%s-%s' % (
                    stamp.group(3), stamp.group(1), stamp.group(2))
            people.append(record)
            continue

        for label, value in FIELD_RE.findall(body):
            label, value = label.strip(), text(value)
            if label == 'Email':
                record['email'] = value
            elif label == 'Admin':
                record['admin'] = value.lower() == 'true'
            elif label == 'Sales Team':
                record['team'] = None if value == 'None' else value
        people.append(record)
    return people


def parse_detail(path):
    """Per-rep detail, including every recorded lesson completion."""
    with open(path, encoding='utf-8', errors='replace') as fh:
        source = fh.read()

    out = {'username': None, 'phone': None, 'permissions': [],
           'plans': [], 'courses': [], 'lessons': 0, 'done': 0, 'last': None}

    for label, value in DETAIL_RE.findall(source):
        label, value = label.strip(), text(value)
        if label == 'User name':
            out['username'] = value or None
        elif label == 'Phone Number':
            out['phone'] = None if value in ('', 'None') else value
        elif label == 'Permissions':
            out['permissions'] = [p for p in value.split('  ') if p]

    plans = re.search(r'<h4>Learning Plans</h4>(.*?)<h4>Training Progress</h4>', source, re.S)
    if plans:
        for name, status in PLAN_RE.findall(plans.group(1)):
            name, status = text(name), text(status)
            if not name:
                continue
            completed = 'Completed on' in status
            entry = {'name': name, 'status': 'completed' if completed else 'assigned'}
            if completed:
                stamp = DATE_RE.search(status)
                if stamp:
                    entry['on'] = '%s-%s-%s' % (stamp.group(3), stamp.group(1), stamp.group(2))
            out['plans'].append(entry)

    dates = []
    for match in COURSE_RE.finditer(source):
        body = match.group(2)
        title = re.search(r'<div class="col-sm-6 font-weight-bold">(.*?)</div>', body, re.S)
        header = re.search(r'<div class="col-sm-6 text-sm-right">(.*?)</div>', body, re.S)
        header_text = text(header.group(1)) if header else ''
        rows = re.findall(
            r'<div class="col-sm-6">(.*?)</div>\s*'
            r'<div class="col-sm-6 text-sm-right">(.*?)</div>', body, re.S)
        finished = sum(1 for _n, st in rows
                       if re.search(r'Finished|Pass|Skipped to end', text(st)))
        out['courses'].append({
            'title': text(title.group(1)) if title else '',
            'complete': header_text.startswith('Completed'),
            'lessons': len(rows),
            'finished': finished,
        })
        out['lessons'] += len(rows)
        out['done'] += finished
        for _n, st in rows:
            dates += DATE_RE.findall(text(st))
        dates += DATE_RE.findall(header_text)

    if dates:
        parsed = []
        for mm, dd, yyyy in dates:
            try:
                parsed.append(datetime(int(yyyy), int(mm), int(dd)))
            except ValueError:
                pass
        if parsed:
            out['last'] = max(parsed).strftime('%Y-%m-%d')
    return out


def main():
    root = sys.argv[1] if len(sys.argv) > 1 else 'wpiuniversity.com'
    if not os.path.isfile(os.path.join(root, 'users.html')):
        sys.exit('No users.html under %r - point this at the archive root.' % root)

    people = parse_roster(root)
    print('%d people in users.html' % len(people))

    enriched = 0
    for record in people:
        if record['pending']:
            continue
        path = os.path.join(root, 'users', '%d.html' % record['id'])
        if not os.path.isfile(path):
            continue
        detail = parse_detail(path)
        record.update({
            'detail': True,
            'username': detail['username'],
            'phone': bool(detail['phone']),
            'permissions': detail['permissions'],
            'plans': detail['plans'],
            'coursesAssigned': len(detail['courses']),
            'coursesComplete': sum(1 for c in detail['courses'] if c['complete']),
            'lessonsAssigned': detail['lessons'],
            'lessonsComplete': detail['done'],
            'last': detail['last'],
        })
        enriched += 1
    print('%d enriched from detail pages' % enriched)

    for record in people:
        record.setdefault('username', None)
        record.setdefault('phone', False)
        record.setdefault('permissions', [])
        record.setdefault('plans', [])
        for key in ('coursesAssigned', 'coursesComplete',
                    'lessonsAssigned', 'lessonsComplete'):
            record.setdefault(key, 0)
        record.setdefault('last', None)
        record.setdefault('detail', False)
        record['progress'] = (
            round(record['lessonsComplete'] / record['lessonsAssigned'] * 100)
            if record['lessonsAssigned'] else 0)

        # 'unknown' is deliberately distinct from 'none': the crawl did not
        # capture a detail page for every accepted user, and reporting those
        # as untrained would overstate how many people have done nothing.
        if record['pending']:
            record['status'] = 'pending'
        elif not record.get('detail'):
            record['status'] = 'unknown'
        elif record['lessonsComplete']:
            record['status'] = 'active'
        elif record['lessonsAssigned']:
            record['status'] = 'assigned'
        else:
            record['status'] = 'none'

    teams = sorted({p['team'] for p in people if p['team']})
    payload = {
        'source': 'wpiuniversity.com site archive',
        'people': people,
        'teams': teams,
        'totals': {
            'people': len(people),
            'accepted': sum(1 for p in people if not p['pending']),
            'pending': sum(1 for p in people if p['pending']),
            'detailed': sum(1 for p in people if p.get('detail')),
            'admins': sum(1 for p in people if p['admin']),
            'teams': len(teams),
            'active': sum(1 for p in people if p['status'] == 'active'),
            'lessonsComplete': sum(p['lessonsComplete'] for p in people),
            'certified': sum(1 for p in people
                             if any(pl['status'] == 'completed' for pl in p['plans'])),
        },
    }

    out_path = os.path.normpath(
        os.path.join(os.path.dirname(os.path.abspath(__file__)),
                     '..', 'assets', 'js', 'roster.js'))
    with open(out_path, 'w', encoding='utf-8') as fh:
        fh.write('/* Generated by tools/extract-roster.py from the wpiuniversity.com\n'
                 '   site archive. Real people - do not publish. */\n')
        fh.write('window.WPI_ROSTER = ')
        json.dump(payload, fh, ensure_ascii=False, separators=(',', ':'))
        fh.write(';\n')
    print('wrote', out_path)
    print(json.dumps(payload['totals'], indent=1))


if __name__ == '__main__':
    main()
