import { Hono } from 'hono';
import { serveStatic } from 'hono/bun';
import { html } from './template';
import { rpc, rpcBatch, type KanboardConfig } from './kanboard-rpc';

const app = new Hono();

// ---------------------------------------------------------------------------
// Static files
// ---------------------------------------------------------------------------
app.use('/public/*', serveStatic({ root: './' }));

// ---------------------------------------------------------------------------
// Kanboard config — resolve from env or defaults
// ---------------------------------------------------------------------------
function getConfig(c: any): KanboardConfig | null {
  // Client sends credentials in X-KB-* headers (set during login)
  const url = c.req.header('x-kb-url') || process.env.KANBOARD_URL || '';
  const username = c.req.header('x-kb-user') || process.env.KANBOARD_USER || '';
  const apiToken = c.req.header('x-kb-token') || process.env.KANBOARD_TOKEN || '';
  if (!url || !username || !apiToken) return null;
  return { url, username, apiToken };
}

// ---------------------------------------------------------------------------
// Auth — validate credentials against Kanboard's getMe
// ---------------------------------------------------------------------------
app.post('/api/auth/login', async (c) => {
  try {
    const { url, username, token } = await c.req.json();
    if (!url || !username || !token) {
      return c.json({ ok: false, error: 'Missing url, username, or token' }, 400);
    }
    const config: KanboardConfig = { url, username, apiToken: token };
    const me = await rpc(config, 'getMe');
    return c.json({ ok: true, user: me });
  } catch (e: any) {
    return c.json({ ok: false, error: e.message }, 401);
  }
});

// ---------------------------------------------------------------------------
// Generic JSON-RPC proxy — POST /api/rpc
// Body: { method: string, params?: object }
// ---------------------------------------------------------------------------
app.post('/api/rpc', async (c) => {
  const config = getConfig(c);
  if (!config) return c.json({ error: 'Not authenticated' }, 401);
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
  const config = getConfig(c);
  if (!config) return c.json({ error: 'Not authenticated' }, 401);
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
  const config = getConfig(c);
  if (!config) return c.json({ error: 'Not authenticated' }, 401);
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
  const config = getConfig(c);
  if (!config) return c.json({ error: 'Not authenticated' }, 401);
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
