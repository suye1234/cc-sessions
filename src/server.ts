import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, resolve, extname } from 'node:path';
import { Store } from './store.js';
import { SessionManager } from './session.js';
import { SearchEngine } from './search.js';

const PORT = parseInt(process.env['PORT'] ?? '8283', 10);
const DATA_DIR = process.env['SESSIONS_DATA_DIR'] ?? join(resolve('.'), 'data');
const PUBLIC_DIR = join(resolve('.'), 'public');

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

const store = new Store(DATA_DIR);
const manager = new SessionManager(store);
const search = new SearchEngine(store);

function json(res: import('node:http').ServerResponse, data: unknown, status = 200): void {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify(data));
}

async function serveStatic(res: import('node:http').ServerResponse, filePath: string): Promise<boolean> {
  try {
    const content = await readFile(filePath);
    const ext = extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] ?? 'application/octet-stream' });
    res.end(content);
    return true;
  } catch {
    return false;
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
  const path = url.pathname;

  try {
    // API routes
    if (path === '/api/sessions' && req.method === 'GET') {
      const filter = {
        tag: url.searchParams.get('tag') ?? undefined,
        project: url.searchParams.get('project') ?? undefined,
        query: url.searchParams.get('query') ?? undefined,
        from: url.searchParams.get('from') ?? undefined,
        to: url.searchParams.get('to') ?? undefined,
      };
      const sessions = await manager.list(filter);
      json(res, { sessions });
      return;
    }

    if (path === '/api/search' && req.method === 'GET') {
      const q = url.searchParams.get('q') ?? '';
      if (!q) { json(res, { results: [] }); return; }
      const filter = {
        tag: url.searchParams.get('tag') ?? undefined,
        project: url.searchParams.get('project') ?? undefined,
      };
      const results = await search.search(q, filter);
      json(res, { results });
      return;
    }

    const sessionMatch = path.match(/^\/api\/sessions\/(.+)$/);
    if (sessionMatch && req.method === 'GET') {
      const id = sessionMatch[1];
      const sessions = await manager.list();
      const match = sessions.find(s => s.id.startsWith(id));
      if (!match) { json(res, { error: 'Not found' }, 404); return; }
      const session = await manager.get(match.id);
      if (!session) { json(res, { error: 'Not found' }, 404); return; }
      json(res, { session });
      return;
    }

    if (sessionMatch && req.method === 'DELETE') {
      const id = sessionMatch[1];
      const sessions = await manager.list();
      const match = sessions.find(s => s.id.startsWith(id));
      if (!match) { json(res, { error: 'Not found' }, 404); return; }
      await manager.delete(match.id);
      json(res, { deleted: match.id });
      return;
    }

    // CORS preflight for DELETE
    if (sessionMatch && req.method === 'OPTIONS') {
      res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, DELETE, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' });
      res.end();
      return;
    }

    // Static files
    if (path === '/' || path === '/index.html') {
      await serveStatic(res, join(PUBLIC_DIR, 'index.html'));
      return;
    }

    const served = await serveStatic(res, join(PUBLIC_DIR, path.slice(1)));
    if (!served) {
      res.writeHead(404);
      res.end('Not found');
    }
  } catch (err) {
    console.error('Server error:', err);
    json(res, { error: 'Internal server error' }, 500);
  }
});

async function start(): Promise<void> {
  await manager.init();
  server.listen(PORT, () => {
    console.log(`Sessions Dashboard: http://localhost:${PORT}`);
  });
}

start();
