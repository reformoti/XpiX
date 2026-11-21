import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = path => readFile(root + path, 'utf8');

function simulateTheme(code, saved) {
  const store = new Map(saved ? [['xpix-theme', saved]] : []);
  const attributes = {};
  const listeners = {};
  const label = { textContent: 'ТЕМНА' };
  const icon = { textContent: '☾' };
  const meta = { setAttribute(key, val) { attributes[key] = val; } };
  const toggle = {
    querySelector(key) {
      return key === '[data-theme-label]' ? label : key === '[data-theme-icon]' ? icon : null;
    },
    setAttribute(key, val) { attributes[key] = val; },
    addEventListener(key, callback) { listeners[key] = callback; }
  };
  const rootElement = { dataset: {}, style: {} };
  const document = {
    documentElement: rootElement, readyState: 'complete',
    getElementById: id => id === 'theme-toggle' ? toggle : null,
    querySelector: key => key === 'meta[name="theme-color"]' ? meta : null
  };
  const localStorage = {
    getItem: key => store.get(key) ?? null,
    setItem: (key, val) => store.set(key, val)
  };
  runInNewContext(code, { document, localStorage });
  return {
    root: rootElement, store, attributes, listeners, label
  };
}

test('Dark is the initial theme and the switcher persists a light preference', async () => {
  const scene = simulateTheme(await read('web/theme.js'));
  assert.equal(scene.root.dataset.theme, 'dark');
  assert.equal(scene.root.style.colorScheme, 'dark');
  assert.equal(scene.attributes['aria-pressed'], 'true');
  scene.listeners.click();
  assert.equal(scene.root.dataset.theme, 'light');
  assert.equal(scene.store.get('xpix-theme'), 'light');
  assert.equal(scene.label.textContent, 'СВІТЛА');
  assert.equal(scene.attributes['aria-pressed'], 'false');
});

test('Saved light preference is restored and can switch to dark', async () => {
  const scene = simulateTheme(await read('web/theme.js'), 'light');
  assert.equal(scene.root.dataset.theme, 'light');
  scene.listeners.click();
  assert.equal(scene.root.dataset.theme, 'dark');
  assert.equal(scene.store.get('xpix-theme'), 'dark');
});

test('Theme is integrated into all publication targets', async () => {
  const pages = await Promise.all(['web/index.html', 'index.html', 'docs/index.html'].map(read));
  for (const html of pages) {
    assert.match(html, /data-theme="dark"/);
    assert.match(html, /id="theme-toggle"/);
    assert.match(html, /\.\/theme\.js\?v=1\.4\.0/);
  }
  const css = await read('web/style.css');
  assert.match(css, /:root\[data-theme="dark"\]/);
  assert.match(css, /:root\[data-theme="dark"\] \.work/);
  assert.match(css, /:root\[data-theme="dark"\] dialog/);
  const pagesBuilder = await read('scripts/build-pages.mjs');
  const workerBuilder = await read('scripts/build.mjs');
  assert.match(pagesBuilder, /'theme\.js'/);
  assert.match(workerBuilder, /'\/theme\.js'/);
});
