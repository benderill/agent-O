// Minimal static file server for local development. No dependencies.
//   npm start                         serves the repository at http://localhost:8000
//   PORT=3000 npm start               uses another port
//   node scripts/serve.mjs --base /agent-O/
//                                     serves it under a subpath, as GitHub Pages does. Anything outside the
//                                     subpath returns 404, which exposes absolute links.
// The app uses ES modules, which browsers will not load from file:// URLs, so a server is required.

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.md': 'text/plain; charset=utf-8',
  '.py': 'text/plain; charset=utf-8',
  '.ipynb': 'application/json; charset=utf-8',
};

/** Starts the server and resolves with it once listening. `base` is a path prefix such as '/agent-O/'. */
export function serve({ port = Number(process.env.PORT) || 8000, base = '/' } = {}) {
  if (!base.startsWith('/')) base = '/' + base;
  if (!base.endsWith('/')) base += '/';
  const server = createServer(async (req, res) => {
    try {
      let urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      if (urlPath + '/' === base) {
        res.writeHead(301, { Location: base }).end();
        return;
      }
      if (!urlPath.startsWith(base)) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end(`Not found (outside ${base})`);
        return;
      }
      urlPath = '/' + urlPath.slice(base.length);
      let file = resolve(join(root, normalize(urlPath)));
      if (file !== root && !file.startsWith(root + sep)) {
        res.writeHead(403).end('Forbidden');
        return;
      }
      if ((await stat(file).catch(() => null))?.isDirectory()) file = join(file, 'index.html');
      const body = await readFile(file);
      res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      res.end(body);
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found');
    }
  });
  return new Promise((ok) => server.listen(port, () => ok(server)));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const i = process.argv.indexOf('--base');
  const base = i > 0 ? process.argv[i + 1] : '/';
  const port = Number(process.env.PORT) || 8000;
  serve({ port, base }).then(() => console.log(`Optimization Live running at http://localhost:${port}${base.startsWith('/') ? base : '/' + base}`));
}
