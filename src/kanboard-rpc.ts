// ---------------------------------------------------------------------------
// Kanboard JSON-RPC client — server-side only (runs in Bun/Hono)
// ---------------------------------------------------------------------------

let _nextId = 1;

export interface RpcRequest {
  jsonrpc: '2.0';
  method: string;
  id: number;
  params?: Record<string, any>;
}

export interface RpcResponse<T = any> {
  jsonrpc: '2.0';
  id: number;
  result?: T;
  error?: { code: number; message: string; data?: any };
}

export interface KanboardConfig {
  url: string;       // e.g. "http://localhost:8080/jsonrpc.php"
  username: string;
  apiToken: string;
}

/**
 * Execute a single JSON-RPC call against the Kanboard backend.
 */
export async function rpc<T = any>(
  config: KanboardConfig,
  method: string,
  params?: Record<string, any>,
): Promise<T> {
  const body: RpcRequest = {
    jsonrpc: '2.0',
    method,
    id: _nextId++,
    ...(params ? { params } : {}),
  };

  const auth = btoa(`${config.username}:${config.apiToken}`);

  const res = await fetch(config.url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${auth}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`Kanboard HTTP ${res.status}: ${res.statusText}`);
  }

  const data: RpcResponse<T> = await res.json();

  if (data.error) {
    throw new Error(`Kanboard RPC [${data.error.code}]: ${data.error.message}`);
  }

  return data.result as T;
}

/**
 * Execute multiple JSON-RPC calls in parallel.
 */
export async function rpcBatch<T extends any[]>(
  config: KanboardConfig,
  calls: Array<{ method: string; params?: Record<string, any> }>,
): Promise<T> {
  return Promise.all(
    calls.map(c => rpc(config, c.method, c.params)),
  ) as Promise<T>;
}
