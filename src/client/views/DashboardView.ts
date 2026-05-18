// ---------------------------------------------------------------------------
// DashboardView — project grid + overdue tasks + quick actions
// ---------------------------------------------------------------------------

import { Component } from 'inferno';
import { createElement } from 'inferno-create-element';
import {
  projects, overdueTasks, currentUser, navigate, globalLoading,
} from '../../signals';
import { S } from '../bridge';
import { fetchBoard, fetchDashboard, createProject } from '../api';
import {
  Button, Badge, Card, CardHeader, CardTitle, CardDescription, CardContent,
  Input,
} from 'blazecn';
import { toast } from 'blazecn';
import {
  IconPlus, IconBoard, IconCalendar, IconWarning, IconFolder,
  IconActivity, IconSpinner, IconClock,
} from '../icons';

export class DashboardView extends Component<{}, { showCreate: boolean; newName: string }> {
  state = { showCreate: false, newName: '' };

  private async handleCreate() {
    const name = this.state.newName.trim();
    if (!name) return;
    const id = await createProject(name);
    if (id) {
      toast.success(`Project "${name}" created`);
      this.setState({ showCreate: false, newName: '' });
      await fetchDashboard();
    } else {
      toast.error('Failed to create project');
    }
  }

  render() {
    return createElement('div', { className: 'p-6 max-w-7xl mx-auto space-y-8' },

      // Header
      createElement('div', { className: 'flex items-center justify-between' },
        createElement('div', null,
          S(() => createElement('h1', { className: 'text-2xl font-bold tracking-tight' },
            `Welcome back, ${currentUser.value?.name || currentUser.value?.username || 'User'}`,
          )),
          createElement('p', { className: 'text-muted-foreground text-sm mt-1' },
            'Manage your projects and tasks',
          ),
        ),
        createElement('div', { className: 'flex items-center gap-2' },
          this.state.showCreate
            ? createElement('div', { className: 'flex items-center gap-2' },
                createElement(Input, {
                  placeholder: 'Project name...',
                  value: this.state.newName,
                  onInput: (e: any) => this.setState({ newName: e.target.value }),
                  onKeyDown: (e: any) => { if (e.key === 'Enter') this.handleCreate(); if (e.key === 'Escape') this.setState({ showCreate: false }); },
                  className: 'h-9 w-48',
                  autoFocus: true,
                } as any),
                createElement(Button, {
                  size: 'sm',
                  onClick: () => this.handleCreate(),
                }, 'Create'),
                createElement(Button, {
                  variant: 'ghost', size: 'sm',
                  onClick: () => this.setState({ showCreate: false }),
                }, 'Cancel'),
              )
            : createElement(Button, {
                onClick: () => this.setState({ showCreate: true }),
              }, IconPlus('size-4 mr-1.5'), 'New Project'),
        ),
      ),

      // Overdue section
      S(() => {
        const overdue = overdueTasks.value;
        if (!overdue.length) return null;
        return createElement(Card, { className: 'border-destructive/30 bg-destructive/5' },
          createElement(CardHeader, { className: 'pb-2' },
            createElement('div', { className: 'flex items-center gap-2' },
              IconWarning('size-5 text-destructive'),
              createElement(CardTitle, { className: 'text-base' }, `${overdue.length} Overdue Task${overdue.length > 1 ? 's' : ''}`),
            ),
          ),
          createElement(CardContent, null,
            createElement('div', { className: 'space-y-1.5' },
              ...overdue.slice(0, 6).map(t =>
                createElement('div', {
                  className: 'flex items-center justify-between py-1.5 px-2 rounded hover:bg-destructive/10 cursor-pointer transition-colors',
                  onClick: () => {
                    navigate('board', { projectId: String(t.project_id) });
                    fetchBoard(t.project_id);
                  },
                },
                  createElement('span', { className: 'text-sm truncate' }, t.title),
                  createElement('div', { className: 'flex items-center gap-2 shrink-0' },
                    createElement(Badge, { variant: 'destructive', className: 'text-[10px]' },
                      IconCalendar('size-3 mr-1'),
                      t.date_due ? new Date(t.date_due).toLocaleDateString() : 'No date',
                    ),
                  ),
                ),
              ),
            ),
          ),
        );
      }),

      // Project grid
      S(() => {
        const pp = projects.value;
        if (!pp.length) {
          return createElement('div', { className: 'text-center py-20' },
            createElement('div', { className: 'size-16 mx-auto mb-4 rounded-2xl bg-muted flex items-center justify-center' },
              IconFolder('size-8 text-muted-foreground'),
            ),
            createElement('h3', { className: 'text-lg font-semibold mb-1' }, 'No projects yet'),
            createElement('p', { className: 'text-sm text-muted-foreground mb-4' }, 'Create your first project to get started'),
            createElement(Button, {
              onClick: () => this.setState({ showCreate: true }),
            }, IconPlus('size-4 mr-1.5'), 'New Project'),
          );
        }

        return createElement('div', null,
          createElement('h2', { className: 'text-lg font-semibold mb-4' }, 'Projects'),
          createElement('div', { className: 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3' },
            ...pp.map(p => ProjectCard(p)),
          ),
        );
      }),
    );
  }
}

// ---------------------------------------------------------------------------
// ProjectCard
// ---------------------------------------------------------------------------

function ProjectCard(project: any) {
  const initial = (project.identifier || project.name[0] || '?').slice(0, 2).toUpperCase();
  const colors = [
    'oklch(0.55 0.25 270)', 'oklch(0.60 0.20 150)', 'oklch(0.65 0.15 30)',
    'oklch(0.55 0.20 200)', 'oklch(0.60 0.18 320)',
  ];
  const color = colors[project.id % colors.length];

  return createElement(Card, {
    className: 'group hover:border-primary/30 hover:shadow-lg transition-all duration-200 cursor-pointer',
    onClick: () => {
      navigate('board', { projectId: String(project.id) });
      fetchBoard(project.id);
    },
  },
    createElement(CardContent, { className: 'pt-5' },
      createElement('div', { className: 'flex items-start gap-3' },
        createElement('div', {
          className: 'size-10 rounded-lg flex items-center justify-center text-sm font-bold text-white shrink-0 group-hover:scale-105 transition-transform',
          style: { background: color },
        }, initial),
        createElement('div', { className: 'min-w-0 flex-1' },
          createElement('h3', { className: 'font-semibold text-sm leading-tight truncate' }, project.name),
          project.description
            ? createElement('p', { className: 'text-xs text-muted-foreground mt-1 line-clamp-2' }, project.description)
            : null,
        ),
      ),
      // Stats row
      createElement('div', { className: 'flex items-center gap-3 mt-4 pt-3 border-t text-xs text-muted-foreground' },
        project.nb_active_tasks !== undefined
          ? createElement('span', { className: 'flex items-center gap-1' },
              IconBoard('size-3'),
              `${project.nb_active_tasks} tasks`,
            )
          : null,
        project.is_active
          ? createElement(Badge, { variant: 'secondary', className: 'text-[10px] h-5' }, 'Active')
          : createElement(Badge, { variant: 'outline', className: 'text-[10px] h-5 text-muted-foreground' }, 'Inactive'),
        project.is_private
          ? createElement(Badge, { variant: 'outline', className: 'text-[10px] h-5' }, 'Private')
          : null,
      ),
    ),
  );
}
