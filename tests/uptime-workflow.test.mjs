import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, delimiter } from 'node:path';
import { spawnSync } from 'node:child_process';

const workflow = readFileSync(new URL('../.github/workflows/uptime.yml', import.meta.url), 'utf8');
const lines = workflow.split('\n'), steps = [];
for (let index = 0; index < lines.length; index++) {
  const name = /^      - name: (.+)$/.exec(lines[index]);
  if (!name) continue;
  while (++index < lines.length && lines[index] !== '        run: |') assert.ok(!/^      - name:/.test(lines[index]), 'the monitor step has a shell block');
  const command = [];
  while (++index < lines.length && (lines[index].startsWith('          ') || !lines[index].trim())) command.push(lines[index].slice(10));
  steps.push({ name: name[1], command: command.join('\n') });
  index--;
}
assert.equal(steps.length, 2);
const [health, home] = steps;
const healthy = JSON.stringify({ status: 'ok', service: 'mekivo', timestamp: '2026-10-21T16:00:00.000Z' });
const homepage = '<!doctype html><html><head><title>Mekivo | Search UK used cars &amp; parts</title></head><body><main><form action="/cars"><input name="make"><button>Search cars</button></form></main></body></html>';

// Execute the exact workflow shell/Python, replacing only curl. Fixtures cannot
// contact Mekivo, providers, authentication or analytics services.
function check(step, body, { status = '200', destination = step === health ? 'https://mekivo.uk/api/health' : 'https://mekivo.uk/', exitCode = 0 } = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'mekivo-uptime-fixture-'));
  try {
    const log = join(directory, 'curl-args.json');
    const bodyFile = join(directory, 'response-fixture');
    writeFileSync(bodyFile, body);
    writeFileSync(join(directory, 'curl'), `#!/usr/bin/env node
const fs = require('node:fs');
const args = process.argv.slice(2);
fs.writeFileSync(process.env.MEKIVO_UPTIME_ARGS, JSON.stringify(args));
const output = args[args.indexOf('--output') + 1];
if (output) fs.writeFileSync(output, fs.readFileSync(process.env.MEKIVO_UPTIME_BODY_FILE));
process.stdout.write(process.env.MEKIVO_UPTIME_STATUS + '\\n' + process.env.MEKIVO_UPTIME_DESTINATION);
process.exit(Number(process.env.MEKIVO_UPTIME_EXIT));
`, { mode: 0o700 });
    const result = spawnSync('bash', ['-eo', 'pipefail', '-c', step.command], {
      encoding: 'utf8', timeout: 5000,
      env: { PATH: directory + delimiter + process.env.PATH, MEKIVO_UPTIME_ARGS: log, MEKIVO_UPTIME_BODY_FILE: bodyFile,
        MEKIVO_UPTIME_STATUS: status, MEKIVO_UPTIME_DESTINATION: destination, MEKIVO_UPTIME_EXIT: String(exitCode) },
    });
    assert.equal(result.error, undefined);
    const args = JSON.parse(readFileSync(log, 'utf8'));
    assert.equal(existsSync(args[args.indexOf('--output') + 1]), false, 'the workflow removes its response body on success and failure');
    return { ...result, args };
  } finally { rmSync(directory, { recursive: true, force: true }); }
}

test('existing schedule stays bounded and checks the homepage even after health failure', () => {
  assert.match(workflow, /cron: "\*\/15 \* \* \* \*"/);
  assert.match(workflow, /timeout-minutes: 3/);
  assert.match(workflow, /- name: Check public homepage\n        if: always\(\)/);
  assert.doesNotMatch(workflow, /continue-on-error|actions\/checkout|Authorization|secrets\.|workflow_run/);
  for (const [step, body] of [[health, healthy], [home, homepage]]) {
    const result = check(step, body);
    assert.equal(result.status, 0, result.stderr);
    const option = name => result.args[result.args.indexOf(name) + 1];
    for (const [name, value] of [['--proto', '=https'], ['--proto-redir', '=https'], ['--max-redirs', '0'], ['--retry', '2'], ['--retry-max-time', '40'], ['--connect-timeout', '10'], ['--max-time', '15']]) assert.equal(option(name), value);
    assert.ok(result.args.includes('--fail'));
    assert.equal(result.args.at(-1), step === health ? 'https://mekivo.uk/api/health' : 'https://mekivo.uk/');
    assert.ok(result.args.filter(arg => /^https?:/.test(arg)).every(arg => new URL(arg).search === ''), 'fixed URLs have no search or campaign parameters');
    assert.match(result.stdout, /upstream providers were not checked/);
  }
});

test('health checks require the expected JSON object and exact status/service', () => {
  for (const body of ['<html>Mekivo is unavailable</html>', 'null', '[]', '{}', '{"status":"ok","service":"another-site"}', '{"status":"down","service":"mekivo"}', healthy + ' trailing text']) {
    const result = check(health, body);
    assert.notEqual(result.status, 0, body);
    assert.match(result.stderr, /Mekivo health check failed/);
  }
});

test('homepage checks reject HTTP-200 error, sign-in, placeholder and foreign pages', () => {
  for (const body of ['<title>Mekivo</title><p>Maintenance</p>', '<title>Another site</title><form action="/cars"></form>',
    '<title>Mekivo sign in</title><form action="/account"></form>', '<title>NotMekivo</title><form action="/cars"></form>',
    '<title>Mekivo</title><!-- <form action="/cars"></form> -->', '<title>Mekivo</title><form action="/cars" method="post"></form>']) {
    const result = check(home, body);
    assert.notEqual(result.status, 0, body);
    assert.match(result.stderr, /Mekivo homepage check failed/);
  }
});

test('non-200 statuses and unexpected final destinations fail without echoing response contents', () => {
  for (const step of steps) {
    const body = step === health ? healthy : homepage;
    for (const status of ['301', '302', '403', '429', '500']) assert.notEqual(check(step, body, { status }).status, 0, status);
    for (const destination of ['http://mekivo.uk/', 'https://foreign.example/', 'https://mekivo.uk/account', 'https://mekivo.uk/?private=do-not-print']) {
      const result = check(step, body, { destination });
      assert.notEqual(result.status, 0, destination);
      assert.doesNotMatch(result.stderr + result.stdout, /do-not-print|foreign\.example/);
    }
    assert.notEqual(check(step, body, { exitCode: 28 }).status, 0, 'a transport timeout must fail the workflow');
  }
});

test('response sizes are bounded and only the fixed canonical host is accepted', () => {
  const healthResult = check(health, healthy + ' '.repeat(16385));
  assert.notEqual(healthResult.status, 0);
  assert.notEqual(check(home, homepage + ' '.repeat(1048577)).status, 0);
  assert.notEqual(check(health, healthy, { destination: 'https://www.mekivo.uk/api/health' }).status, 0);
  assert.notEqual(check(home, homepage, { destination: 'https://www.mekivo.uk/' }).status, 0);
});
