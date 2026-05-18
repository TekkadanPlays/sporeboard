// ---------------------------------------------------------------------------
// ListView — sortable table view of tasks
// ---------------------------------------------------------------------------

import { Component } from 'inferno';
import { createElement } from 'inferno-create-element';
import {
  currentProject, boardData, tasksList, routeParams,
  KANBOARD_COLORS, taskPanelOpen, navigate,
  type KBTask, batch,
} from '../../signals';
import { S } from '../bridge';
import { fetchAllTasks, fetchBoard, fetchTask } from '../api';
import {
  Button, Badge,
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from 'blazecn';
import {
  IconCalendar, IconUser, IconSubtask, IconComment,
  IconChevronDown, IconCheck, IconX,
} from '../icons';

export class ListView extends Component<{}, { sortKey: string; sortDir: 'asc' | 'desc' }> {
  state = { sortKey: 'title', sortDir: 'asc' as 'asc' | 'desc' };

  componentDidMount() {
    const params = routeParams.value;
    if (params.projectId) {
      const pid = parseInt(params.projectId, 10);
      if (!currentProject.value || currentProject.value.id !== pid) {
        fetchBoard(pid);
      }
      fetchAllTasks(pid);
    }
  }

  private sortedTasks(): KBTask[] {
    // Flatten board data if tasksList is empty
    let tasks = tasksList.value;
    if (!tasks.length) {
      tasks = [];
      for (const s of boardData.value) {
        for (const c of (s.columns || [])) {
          tasks.push(...c.tasks);
        }
      }
    }
    const { sortKey, sortDir } = this.state;
    const sorted = [...tasks].sort((a: any, b: any) => {
      const va = a[sortKey] ?? '';
      const vb = b[sortKey] ?? '';
      if (typeof va === 'string') return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
      return sortDir === 'asc' ? va - vb : vb - va;
    });
    return sorted;
  }

  private toggleSort(key: string) {
    if (this.state.sortKey === key) {
      this.setState({ sortDir: this.state.sortDir === 'asc' ? 'desc' : 'asc' });
    } else {
      this.setState({ sortKey: key, sortDir: 'asc' });
    }
  }

  private SortHeader(key: string, label: string) {
    const active = this.state.sortKey === key;
    return createElement(TableHead, {
      className: 'cursor-pointer select-none hover:text-foreground transition-colors',
      onClick: () => this.toggleSort(key),
    },
      createElement('div', { className: 'flex items-center gap-1' },
        label,
        active ? IconChevronDown(`size-3 transition-transform ${this.state.sortDir === 'desc' ? 'rotate-180' : ''}`) : null,
      ),
    );
  }

  render() {
    return createElement('div', { className: 'p-4' },
      S(() => {
        const tasks = this.sortedTasks();
        if (!tasks.length) {
          return createElement('div', { className: 'text-center py-20 text-muted-foreground' },
            'No tasks found in this project.',
          );
        }

        return createElement(Table, null,
          createElement(TableHeader, null,
            createElement(TableRow, null,
              createElement(TableHead, { className: 'w-8' }, '#'),
              this.SortHeader('title', 'Title'),
              this.SortHeader('column_id', 'Column'),
              this.SortHeader('category_name', 'Category'),
              this.SortHeader('assignee_name', 'Assignee'),
              this.SortHeader('priority', 'Priority'),
              this.SortHeader('date_due', 'Due Date'),
              createElement(TableHead, { className: 'text-center' }, 'Status'),
            ),
          ),
          createElement(TableBody, null,
            ...tasks.map((task: KBTask) => {
              const color = KANBOARD_COLORS[task.color_id] || KANBOARD_COLORS['yellow'];
              const hasDate = !!task.date_due;
              const isOverdue = hasDate && new Date(task.date_due) < new Date() && task.is_active;

              return createElement(TableRow, {
                className: 'cursor-pointer hover:bg-muted/50 transition-colors',
                style: { borderLeftWidth: '3px', borderLeftColor: color.border },
                onClick: () => {
                  batch(() => { taskPanelOpen.value = true; });
                  fetchTask(task.id);
                },
              },
                createElement(TableCell, { className: 'text-muted-foreground text-xs tabular-nums' }, `#${task.id}`),
                createElement(TableCell, null,
                  createElement('span', { className: 'font-medium text-sm' }, task.title),
                  task.nb_subtasks
                    ? createElement('span', { className: 'ml-2 text-xs text-muted-foreground inline-flex items-center gap-0.5' },
                        IconSubtask('size-3'),
                        `${task.nb_completed_subtasks || 0}/${task.nb_subtasks}`,
                      )
                    : null,
                ),
                createElement(TableCell, null,
                  createElement(Badge, { variant: 'secondary', className: 'text-[10px]' },
                    // Column name would need to be resolved — use column_id for now
                    `Col ${task.column_id}`,
                  ),
                ),
                createElement(TableCell, null,
                  task.category_name
                    ? createElement(Badge, { variant: 'outline', className: 'text-[10px]' }, task.category_name)
                    : createElement('span', { className: 'text-muted-foreground text-xs' }, '—'),
                ),
                createElement(TableCell, null,
                  task.assignee_name || task.assignee_username
                    ? createElement('span', { className: 'flex items-center gap-1 text-xs' },
                        IconUser('size-3 text-muted-foreground'),
                        task.assignee_name || task.assignee_username,
                      )
                    : createElement('span', { className: 'text-muted-foreground text-xs' }, 'Unassigned'),
                ),
                createElement(TableCell, null,
                  task.priority > 0
                    ? createElement(Badge, {
                        variant: task.priority >= 2 ? 'destructive' : 'outline',
                        className: 'text-[10px]',
                      }, `P${task.priority}`)
                    : createElement('span', { className: 'text-muted-foreground text-xs' }, '—'),
                ),
                createElement(TableCell, null,
                  hasDate
                    ? createElement('span', {
                        className: `text-xs flex items-center gap-1 ${isOverdue ? 'text-destructive font-medium' : 'text-muted-foreground'}`,
                      },
                        IconCalendar('size-3'),
                        new Date(task.date_due).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
                      )
                    : createElement('span', { className: 'text-muted-foreground text-xs' }, '—'),
                ),
                createElement(TableCell, { className: 'text-center' },
                  task.is_active
                    ? createElement(Badge, { variant: 'secondary', className: 'text-[10px]' }, 'Open')
                    : createElement(Badge, { variant: 'outline', className: 'text-[10px] text-muted-foreground' }, 'Closed'),
                ),
              );
            }),
          ),
        );
      }),
    );
  }
}
