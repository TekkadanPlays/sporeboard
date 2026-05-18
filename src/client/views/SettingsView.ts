// ---------------------------------------------------------------------------
// SettingsView — project settings placeholder
// ---------------------------------------------------------------------------

import { Component } from 'inferno';
import { createElement } from 'inferno-create-element';
import { currentProject, boardColumns, boardCategories, boardSwimlanes } from '../../signals';
import { S } from '../bridge';
import {
  Card, CardHeader, CardTitle, CardDescription, CardContent,
  Badge, Separator,
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from 'blazecn';
import { IconSettings, IconBoard, IconTag, IconList } from '../icons';

export class SettingsView extends Component<{}, {}> {
  render() {
    return createElement('div', { className: 'p-6 max-w-4xl mx-auto space-y-6' },
      createElement('div', { className: 'flex items-center gap-3 mb-6' },
        IconSettings('size-6 text-muted-foreground'),
        createElement('h1', { className: 'text-2xl font-bold tracking-tight' }, 'Settings'),
      ),

      // Project info
      S(() => {
        const p = currentProject.value;
        if (!p) {
          return createElement('div', { className: 'text-center py-12 text-muted-foreground' },
            'Select a project to view its settings.',
          );
        }

        return createElement('div', { className: 'space-y-6' },
          // Project details
          createElement(Card, null,
            createElement(CardHeader, null,
              createElement(CardTitle, null, p.name),
              createElement(CardDescription, null, p.description || 'No description'),
            ),
            createElement(CardContent, null,
              createElement('div', { className: 'grid grid-cols-2 gap-4 text-sm' },
                createElement('div', null,
                  createElement('span', { className: 'text-muted-foreground' }, 'Identifier: '),
                  createElement('span', { className: 'font-medium' }, p.identifier || '—'),
                ),
                createElement('div', null,
                  createElement('span', { className: 'text-muted-foreground' }, 'Status: '),
                  p.is_active
                    ? createElement(Badge, { variant: 'secondary', className: 'text-[10px]' }, 'Active')
                    : createElement(Badge, { variant: 'outline', className: 'text-[10px]' }, 'Inactive'),
                ),
                createElement('div', null,
                  createElement('span', { className: 'text-muted-foreground' }, 'Private: '),
                  createElement('span', { className: 'font-medium' }, p.is_private ? 'Yes' : 'No'),
                ),
                createElement('div', null,
                  createElement('span', { className: 'text-muted-foreground' }, 'Last modified: '),
                  createElement('span', { className: 'font-medium' },
                    p.last_modified ? new Date(p.last_modified * 1000).toLocaleString() : '—',
                  ),
                ),
              ),
            ),
          ),

          // Columns
          createElement(Card, null,
            createElement(CardHeader, null,
              createElement('div', { className: 'flex items-center gap-2' },
                IconBoard('size-4 text-muted-foreground'),
                createElement(CardTitle, { className: 'text-base' }, 'Columns'),
              ),
            ),
            createElement(CardContent, null,
              createElement(Table, null,
                createElement(TableHeader, null,
                  createElement(TableRow, null,
                    createElement(TableHead, null, 'Position'),
                    createElement(TableHead, null, 'Name'),
                    createElement(TableHead, null, 'WIP Limit'),
                  ),
                ),
                createElement(TableBody, null,
                  ...boardColumns.value.map(col =>
                    createElement(TableRow, null,
                      createElement(TableCell, { className: 'tabular-nums text-muted-foreground' }, String(col.position)),
                      createElement(TableCell, { className: 'font-medium' }, col.title),
                      createElement(TableCell, null,
                        col.task_limit > 0
                          ? createElement(Badge, { variant: 'secondary', className: 'text-[10px]' }, String(col.task_limit))
                          : createElement('span', { className: 'text-muted-foreground text-xs' }, 'None'),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),

          // Categories
          createElement(Card, null,
            createElement(CardHeader, null,
              createElement('div', { className: 'flex items-center gap-2' },
                IconTag('size-4 text-muted-foreground'),
                createElement(CardTitle, { className: 'text-base' }, 'Categories'),
              ),
            ),
            createElement(CardContent, null,
              boardCategories.value.length
                ? createElement('div', { className: 'flex flex-wrap gap-2' },
                    ...boardCategories.value.map(cat =>
                      createElement(Badge, { variant: 'secondary' }, cat.name),
                    ),
                  )
                : createElement('p', { className: 'text-sm text-muted-foreground' }, 'No categories'),
            ),
          ),

          // Swimlanes
          createElement(Card, null,
            createElement(CardHeader, null,
              createElement('div', { className: 'flex items-center gap-2' },
                IconList('size-4 text-muted-foreground'),
                createElement(CardTitle, { className: 'text-base' }, 'Swimlanes'),
              ),
            ),
            createElement(CardContent, null,
              boardSwimlanes.value.length
                ? createElement('div', { className: 'space-y-2' },
                    ...boardSwimlanes.value.map(sl =>
                      createElement('div', { className: 'flex items-center justify-between py-1.5' },
                        createElement('span', { className: 'text-sm font-medium' }, sl.name),
                        createElement(Badge, { variant: sl.is_active ? 'secondary' : 'outline', className: 'text-[10px]' },
                          sl.is_active ? 'Active' : 'Inactive',
                        ),
                      ),
                    ),
                  )
                : createElement('p', { className: 'text-sm text-muted-foreground' }, 'No swimlanes'),
            ),
          ),
        );
      }),
    );
  }
}
