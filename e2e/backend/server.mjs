/**
 * Local stand-in for the Supabase project used by the end-to-end tests:
 * an embedded PostgreSQL with the real migration applied, plus a tiny HTTP
 * server that answers like PostgREST (`POST /rest/v1/rpc/<fn>`, as the anon
 * role) and like the `otp` edge function (SMS provider "test").
 *
 *   node server.mjs [port]      (default 54321)
 *
 * Test helper: GET /__test/otp?phone=9xxxxxxxxx → the last code "sent".
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { chownSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const here = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.argv[2] || 54321);
const PG_PORT = PORT + 1;
// PostgreSQL binaries from the `@embedded-postgres/<platform>` package. Postgres
// refuses to run as root, so when started as root it runs as the "postgres"
// OS user, with its files in a world-traversable place.
const BIN = join(here, 'node_modules', '@embedded-postgres', `${process.platform}-${process.arch}`, 'native', 'bin');
const dir = mkdtempSync(join('/tmp', 'cce-pg-'));
let ids = {};
if (process.getuid?.() === 0) {
  const id = (f) => Number(execFileSync('id', [f, 'postgres']).toString().trim());
  try {
    ids = { uid: id('-u'), gid: id('-g') };
  } catch {
    execFileSync('useradd', ['-r', '-U', 'postgres']);
    ids = { uid: id('-u'), gid: id('-g') };
  }
  chownSync(dir, ids.uid, ids.gid);
}
function pgRun(cmd, args) {
  const r = spawnSync(join(BIN, cmd), args, { ...ids, env: { LC_ALL: 'C', PATH: process.env.PATH }, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`${cmd} failed: ${r.stderr || r.stdout}`);
}
pgRun('initdb', ['-D', dir, '-U', 'postgres', '--auth=trust', '-E', 'UTF8', '--locale=C']);
pgRun('pg_ctl', ['-D', dir, '-o', `-p ${PG_PORT} -k /tmp -c listen_addresses=127.0.0.1`, '-l', join(dir, 'server.log'), '-w', 'start']);
const epg = { stop: async () => pgRun('pg_ctl', ['-D', dir, '-m', 'fast', '-w', 'stop']) };

const pool = new pg.Pool({ host: '127.0.0.1', port: PG_PORT, user: 'postgres', database: 'postgres', max: 8 });

// Supabase-like roles and the extensions schema
await pool.query(`
  do $$ begin
    if not exists (select from pg_roles where rolname = 'anon') then create role anon nologin; end if;
    if not exists (select from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
    if not exists (select from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
  end $$;
  create schema if not exists extensions;
  grant usage on schema public, extensions to anon, authenticated, service_role;
  alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
`);
const migDir = join(here, '..', '..', 'supabase', 'migrations');
for (const f of readdirSync(migDir).filter((x) => x.endsWith('.sql')).sort()) {
  await pool.query(readFileSync(join(migDir, f), 'utf8'));
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'apikey, authorization, content-type, x-client-info, prefer',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

function send(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json', ...CORS });
  res.end(JSON.stringify(body));
}

async function readJson(req) {
  let raw = '';
  for await (const c of req) raw += c;
  return raw ? JSON.parse(raw) : {};
}

/** Call a SQL function as `role`, with PostgREST-style request headers. */
async function callAs(role, fn, args, headers) {
  const c = await pool.connect();
  try {
    await c.query('begin');
    await c.query(`select set_config('request.headers', $1, true)`, [JSON.stringify(headers)]);
    await c.query(`set local role ${role}`);
    const names = Object.keys(args);
    const sql = `select public.${fn}(${names.map((n, i) => `${n} => $${i + 1}`).join(', ')}) as r`;
    const out = await c.query(sql, names.map((n) => (args[n] !== null && typeof args[n] === 'object' ? JSON.stringify(args[n]) : args[n])));
    await c.query('commit');
    return out.rows[0].r;
  } catch (e) {
    await c.query('rollback').catch(() => {});
    throw e;
  } finally {
    c.release();
  }
}

const server = createServer(async (req, res) => {
  try {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, CORS);
      return res.end();
    }
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const hdrs = { 'x-forwarded-for': req.socket.remoteAddress ?? 'local' };
    const rpc = /^\/rest\/v1\/rpc\/([a-z_]+)$/.exec(url.pathname);
    if (rpc && req.method === 'POST') {
      const fn = rpc[1];
      if (!fn.startsWith('api_')) return send(res, 404, { code: 'PGRST202', message: 'not found' });
      try {
        return send(res, 200, await callAs('anon', fn, await readJson(req), hdrs));
      } catch (e) {
        return send(res, 400, { code: e.code, message: e.message });
      }
    }
    if (url.pathname === '/functions/v1/otp' && req.method === 'POST') {
      const body = await readJson(req);
      if (body.action === 'send') {
        const r = await callAs('service_role', 'svc_otp_create', { p_phone: String(body.phone ?? ''), p_ip: hdrs['x-forwarded-for'], p_provider: 'test' }, hdrs);
        if (!r.ok) return send(res, 200, r);
        return send(res, 200, { ok: true });
      }
      if (body.action === 'verify') {
        return send(res, 200, await callAs('service_role', 'svc_otp_check', { p_phone: String(body.phone ?? ''), p_code: String(body.code ?? '') }, hdrs));
      }
      return send(res, 200, { ok: false, error: 'bad_request' });
    }
    if (url.pathname === '/__test/otp') {
      const r = await pool.query('select code from private.otp_outbox where phone = $1 order by id desc limit 1', [url.searchParams.get('phone')]);
      return send(res, 200, { code: r.rows[0]?.code ?? null });
    }
    if (url.pathname === '/__test/sql' && req.method === 'POST') {
      const body = await readJson(req);
      const r = await pool.query(body.sql);
      return send(res, 200, { rows: r.rows ?? [] });
    }
    send(res, 404, { message: 'not found' });
  } catch (e) {
    send(res, 500, { message: String(e?.message ?? e) });
  }
});

server.listen(PORT, '127.0.0.1', () => console.log(`local backend ready on http://localhost:${PORT}`));

async function stop() {
  server.close();
  await pool.end().catch(() => {});
  await epg.stop().catch(() => {});
  rmSync(dir, { recursive: true, force: true });
  process.exit(0);
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
