import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT) || 4173;
const types = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.mjs':'text/javascript; charset=utf-8', '.jpg':'image/jpeg', '.webmanifest':'application/manifest+json; charset=utf-8' };
const sendJson = (res, status, body) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(body)); };
const readJson = req => new Promise((resolve, reject) => {
  let body = '';
  req.on('data', chunk => { body += chunk; if (body.length > 10_000) reject(new Error('payload too large')); });
  req.on('end', () => { try { resolve(JSON.parse(body)); } catch { reject(new Error('invalid json')); } });
  req.on('error', reject);
});
http.createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (pathname === '/api/login' && req.method === 'POST') {
      const body = await readJson(req);
      const expectedUser = String(process.env.APP_USERNAME || '').trim().toUpperCase();
      const expectedPassword = String(process.env.APP_PASSWORD || '');
      if (!expectedUser || !expectedPassword) return sendJson(res, 503, { message: 'Acesso ainda não configurado no servidor.' });
      const username = String(body.username || '').trim().toUpperCase();
      const password = String(body.password || '');
      if (username !== expectedUser || password !== expectedPassword) return sendJson(res, 401, { message: 'Usuário ou senha inválidos.' });
      return sendJson(res, 200, { user: expectedUser });
    }
    if (pathname === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end('{"status":"ok"}');
      return;
    }
    const requested = pathname === '/' ? '/index.html' : pathname;
    const file = path.resolve(root, `.${requested}`);
    if (!file.startsWith(root + path.sep)) throw new Error('invalid path');
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(body);
  } catch {
    res.writeHead(404, { 'Content-Type':'text/plain; charset=utf-8' });
    res.end('Arquivo não encontrado.');
  }
}).listen(port, '0.0.0.0', () => console.log(`Teixeira Gestão disponível na porta ${port}`));
