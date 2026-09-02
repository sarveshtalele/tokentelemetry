// Minimal static file server with SPA fallback and an /api reverse proxy to
// the FastAPI backend (mirrors frontend/vite.config.ts's dev-server proxy,
// which only applies to `npm run dev` — this is the production equivalent).
// Usage: node static-server.js <dir> <port> [backendPort]
const fs = require('fs');
const path = require('path');
const http = require('http');

const dir = process.argv[2];
const port = Number(process.argv[3] || 5173);
const backendPort = Number(process.argv[4] || 8000);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

function proxyToBackend(req, res) {
  const proxyReq = http.request(
    { host: '127.0.0.1', port: backendPort, path: req.url, method: req.method, headers: req.headers },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode || 502, proxyRes.headers);
      proxyRes.pipe(res);
    }
  );
  proxyReq.on('error', (err) => {
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: `Backend unreachable on 127.0.0.1:${backendPort}: ${err.message}` }));
  });
  req.pipe(proxyReq);
}

function serveStatic(req, res) {
  try {
    const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
    let filePath = path.normalize(path.join(dir, urlPath));
    if (!filePath.startsWith(path.normalize(dir))) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      filePath = path.join(dir, 'index.html');
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  } catch (err) {
    res.writeHead(500);
    res.end('Internal error: ' + err.message);
  }
}

const server = http.createServer((req, res) => {
  if ((req.url || '/').startsWith('/api')) {
    proxyToBackend(req, res);
  } else {
    serveStatic(req, res);
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Static dashboard server on http://127.0.0.1:${port} (proxying /api to :${backendPort})`);
});
