#!/usr/bin/env python3
"""Classement final par catégorie — LECTURE SEULE.
Score = moyenne des 2 meilleurs vélos (tours) + points / 20.
Tours « app » (comptés pendant la course) ; entre crochets : version règle 2 min + arrêt 16:30:00 si différente."""
import csv, io, json, subprocess, urllib.request
from datetime import datetime
from zoneinfo import ZoneInfo
TZ, UTC = ZoneInfo('Europe/Brussels'), ZoneInfo('UTC')
FIN = datetime(2026, 10, 3, 16, 30, 0, tzinfo=TZ).astimezone(UTC).replace(tzinfo=None)
live = json.load(urllib.request.urlopen('http://127.0.0.1:8092/api/live', timeout=15))
out = subprocess.run(['docker', 'compose', 'exec', '-T', 'db', 'psql', '-U', 'ft', '-d', 'ft', '-c',
    'COPY (SELECT "dossardNumber", timestamp FROM "RaceLapEvent" ORDER BY 1, 2) TO STDOUT WITH CSV'], cwd='/opt/ft', capture_output=True, text=True, check=True).stdout
times = {}
for n, t in csv.reader(io.StringIO(out)): times.setdefault(int(n), []).append(datetime.fromisoformat(t[:23]))
def rule(n):
    last, c = None, 0
    for t in times.get(n, []):
        if t > FIN or (last and (t - last).total_seconds() < 120): continue
        c += 1; last = t
    return c
teams = {t['id']: t for t in live['teams']}
rows_csv = []
def rank(group, key):
    by = {}
    for b in live['bikes']:
        if b['group'] == group: by.setdefault(b['teamId'], []).append(b[key] if key == 'laps' else rule(b['number']) + b['adjustment'])
    res = []
    for tid, laps in by.items():
        best = sorted(laps, reverse=True)[:2]; avg = sum(best) / len(best); pts = teams[tid]['points']
        res.append((avg + pts / 20, avg, pts, tid, sorted(laps, reverse=True)))
    return sorted(res, key=lambda r: (-r[0], -r[1]))
print(f"\nCLASSEMENT FINAL — score = moyenne 2 meilleurs vélos + points/20   ({datetime.now(TZ):%H:%M:%S})")
for c in live['contests']:
    app, reg = rank(c['key'], 'laps'), rank(c['key'], 'rule')
    reg_pos = {r[3]: (i, r) for i, r in enumerate(reg, 1)}
    print(f"\n=== {c['name'].upper()} ===")
    print(f" {'Rg':>2}  {'Écurie':<24} {'Moy.2 vélos':>11} {'Points':>7} {'Pts/20':>7} {'SCORE':>7}")
    for i, (score, avg, pts, tid, laps) in enumerate(app, 1):
        ri, r = reg_pos[tid]
        note = f"   [règle 2 min : score {r[0]:.2f}, rang {ri}]" if (ri != i or abs(r[0] - score) > 1e-9) else ''
        print(f" {i:>2}  {teams[tid]['name'][:24]:<24} {avg:>11.1f} {pts:>7} {pts / 20:>7.2f} {score:>7.2f}{note}")
        rows_csv.append({'Classement': c['name'], 'Rang': i, 'Écurie': teams[tid]['name'], 'Tours vélos': ' / '.join(map(str, laps)),
                         'Moyenne 2 meilleurs': str(avg).replace('.', ','), 'Points': pts, 'Points/20': str(pts / 20).replace('.', ','),
                         'Score': str(round(score, 2)).replace('.', ','), 'Rang (règle 2 min)': ri, 'Score (règle 2 min)': str(round(r[0], 2)).replace('.', ',')})
path = f"/root/exports/classement-final-{datetime.now(TZ):%H%M}.csv"
with open(path, 'w', encoding='utf-8-sig', newline='') as f:
    w = csv.DictWriter(f, fieldnames=list(rows_csv[0]), delimiter=';'); w.writeheader(); w.writerows(rows_csv)
print(f"\nscp root@76.13.62.105:{path} ~/Downloads/")
