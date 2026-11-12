import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
await import('./build.mjs');
const { default: worker } = await import(pathToFileURL(resolve('dist/server/index.js')));
const env = { ...process.env };
try {
  const file = await readFile('.env', 'utf8');
  for (const line of file.split('\n')) {
    const match = line.match(/^([A-Z_]+)=(.*)$/);
    if (match && !env[match[1]]) env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
  }
} catch {}
const portArg = process.argv.indexOf('--port');
const port = Number(portArg >= 0 ? process.argv[portArg+1] : process.env.PORT || 3000);
http.createServer(async (req, res) => {
  try {
    const body = [];
    for await (const chunk of req) body.push(chunk);
    const request = new Request('http://' + (req.headers.host || 'localhost') + req.url, {
      method: req.method, headers: req.headers,
      ...(!['GET', 'HEAD'].includes(req.method) ? { body: Buffer.concat(body) } : {})
    });
    const result = await worker.fetch(request, env);
    res.writeHead(result.status, Object.fromEntries(result.headers));
    res.end(Buffer.from(await result.arrayBuffer()));
  } catch { res.writeHead(500); res.end('Server error'); }
}).listen(port, '0.0.0.0', () => console.log('XpiX preview on port ' + port));
