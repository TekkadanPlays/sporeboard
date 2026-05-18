// ---------------------------------------------------------------------------
// BoardView — Kanban board with columns, swimlanes, drag-and-drop
// ---------------------------------------------------------------------------

import { Component } from 'inferno';
import { createElement } from 'inferno-create-element';
import {
  currentProject, filteredBoardData, boardColumns, boardCategories,
  boardUsers, filterSearch, filterCategory, filterColor, filterAssignee,
  KANBOARD_COLORS, navigate, routeParams,
  currentTask, currentSubtasks, currentComments, taskPanelOpen,
  dragOverInfo, isDragging,
  type KBTask, type KBBoardColumn, type KBSwimlane,
  batch,
} from '../../signals';
import { S } from '../bridge';
import {
  fetchBoard, moveTask, createTask, fetchTask, closeTask, openTask,
} from '../api';
import {
  Button, Badge, Card, CardContent, Input,
} from 'blazecn';
import { toast } from 'blazecn';
import {
  IconPlus, IconFilter, IconSearch, IconX, IconComment,
  IconSubtask, IconCalendar, IconStar, IconUser, IconCheck,
  IconSpinner, IconChevronDown,
} from '../icons';
import { TaskDetailView } from './TaskDetailView';

// ---------------------------------------------------------------------------
// BoardView
// ---------------------------------------------------------------------------

export class BoardView extends Component<{}, { creatingInColumn: number | null; newTitle: string }> {
  state = { creatingInColumn: null as number | null, newTitle: '' };

  componentDidMount() {
    const params = routeParams.value;
    if (params.projectId && !currentProject.value) {
      fetchBoard(parseInt(params.projectId, 10));
    }
  }

  private handleDragOver(e: DragEvent, columnId: number, swimlaneId: number, tasks: KBTask[]) {
    e.preventDefault();
    e.dataTransfer!.dropEffect = 'move';
    
    const container = e.currentTarget as HTMLElement;
    const cards = Array.from(container.children).filter((c: Element) => 
        c.hasAttribute('data-task-id') && !c.classList.contains('currently-dragging-card')
    );
    
    let insertIndex = cards.length;
    
    for (let i = 0; i < cards.length; i++) {
        const rect = cards[i].getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        if (e.clientY < midY) {
            insertIndex = i;
            break;
        }
    }
    
    const currentInfo = dragOverInfo.value;
    if (!currentInfo || currentInfo.columnId !== columnId || currentInfo.swimlaneId !== swimlaneId || currentInfo.insertIndex !== insertIndex) {
        dragOverInfo.value = { columnId, swimlaneId, insertIndex };
    }
  }

  private handleDragLeave(e: DragEvent) {
      // Small optimization to avoid flickering
      const related = e.relatedTarget as HTMLElement;
      if (!related || !related.closest('.drop-zone')) {
          dragOverInfo.value = null;
      }
  }

  private async handleDrop(e: DragEvent, columnId: number, swimlaneId: number) {
    e.preventDefault();
    const info = dragOverInfo.value;
    dragOverInfo.value = null;
    isDragging.value = false;
    
    const data = e.dataTransfer?.getData('text/plain');
    if (!data) return;
    
    try {
      const { taskId, projectId, sourceColumnId } = JSON.parse(data);
      const position = info ? info.insertIndex + 1 : 1;
      
      // Optimitistic update
      // Import missing optimisticMoveTask here inline:
      const { optimisticMoveTask } = require('../../signals');
      
      // Update visually immediately
      optimisticMoveTask(taskId, sourceColumnId, columnId, swimlaneId, info ? info.insertIndex : -1);

      const success = await moveTask(projectId, taskId, columnId, position, swimlaneId);
      if (success) {
        toast.success('Task moved');
        // Fetch quietly without globalLoading interference
        fetchBoard(projectId, true);
      } else {
        toast.error('Failed to move task');
        fetchBoard(projectId, true); // rollback
      }
    } catch(err) {
      console.error(err);
    }
  }

  private async handleQuickCreate(columnId: number, swimlaneId: number) {
    const title = this.state.newTitle.trim();
    if (!title) return;
    const p = currentProject.value;
    if (!p) return;
    const id = await createTask({
      title,
      project_id: p.id,
      column_id: columnId,
      swimlane_id: swimlaneId,
    });
    if (id) {
      toast.success('Task created');
      this.setState({ creatingInColumn: null, newTitle: '' });
      await fetchBoard(p.id);
    } else {
      toast.error('Failed to create task');
    }
  }

  render() {
    return createElement('div', { className: 'flex flex-col h-full bg-background' },
      // Filter bar
      createElement('div', {
        className: 'flex items-center gap-3 px-4 py-3 border-b bg-muted/20 shrink-0 shadow-sm z-10',
      },
        // Search
        createElement('div', { className: 'relative flex-1 max-w-sm' },
          createElement('div', { className: 'absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none' },
            IconSearch('size-4'),
          ),
          S(() =>
            createElement(Input, {
              placeholder: 'Filter tasks...',
              value: filterSearch.value,
              onInput: (e: any) => { filterSearch.value = e.target.value; },
              className: 'h-9 text-sm pl-9 bg-background shadow-inner transition-all focus:ring-2 focus:ring-primary/20 rounded-full',
            }),
          ),
        ),
        // Category filter
        S(() => {
          const cats = boardCategories.value;
          if (!cats.length) return null;
          return createElement('select', {
            className: 'h-9 rounded-full border bg-background px-3 text-sm cursor-pointer hover:bg-muted/50 transition-colors focus:ring-2 focus:ring-primary/20',
            value: filterCategory.value || '',
            onChange: (e: any) => {
              filterCategory.value = e.target.value ? parseInt(e.target.value) : null;
            },
          },
            createElement('option', { value: '' }, 'Categorized by: All'),
            ...cats.map(c => createElement('option', { value: c.id }, c.name)),
          );
        }),
        // Color filter
        createElement('select', {
          className: 'h-9 rounded-full border bg-background px-3 text-sm cursor-pointer hover:bg-muted/50 transition-colors focus:ring-2 focus:ring-primary/20',
          onChange: (e: any) => { filterColor.value = e.target.value || null; },
        },
          createElement('option', { value: '' }, 'Color: All'),
          ...Object.entries(KANBOARD_COLORS).map(([id, c]) =>
            createElement('option', { value: id }, c.name),
          ),
        ),
        // Clear filters
        S(() => {
          const hasFilter = filterSearch.value || filterCategory.value || filterColor.value || filterAssignee.value;
          if (!hasFilter) return null;
          return createElement(Button, {
            variant: 'ghost', size: 'sm', className: 'h-9 text-sm rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors',
            onClick: () => {
              batch(() => {
                filterSearch.value = '';
                filterCategory.value = null;
                filterColor.value = null;
                filterAssignee.value = null;
              });
            },
          }, IconX('size-4 mr-1.5'), 'Clear');
        }),
      ),

      // Board area
      S(() => {
        const data = filteredBoardData.value;
        if (!data.length) {
          return createElement('div', { className: 'flex items-center justify-center h-full text-muted-foreground' },
            'No board data. Select a project.',
          );
        }

        return createElement('div', { 
            className: 'flex-1 overflow-auto bg-gradient-to-br from-background to-muted/20 pb-8',
            onDragEnd: () => { dragOverInfo.value = null; isDragging.value = false; }
        },
          ...data.map((swimlane: KBSwimlane) =>
            createElement('div', { className: 'min-w-0' },
              // Swimlane header
              data.length > 1
                ? createElement('div', {
                    className: 'sticky top-0 z-10 px-5 py-3 bg-background/80 backdrop-blur-md border-b text-sm font-semibold text-foreground flex items-center gap-2 shadow-sm',
                  },
                    IconChevronDown('size-4 text-muted-foreground'),
                    swimlane.name || 'Default Swimlane',
                    swimlane.nb_tasks !== undefined
                      ? createElement(Badge, { variant: 'secondary', className: 'text-xs h-5 px-2 bg-muted' }, String(swimlane.nb_tasks))
                      : null,
                  )
                : null,

              // Columns
              createElement('div', {
                className: 'flex items-start gap-4 p-5 min-h-[400px] overflow-x-auto pb-4',
              },
                ...(swimlane.columns || []).map((col: KBBoardColumn) => {
                  const limit = col.task_limit > 0 ? col.task_limit : 0;
                  const overLimit = limit > 0 && col.tasks.length > limit;

                  return createElement('div', {
                    className: `flex flex-col min-w-[300px] w-[300px] max-w-[340px] shrink-0 rounded-xl border bg-card/60 backdrop-blur-sm shadow-sm transition-shadow hover:shadow-md h-max`,
                  },
                    // Column header
                    createElement('div', {
                      className: `flex items-center justify-between px-4 py-3 rounded-t-xl border-b ${
                        overLimit ? 'bg-destructive/5 border-destructive/20' : 'bg-muted/30 border-border/50'
                      }`,
                    },
                      createElement('div', { className: 'flex items-center gap-2.5' },
                        // Dot indicator
                        createElement('div', { className: `size-2.5 rounded-full ${overLimit ? 'bg-destructive animate-pulse' : 'bg-primary/70'}` }),
                        createElement('span', { className: 'text-sm font-semibold tracking-tight' }, col.title),
                        createElement(Badge, {
                          variant: overLimit ? 'destructive' : 'secondary',
                          className: 'text-[10px] h-5 px-2 ml-1 rounded-full',
                        }, String(col.tasks.length) + (limit ? ` / ${limit}` : '')),
                      ),
                      createElement(Button, {
                        variant: 'ghost', size: 'icon',
                        className: 'size-7 text-muted-foreground hover:bg-background hover:text-foreground hover:shadow-sm transition-all rounded-md',
                        onClick: () => this.setState({ creatingInColumn: col.id, newTitle: '' }),
                      }, IconPlus('size-4')),
                    ),

                    // Column body (drop zone)
                    createElement('div', {
                      className: `drop-zone flex-1 flex flex-col gap-2 p-3 min-h-[120px] rounded-b-xl transition-colors ${
                          dragOverInfo.value?.columnId === col.id && dragOverInfo.value?.swimlaneId === swimlane.id ? 'bg-primary/5' : ''
                      }`,
                      onDragOver: (e: DragEvent) => this.handleDragOver(e, col.id, swimlane.id, col.tasks),
                      onDragLeave: (e: DragEvent) => this.handleDragLeave(e),
                      onDrop: (e: DragEvent) => this.handleDrop(e, col.id, swimlane.id),
                    },
                      // Task cards & drop dividers
                      ...(() => {
                          const elements: any[] = [];
                          const visibleCards = col.tasks;
                          
                          // Track the logical insertion index out of the visible components
                          let visualIndex = 0;
                          
                          for (let i = 0; i < visibleCards.length; i++) {
                              const t = visibleCards[i];
                              // Check if this task is the one being currently dragged.
                              // If we have to show drop dividers, we use visualIndex.
                              if (dragOverInfo.value?.columnId === col.id && dragOverInfo.value?.swimlaneId === swimlane.id && dragOverInfo.value?.insertIndex === visualIndex) {
                                  elements.push(createElement('div', { className: 'drop-placeholder border-primary/40 bg-primary/10', key: `divider-${visualIndex}` }));
                              }
                              
                              if (isDragging.value && document.querySelector(`.currently-dragging-card[data-task-id="${t.id}"]`)) {
                                  // Skip rendering a visible TaskCard completely to avoid height bugs? No, just render but we know it's hidden.
                                  // We do not increment visualIndex because it doesn't take up layout space in handleDragOver calculations!
                                  elements.push(TaskCard(t));
                              } else {
                                  elements.push(TaskCard(t));
                                  visualIndex++;
                              }
                          }
                          
                          // Bottom divider (if appending at the end)
                          if (dragOverInfo.value?.columnId === col.id && dragOverInfo.value?.swimlaneId === swimlane.id && dragOverInfo.value?.insertIndex === visualIndex) {
                              elements.push(createElement('div', { className: 'drop-placeholder border-primary/40 bg-primary/10', key: 'divider-end' }));
                          }
                          return elements;
                      })(),

                      // Inline create
                      this.state.creatingInColumn === col.id
                        ? createElement('div', { className: 'mt-2 space-y-2 p-3 border rounded-lg bg-background shadow-sm animate-in fade-in slide-in-from-top-2 duration-200' },
                            createElement(Input, {
                              placeholder: 'What needs to be done?',
                              value: this.state.newTitle,
                              onInput: (e: any) => this.setState({ newTitle: e.target.value }),
                              onKeyDown: (e: any) => {
                                if (e.key === 'Enter') this.handleQuickCreate(col.id, swimlane.id);
                                if (e.key === 'Escape') this.setState({ creatingInColumn: null });
                              },
                              className: 'h-9 text-sm w-full',
                              autoFocus: true,
                            } as any),
                            createElement('div', { className: 'flex gap-2' },
                              createElement(Button, {
                                size: 'sm', className: 'h-8 px-4 text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 flex-1',
                                onClick: () => this.handleQuickCreate(col.id, swimlane.id),
                              }, 'Add Task'),
                              createElement(Button, {
                                variant: 'ghost', size: 'sm', className: 'h-8 px-3 text-xs text-muted-foreground hover:text-foreground',
                                onClick: () => this.setState({ creatingInColumn: null }),
                              }, 'Cancel'),
                            ),
                          )
                        : null,
                        
                      // Empty state hint
                      col.tasks.length === 0 && this.state.creatingInColumn !== col.id && (!dragOverInfo.value || dragOverInfo.value.columnId !== col.id)
                        ? createElement('div', { className: 'flex-1 flex items-center justify-center border-2 border-dashed border-border/60 rounded-lg m-1 text-xs text-muted-foreground/60 select-none' }, 'Drop tasks here')
                        : null
                    ),
                  );
                }),
              ),
            ),
          ),
        );
      }),

      // Task detail panel
      S(() => {
        if (!taskPanelOpen.value || !currentTask.value) return null;
        return createElement(TaskDetailView, null);
      }),
    );
  }
}

// ---------------------------------------------------------------------------
// TaskCard — draggable card for a single task
// ---------------------------------------------------------------------------

function TaskCard(task: KBTask) {
  const color = KANBOARD_COLORS[task.color_id] || KANBOARD_COLORS['yellow'];
  const hasDate = !!task.date_due;
  const isOverdue = hasDate && new Date(task.date_due) < new Date() && task.is_active;

  return createElement('div', {
    'data-task-id': task.id,
    className: `group relative rounded-xl border bg-card shadow-sm hover:shadow-md transition-all duration-200 cursor-grab active:cursor-grabbing overflow-hidden`,
    style: { 
        borderLeftWidth: '4px', 
        borderLeftColor: color.border 
    },
    draggable: true,
    onDragStart: (e: DragEvent) => {
      e.dataTransfer!.setData('text/plain', JSON.stringify({
        taskId: task.id,
        projectId: task.project_id,
        sourceColumnId: task.column_id,
      }));
      e.dataTransfer!.effectAllowed = 'move';
      
      const el = e.currentTarget as HTMLElement;
      // Use setTimeout so the drag image is created before we make the card look like a ghost/hide it
      setTimeout(() => {
          isDragging.value = true;
          el.classList.add('currently-dragging-card');
      }, 0);
    },
    onDragEnd: (e: DragEvent) => {
        isDragging.value = false;
        dragOverInfo.value = null;
        const el = e.currentTarget as HTMLElement;
        el.classList.remove('currently-dragging-card');
    },
    onClick: () => {
      batch(() => {
        taskPanelOpen.value = true;
      });
      fetchTask(task.id);
    },
  },
    // Top subtle color strip matching the border, adding style
    createElement('div', { className: 'absolute inset-x-0 top-0 h-1 opacity-20', style: { backgroundColor: color.bg } }),
    
    createElement('div', { className: 'p-3.5 space-y-3' },
      // Title
      createElement('p', { className: 'text-sm font-medium leading-relaxed text-foreground group-hover:text-primary transition-colors' }, task.title),

      // Meta tags row
      createElement('div', { className: 'flex items-center gap-1.5 flex-wrap' },
        // Category
        task.category_name
          ? createElement(Badge, { variant: 'secondary', className: 'text-[10px] h-5 px-2 bg-muted/50 text-muted-foreground hover:bg-muted font-medium border-0' }, task.category_name)
          : null,
        // Priority
        task.priority > 0
          ? createElement(Badge, {
              variant: task.priority >= 2 ? 'destructive' : 'outline',
              className: `text-[10px] h-5 px-2 font-semibold border-0 ${task.priority >= 2 ? 'bg-destructive/10 text-destructive' : 'bg-orange-500/10 text-orange-600 dark:text-orange-400'}`,
            }, `P${task.priority}`)
          : null,
        // Tags
        ...(task.tags || []).slice(0, 3).map((tag: string) =>
          createElement(Badge, { variant: 'outline', className: 'text-[10px] h-5 px-2 border-border/60 text-muted-foreground' }, tag),
        ),
      ),

      // Bottom info row
      createElement('div', { className: 'flex items-center justify-between text-xs text-muted-foreground pt-1 border-t border-border/30 mt-1.5' },
        createElement('div', { className: 'flex items-center gap-3' },
          // Due date
          hasDate
            ? createElement('span', {
                className: `flex items-center gap-1 font-medium ${isOverdue ? 'text-destructive' : 'text-muted-foreground'}`,
              },
                IconCalendar('size-3.5'),
                new Date(task.date_due).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
              )
            : null,
          // Subtasks
          task.nb_subtasks
            ? createElement('span', { className: 'flex items-center gap-1 opacity-80 hover:opacity-100 transition-opacity' },
                IconSubtask('size-3.5'),
                `${task.nb_completed_subtasks || 0}/${task.nb_subtasks}`,
              )
            : null,
          // Comments
          task.nb_comments
            ? createElement('span', { className: 'flex items-center gap-1 opacity-80 hover:opacity-100 transition-opacity' },
                IconComment('size-3.5'),
                String(task.nb_comments),
              )
            : null,
        ),
        // Assignee
        task.assignee_name || task.assignee_username
          ? createElement('span', { className: 'flex items-center gap-1.5 truncate max-w-[90px] font-medium bg-muted/30 px-2 py-0.5 rounded-full text-[10px]' },
              IconUser('size-3 opacity-70'),
              task.assignee_name || task.assignee_username,
            )
          : null,
      ),
    ),
  );
}
