import type { IncomingMessage, ServerResponse } from 'node:http';
import app from '../backend/src/app';

export default function handler(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url || '/', 'http://localhost');
  if (url.pathname === '/api/handler') {
    const route = url.searchParams.get('__eco_path');
    if (!route || !/^[a-z0-9][a-z0-9._/-]*$/i.test(route)) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: 'Route not found' }));
      return;
    }
    url.searchParams.delete('__eco_path');
    req.url = `/api/${route}${url.search}`;
  } else if (url.searchParams.has('__eco_path')) {
    url.searchParams.delete('__eco_path');
    req.url = url.pathname + url.search;
  }

  app(req, res);
}
