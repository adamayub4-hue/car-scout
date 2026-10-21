import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source = readFileSync(new URL('../app/components/search-query-observer.tsx', import.meta.url), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;

test('the query observer ignores its initial mount and notifies each committed client navigation once', () => {
  let query = 'restore=1&mode=cars&make=Ford', cursor = 0, callback;
  const slots = [], effects = [], pending = [], events = [], exports = {};
  vm.runInNewContext(code, { exports, require(name) {
    if (name === 'next/navigation') return { useSearchParams: () => new URLSearchParams(query) };
    if (name === 'react') return {
      useRef(initial) { const index = cursor++; return slots[index] ??= { current: initial }; },
      useEffectEvent(fn) { callback = fn; return value => callback(value); },
      useEffect(fn, deps) { const index = cursor++; if (!effects[index] || deps.some((value, i) => value !== effects[index][i])) { effects[index] = deps; pending.push(fn); } },
    };
    throw Error(name);
  } });
  const render = (label = 'current') => { cursor = 0; assert.equal(exports.default({ onChange: value => events.push([label, value]) }), null); pending.splice(0).forEach(fn => fn()); };
  render(); render();
  assert.deepEqual(events, [], 'the existing mount restoration owns initial run=1');
  query = 'restore=1&mode=cars&make=Volkswagen'; render('updated'); render();
  assert.deepEqual(events, [['updated', query]]);
  query = ''; render('cleared'); render();
  assert.deepEqual(events, [['updated', 'restore=1&mode=cars&make=Volkswagen'], ['cleared', '']]);
});

test('only the invisible query observer is under the search form Suspense boundary', () => {
  const page = readFileSync(new URL('../app/components/search-experience.tsx', import.meta.url), 'utf8');
  const ast = ts.createSourceFile('search-experience.tsx', page, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const boundaries = [];
  function visit(node) {
    if (ts.isJsxElement(node) && node.openingElement.tagName.getText(ast) === 'Suspense') boundaries.push(node);
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.equal(boundaries.length, 1);
  assert.equal(boundaries[0].openingElement.attributes.getText(ast), 'fallback={null}');
  assert.equal(boundaries[0].children.filter(ts.isJsxSelfClosingElement).map(node => node.tagName.getText(ast)).join(','), 'SearchQueryObserver');
});
