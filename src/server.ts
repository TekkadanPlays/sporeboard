import { Hono } from 'hono';
import { serveStatic } from 'hono/bun';
import { getCookie } from 'hono/cookie';
import { html } from './template';
import { rpc, rpcBatch, type KanboardConfig } from './kanboard-rpc';
import * as jose from 'jose';

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
// SSO auth middleware — verify mycelium_token cookie
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
// Auth status — GET /api/auth/me
// Returns the current user from the SSO cookie (no login needed here)
// ---------------------------------------------------------------------------
app.get('/api/auth/me', async (c) => {
  const auth = await verifyAuth(c);
  if (!auth) return c.json({ error: 'Not authenticated. Log in at ' + MAIN_DOMAIN }, 401);
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
