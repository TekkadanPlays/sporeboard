// ---------------------------------------------------------------------------
// TaskDetailView — slide-over panel for task editing
// ---------------------------------------------------------------------------

import { Component } from 'inferno';
import { createElement } from 'inferno-create-element';
import {
  currentTask, currentSubtasks, currentComments,
  taskPanelOpen, currentUser, KANBOARD_COLORS,
  type KBSubtask, type KBComment, batch,
} from '../../signals';
import { S } from '../bridge';
import {
  fetchTask, updateTask, closeTask, openTask,
  createSubtask, updateSubtask, createComment,
  fetchBoard,
} from '../api';
import {
  Button, Badge, Card, CardContent,
  Input, Label, Separator, Textarea,
  Avatar, AvatarFallback,
} from 'blazecn';
import { toast } from 'blazecn';
import {
  IconX, IconCheck, IconEdit, IconTrash, IconCalendar,
  IconUser, IconTag, IconComment, IconSubtask, IconSend,
  IconStar, IconSpinner,
} from '../icons';

export class TaskDetailView extends Component<{}, {
  editing: boolean;
  editTitle: string;
  editDesc: string;
  newSubtask: string;
  newComment: string;
}> {
  state = {
    editing: false,
    editTitle: '',
    editDesc: '',
    newSubtask: '',
    newComment: '',
  };

  private startEdit() {
    const task = currentTask.value;
    if (!task) return;
    this.setState({
      editing: true,
      editTitle: task.title,
      editDesc: task.description || '',
    });
  }

  private async saveEdit() {
    const task = currentTask.value;
    if (!task) return;
    const ok = await updateTask({
      id: task.id,
      title: this.state.editTitle,
      description: this.state.editDesc,
    });
    if (ok) {
      toast.success('Task updated');
      this.setState({ editing: false });
      await fetchTask(task.id);
      if (task.project_id) await fetchBoard(task.project_id);
    } else {
      toast.error('Failed to update');
    }
  }

  private async toggleTaskStatus() {
    const task = currentTask.value;
    if (!task) return;
    const ok = task.is_active ? await closeTask(task.id) : await openTask(task.id);
    if (ok) {
      toast.success(task.is_active ? 'Task closed' : 'Task reopened');
      await fetchTask(task.id);
      if (task.project_id) await fetchBoard(task.project_id);
    }
  }

  private async handleAddSubtask() {
    const title = this.state.newSubtask.trim();
    if (!title) return;
    const task = currentTask.value;
    if (!task) return;
    const id = await createSubtask(task.id, title);
    if (id) {
      this.setState({ newSubtask: '' });
      await fetchTask(task.id);
    }
  }

  private async handleToggleSubtask(subtask: KBSubtask) {
    const newStatus = subtask.status === 2 ? 0 : 2;
    await updateSubtask({
      id: subtask.id,
      task_id: subtask.task_id,
      status: newStatus,
    });
    await fetchTask(subtask.task_id);
  }

  private async handleAddComment() {
    const content = this.state.newComment.trim();
    if (!content) return;
    const task = currentTask.value;
    const user = currentUser.value;
    if (!task || !user) return;
    const id = await createComment(task.id, user.id, content);
    if (id) {
      this.setState({ newComment: '' });
      await fetchTask(task.id);
    }
  }

  render() {
    return S(() => {
      const task = currentTask.value;
      if (!task) return null;

      const color = KANBOARD_COLORS[task.color_id] || KANBOARD_COLORS['yellow'];
      const subtasks = currentSubtasks.value;
      const comments = currentComments.value;
      const completedSubs = subtasks.filter(s => s.status === 2).length;
      const subProgress = subtasks.length ? Math.round((completedSubs / subtasks.length) * 100) : 0;

      return createElement('div', {
        className: 'fixed inset-0 z-50 flex justify-end',
      },
        // Backdrop
        createElement('div', {
          className: 'absolute inset-0 bg-black/30 backdrop-blur-sm',
          onClick: () => { taskPanelOpen.value = false; },
        }),
        // Panel
        createElement('div', {
          className: 'relative bg-background border-l shadow-2xl w-full max-w-lg flex flex-col animate-in slide-in-from-right',
        },
          // Header
          createElement('div', {
            className: 'flex items-center justify-between px-4 py-3 border-b shrink-0',
            style: { borderTopColor: color.border, borderTopWidth: '3px' },
          },
            createElement('div', { className: 'flex items-center gap-2 min-w-0' },
              createElement(Badge, { variant: 'secondary', className: 'text-[10px] shrink-0' }, `#${task.id}`),
              task.is_active
                ? createElement(Badge, { variant: 'secondary', className: 'text-[10px]' }, 'Open')
                : createElement(Badge, { variant: 'outline', className: 'text-[10px]' }, 'Closed'),
            ),
            createElement('div', { className: 'flex items-center gap-1.5' },
              createElement(Button, {
                variant: 'ghost', size: 'sm', className: 'h-7 text-xs text-muted-foreground',
                onClick: () => this.startEdit(),
              }, IconEdit('size-3.5 mr-1'), 'Edit'),
              createElement(Button, {
                variant: task.is_active ? 'outline' : 'default', size: 'sm',
                className: `h-7 text-xs ${task.is_active ? 'hover:bg-green-500/10 hover:text-green-600' : ''}`,
                onClick: () => this.toggleTaskStatus(),
              }, task.is_active ? [IconCheck('size-3.5 mr-1'), 'Complete'] : 'Reopen'),
              createElement('div', { className: 'w-px h-4 bg-border mx-1' }),
              createElement(Button, {
                variant: 'ghost', size: 'icon', className: 'size-7 hover:bg-destructive/10 hover:text-destructive',
                onClick: () => { taskPanelOpen.value = false; },
              }, IconX('size-4')),
            ),
          ),

          // Body
          createElement('div', { className: 'flex-1 overflow-y-auto' },
            createElement('div', { className: 'p-4 space-y-6' },

              // Title + description
              this.state.editing
                ? createElement('div', { className: 'space-y-3' },
                    createElement(Input, {
                      value: this.state.editTitle,
                      onInput: (e: any) => this.setState({ editTitle: e.target.value }),
                      className: 'text-lg font-semibold',
                    }),
                    createElement(Textarea, {
                      value: this.state.editDesc,
                      onInput: (e: any) => this.setState({ editDesc: e.target.value }),
                      rows: 6,
                      placeholder: 'Description (Markdown supported)...',
                    } as any),
                    createElement('div', { className: 'flex gap-2' },
                      createElement(Button, {
                        size: 'sm',
                        onClick: () => this.saveEdit(),
                      }, 'Save'),
                      createElement(Button, {
                        variant: 'ghost', size: 'sm',
                        onClick: () => this.setState({ editing: false }),
                      }, 'Cancel'),
                    ),
                  )
                : createElement('div', null,
                    createElement('h2', { className: 'text-lg font-semibold leading-tight mb-2' }, task.title),
                    task.description
                      ? createElement('div', { className: 'text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed' }, task.description)
                      : createElement('p', { className: 'text-sm text-muted-foreground/50 italic' }, 'No description'),
                  ),

              // Metadata grid
              createElement('div', { className: 'grid grid-cols-2 gap-3' },
                MetaItem(IconUser, 'Assignee', task.assignee_name || task.assignee_username || 'Unassigned'),
                MetaItem(IconCalendar, 'Due Date', task.date_due ? new Date(task.date_due).toLocaleDateString() : 'No date'),
                MetaItem(IconStar, 'Priority', task.priority > 0 ? `P${task.priority}` : 'None'),
                MetaItem(IconTag, 'Category', task.category_name || 'None'),
                task.score ? MetaItem(IconStar, 'Score', String(task.score)) : null,
                task.time_estimated ? MetaItem(IconCalendar, 'Estimated', `${task.time_estimated}h`) : null,
              ),

              // Tags
              (task.tags && task.tags.length > 0)
                ? createElement('div', { className: 'flex items-center gap-1.5 flex-wrap' },
                    ...task.tags.map((tag: string) =>
                      createElement(Badge, { variant: 'outline', className: 'text-[10px]' }, tag),
                    ),
                  )
                : null,

              createElement(Separator, null),

              // Subtasks
              createElement('div', { className: 'space-y-3' },
                createElement('div', { className: 'flex items-center justify-between' },
                  createElement('h3', { className: 'text-sm font-semibold flex items-center gap-1.5' },
                    IconSubtask('size-4'),
                    `Subtasks (${completedSubs}/${subtasks.length})`,
                  ),
                ),
                // Progress bar
                subtasks.length > 0
                  ? createElement('div', { className: 'h-1.5 rounded-full bg-muted overflow-hidden' },
                      createElement('div', {
                        className: 'h-full rounded-full bg-primary transition-all duration-300',
                        style: { width: `${subProgress}%` },
                      }),
                    )
                  : null,
                // Subtask list
                createElement('div', { className: 'space-y-1' },
                  ...subtasks.map(sub =>
                    createElement('div', {
                      className: `flex items-center gap-2 py-1.5 px-2 rounded hover:bg-muted/50 cursor-pointer transition-colors ${sub.status === 2 ? 'opacity-60' : ''}`,
                      onClick: () => this.handleToggleSubtask(sub),
                    },
                      createElement('div', {
                        className: `size-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                          sub.status === 2
                            ? 'bg-primary border-primary'
                            : sub.status === 1
                              ? 'border-primary/50 bg-primary/10'
                              : 'border-muted-foreground/30'
                        }`,
                      }, sub.status === 2 ? IconCheck('size-3 text-primary-foreground') : null),
                      createElement('span', {
                        className: `text-sm flex-1 ${sub.status === 2 ? 'line-through' : ''}`,
                      }, sub.title),
                      sub.username
                        ? createElement('span', { className: 'text-[10px] text-muted-foreground' }, sub.username)
                        : null,
                    ),
                  ),
                ),
                // Add subtask
                createElement('div', { className: 'flex gap-1.5' },
                  createElement(Input, {
                    placeholder: 'Add subtask...',
                    value: this.state.newSubtask,
                    onInput: (e: any) => this.setState({ newSubtask: e.target.value }),
                    onKeyDown: (e: any) => { if (e.key === 'Enter') this.handleAddSubtask(); },
                    className: 'h-8 text-xs',
                  }),
                  createElement(Button, {
                    variant: 'secondary', size: 'sm', className: 'h-8',
                    onClick: () => this.handleAddSubtask(),
                  }, IconCheck('size-3')),
                ),
              ),

              createElement(Separator, null),

              // Comments
              createElement('div', { className: 'space-y-3' },
                createElement('h3', { className: 'text-sm font-semibold flex items-center gap-1.5' },
                  IconComment('size-4'),
                  `Comments (${comments.length})`,
                ),
                createElement('div', { className: 'space-y-3' },
                  ...comments.map(comment =>
                    createElement('div', { className: 'space-y-1' },
                      createElement('div', { className: 'flex items-center gap-2' },
                        createElement(Avatar, { className: 'size-6' },
                          createElement(AvatarFallback, { className: 'text-[8px] bg-secondary text-secondary-foreground' },
                            (comment.name || comment.username || '?').slice(0, 2).toUpperCase(),
                          ),
                        ),
                        createElement('span', { className: 'text-xs font-medium' }, comment.name || comment.username),
                        createElement('span', { className: 'text-[10px] text-muted-foreground' },
                          new Date(comment.date_creation * 1000).toLocaleString(),
                        ),
                      ),
                      createElement('p', { className: 'text-sm text-muted-foreground pl-8 whitespace-pre-wrap' }, comment.comment),
                    ),
                  ),
                ),
                // Add comment
                createElement('div', { className: 'flex gap-1.5' },
                  createElement(Input, {
                    placeholder: 'Write a comment...',
                    value: this.state.newComment,
                    onInput: (e: any) => this.setState({ newComment: e.target.value }),
                    onKeyDown: (e: any) => { if (e.key === 'Enter' && !e.shiftKey) this.handleAddComment(); },
                    className: 'h-8 text-xs',
                  }),
                  createElement(Button, {
                    size: 'sm', className: 'h-8',
                    onClick: () => this.handleAddComment(),
                  }, IconSend('size-3')),
                ),
              ),
            ),
          ),
        ),
      );
    });
  }
}

// ---------------------------------------------------------------------------
// MetaItem — label + value pair
// ---------------------------------------------------------------------------

function MetaItem(icon: (cls?: string) => any, label: string, value: string) {
  return createElement('div', { className: 'flex items-center gap-2 text-sm' },
    createElement('div', { className: 'text-muted-foreground shrink-0' }, icon('size-3.5')),
    createElement('div', null,
      createElement('div', { className: 'text-[10px] text-muted-foreground/70' }, label),
      createElement('div', { className: 'text-xs font-medium' }, value),
    ),
  );
}
