import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import ts from 'typescript';

const file = fileURLToPath(new URL('../app/lib/car-extras.ts', import.meta.url));
const exports = {};
vm.runInNewContext(ts.transpileModule(readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, { exports }, { filename: file });
const { carExtras, normalizeCarExtras, carExtraLabels, carExtrasInputIsValid, matchesCarExtras, carExtraSeedKeywords } = exports;
const ids = value => Array.from(normalizeCarExtras(value));
const matches = (title, extra, shortDescription) => matchesCarExtras({ title, shortDescription }, [extra]);

test('stable extras restore deterministically, discard unknown legacy IDs and bound input', () => {
  assert.equal(carExtras.length, 12);
  assert.deepEqual(ids(['bluetooth', 'heated_seats', 'heated_seats', 'unknown']), ['heated_seats', 'bluetooth']);
  assert.deepEqual(ids(' bluetooth,heated_seats,bluetooth '), ['heated_seats', 'bluetooth']);
  assert.deepEqual(Array.from(carExtraLabels('bluetooth,heated_seats')), ['Heated seats', 'Bluetooth']);
  for (const value of [null, {}, 12, 'heated_seats,'.repeat(40), Array(25).fill('heated_seats')]) assert.deepEqual(ids(value), []);
  for (const value of ['heated_seats,bluetooth', 'heated_seats,heated_seats', '', []]) assert.equal(carExtrasInputIsValid(value), true);
  for (const value of ['heated_seats,unknown', 'heated_seats,', '__proto__', 'constructor', [12], {}, Array(25).fill('heated_seats')]) assert.equal(carExtrasInputIsValid(value), false);
});

test('advertised aliases cover each supported extra without relying on trim names', () => {
  for (const [extra, titles] of [
    ['heated_seats', ['Golf heated seats', 'heated front leather seats', 'seat heating', 'HTD seats']],
    ['panoramic_roof', ['Panoramic roof', 'pan roof', 'PANROOF', 'pano glass roof', 'panoramic sunroof']],
    ['sunroof', ['electric sunroof', 'sun roof', 'moonroof']],
    ['leather_seats', ['black leather seats', 'full leather interior', 'leather upholstery']],
    ['parking_sensors', ['front and rear parking sensors', 'PDC', 'park distance control', 'reversing sensors']],
    ['reversing_camera', ['reversing camera', 'rear view camera', 'rearview camera', 'reverse cam', '360° camera']],
    ['cruise_control', ['adaptive cruise control', 'cruise-control']],
    ['keyless_entry', ['keyless entry', 'keyless access']],
    ['sat_nav', ['Sat Nav', 'satnav', 'satellite navigation', 'navigation system']],
    ['apple_carplay', ['Apple CarPlay', 'wireless car play']],
    ['android_auto', ['Wireless Android Auto']],
    ['bluetooth', ['Bluetooth audio', 'blue tooth']],
  ]) for (const title of titles) assert.equal(matches(title, extra), true, `${extra}: ${title}`);
  assert.equal(matches('Golf GTI Highline', 'heated_seats'), false);
  assert.equal(matches('VW Golf', 'heated_seats', 'Heated seats included'), true);
});

test('extras require all selected advertised features and never join phrase fragments across fields', () => {
  assert.equal(matchesCarExtras({ title: 'Golf heated seats', shortDescription: 'panoramic roof' }, ['heated_seats', 'panoramic_roof']), true);
  assert.equal(matchesCarExtras({ title: 'Golf heated seats' }, ['heated_seats', 'panoramic_roof']), false);
  assert.equal(matchesCarExtras({ title: 'Golf' }, ['heated_seats']), false);
  assert.equal(matchesCarExtras({ title: 'Golf heated', shortDescription: 'Seats, Bluetooth' }, ['heated_seats']), false);
  assert.equal(matchesCarExtras({ title: 'Golf' }, []), true);
});

test('distinct roof, seat and camera filters do not claim unrelated equipment', () => {
  assert.equal(matches('Golf sunroof', 'panoramic_roof'), false);
  assert.equal(matches('Golf panoramic fixed glass roof', 'sunroof'), false);
  assert.equal(matches('Golf panoramic roof', 'sunroof'), false);
  assert.equal(matches('Golf heated steering wheel', 'heated_seats'), false);
  assert.equal(matches('Golf leather steering wheel', 'leather_seats'), false);
  assert.equal(matches('Golf front and rear dashcam', 'reversing_camera'), false);
  assert.equal(matches('Golf front camera', 'reversing_camera'), false);
  assert.equal(matches('Golf keyless start', 'keyless_entry'), false);
  assert.equal(matches('Golf Android Auto', 'apple_carplay'), false);
});

test('obvious absent, broken, optional and retrofit-only wording cannot satisfy an extra', () => {
  for (const title of [
    'Golf no heated seats', 'Golf without heated seats', 'Golf lacks heated seats',
    'Golf not fitted with heated seats', "Golf doesn't have heated seats", 'Golf does not come with heated seats',
    'Golf heated seats not fitted', 'Golf heated seats are not included', 'Golf heated seats have been removed',
    'Golf heated seats not working', 'Golf heated seats do not work', "Golf heated seats aren't working", 'Golf non-working heated seats', 'Golf faulty heated seats',
    'Golf optional heated seats', 'Golf heated seats optional extra', 'Golf retrofit heated seats',
    'Golf heated seats retrofit kit', 'Golf heated seats available as an option', 'Golf prepared for heated seats',
    'Golf heated seats can be fitted', 'Golf heated seats available at extra cost', 'Golf not heated seats',
  ]) assert.equal(matches(title, 'heated_seats'), false, title);
  assert.equal(matches('Golf heated seats', 'heated_seats', 'Heated seats not fitted'), false);
  assert.equal(matches('Golf heated seats but no sat nav', 'heated_seats'), true);
  assert.equal(matches('Golf no heated seats but panoramic roof', 'panoramic_roof'), true);
  assert.equal(matches('Golf panoramic roof not fitted', 'panoramic_roof'), false);
  assert.equal(matches('Golf PANROOF', 'panoramic_roof', 'No panoramic sunroof'), false);
  assert.equal(matches('Golf heated seats', 'heated_seats', 'No panoramic sunroof'), true);
});

test('coordinated absent extras cannot be selected while nearby positive clauses remain valid', () => {
  for (const title of [
    'Golf no heated seats or panoramic roof', 'Golf no heated seats and panoramic roof',
    'Golf without heated seats, sat nav or panoramic roof',
    'Golf does not come with heated seats or panoramic roof',
    "Golf doesn't have heated seats and panoramic roof",
    'Golf not fitted with heated seats or panoramic roof',
  ]) assert.equal(matches(title, 'panoramic_roof'), false, title);
  assert.equal(matches('Golf PANROOF', 'panoramic_roof', 'No heated seats or panoramic roof'), false);
  for (const title of [
    'Golf no heated seats but panoramic roof',
    'Golf no heated seats, with panoramic roof',
    'Golf does not come with heated seats. Panoramic roof fitted',
    'Golf heated seats do not work but panoramic roof fitted',
    'Golf no heated seats or sat nav, but has panoramic roof',
    'Golf panoramic roof; no heated seats or sat nav',
  ]) assert.equal(matches(title, 'panoramic_roof'), true, title);
  assert.equal(matches('Golf comes with heated seats and panoramic roof', 'heated_seats'), true);
  assert.equal(matches('Golf does not come with sat nav but heated seats fitted', 'heated_seats'), true);
  assert.equal(matches('Golf heated seats work; parking sensors do not work', 'heated_seats'), true);
});

test('provider seeds are bounded simple keywords or one documented OR list', () => {
  for (const extra of carExtras) {
    const seed = carExtraSeedKeywords(extra.id);
    assert.ok(seed.length < 40);
    assert.match(seed, /^(?:[a-z]+|\([a-z]+(?:,[a-z]+)+\))$/);
  }
});
