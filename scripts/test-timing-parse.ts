/**
 * Tests du parseur chrono (formats RaceResult réels + variantes).
 * Usage : npx tsx scripts/test-timing-parse.ts   (aucune base nécessaire)
 */
import assert from 'node:assert/strict'
import { parseParams, parsePassingTime, parseTimingPayload as parse } from '../src/lib/timing/parse'

let passed = 0
function test(name: string, fn: () => void) {
  try {
    fn()
    passed++
    console.log(`  ✓ ${name}`)
  } catch (err) {
    console.error(`  ✗ ${name}\n`, err)
    process.exitCode = 1
  }
}
const bibs = (r: { bib: number }[]) => r.map((x) => x.bib)

console.log('RaceResult — exporters par défaut')
test('Raw Data Record JSON (objet imbriqué, UTCTime prioritaire)', () => {
  const r = parse(JSON.stringify({
    ID: 1, Bib: 50001, TimingPoint: 'STARTFINISH', Result: -10, Time: 32795.944, Invalid: false,
    Passing: { Transponder: 'ZICAD30', Hits: 75, PassingNo: 1, UTCTime: '2024-01-12T09:06:35.944Z', Received: '2024-01-12T09:07:43.15+01:00' },
  }))
  assert.deepEqual(r, [{ bib: 50001, time: '2024-01-12T09:06:35.944Z', externalId: '1', timingPoint: 'STARTFINISH' }])
})
test('Raw Data Record JSON marqué Invalid → ignoré', () => {
  assert.equal(parse('{"ID":2,"Bib":12,"Time":100.5,"Invalid":true}').length, 0)
})
test('Raw Data Record V2', () => {
  const r = parse('7750;12;;10:50:00.477;0;72;127;;1;1;1;;16731;2,9;17;0;D-5662;;0;D-5662')
  assert.deepEqual(r, [{ bib: 12, time: '10:50:00.477', externalId: '7750@10:50:00.477' }])
})
test('Raw Data Record V1 (plusieurs lignes)', () => {
  const r = parse('7750;12;;10:50:00.477;0;72;127;;1;1;1;16731;2,9;17;0;D-5662;;0;D-5662\n7751;13;;10:50:02.100;0;72;127;;1;1;1;16731;2,9;17;0;D-5662;;0;D-5662')
  assert.deepEqual(bibs(r), [12, 13])
})
test('Raw Data V2 avec code transpondeur (pas de dossard) → ignoré, pas lu comme #52', () => {
  assert.equal(parse('7750;ZCMBG52;;10:50:00.477;0;72;127;;1;1;1;;16731;2,9;17;0;D-5662;;0;D-5662').length, 0)
})
test('RunScore RSBCI', () => {
  assert.deepEqual(parse('RSBCI,12,10:50:00.477,START+FINISH'), [{ bib: 12, time: '10:50:00.477', timingPoint: 'START+FINISH' }])
})

console.log('RaceResult — expressions perso / listes')
test('[Event.ID];[RD_TimingPoint];[Bib];[RD_Time] → dossard = entier avant l\'heure', () => {
  assert.deepEqual(parse('123456;STARTFINISH;12;51785.32'), [{ bib: 12, time: '51785.32' }])
})
test('Liste data/list JSON sans en-tête [[bib, nom, tours]] → compteurs', () => {
  assert.deepEqual(parse('[[12,"Faucons",5],[13,"Loups",4]]'), [{ bib: 12, laps: 5 }, { bib: 13, laps: 4 }])
})
test('Liste avec en-tête RD_*', () => {
  const r = parse('RD_ID;RD_IDBib;RD_Time;RD_TimingPoint\n981;12;14:03:22.418;FINISH')
  assert.deepEqual(r, [{ bib: 12, time: '14:03:22.418', externalId: '981', timingPoint: 'FINISH' }])
})
test('CSV avec en-tête Bib;Laps', () => {
  assert.deepEqual(parse('Bib;Name;Laps\n12;A;7\n13;B;6'), [{ bib: 12, laps: 7 }, { bib: 13, laps: 6 }])
})
test('Liste groupée {"#1_Vélos": [[...]], "#2_...": [[...]]}', () => {
  assert.deepEqual(bibs(parse('{"#1_A":[[1,"x",3]],"#2_B":[[2,"y",4]]}')), [1, 2])
})
test('Filtre point de chrono', () => {
  const r = parse('RD_IDBib;RD_Time;RD_TimingPoint\n12;10:00:00;START\n12;10:05:00;FINISH', '', { timingPoint: 'finish' })
  assert.deepEqual(r, [{ bib: 12, time: '10:05:00', timingPoint: 'FINISH' }])
})
test('Colonnes forcées par numéro (sans en-tête)', () => {
  const r = parse('999;X;12;7', '', { bibField: '3', lapsField: '4' })
  assert.deepEqual(r, [{ bib: 12, laps: 7 }])
})
test('Colonne forcée par nom', () => {
  assert.deepEqual(parse('[{"StartNo":"x","Startnummer":"12","Rondes":3}]', '', { bibField: 'Startnummer' }), [{ bib: 12, laps: 3 }])
})

console.log('Webhooks / GET / divers')
test('Webhook RaceResult (POST JSON, champs imbriqués, EventID ≠ id de passage)', () => {
  const r = parse('{"EventID":"123456","WebhookID":7,"Timestamp":"2026-10-02T13:00:00Z","RawData":{"ID":55,"Bib":12,"Time":51785.3}}')
  assert.equal(r[0].bib, 12)
  assert.equal(r[0].externalId, '55')
})
test('GET ?bib=12&time=…', () => {
  assert.deepEqual(parseParams(new URLSearchParams('bib=12&time=14:03:22.418&token=x')), [{ bib: 12, time: '14:03:22.418' }])
})
test('GET ?data=<lignes RSBCI>', () => {
  assert.deepEqual(bibs(parseParams(new URLSearchParams('data=RSBCI%2C12%2C10%3A50%3A00.477%2CFINISH'))), [12])
})
test('Texte brut une ligne par dossard', () => {
  assert.deepEqual(bibs(parse('12\n#13\n\n14')), [12, 13, 14])
})
test('"12;5" → compteur, "12;14:03:22" → passage', () => {
  assert.deepEqual(parse('12;5'), [{ bib: 12, laps: 5 }])
  assert.deepEqual(parse('12;14:03:22'), [{ bib: 12, time: '14:03:22' }])
})
test('Formulaire', () => {
  assert.deepEqual(parse('bib=8&time=51785.3', 'application/x-www-form-urlencoded'), [{ bib: 8, time: '51785.3' }])
})
test('Ordures → rien', () => {
  assert.equal(parse('<html>404</html>').length, 0)
  assert.equal(parse('[]').length, 0)
  assert.equal(parse('{"error":"not found"}').length, 0)
})

console.log('Heures')
const ref = new Date('2026-10-02T10:00:00Z') // 12:00 à Bruxelles (CEST)
test('HH:MM:SS.mmm = heure de Bruxelles', () => {
  assert.equal(parsePassingTime('14:03:22.418', ref)?.toISOString(), '2026-10-02T12:03:22.418Z')
})
test('Secondes depuis minuit (format RaceResult)', () => {
  assert.equal(parsePassingTime('51785.3', ref)?.toISOString(), '2026-10-02T12:23:05.300Z')
})
test('ISO UTC / ISO avec offset / date locale', () => {
  assert.equal(parsePassingTime('2024-01-12T09:06:35.944Z')?.toISOString(), '2024-01-12T09:06:35.944Z')
  assert.equal(parsePassingTime('2024-01-12T09:07:43.15+01:00')?.toISOString(), '2024-01-12T08:07:43.150Z')
  assert.equal(parsePassingTime('2026-10-02 14:00:00')?.toISOString(), '2026-10-02T12:00:00.000Z')
})
test('Illisible → null', () => {
  assert.equal(parsePassingTime('demain'), null)
})

console.log(`\n${passed} test(s) OK${process.exitCode ? ' — ÉCHECS ci-dessus' : ''}`)
