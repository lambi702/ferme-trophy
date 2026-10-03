#!/usr/bin/env python3
"""
Résultats de fin de course — LECTURE SEULE (aucune écriture en base).
Lit l'état réel depuis l'app (127.0.0.1:8092, donc PAS la photo du gel public).

Par classement (parcours · catégorie), écuries triées par la MOYENNE DES 2
MEILLEURS VÉLOS ; affiche tours par vélo, total écurie, moyenne et points.
Tours = tours chrono + bonus/malus/corrections (détail entre parenthèses).

Usage : python3 /opt/ft/scripts/resultats.py
Écrit aussi /root/exports/resultats-<heure>.csv (s'ouvre dans Excel).
"""
import csv, json, os, urllib.request
from datetime import datetime
from zoneinfo import ZoneInfo

data = json.load(urllib.request.urlopen('http://127.0.0.1:8092/api/live', timeout=15))
now = datetime.now(ZoneInfo('Europe/Brussels'))
teams = {t['id']: t for t in data['teams']}

rows_out = []
print(f"\nRÉSULTATS FERME TROPHY — {now:%d/%m %H:%M:%S}  ({data['totalLaps']} passages chrono au total)")
for c in data['contests']:
    bikes = [b for b in data['bikes'] if b['group'] == c['key']]
    by_team = {}
    for b in bikes:
        by_team.setdefault(b['teamId'], []).append(b)
    results = []
    for tid, tb in by_team.items():
        tb.sort(key=lambda b: (-b['laps'], b['number']))
        best2 = tb[:2]
        avg = sum(b['laps'] for b in best2) / len(best2)
        results.append({
            'team': teams[tid], 'bikes': tb, 'total': sum(b['laps'] for b in tb),
            'avg': avg, 'best': tb[0]['laps'], 'note': '' if len(tb) >= 2 else '⚠️ 1 seul vélo',
        })
    # Départage : moyenne, puis meilleur vélo, puis total écurie.
    results.sort(key=lambda r: (-r['avg'], -r['best'], -r['total']))

    print(f"\n{'=' * 96}\n {c['name'].upper()}  —  {len(results)} écuries, {len(bikes)} vélos\n{'=' * 96}")
    print(f" {'Rg':>2}  {'Écurie':<26} {'Vélos (tours)':<40} {'Total':>5} {'Moy.2':>6} {'Pts':>5}")
    rank, prev = 0, None
    for i, r in enumerate(results, 1):
        key = (r['avg'], r['best'], r['total'])
        if key != prev:
            rank = i
        prev = key
        detail = '  '.join(f"#{b['number']}:{b['laps']}" + (f"({b['adjustment']:+d})" if b['adjustment'] else '') for b in r['bikes'])
        tie = ' =' if sum(1 for x in results if (x['avg'], x['best'], x['total']) == key) > 1 else ''
        print(f" {rank:>2}{tie:<2}{r['team']['name'][:26]:<26} {detail:<40} {r['total']:>5} {r['avg']:>6.1f} {r['team']['points']:>5} {r['note']}")
        rows_out.append({
            'Classement': c['name'], 'Rang': rank, 'Écurie': r['team']['name'], 'Unité': r['team']['unitName'],
            'Section': r['team']['sectionName'],
            **{f'Vélo {k + 1}': f"#{b['number']}" for k, b in enumerate(r['bikes'][:3])},
            **{f'Tours vélo {k + 1}': b['laps'] for k, b in enumerate(r['bikes'][:3])},
            **{f'Bonus/malus vélo {k + 1}': b['adjustment'] for k, b in enumerate(r['bikes'][:3])},
            'Total tours écurie': r['total'], 'Moyenne 2 meilleurs': str(round(r['avg'], 2)).replace('.', ','),
            'Points restants': r['team']['points'], 'Points gagnés': r['team']['earned'], 'Points dépensés': r['team']['spent'],
        })

os.makedirs('/root/exports', exist_ok=True)
path = f"/root/exports/resultats-{now:%Y%m%d-%H%M%S}.csv"
fields = list(dict.fromkeys(k for r in rows_out for k in r))
with open(path, 'w', encoding='utf-8-sig', newline='') as f:
    w = csv.DictWriter(f, fieldnames=fields, delimiter=';')
    w.writeheader(); w.writerows(rows_out)
print(f"\nFichier : {path}\nTélécharger sur ton Mac : scp root@76.13.62.105:{path} ~/Downloads/\n")
