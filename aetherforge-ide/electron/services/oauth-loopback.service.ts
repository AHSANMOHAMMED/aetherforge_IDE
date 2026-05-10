import http from 'node:http';
import type { WebContents } from 'electron';
import { IPCChannels } from '../../src/common/ipc';

let server: http.Server | null = null;

export function stopOAuthLoopback(): void {
  if (server) {
    try {
      server.close();
    } catch {
      // ignore
    }
    server = null;
  }
}

/**
 * Binds an ephemeral loopback HTTP server; on `/oauth/callback` posts `code` + `state` to the renderer.
 */
export async function startOAuthLoopback(
  wc: WebContents,
  expectedState: string
): Promise<{ port: number; redirectUri: string }> {
  stopOAuthLoopback();
  return new Promise((resolve, reject) => {
    const srv = http.createServer((req, res) => {
      void (async () => {
        try {
          const u = new URL(req.url ?? '/', 'http://127.0.0.1');
          if (u.pathname !== '/oauth/callback') {
            res.writeHead(404);
            res.end();
            return;
          }
          const code = u.searchParams.get('code') ?? '';
          const state = u.searchParams.get('state') ?? '';
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end('<!doctype html><title>Sign-in complete</title><p>You can close this tab.</p>');
          if (state === expectedState && code && !wc.isDestroyed()) {
            wc.send(IPCChannels.OAuthLoopbackResult, { code, state });
          }
        } finally {
          stopOAuthLoopback();
        }
      })();
    });
    srv.once('error', (err) => {
      stopOAuthLoopback();
      reject(err);
    });
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address();
      if (!addr || typeof addr === 'string') {
        reject(new Error('Failed to bind OAuth loopback server'));
        return;
      }
      server = srv;
      resolve({
        port: addr.port,
        redirectUri: `http://127.0.0.1:${addr.port}/oauth/callback`
      });
    });
  });
}
