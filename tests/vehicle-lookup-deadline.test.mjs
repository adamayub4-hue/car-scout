import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const cases = [
  { name: 'standalone tax/MOT check', path: '../app/components/vehicle-check.tsx', handler: 'checkVehicle', manual: false },
  { name: 'parts registration lookup', path: '../app/components/search-experience.tsx', handler: 'handleVehicleLookup', manual: true },
];

// Execute the real request handlers with a clock and fetch that can independently
// stall before headers or during JSON reading. No browser or provider is used.
function lookupHarness(config, { ignoreAbort = false } = {}) {
  const source = readFileSync(new URL(config.path, import.meta.url), 'utf8');
  const ast = ts.createSourceFile(config.path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let expression;
  function visit(node) {
    if (ts.isFunctionDeclaration(node) && node.name?.text === config.handler) expression = node.getText(ast);
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === config.handler) expression = node.initializer.getText(ast);
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.ok(expression, config.handler);

  const requests = [], events = [], timers = new Map();
  const state = { loading: false, error: '', vehicle: null, make: '', registration: 'AB12CDE' };
  const ref = { current: { id: 0, controller: null } };
  let now = 0, timerId = 0;
  const setLoading = value => { state.loading = value; };
  const setVehicle = value => { state.vehicle = value; };
  const setRegistration = value => { state.registration = value; };
  const context = {
    AbortController, Error, registration: state.registration, request: ref, vehicleLookupRequest: ref,
    setLoading, setVehicleLookupLoading: setLoading, setVehicle, setVehicleLookup: setVehicle, setRegistration,
    setError: value => { state.error = value; }, makes: { Ford: ['Focus'] },
    setMake: value => { state.make = value; }, setModel() {}, setYear() {}, setEngine() {}, setFuel() {}, setBodyStyle() {},
    resetPartsBelowVehicle() {}, trackGrowthEvent: (...args) => events.push(args), trackActivity: (...args) => events.push(args),
    setTimeout(callback, delay) { const id = ++timerId; timers.set(id, { callback, at: now + delay }); return id; },
    clearTimeout(id) { timers.delete(id); },
    fetch(url, options) {
      return new Promise((resolve, reject) => {
        const request = { url, options, resolve, reject, rejectBody: null, resolveBody: null };
        requests.push(request);
        if (!ignoreAbort) options.signal.addEventListener('abort', () => {
          const error = new Error('The request was aborted'); error.name = 'AbortError';
          reject(error); request.rejectBody?.(error);
        }, { once: true });
      });
    },
  };
  const compiled = ts.transpileModule(`const run = (${expression});`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const run = vm.runInNewContext(`${compiled}\nrun`, context);
  return {
    state, requests, events, timers, ref,
    run: () => run({ preventDefault() {} }),
    advance(milliseconds) {
      now += milliseconds;
      for (const [id, timer] of Array.from(timers)) {
        if (timer.at <= now) { timers.delete(id); timer.callback(); }
      }
    },
    respond(index, payload = { vehicle: { make: 'Ford', model: 'Focus' } }, status = 200) {
      requests[index].resolve({ ok: status >= 200 && status < 300, status, json: async () => payload });
    },
    async startBody(index) {
      const request = requests[index];
      request.resolve({ ok: true, status: 200, json: () => new Promise((resolve, reject) => {
        request.resolveBody = resolve; request.rejectBody = reject;
      }) });
      await new Promise(resolve => setImmediate(resolve));
      assert.equal(typeof request.rejectBody, 'function', 'handler has started reading the body');
    },
    cancel() { ref.current.id += 1; ref.current.controller?.abort(); },
  };
}

for (const config of cases) {
  test(`${config.name}: a stalled fetch stops after 20 seconds and permits a retry`, async () => {
    const app = lookupHarness(config), pending = app.run();
    assert.equal(app.state.loading, true);
    assert.equal(app.requests[0].url, '/api/vehicle');
    app.advance(19999);
    assert.equal(app.requests[0].options.signal.aborted, false);
    app.advance(1);
    await pending;
    assert.equal(app.requests[0].options.signal.aborted, true);
    assert.equal(app.state.loading, false);
    assert.match(app.state.error, /took too long.*[Tt]ry again/);
    if (config.manual) assert.match(app.state.error, /enter the make and model/);
    assert.equal(app.timers.size, 0);
    assert.deepEqual(app.events, [], 'a timed-out lookup emits no success event');

    const retry = app.run(); app.respond(1); await retry;
    assert.equal(app.state.loading, false); assert.equal(app.state.error, '');
    assert.equal(app.state.vehicle.make, 'Ford');
    assert.equal(app.timers.size, 0);
  });

  test(`${config.name}: the same deadline also covers a stalled response body`, async () => {
    const app = lookupHarness(config), pending = app.run();
    app.advance(12000);
    await app.startBody(0);
    app.advance(8000);
    await pending;
    assert.equal(app.state.loading, false);
    assert.match(app.state.error, /took too long/);
    assert.equal(app.state.vehicle, null);
    assert.equal(app.timers.size, 0);
    assert.deepEqual(app.events, []);
  });

  test(`${config.name}: successful and failed responses clear their timers`, async () => {
    for (const status of [200, 429, 503]) {
      const app = lookupHarness(config), pending = app.run();
      app.respond(0, { vehicle: { make: 'Ford' } }, status); await pending;
      assert.equal(app.state.loading, false);
      assert.equal(app.timers.size, 0);
      app.advance(20000);
      assert.equal(app.requests[0].options.signal.aborted, false, 'settled request has no later timeout');
      if (status === 200) assert.equal(app.state.vehicle.make, 'Ford');
      else assert.ok(app.state.error);
    }
  });

  test(`${config.name}: an old timeout cannot abort or change a newer lookup`, async () => {
    // Deliberately ignore cancellation to exercise identity protection as well.
    const app = lookupHarness(config, { ignoreAbort: true });
    const first = app.run(); app.advance(10000);
    const second = app.run(); app.advance(10000);
    assert.equal(app.requests[0].options.signal.aborted, true);
    assert.equal(app.requests[1].options.signal.aborted, false);
    app.respond(0, { vehicle: { make: 'OLD' } }); await first;
    assert.equal(app.state.loading, true);
    assert.equal(app.state.error, ''); assert.equal(app.state.vehicle, null);
    assert.deepEqual(app.events, []);
    app.respond(1); await second;
    assert.equal(app.state.vehicle.make, 'Ford'); assert.equal(app.state.loading, false);
    assert.equal(app.timers.size, 0);
  });

  test(`${config.name}: cancellation suppresses a late body and clears its timeout`, async () => {
    const app = lookupHarness(config, { ignoreAbort: true }), pending = app.run();
    await app.startBody(0);
    // Real registration edits/unmount cleanup increments identity before aborting.
    app.cancel();
    app.requests[0].resolveBody({ vehicle: { make: 'OLD' } }); await pending;
    assert.equal(app.state.vehicle, null); assert.equal(app.state.error, '');
    assert.equal(app.timers.size, 0); assert.deepEqual(app.events, []);
  });

  test(`${config.name}: a body arriving after timeout cannot become a successful result`, async () => {
    const app = lookupHarness(config, { ignoreAbort: true }), pending = app.run();
    await app.startBody(0);
    app.advance(20000);
    app.requests[0].resolveBody({ vehicle: { make: 'OLD' } }); await pending;
    assert.equal(app.state.loading, false); assert.equal(app.state.vehicle, null);
    assert.match(app.state.error, /took too long/);
    assert.equal(app.timers.size, 0); assert.deepEqual(app.events, []);
  });
}
