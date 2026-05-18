// ---------------------------------------------------------------------------
// Client-side API layer — all fetch calls to the Hono BFF
// ---------------------------------------------------------------------------

import {
  authCredentials, currentUser, authLoading, authError,
  projects, overdueTasks, boardData, boardColumns,
  boardCategories, boardSwimlanes, boardUsers, currentProject,
  currentTask, currentSubtasks, currentComments,
  tasksList, globalLoading, globalError,
  saveAuth, navigate, batch,
  type AuthCredentials, type KBTask,
} from '../signals';

// ---------------------------------------------------------------------------
// Headers builder — sends KB credentials on every request
// ---------------------------------------------------------------------------

function headers(): Record<string, string> {
  const creds = authCredentials.value;
  if (!creds) return { 'Content-Type': 'application/json' };
  return {
    'Content-Type': 'application/json',
    'x-kb-url': creds.url,
    'x-kb-user': creds.username,
    'x-kb-token': creds.token,
  };
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export async function login(url: string, username: string, token: string): Promise<boolean> {
  authLoading.value = true;
  authError.value = '';
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, username, token }),
    });
    const data = await res.json();
    if (data.ok) {
      batch(() => {
        saveAuth({ url, username, token });
        currentUser.value = data.user;
        authLoading.value = false;
      });
      navigate('dashboard');
      return true;
    } else {
      batch(() => {
        authError.value = data.error || 'Login failed';
        authLoading.value = false;
      });
      return false;
    }
  } catch (e: any) {
    batch(() => {
      authError.value = e.message;
      authLoading.value = false;
    });
    return false;
  }
}

export async function validateSession(): Promise<boolean> {
  try {
    const res = await fetch('/api/rpc', {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ method: 'getMe' }),
    });
    const data = await res.json();
    if (data.ok && data.result) {
      currentUser.value = data.result;
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export async function fetchDashboard() {
  globalLoading.value = true;
  try {
    const res = await fetch('/api/dashboard', { headers: headers() });
    const data = await res.json();
    if (data.ok) {
      batch(() => {
        currentUser.value = data.me;
        projects.value = data.projects || [];
        overdueTasks.value = data.overdue || [];
        globalLoading.value = false;
      });
    } else {
      batch(() => {
        globalError.value = data.error;
        globalLoading.value = false;
      });
    }
  } catch (e: any) {
    batch(() => {
      globalError.value = e.message;
      globalLoading.value = false;
    });
  }
}

// ---------------------------------------------------------------------------
// Board
// ---------------------------------------------------------------------------

export async function fetchBoard(projectId: number, quiet: boolean = false) {
  if (!quiet) globalLoading.value = true;
  try {
    const res = await fetch(`/api/board/${projectId}`, { headers: headers() });
    const data = await res.json();
    if (data.ok) {
      batch(() => {
        currentProject.value = data.project;
        boardData.value = data.board || [];
        boardColumns.value = data.columns || [];
        boardCategories.value = data.categories || [];
        boardSwimlanes.value = data.swimlanes || [];
        boardUsers.value = data.users || {};
        if (!quiet) globalLoading.value = false;
      });
    } else {
      batch(() => {
        globalError.value = data.error;
        if (!quiet) globalLoading.value = false;
      });
    }
  } catch (e: any) {
    batch(() => {
      globalError.value = e.message;
      globalLoading.value = false;
    });
  }
}

// ---------------------------------------------------------------------------
// Task Detail
// ---------------------------------------------------------------------------

export async function fetchTask(taskId: number) {
  try {
    const res = await fetch(`/api/task/${taskId}`, { headers: headers() });
    const data = await res.json();
    if (data.ok) {
      batch(() => {
        currentTask.value = data.task;
        currentSubtasks.value = data.subtasks || [];
        currentComments.value = data.comments || [];
      });
    }
  } catch (e: any) {
    globalError.value = e.message;
  }
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

async function rpcCall(method: string, params?: Record<string, any>) {
  const res = await fetch('/api/rpc', {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ method, params }),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || 'RPC call failed');
  return data.result;
}

export async function createTask(params: Record<string, any>): Promise<number | false> {
  try {
    return await rpcCall('createTask', params);
  } catch {
    return false;
  }
}

export async function updateTask(params: Record<string, any>): Promise<boolean> {
  try {
    return await rpcCall('updateTask', params);
  } catch {
    return false;
  }
}

export async function moveTask(projectId: number, taskId: number, columnId: number, position: number, swimlaneId: number): Promise<boolean> {
  try {
    return await rpcCall('moveTaskPosition', {
      project_id: projectId,
      task_id: taskId,
      column_id: columnId,
      position,
      swimlane_id: swimlaneId,
    });
  } catch {
    return false;
  }
}

export async function closeTask(taskId: number): Promise<boolean> {
  try {
    return await rpcCall('closeTask', { task_id: taskId });
  } catch {
    return false;
  }
}

export async function openTask(taskId: number): Promise<boolean> {
  try {
    return await rpcCall('openTask', { task_id: taskId });
  } catch {
    return false;
  }
}

export async function createSubtask(taskId: number, title: string): Promise<number | false> {
  try {
    return await rpcCall('createSubtask', { task_id: taskId, title });
  } catch {
    return false;
  }
}

export async function updateSubtask(params: Record<string, any>): Promise<boolean> {
  try {
    return await rpcCall('updateSubtask', params);
  } catch {
    return false;
  }
}

export async function createComment(taskId: number, userId: number, content: string): Promise<number | false> {
  try {
    return await rpcCall('createComment', {
      task_id: taskId,
      user_id: userId,
      content,
    });
  } catch {
    return false;
  }
}

export async function createProject(name: string, description?: string): Promise<number | false> {
  try {
    return await rpcCall('createProject', { name, description });
  } catch {
    return false;
  }
}

export async function fetchAllTasks(projectId: number) {
  try {
    const result = await rpcCall('getAllTasks', { project_id: projectId, status_id: 1 });
    tasksList.value = result || [];
  } catch (e: any) {
    globalError.value = e.message;
  }
}
