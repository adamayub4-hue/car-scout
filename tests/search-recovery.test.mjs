import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const compile = path => ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const extras = {}, recovery = {}, search = {}, catalogue = {}, pickerHelpers = {};
vm.runInNewContext(compile('../app/lib/car-extras.ts'), { exports: extras });
vm.runInNewContext(compile('../app/lib/vehicle-options.ts'), { exports: catalogue });
vm.runInNewContext(compile('../app/lib/vehicle-picker-options.ts'), { exports: pickerHelpers });
const requireHelper = name => {
  if (name === './car-extras') return extras;
  if (name === './vehicle-options') return catalogue;
  if (name === './vehicle-picker-options') return pickerHelpers;
  throw Error(`Unexpected recovery dependency: ${name}`);
};
vm.runInNewContext(compile('../app/lib/search-recovery.ts'), { exports: recovery, URLSearchParams, require: requireHelper });
vm.runInNewContext(compile('../app/lib/search.ts'), { exports: search, URL, URLSearchParams, require: requireHelper });
const paramsFor = value => new URL(value, 'https://local.test').search;

test('car report preserves bounded filter settings without copying free text, locations or URLs', () => {
  const fields = {
    make: 'private@example.com', model: 'PRIVATE MODEL', year: '2018', postcode: 'SW1A 1AA',
    platform: 'all', minPrice: '500', price: '5000', sort: 'price_asc', hideUnwanted: true,
    carExtras: ['heated_seats', 'panoramic_roof'],
  };
  const submitted = search.createCarSearch(fields), before = JSON.stringify(submitted);
  const href = recovery.searchProblemHref(submitted, 'empty');
  assert.equal(href.split('?')[0], '/support');
  const report = recovery.parseSearchProblem(paramsFor(href));
  assert.equal(report.subject, 'Cars search problem');
  for (const expected of ['Results provider: eBay', 'Selected marketplace: All marketplaces', 'No matches in the checked results',
    'Budget: £500–£5,000', 'Year: 2018', 'Lowest price first', 'adverts: hidden', 'Heated seats, Panoramic roof', 'Make: set', 'Location filter (postcode not copied): set']) {
    assert.ok(report.details.includes(expected), expected);
  }
  const copied = decodeURIComponent(href) + report.message;
  for (const privateValue of ['private@example.com', 'PRIVATE MODEL', 'SW1A', submitted.fallbackUrl, 'campid', 'registration', 'user_id']) assert.ok(!copied.includes(privateValue), privateValue);
  assert.equal(JSON.stringify(submitted), before, 'reporting never mutates the submitted search');
  assert.ok(href.length < 1000);
});

test('part-number and motorbike reports reflect their real scopes without copying part numbers or car extras', () => {
  const part = search.createPartSearch({ make: '', model: '', year: '', engine: '', fuel: '', bodyStyle: '', part: '', partCategory: '', partNumber: '1K0 698 151 F', partMethod: 'search' }, true);
  const href = recovery.searchProblemHref(part, 'unavailable');
  const report = recovery.parseSearchProblem(paramsFor(href));
  assert.match(report.details, /Search: Parts/);
  assert.match(report.details, /Part number: set/);
  assert.match(report.details, /Search method: Part number/);
  assert.match(report.details, /could not be loaded completely/);
  assert.doesNotMatch(decodeURIComponent(href) + report.message, /1K0|698|151|Budget:|Location filter/);
  const bike = search.createCarSearch({ make: 'Honda', model: 'CBR600F', year: '', postcode: '', platform: 'all', vehicleType: 'motorbikes', price: '3000', carExtras: ['heated_seats'] });
  const bikeReport = recovery.parseSearchProblem(paramsFor(recovery.searchProblemHref(bike, 'empty')));
  assert.match(bikeReport.details, /Search: Motorbikes/);
  assert.match(bikeReport.details, /Selected marketplace: eBay/);
  assert.match(bikeReport.details, /Make: Honda/);
  assert.match(bikeReport.details, /Model: set/);
  assert.doesNotMatch(bikeReport.message, /CBR600F|Heated seats|Requested extras/);
});

test('only catalogue make/model preferences are copied and the support parser validates them again', () => {
  const car = search.createCarSearch({ make: 'VW', model: ' golf ', year: '2018', platform: 'all', price: '5000', postcode: '' });
  const href = recovery.searchProblemHref(car, 'empty');
  const report = recovery.parseSearchProblem(paramsFor(href));
  assert.match(report.details, /Make: Volkswagen/);
  assert.match(report.details, /Model: Golf/);
  const unlisted = search.createCarSearch({ make: 'Ford', model: 'CUSTOM PRIVATE MODEL', year: '', platform: 'all', price: '', postcode: '' });
  const safeHref = recovery.searchProblemHref(unlisted, 'empty');
  assert.doesNotMatch(decodeURIComponent(safeHref), /CUSTOM|PRIVATE/);
  const safe = recovery.parseSearchProblem(paramsFor(safeHref));
  assert.match(safe.details, /Make: Ford/);
  assert.match(safe.details, /Model: set/);
  const params = new URLSearchParams(paramsFor(href));
  params.set('model', 'someone@example.com');
  assert.doesNotMatch(recovery.parseSearchProblem(params.toString()).message, /someone@example/);
  params.set('make', 'someone@example.com'); params.set('model', 'Golf');
  const wrongMake = recovery.parseSearchProblem(params.toString());
  assert.doesNotMatch(wrongMake.message, /someone@example|Model: Golf/);
  params.set('make', 'Volkswagen'); params.set('model', 'Golf'); params.set('search_kind', 'motorbikes');
  assert.doesNotMatch(recovery.parseSearchProblem(params.toString()).message, /Volkswagen|Golf/);
});

test('untrusted support parameters cannot supply messages, links, markup or unbounded fields', () => {
  const valid = '?report=search&search_kind=cars&marketplace=ebay&outcome=unavailable';
  for (const invalid of [
    '', '?report=search', valid + '&outcome=empty', valid.replace('cars', '__proto__'),
    valid.replace('marketplace=ebay', 'marketplace=constructor'), valid.replace('unavailable', 'published'),
    valid + '&unused=' + 'x'.repeat(1800),
  ]) assert.equal(recovery.parseSearchProblem(invalid), null, invalid.slice(0, 100));
  const hostile = new URLSearchParams(valid);
  for (const [key, value] of Object.entries({ subject: 'HOSTILE SUBJECT', message: '<script>PRIVATE</script>', body: 'PRIVATE BODY',
    next: 'https://hostile.example', year: 'PRIVATE YEAR', min: 'NaN', max: '9000000000', sort: 'PRIVATE SORT', extras: 'heated_seats,PRIVATE EXTRAS',
    make_set: 'PRIVATE MAKE', location_set: 'PRIVATE POSTCODE', method: 'PRIVATE METHOD' })) hostile.set(key, value);
  const report = recovery.parseSearchProblem(hostile.toString());
  assert.equal(report.subject, 'Cars search problem');
  assert.match(report.details, /Heated seats/);
  assert.doesNotMatch(report.message, /PRIVATE|HOSTILE|hostile|script|NaN|Budget:|Year:|Sort:/);
  for (const [value, expected] of [['500.50', 'Up to £500.5'], ['0', 'Up to £0'], ['5000000', 'Up to £5,000,000']]) {
    assert.ok(recovery.parseSearchProblem(valid + '&max=' + value).details.includes(expected));
  }
});
