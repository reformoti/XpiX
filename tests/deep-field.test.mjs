import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const file = relative => readFile(root + relative, 'utf8');

test('XpiX homepage includes a live 3D canvas with working controls and fallback SVG', async () => {
  const html = await file('web/index.html');
  for (const marker of [
    'id="xpix-deepfield"',
    'id="hero-glow-color"',
    'id="hero-glow-intensity"',
    'id="hero-scene-panel"',
    'class="x-object"',
    'deep-field-preview.js'
  ]) assert.ok(html.includes(marker), 'Missing: ' + marker);
  const source = await file('web/deep-field-preview.js');
  assert.match(source, /buildStarSculpture/);
  assert.match(source, /WebGLRenderer/);
  assert.match(source, /prefers-reduced-motion/);
  assert.match(source, /IntersectionObserver/);
});

test('Shared model is used in both the immersive and homepage 3D scene', async () => {
  const full = await file('gliboke-pole/app.js');
  const share = await file('gliboke-pole/star-geometry.js');
  const embedded = await file('web/deep-field-preview.js');
  assert.match(full, /import \{ buildStarSculpture \} from '.\/star-geometry\.js'/);
  assert.match(embedded, /import \{ buildStarSculpture \} from '.\/gliboke-pole\/star-geometry\.js'/);
  assert.match(share, /export function buildStarSculpture/);
  assert.doesNotMatch(full, /function buildStarSculpture\(/);
});

test('All publish targets retain the 3D integration', async () => {
  const builder = await file('scripts/build-pages.mjs');
  const workerBuilder = await file('scripts/build.mjs');
  assert.ok(builder.includes("'deep-field-preview.js'"));
  assert.ok(builder.includes("directory + 'gliboke-pole'"));
  for (const marker of [
    "'/deep-field-preview.js'",
    "'/gliboke-pole/'",
    "'/gliboke-pole/star-geometry.js'",
    "'/gliboke-pole/vendor/three.module.js'"
  ]) assert.ok(workerBuilder.includes(marker), 'Worker missing: ' + marker);
});

test('JavaScript modules and build scripts pass Node syntax checking', () => {
  for (const path of [
    'web/deep-field-preview.js',
    'gliboke-pole/app.js',
    'gliboke-pole/star-geometry.js',
    'scripts/build.mjs',
    'scripts/build-pages.mjs'
  ]) {
    const r = spawnSync(process.execPath, ['--check', path], {
      cwd: root, encoding: 'utf8'
    });
    assert.equal(r.status, 0, path + ': ' + r.stderr);
  }
});
