import { readFile, mkdir, writeFile, copyFile, cp, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const directory = root + 'docs/';
await rm(directory, { recursive: true, force: true });
await mkdir(directory, { recursive: true });
const html = (await readFile(root + 'web/index.html', 'utf8')).replace('<head>', '<head>\n  <meta name="xpix-runtime" content="static">');
await writeFile(directory + 'index.html', html);
for (const name of ['style.css', 'app.js', 'favicon.svg', 'deep-field-preview.js', 'theme.js']) await copyFile(root + 'web/' + name, directory + name);
await cp(root + 'gliboke-pole', directory + 'gliboke-pole', { recursive: true });
await writeFile(directory + '.nojekyll', '');
for (const name of ['index.html', 'style.css', 'app.js', 'favicon.svg', 'deep-field-preview.js', 'theme.js', '.nojekyll']) {
  await copyFile(directory + name, root + name);
}
console.log('GitHub Pages site is ready in the repository root and docs/ (payments disabled, contact remains masked)');
