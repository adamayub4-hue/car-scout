import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const require = createRequire(import.meta.url);
const cache = new Map();
function load(url) {
  if (cache.has(url.href)) return cache.get(url.href);
  const exports = {};
  cache.set(url.href, exports);
  const source = ts.transpileModule(readFileSync(url, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(source, { exports, URL, Date, Intl, require(name) {
    if (name === 'next/link') return { __esModule: true, default: 'a' };
    if (!name.startsWith('.')) return require(name);
    const path = name.endsWith('/guides') ? `${name}/index.ts` : `${name}${name.includes('components/') ? '.tsx' : '.ts'}`;
    return load(new URL(path, url));
  } });
  return exports;
}

const { guides } = load(new URL('../app/lib/guides/index.ts', import.meta.url));
const { guideStructuredData, guideMetadata, serializeStructuredData } = load(new URL('../app/lib/guides/metadata.ts', import.meta.url));
const Article = load(new URL('../app/components/guide-article.tsx', import.meta.url)).default;

test('all seven substantial guides use resolvable GOV.UK citations and related links', () => {
  assert.equal(guides.length, 7);
  const slugs = guides.map(guide => guide.slug);
  assert.equal(new Set(slugs).size, guides.length);
  for (const guide of guides) {
    const prose = [...guide.intro, ...guide.sections.flatMap(section => section.paragraphs)].join(' ');
    assert.ok(prose.trim().split(/\s+/).length >= 800, `${guide.slug} has at least 800 words of article prose`);
    assert.ok(guide.sources.length > 0);
    const sourceIds = guide.sources.map(source => source.id);
    assert.equal(new Set(sourceIds).size, sourceIds.length);
    for (const source of guide.sources) {
      const url = new URL(source.url);
      assert.equal(url.protocol, 'https:');
      assert.ok(url.hostname === 'gov.uk' || url.hostname.endsWith('.gov.uk'), `${guide.slug}: ${source.url}`);
    }
    assert.equal(new Set(guide.sections.map(section => section.id)).size, guide.sections.length);
    for (const section of guide.sections) {
      assert.match(section.id, /^[a-z0-9-]+$/);
      assert.ok(section.sourceIds.length > 0, `${guide.slug}/${section.id} cites its source`);
      assert.ok(section.sourceIds.every(id => sourceIds.includes(id)));
    }
    assert.ok(guide.relatedSlugs.every(slug => slug !== guide.slug && slugs.includes(slug)));
    assert.match(guide.publishedAt, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(guide.updatedAt >= guide.publishedAt);
  }
});

test('every real route renders its own article and breadcrumb data with matching metadata', () => {
  for (const guide of guides) {
    const route = load(new URL(`../app/guides/${guide.slug}/page.tsx`, import.meta.url));
    const markup = renderToStaticMarkup(React.createElement(route.default));
    const scripts = [...markup.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g)];
    assert.equal(scripts.length, 1);
    const structured = JSON.parse(scripts[0][1]);
    const article = structured['@graph'].find(item => item['@type'] === 'Article');
    const breadcrumb = structured['@graph'].find(item => item['@type'] === 'BreadcrumbList');
    assert.equal(article.headline, guide.title);
    assert.equal(article.url, `https://mekivo.uk/guides/${guide.slug}`);
    assert.equal(article.mainEntityOfPage['@id'], article.url);
    assert.equal(article.dateModified, guide.updatedAt);
    assert.equal(article.datePublished, guide.publishedAt);
    assert.equal(breadcrumb.itemListElement.length, 3);
    assert.equal(breadcrumb.itemListElement[2].item, article.url);
    assert.equal(route.metadata.alternates.canonical, `/guides/${guide.slug}`);
    assert.equal(guideMetadata(guide).openGraph.url, article.url);
    assert.ok(markup.includes('aria-label="Breadcrumb"'));
    for (const section of guide.sections) assert.ok(markup.includes(`href="#${section.id}"`));
    for (const source of guide.sources) assert.ok(markup.includes(source.url.replaceAll('&', '&amp;')));
  }
});

test('structured data cannot close its script when content contains HTML', () => {
  const guide = { ...guides[0], title: '</script><script>alert(1)</script>' };
  const serialized = serializeStructuredData(guideStructuredData(guide));
  assert.equal(serialized.includes('<'), false);
  assert.equal(JSON.parse(serialized)['@graph'][0].headline, guide.title);
  const markup = renderToStaticMarkup(React.createElement(Article, { guide }));
  assert.equal((markup.match(/<script/g) || []).length, 1);
});

test('sitemap includes every guide once and uses stable content dates', () => {
  const sitemap = load(new URL('../app/sitemap.ts', import.meta.url)).default;
  const entries = sitemap();
  assert.equal(new Set(entries.map(entry => entry.url)).size, entries.length);
  assert.ok(entries.every(entry => /^\d{4}-\d{2}-\d{2}$/.test(entry.lastModified)));
  for (const guide of guides) {
    const entry = entries.find(item => item.url === `https://mekivo.uk/guides/${guide.slug}`);
    assert.equal(entry?.lastModified, guide.updatedAt);
  }
  assert.equal(JSON.stringify(sitemap()), JSON.stringify(entries));
});
