// Minimal static-file server for local preview of TuroFleetManager (a static PWA).
// Production hosting is GitHub Pages; this is only for dev preview via Claude Preview MCP
// or local testing. No dependencies — uses Node's built-in http + fs + path modules.
//
// Usage: `node server.js` (default port 3000). Override with `PORT=8080 node server.js`.

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = parseInt(process.env.PORT, 10) || 3000;
const ROOT = __dirname;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.htm':  'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.mjs':  'application/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.webp': 'image/webp',
  '.ico':  'image/x-icon',
  '.webmanifest': 'application/manifest+json',
  '.txt':  'text/plain; charset=utf-8',
  '.md':   'text/markdown; charset=utf-8',
  '.map':  'application/json; charset=utf-8'
};

function sendError(res, code, msg) {
  res.writeHead(code, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(msg);
}

const server = http.createServer((req, res) => {
  // Strip query string, decode URI
  let urlPath;
  try {
    urlPath = decodeURIComponent(req.url.split('?')[0]);
  } catch {
    return sendError(res, 400, 'Bad URL');
  }

  // Default to index.html at root
  if (urlPath === '/' || urlPath === '') urlPath = '/index.html';

  // Resolve and prevent directory traversal
  const safePath = path.normalize(path.join(ROOT, urlPath));
  if (!safePath.startsWith(ROOT)) return sendError(res, 403, 'Forbidden');

  fs.stat(safePath, (err, stat) => {
    if (err || !stat) {
      // SPA fallback: unknown routes return index.html so client-side routing works
      const indexPath = path.join(ROOT, 'index.html');
      fs.readFile(indexPath, (e2, data) => {
        if (e2) return sendError(res, 404, 'Not found');
        res.writeHead(200, {
          'Content-Type': MIME['.html'],
          'Cache-Control': 'no-store'
        });
        res.end(data);
      });
      return;
    }

    if (stat.isDirectory()) {
      // Serve index.html from directory
      const idx = path.join(safePath, 'index.html');
      return fs.readFile(idx, (e3, data) => {
        if (e3) return sendError(res, 404, 'Not found');
        res.writeHead(200, { 'Content-Type': MIME['.html'], 'Cache-Control': 'no-store' });
        res.end(data);
      });
    }

    const ext = path.extname(safePath).toLowerCase();
    const type = MIME[ext] || 'application/octet-stream';
    fs.readFile(safePath, (e4, data) => {
      if (e4) return sendError(res, 500, 'Read error: ' + e4.message);
      res.writeHead(200, {
        'Content-Type': type,
        // No caching during dev so iteration is instant
        'Cache-Control': 'no-store'
      });
      res.end(data);
    });
  });
});

server.listen(PORT, () => {
  console.log(`TuroFleetManager static preview running at http://localhost:${PORT}`);
});
