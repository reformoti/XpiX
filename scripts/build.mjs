import { readFile, mkdir, writeFile, rm, copyFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const assets = {};
for (const [url, path, type] of [
  ['/', 'web/index.html', 'text/html; charset=utf-8'],
  ['/style.css', 'web/style.css', 'text/css; charset=utf-8'],
  ['/app.js', 'web/app.js', 'text/javascript; charset=utf-8'],
  ['/favicon.svg', 'web/favicon.svg', 'image/svg+xml'],
  ['/deep-field-preview.js', 'web/deep-field-preview.js', 'text/javascript; charset=utf-8'],
  ['/theme.js', 'web/theme.js', 'text/javascript; charset=utf-8'],
  ['/gliboke-pole/', 'gliboke-pole/index.html', 'text/html; charset=utf-8'],
  ['/gliboke-pole/index.html', 'gliboke-pole/index.html', 'text/html; charset=utf-8'],
  ['/gliboke-pole/app.js', 'gliboke-pole/app.js', 'text/javascript; charset=utf-8'],
  ['/gliboke-pole/star-geometry.js', 'gliboke-pole/star-geometry.js', 'text/javascript; charset=utf-8'],
  ['/gliboke-pole/vendor/three.module.js', 'gliboke-pole/vendor/three.module.js', 'text/javascript; charset=utf-8'],
  ['/gliboke-pole/styles.css', 'gliboke-pole/styles.css', 'text/css; charset=utf-8'],
  ['/gliboke-pole/favicon.svg', 'gliboke-pole/favicon.svg', 'image/svg+xml']
]) assets[url] = { body: await readFile(root + path, 'utf8'), type };
const source = await readFile(root + 'worker/index.js', 'utf8');
if (!source.includes('const assets = {}; // BUILD_ASSETS')) throw new Error('Missing asset marker');
await rm(root + 'dist', { recursive: true, force: true });
await mkdir(root + 'dist/server', { recursive: true });
await mkdir(root + 'dist/.openai', { recursive: true });
await writeFile(root + 'dist/server/index.js', source.replace('const assets = {}; // BUILD_ASSETS', () => 'const assets = ' + JSON.stringify(assets) + ';'));
await copyFile(root + '.openai/hosting.json', root + 'dist/.openai/hosting.json');
console.log('Built self-contained XpiX Worker');
