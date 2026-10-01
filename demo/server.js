/**
 * Local demo server — static files + mock /upload endpoint.
 * No dependencies. Run: node demo/server.js → http://localhost:4173/demo/
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PORT = 4173;

const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
};

http.createServer((req, res) => {
    const url = decodeURIComponent(req.url.split('?')[0]);

    // Mock upload endpoint — returns FilePond-compatible {path} response
    if (req.method === 'POST' && url === '/upload') {
        let size = 0;
        req.on('data', (chunk) => (size += chunk.length));
        req.on('end', () => {
            console.log(`[upload] received ${size} bytes`);
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ path: `demo/${Date.now()}.png` }));
        });
        return;
    }

    if (req.method !== 'GET') {
        res.writeHead(405).end();
        return;
    }

    const rel = url === '/' || url === '/demo' || url === '/demo/'
        ? '/demo/index.html'
        : url;

    const filePath = path.normalize(path.join(ROOT, rel));

    if (!filePath.startsWith(ROOT)) {
        res.writeHead(403).end('Forbidden');
        return;
    }

    fs.readFile(filePath, (err, content) => {
        if (err) {
            res.writeHead(404).end('Not found: ' + rel);
            return;
        }
        res.setHeader('Content-Type', MIME[path.extname(filePath)] || 'application/octet-stream');
        res.end(content);
    });
}).listen(PORT, () => {
    console.log(`Demo: http://localhost:${PORT}/demo/`);
});
