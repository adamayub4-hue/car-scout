import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
import sharp from 'sharp';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const require = createRequire(import.meta.url);
const root = new URL('../', import.meta.url);
const svg = readFileSync(new URL('app/icon.svg', root));
const canonicalUrl = 'https://mekivo.uk/';
const verifiedProfiles = ['https://www.instagram.com/mekivo.uk/', 'https://www.tiktok.com/@mekivo0'];

function load(path, overrides = {}) {
  const exports = {};
  const source = ts.transpileModule(readFileSync(new URL(path, root), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(source, { exports, URL, require(name) {
    if (name in overrides) return overrides[name];
    if (name === './globals.css') return {};
    // Rendering branding must never mount analytics or browser theme effects.
    if (name === './components/site-analytics') return { SiteAnalytics: () => null };
    if (name === './components/appearance') return { AppearanceRuntime: () => null };
    if (name === './lib/site-brand') return load('app/lib/site-brand.ts');
    if (name === 'react' || name === 'react/jsx-runtime') return require(name);
    throw Error(`Unexpected branding dependency: ${name}`);
  } });
  return exports;
}

function structuredData(layout) {
  const html = renderToStaticMarkup(React.createElement(layout.default, null, React.createElement('main', null, 'Mekivo')));
  const scripts = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  assert.equal(scripts.length, 1, 'root renders one branding graph, not conflicting duplicate WebSite nodes');
  return { html, json: JSON.parse(scripts[0][1]) };
}

function publicAsset(src) {
  const url = new URL(src, canonicalUrl);
  assert.equal(url.origin, new URL(canonicalUrl).origin, 'brand asset must resolve to this site');
  assert.equal(url.search, '');
  assert.equal(url.hash, '');
  assert.ok(url.pathname.startsWith('/icons/'), 'brand logo and manifest assets use the public icons directory');
  const file = new URL(`public${url.pathname}`, root);
  assert.ok(existsSync(file), `${url.pathname} exists locally`);
  return file;
}

// Compare decoded pixels, not compressed PNG bytes. The rendering parameters
// follow scripts/generate-brand-icons.mjs; this never runs that mutating script.
async function assertBrandedPixels(buffer, size, opaque = false) {
  let expected = sharp(svg, { density: 576 }).resize(size, size).ensureAlpha();
  if (opaque) expected = expected.flatten({ background: '#06101f' });
  const [actualPixels, expectedPixels] = await Promise.all([
    sharp(buffer).ensureAlpha().raw().toBuffer(),
    expected.ensureAlpha().raw().toBuffer(),
  ]);
  assert.deepEqual(actualPixels, expectedPixels, `${size}px image must depict the current Mekivo SVG, not a stock icon`);
}

test('favicon ICO contains valid nonoverlapping PNG frames depicting the Mekivo mark at every size', async () => {
  const ico = readFileSync(new URL('app/favicon.ico', root));
  assert.ok(ico.length >= 6);
  assert.equal(ico.readUInt16LE(0), 0, 'reserved header');
  assert.equal(ico.readUInt16LE(2), 1, 'ICO resource type');
  const count = ico.readUInt16LE(4), directoryEnd = 6 + count * 16;
  assert.equal(count, 6);
  assert.ok(directoryEnd <= ico.length, 'complete frame directory');
  const frames = [];
  for (let index = 0; index < count; index += 1) {
    const entry = 6 + index * 16;
    const width = ico[entry] || 256, height = ico[entry + 1] || 256;
    const length = ico.readUInt32LE(entry + 8), offset = ico.readUInt32LE(entry + 12);
    assert.equal(width, height, `frame ${index}: square icon`);
    assert.equal(ico[entry + 3], 0, `frame ${index}: reserved byte`);
    assert.equal(ico.readUInt16LE(entry + 4), 1, `frame ${index}: one colour plane`);
    assert.equal(ico.readUInt16LE(entry + 6), 32, `frame ${index}: RGBA depth`);
    assert.ok(length > 8 && offset >= directoryEnd && offset + length <= ico.length, `frame ${index}: payload within file bounds`);
    frames.push({ width, height, length, offset });
  }
  assert.deepEqual(frames.map(frame => frame.width).sort((a, b) => a - b), [16, 32, 48, 64, 128, 256]);
  const ordered = [...frames].sort((a, b) => a.offset - b.offset);
  for (let index = 1; index < ordered.length; index += 1) {
    assert.ok(ordered[index].offset >= ordered[index - 1].offset + ordered[index - 1].length, 'frame payloads must not overlap');
  }
  for (const frame of frames) {
    const png = ico.subarray(frame.offset, frame.offset + frame.length);
    assert.deepEqual(png.subarray(0, 8), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), 'embedded frame is PNG encoded');
    const info = await sharp(png).metadata();
    assert.equal(info.format, 'png');
    assert.equal(info.width, frame.width);
    assert.equal(info.height, frame.height);
    await assertBrandedPixels(png, frame.width);
  }
});

test('manifest icons are real branded PNGs whose dimensions match their declared sizes', async () => {
  const manifest = load('app/manifest.ts').default();
  assert.equal(manifest.name, 'Mekivo');
  assert.equal(manifest.short_name, 'Mekivo');
  assert.equal(new URL(manifest.start_url, canonicalUrl).href, canonicalUrl);
  assert.equal(manifest.icons.length, 2);
  assert.deepEqual(Array.from(manifest.icons, icon => icon.sizes).sort(), ['192x192', '512x512']);
  for (const icon of manifest.icons) {
    assert.equal(icon.type, 'image/png');
    const buffer = readFileSync(publicAsset(icon.src));
    const info = await sharp(buffer).metadata();
    assert.equal(info.format, 'png');
    assert.equal(`${info.width}x${info.height}`, icon.sizes);
    await assertBrandedPixels(buffer, info.width);
  }
});

test('Apple touch icon is an opaque 180px rendering of the same Mekivo mark', async () => {
  const buffer = readFileSync(new URL('app/apple-icon.png', root));
  const info = await sharp(buffer).metadata();
  assert.equal(info.format, 'png');
  assert.equal(info.width, 180);
  assert.equal(info.height, 180);
  assert.equal((await sharp(buffer).stats()).isOpaque, true, 'all pixels are opaque, whether stored as RGB or RGBA');
  await assertBrandedPixels(buffer, 180, true);
});

test('root metadata consistently identifies Mekivo and exposes a stable large raster favicon', async () => {
  const brand = load('app/lib/site-brand.ts');
  const { metadata } = load('app/layout.tsx');
  assert.equal(brand.siteName, 'Mekivo');
  assert.equal(brand.siteUrl, canonicalUrl);
  assert.ok(brand.siteTitle.includes(brand.siteName));
  assert.ok(brand.siteDescription.trim().length > 0);
  assert.equal(metadata.applicationName, brand.siteName);
  assert.equal(metadata.title.default, brand.siteTitle);
  assert.equal(metadata.description, brand.siteDescription);
  assert.equal(metadata.openGraph.title, brand.siteTitle);
  assert.equal(metadata.openGraph.description, brand.siteDescription);
  assert.equal(metadata.openGraph.siteName, brand.siteName);
  assert.equal(metadata.twitter.title, brand.siteTitle);
  assert.equal(metadata.twitter.description, brand.siteDescription);
  assert.equal(metadata.metadataBase.href, canonicalUrl);
  assert.equal(new URL(metadata.alternates.canonical, metadata.metadataBase).href, canonicalUrl);
  assert.equal(new URL(metadata.openGraph.url).href, canonicalUrl);
  assert.equal(metadata.manifest, '/manifest.webmanifest');
  assert.equal(metadata.icons.apple[0].url, '/apple-icon.png');
  assert.equal(metadata.icons.apple[0].sizes, '180x180');
  const raster = metadata.icons.icon.find(icon => icon.url === '/icons/mekivo-192.png');
  assert.ok(raster, 'declare the stable large raster as well as the automatic ICO link');
  assert.equal(raster.type, 'image/png');
  assert.equal(raster.sizes, '192x192');
  const buffer = readFileSync(publicAsset(raster.url));
  const info = await sharp(buffer).metadata();
  assert.equal(info.format, 'png');
  assert.equal(info.width, 192);
  assert.equal(info.height, 192);
  await assertBrandedPixels(buffer, 192);
});

test('rendered branding graph links one WebSite to Mekivo with only recorded owned profiles and a real logo', async () => {
  const { json } = structuredData(load('app/layout.tsx'));
  assert.equal(json['@context'], 'https://schema.org');
  const websites = json['@graph'].filter(entity => entity['@type'] === 'WebSite');
  const organizations = json['@graph'].filter(entity => entity['@type'] === 'Organization');
  assert.equal(websites.length, 1);
  assert.equal(organizations.length, 1);
  const [website] = websites, [organization] = organizations;
  assert.equal(website.name, 'Mekivo');
  assert.equal(organization.name, website.name);
  assert.equal(website.alternateName, 'mekivo.uk');
  assert.equal(organization.alternateName, website.alternateName);
  assert.equal(website.url, canonicalUrl);
  assert.equal(organization.url, canonicalUrl);
  assert.equal(website.publisher['@id'], organization['@id']);
  assert.notEqual(website['@id'], organization['@id']);
  assert.deepEqual(organization.sameAs, verifiedProfiles, 'do not associate same-name Facebook or YouTube accounts without verified ownership');
  const logo = organization.logo;
  assert.equal(logo['@type'], 'ImageObject');
  const info = await sharp(readFileSync(publicAsset(logo.url))).metadata();
  assert.ok(info.width >= 112 && info.height >= 112, 'organization logo meets minimum search dimensions');
  assert.equal(logo.width, info.width);
  assert.equal(logo.height, info.height);
});

test('branding JSON-LD cannot create another script when brand data contains HTML', () => {
  const brand = load('app/lib/site-brand.ts');
  const replacement = JSON.parse(JSON.stringify(brand.siteStructuredData));
  const hostileName = '</script><script>alert(1)</script>';
  replacement['@graph'][0].name = hostileName;
  const layout = load('app/layout.tsx', { './lib/site-brand': { ...brand, siteStructuredData: replacement } });
  const { html, json } = structuredData(layout);
  assert.equal(json['@graph'][0].name, hostileName);
  assert.equal(html.includes('<script>alert(1)</script>'), false);
});
