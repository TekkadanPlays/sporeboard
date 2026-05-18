import { Hono } from 'hono';
import { serveStatic } from 'hono/bun';
import { getCookie, setCookie } from 'hono/cookie';
import { html } from './template';
import { rpc, rpcBatch, type KanboardConfig } from './kanboard-rpc';
import * as jose from 'jose';
import crypto from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET || '';
const ADMIN_NPUB = process.env.ADMIN_NPUB || '';
const KANBOARD_URL = process.env.KANBOARD_URL || '';
const KANBOARD_USER = process.env.KANBOARD_USER || '';
const KANBOARD_TOKEN = process.env.KANBOARD_TOKEN || '';
const MAIN_DOMAIN = process.env.DOMAIN || 'mycelium.social';

const app = new Hono();

// ---------------------------------------------------------------------------
// Static files
// ---------------------------------------------------------------------------
app.use('/public/*', serveStatic({ root: './' }));

// ---------------------------------------------------------------------------
// SSO auth — verify mycelium_token cookie
// ---------------------------------------------------------------------------
interface AuthPayload {
  pubkey: string;
  userId: string;
}

async function verifyAuth(c: any): Promise<AuthPayload | null> {
  const token = getCookie(c, 'mycelium_token');
  if (!token || !JWT_SECRET) return null;

  try {
    const secret = new TextEncoder().encode(JWT_SECRET);
    const { payload } = await jose.jwtVerify(token, secret);
    if (!payload.pubkey || !payload.userId) return null;
    return { pubkey: payload.pubkey as string, userId: payload.userId as string };
  } catch {
    return null;
  }
}

function isAdmin(auth: AuthPayload): boolean {
  return ADMIN_NPUB ? auth.pubkey === ADMIN_NPUB : false;
}

// ---------------------------------------------------------------------------
// In-memory login tokens (no DB needed — single-admin app)
// ---------------------------------------------------------------------------
const loginTokens = new Map<string, number>(); // token → created timestamp

function cleanupTokens() {
  const cutoff = Date.now() - 15 * 60 * 1000; // 15 min
  for (const [t, ts] of loginTokens) {
    if (ts < cutoff) loginTokens.delete(t);
  }
}

// ---------------------------------------------------------------------------
// NIP-07 Login — right here on the subdomain
// ---------------------------------------------------------------------------
app.get('/api/auth/login-token', (c) => {
  cleanupTokens();
  const token = crypto.randomBytes(32).toString('hex');
  loginTokens.set(token, Date.now());
  return c.json({ token });
});

app.post('/api/auth/login', async (c) => {
  const event = await c.req.json();

  // Validate event shape
  if (!event?.id || !event?.pubkey || !event?.sig || !event?.content) {
    return c.json({ error: 'Invalid event' }, 400);
  }

  // Check login token
  const tokenTs = loginTokens.get(event.content);
  if (!tokenTs) {
    return c.json({ error: 'Invalid or expired login token' }, 401);
  }
  loginTokens.delete(event.content);

  // Verify event is recent (within 5 minutes)
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - event.created_at) > 300) {
    return c.json({ error: 'Event too old' }, 401);
  }

  // Check admin
  const pubkey = event.pubkey;
  const admin = ADMIN_NPUB ? pubkey === ADMIN_NPUB : false;

  // Sign JWT with shared secret
  const secret = new TextEncoder().encode(JWT_SECRET);
  const token = await new jose.SignJWT({ pubkey, userId: pubkey })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('7d')
    .sign(secret);

  // Set SSO cookie for all subdomains
  setCookie(c, 'mycelium_token', token, {
    domain: `.${MAIN_DOMAIN}`,
    path: '/',
    secure: true,
    sameSite: 'Lax',
    maxAge: 7 * 24 * 60 * 60,
  });

  return c.json({ ok: true, token, user: { pubkey, admin } });
});

app.get('/api/auth/me', async (c) => {
  const auth = await verifyAuth(c);
  if (!auth) return c.json({ error: 'Not authenticated' }, 401);
  return c.json({ ok: true, pubkey: auth.pubkey, admin: isAdmin(auth) });
});

// ---------------------------------------------------------------------------
// Kanboard config — uses server-side credentials (hidden from client)
// ---------------------------------------------------------------------------
function getKanboardConfig(): KanboardConfig | null {
  if (!KANBOARD_URL || !KANBOARD_USER || !KANBOARD_TOKEN) return null;
  return { url: KANBOARD_URL, username: KANBOARD_USER, apiToken: KANBOARD_TOKEN };
}

// ---------------------------------------------------------------------------
// Auth guard — all /api/* routes below require admin
// ---------------------------------------------------------------------------
app.use('/api/rpc', async (c, next) => {
  const auth = await verifyAuth(c);
  if (!auth || !isAdmin(auth)) {
    return c.json({ error: 'Admin access required' }, 403);
  }
  (c as any).auth = auth;
  await next();
});

app.use('/api/dashboard', async (c, next) => {
  const auth = await verifyAuth(c);
  if (!auth || !isAdmin(auth)) {
    return c.json({ error: 'Admin access required' }, 403);
  }
  await next();
});

app.use('/api/board/*', async (c, next) => {
  const auth = await verifyAuth(c);
  if (!auth || !isAdmin(auth)) {
    return c.json({ error: 'Admin access required' }, 403);
  }
  await next();
});

app.use('/api/task/*', async (c, next) => {
  const auth = await verifyAuth(c);
  if (!auth || !isAdmin(auth)) {
    return c.json({ error: 'Admin access required' }, 403);
  }
  await next();
});

// ---------------------------------------------------------------------------
// Generic JSON-RPC proxy — POST /api/rpc
// Body: { method: string, params?: object }
// ---------------------------------------------------------------------------
app.post('/api/rpc', async (c) => {
  const config = getKanboardConfig();
  if (!config) return c.json({ error: 'Kanboard not configured' }, 503);
  try {
    const { method, params } = await c.req.json();
    const result = await rpc(config, method, params);
    return c.json({ ok: true, result });
  } catch (e: any) {
    return c.json({ ok: false, error: e.message }, 500);
  }
});

// ---------------------------------------------------------------------------
// Convenience: GET /api/dashboard — aggregated dashboard data
// ---------------------------------------------------------------------------
app.get('/api/dashboard', async (c) => {
  const config = getKanboardConfig();
  if (!config) return c.json({ error: 'Kanboard not configured' }, 503);
  try {
    const [me, projects, overdue] = await rpcBatch(config, [
      { method: 'getMe' },
      { method: 'getMyProjects' },
      { method: 'getMyOverdueTasks' },
    ]);
    return c.json({ ok: true, me, projects, overdue });
  } catch (e: any) {
    return c.json({ ok: false, error: e.message }, 500);
  }
});

// ---------------------------------------------------------------------------
// Convenience: GET /api/board/:projectId
// ---------------------------------------------------------------------------
app.get('/api/board/:projectId', async (c) => {
  const config = getKanboardConfig();
  if (!config) return c.json({ error: 'Kanboard not configured' }, 503);
  const projectId = parseInt(c.req.param('projectId'), 10);
  try {
    const [project, board, columns, categories, swimlanes, users] = await rpcBatch(config, [
      { method: 'getProjectById', params: { project_id: projectId } },
      { method: 'getBoard', params: { project_id: projectId } },
      { method: 'getColumns', params: { project_id: projectId } },
      { method: 'getAllCategories', params: { project_id: projectId } },
      { method: 'getActiveSwimlanes', params: { project_id: projectId } },
      { method: 'getProjectUsers', params: { project_id: projectId } },
    ]);
    return c.json({ ok: true, project, board, columns, categories, swimlanes, users });
  } catch (e: any) {
    return c.json({ ok: false, error: e.message }, 500);
  }
});

// ---------------------------------------------------------------------------
// Convenience: GET /api/task/:taskId
// ---------------------------------------------------------------------------
app.get('/api/task/:taskId', async (c) => {
  const config = getKanboardConfig();
  if (!config) return c.json({ error: 'Kanboard not configured' }, 503);
  const taskId = parseInt(c.req.param('taskId'), 10);
  try {
    const [task, subtasks, comments] = await rpcBatch(config, [
      { method: 'getTask', params: { task_id: taskId } },
      { method: 'getAllSubtasks', params: { task_id: taskId } },
      { method: 'getAllComments', params: { task_id: taskId } },
    ]);
    return c.json({ ok: true, task, subtasks, comments });
  } catch (e: any) {
    return c.json({ ok: false, error: e.message }, 500);
  }
});

// ---------------------------------------------------------------------------
// SSR shell — serves the HTML with client bundle
// ---------------------------------------------------------------------------
app.get('*', (c) => {
  return c.html(html());
});

const port = parseInt(process.env.PORT || '3000', 10);

export default {
  port,
  fetch: app.fetch,
};

console.log(`🍄 Sporeboard on http://localhost:${port}`);
