// ---------------------------------------------------------------------------
// Kanboard reactive state layer — Preact Signals (framework-agnostic core)
// ---------------------------------------------------------------------------

import { signal, computed, effect, batch } from '@preact/signals-core';

export { signal, computed, effect, batch };

// ---------------------------------------------------------------------------
// Types — mirrors Kanboard's JSON-RPC data shapes
// ---------------------------------------------------------------------------

export interface KBUser {
  id: number;
  username: string;
  name: string;
  email: string;
  role: string;
  is_active: number;
  avatar_path: string;
}

export interface KBProject {
  id: number;
  name: string;
  description: string;
  identifier: string;
  is_active: number;
  is_public: number;
  is_private: number;
  last_modified: number;
  owner_id: number;
  columns?: KBColumn[];
  nb_active_tasks?: number;
  url?: { board: string; list: string; };
}

export interface KBColumn {
  id: number;
  title: string;
  position: number;
  project_id: number;
  task_limit: number;
  description: string;
  nb_open_tasks?: number;
  nb_closed_tasks?: number;
}

export interface KBSwimlane {
  id: number;
  name: string;
  description: string;
  position: number;
  is_active: number;
  project_id: number;
  nb_tasks?: number;
  columns?: KBBoardColumn[];
}

export interface KBBoardColumn {
  id: number;
  title: string;
  position: number;
  task_limit: number;
  tasks: KBTask[];
  nb_tasks: number;
  score: number;
}

export interface KBTask {
  id: number;
  title: string;
  description: string;
  project_id: number;
  column_id: number;
  swimlane_id: number;
  position: number;
  color_id: string;
  category_id: number;
  category_name?: string;
  owner_id: number;
  assignee_username?: string;
  assignee_name?: string;
  creator_id: number;
  date_due: string;
  date_started: string;
  date_creation: number;
  date_modification: number;
  date_completed: number;
  date_moved: number;
  is_active: number;
  score: number;
  priority: number;
  reference: string;
  time_spent: number;
  time_estimated: number;
  nb_subtasks?: number;
  nb_completed_subtasks?: number;
  nb_comments?: number;
  tags?: string[];
  url?: string;
}

export interface KBSubtask {
  id: number;
  title: string;
  status: number; // 0 = Todo, 1 = In progress, 2 = Done
  time_estimated: number;
  time_spent: number;
  task_id: number;
  user_id: number;
  username?: string;
  name?: string;
  position: number;
}

export interface KBComment {
  id: number;
  task_id: number;
  user_id: number;
  username?: string;
  name?: string;
  comment: string;
  date_creation: number;
  date_modification: number;
}

export interface KBCategory {
  id: number;
  name: string;
  project_id: number;
  color_id: string;
  description?: string;
}

// ---------------------------------------------------------------------------
// Auth state
// ---------------------------------------------------------------------------

export interface AuthCredentials {
  url: string;
  username: string;
  token: string;
}

export const authCredentials = signal<AuthCredentials | null>(null);
export const currentUser = signal<KBUser | null>(null);
export const isAuthenticated = computed(() => currentUser.value !== null);
export const authLoading = signal(false);
export const authError = signal('');

// Persist/restore from localStorage
const CRED_KEY = 'kb_credentials';

export function restoreAuth(): boolean {
  try {
    const raw = localStorage.getItem(CRED_KEY);
    if (raw) {
      const creds = JSON.parse(raw) as AuthCredentials;
      authCredentials.value = creds;
      return true;
    }
  } catch {}
  return false;
}

export function saveAuth(creds: AuthCredentials) {
  localStorage.setItem(CRED_KEY, JSON.stringify(creds));
  authCredentials.value = creds;
}

export function logout() {
  localStorage.removeItem(CRED_KEY);
  batch(() => {
    authCredentials.value = null;
    currentUser.value = null;
    projects.value = [];
    currentProject.value = null;
    boardData.value = [];
    currentTask.value = null;
    route.value = 'login';
  });
}

// ---------------------------------------------------------------------------
// Router state
// ---------------------------------------------------------------------------

export type Route = 'login' | 'dashboard' | 'board' | 'list' | 'task' | 'settings';

export const route = signal<Route>('login');
export const routeParams = signal<Record<string, string>>({});

export function navigate(r: Route, params: Record<string, string> = {}) {
  batch(() => {
    route.value = r;
    routeParams.value = params;
  });
  // Update hash
  const hash = params.projectId
    ? `#${r}/${params.projectId}${params.taskId ? '/' + params.taskId : ''}`
    : `#${r}`;
  history.replaceState(null, '', hash);
}

export function parseHash() {
  const hash = location.hash.replace('#', '');
  if (!hash) return;
  const parts = hash.split('/');
  const r = parts[0] as Route;
  const params: Record<string, string> = {};
  if (parts[1]) params.projectId = parts[1];
  if (parts[2]) params.taskId = parts[2];
  batch(() => {
    route.value = r;
    routeParams.value = params;
  });
}

// ---------------------------------------------------------------------------
// Data state
// ---------------------------------------------------------------------------

export const projects = signal<KBProject[]>([]);
export const currentProject = signal<KBProject | null>(null);
export const boardData = signal<KBSwimlane[]>([]);
export const boardColumns = signal<KBColumn[]>([]);
export const boardCategories = signal<KBCategory[]>([]);
export const boardSwimlanes = signal<KBSwimlane[]>([]);
export const boardUsers = signal<Record<string, any>>({});
export const overdueTasks = signal<KBTask[]>([]);

export const currentTask = signal<KBTask | null>(null);
export const currentSubtasks = signal<KBSubtask[]>([]);
export const currentComments = signal<KBComment[]>([]);

export const tasksList = signal<KBTask[]>([]);

export const globalLoading = signal(false);
export const globalError = signal('');

// Filters
export const filterCategory = signal<number | null>(null);
export const filterAssignee = signal<number | null>(null);
export const filterColor = signal<string | null>(null);
export const filterSearch = signal('');

// Sidebar
export const sidebarCollapsed = signal(false);

// Task detail panel
export const taskPanelOpen = signal(false);

// Board interaction state (signals, not component state, so S() tracks them)
export const creatingInColumn = signal<number | null>(null);
export const newTaskTitle = signal('');
export const dragOverColumn = signal<number | null>(null);

// Drag-and-drop insertion tracking
export interface DragOverInfo {
  columnId: number;
  swimlaneId: number;
  insertIndex: number; // index *before* which the card will be inserted (-1 = end)
}
export const dragOverInfo = signal<DragOverInfo | null>(null);
export const isDragging = signal(false);

// ---------------------------------------------------------------------------
// Optimistic task move — updates local board data immediately
// ---------------------------------------------------------------------------
export function optimisticMoveTask(taskId: number, fromColumnId: number, toColumnId: number, swimlaneId: number, insertIndex: number = -1) {
  const data = boardData.value;
  let movedTask: KBTask | null = null;

  // Deep-clone and remove from source
  const updated = data.map(sl => ({
    ...sl,
    columns: (sl.columns || []).map(col => {
      if (col.id === fromColumnId) {
        const idx = col.tasks.findIndex(t => t.id === taskId);
        if (idx !== -1) {
          movedTask = { ...col.tasks[idx], column_id: toColumnId };
          const newTasks = [...col.tasks];
          newTasks.splice(idx, 1);
          return { ...col, tasks: newTasks, nb_tasks: newTasks.length };
        }
      }
      return col;
    }),
  }));

  if (!movedTask) return;

  // Insert into target
  const final = updated.map(sl => ({
    ...sl,
    columns: (sl.columns || []).map(col => {
      if (col.id === toColumnId && (sl.id === swimlaneId || swimlaneId === 0)) {
        const newTasks = [...col.tasks];
        if (insertIndex >= 0 && insertIndex <= newTasks.length) {
            newTasks.splice(insertIndex, 0, movedTask!);
        } else {
            newTasks.push(movedTask!);
        }
        return { ...col, tasks: newTasks, nb_tasks: newTasks.length };
      }
      return col;
    }),
  }));

  boardData.value = final;
}

// ---------------------------------------------------------------------------
// Kanboard color palette — mapped to modern OKLCH values
// ---------------------------------------------------------------------------
export const KANBOARD_COLORS: Record<string, { name: string; bg: string; border: string; text: string }> = {
  yellow:      { name: 'Yellow',      bg: 'oklch(0.95 0.12 95)',   border: 'oklch(0.85 0.17 95)',   text: 'oklch(0.30 0.08 80)'  },
  blue:        { name: 'Blue',        bg: 'oklch(0.92 0.06 250)',  border: 'oklch(0.78 0.12 250)',  text: 'oklch(0.30 0.10 250)' },
  green:       { name: 'Green',       bg: 'oklch(0.92 0.10 150)',  border: 'oklch(0.75 0.18 150)',  text: 'oklch(0.30 0.08 150)' },
  purple:      { name: 'Purple',      bg: 'oklch(0.88 0.12 300)',  border: 'oklch(0.72 0.19 300)',  text: 'oklch(0.30 0.10 300)' },
  red:         { name: 'Red',         bg: 'oklch(0.90 0.10 25)',   border: 'oklch(0.75 0.17 25)',   text: 'oklch(0.35 0.10 25)'  },
  orange:      { name: 'Orange',      bg: 'oklch(0.92 0.10 55)',   border: 'oklch(0.75 0.17 55)',   text: 'oklch(0.30 0.10 55)'  },
  grey:        { name: 'Grey',        bg: 'oklch(0.93 0 0)',       border: 'oklch(0.80 0 0)',       text: 'oklch(0.30 0 0)'      },
  brown:       { name: 'Brown',       bg: 'oklch(0.85 0.04 50)',   border: 'oklch(0.35 0.05 30)',   text: 'oklch(0.30 0.05 30)'  },
  deep_orange: { name: 'Deep Orange', bg: 'oklch(0.82 0.12 35)',   border: 'oklch(0.58 0.20 30)',   text: 'oklch(0.30 0.10 30)'  },
  dark_grey:   { name: 'Dark Grey',   bg: 'oklch(0.88 0.01 220)',  border: 'oklch(0.45 0.02 220)',  text: 'oklch(0.30 0.02 220)' },
  pink:        { name: 'Pink',        bg: 'oklch(0.80 0.12 350)',  border: 'oklch(0.60 0.22 350)',  text: 'oklch(0.98 0.01 350)' },
  teal:        { name: 'Teal',        bg: 'oklch(0.82 0.08 180)',  border: 'oklch(0.42 0.08 180)',  text: 'oklch(0.30 0.06 180)' },
  cyan:        { name: 'Cyan',        bg: 'oklch(0.90 0.06 210)',  border: 'oklch(0.72 0.10 210)',  text: 'oklch(0.30 0.06 210)' },
  lime:        { name: 'Lime',        bg: 'oklch(0.92 0.10 120)',  border: 'oklch(0.70 0.14 120)',  text: 'oklch(0.30 0.08 120)' },
  light_green: { name: 'Light Green', bg: 'oklch(0.90 0.08 140)',  border: 'oklch(0.60 0.12 140)',  text: 'oklch(0.30 0.08 140)' },
  amber:       { name: 'Amber',       bg: 'oklch(0.90 0.12 80)',   border: 'oklch(0.72 0.17 70)',   text: 'oklch(0.30 0.10 70)'  },
};

// ---------------------------------------------------------------------------
// Computed helpers
// ---------------------------------------------------------------------------

export const filteredBoardData = computed(() => {
  const data = boardData.value;
  const cat = filterCategory.value;
  const assignee = filterAssignee.value;
  const color = filterColor.value;
  const search = filterSearch.value.toLowerCase();

  if (!cat && !assignee && !color && !search) return data;

  return data.map(swimlane => ({
    ...swimlane,
    columns: (swimlane.columns || []).map(col => ({
      ...col,
      tasks: col.tasks.filter(task => {
        if (cat && task.category_id !== cat) return false;
        if (assignee && task.owner_id !== assignee) return false;
        if (color && task.color_id !== color) return false;
        if (search && !task.title.toLowerCase().includes(search)) return false;
        return true;
      }),
      nb_tasks: col.tasks.filter(task => {
        if (cat && task.category_id !== cat) return false;
        if (assignee && task.owner_id !== assignee) return false;
        if (color && task.color_id !== color) return false;
        if (search && !task.title.toLowerCase().includes(search)) return false;
        return true;
      }).length,
    })),
  }));
});

export const projectTaskCount = computed(() => {
  let total = 0;
  for (const s of boardData.value) {
    for (const c of (s.columns || [])) {
      total += c.tasks.length;
    }
  }
  return total;
});
