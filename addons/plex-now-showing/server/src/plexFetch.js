// Scoped fetch for Plex requests.
//
// A Plex server reached by a custom hostname or bare IP presents a
// *.plex.direct TLS certificate that won't match, so Node's global fetch
// rejects the connection (`fetch failed` / plex_unreachable). When the user
// opts into `plex_insecure_tls`, we return a fetch-like GET built on node:https
// with certificate verification disabled — but ONLY for Plex requests. Every
// other outbound call (HA, TMDB, Radarr/Sonarr) keeps full verification.
//
// The shim implements just the surface the Plex callers use: `ok`, `status`,
// `headers.get()`, `arrayBuffer()`, `text()`, `json()`.

import http from 'node:http';
import https from 'node:https';

export function makePlexFetch({ insecure = false } = {}) {
  if (!insecure) return globalThis.fetch; // secure default — full TLS verification

  const agent = new https.Agent({ rejectUnauthorized: false });

  return (url, opts = {}) => new Promise((resolve, reject) => {
    let u;
    try { u = new URL(url); } catch (e) { return reject(e); }
    const mod = u.protocol === 'https:' ? https : http;
    const req = mod.request(
      u,
      {
        method: opts.method || 'GET',
        headers: opts.headers || {},
        agent: u.protocol === 'https:' ? agent : undefined,
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const buf = Buffer.concat(chunks);
          resolve({
            ok: res.statusCode >= 200 && res.statusCode < 300,
            status: res.statusCode,
            headers: { get: (k) => res.headers[String(k).toLowerCase()] ?? null },
            arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
            text: async () => buf.toString('utf8'),
            json: async () => JSON.parse(buf.toString('utf8')),
          });
        });
      },
    );
    req.on('error', reject);
    req.setTimeout(10000, () => req.destroy(new Error('plex fetch timeout')));
    req.end();
  });
}
