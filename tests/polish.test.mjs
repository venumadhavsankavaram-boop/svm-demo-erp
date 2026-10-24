// The look-and-feel layer is wired in and self-contained.   Run:  node tests/polish.test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, done } from './helpers.mjs';
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(root, 'public/index.html'), 'utf8');
test('the polish layer is present, once', () => { assert.equal((html.match(/<style id="polish-layer">/g) || []).length, 1); });
test('every bundled font file the page names exists', () => {
  const names = [...html.matchAll(/\/fonts\/([a-z0-9-]+\.woff2)/g)].map(m => m[1]);
  assert.ok(names.length >= 3);
  for (const n of new Set(names)) assert.ok(fs.statSync(path.join(root, 'public/fonts', n)).size > 5000, n);
});
test('no font is fetched from Google any more', () => { assert.ok(!/fonts\.(googleapis|gstatic)\.com/.test(html)); });
test('the rupee sign is covered by a bundled font range', () => { assert.ok(/U\+20A0-20AB,U\+20AD-20C0/.test(html)); });
test('dark mode keeps readable text on the brand-coloured buttons and tabs', () => {
  assert.ok(/\[data-theme="dark"\] \.btn-primary\{color:var\(--brand-navy-deep\)/.test(html));
  assert.ok(/\[data-theme="dark"\] \.mf-tab\.active\{color:var\(--brand-navy-deep\)/.test(html));
});
test('fonts are cached for a year by the server', () => { assert.ok(/public', 'fonts'[\s\S]{0,200}immutable/.test(fs.readFileSync(path.join(root, 'server.js'), 'utf8'))); });
done();
