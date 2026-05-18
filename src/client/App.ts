// ---------------------------------------------------------------------------
// Kanboard × Spore — Main Application Shell
// Router + Layout + View switching
// ---------------------------------------------------------------------------

import { Component } from 'inferno';
import { createElement } from 'inferno-create-element';
import {
  route, routeParams, parseHash, restoreAuth, isAuthenticated,
  currentUser, currentProject, sidebarCollapsed, navigate,
  logout, projects, globalLoading, batch,
} from '../signals';
import { S } from './bridge';
import { validateSession, fetchDashboard, fetchBoard } from './api';
import {
  ThemeToggle, ThemeSelector, Toaster, toast, initTheme,
  Button, Badge, Avatar, AvatarFallback, AvatarImage,
} from 'blazecn';
import {
  IconHome, IconBoard, IconList, IconSettings,
  IconLogout, IconMenu, IconChevronLeft, IconSearch,
  IconPlus, IconSpinner, IconFolder,
} from './icons';

// Lazy view imports
import { LoginView } from './views/LoginView';
import { DashboardView } from './views/DashboardView';
import { BoardView } from './views/BoardView';
import { ListView } from './views/ListView';
import { TaskDetailView } from './views/TaskDetailView';
import { SettingsView } from './views/SettingsView';

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

export class App extends Component<{}, {}> {
  componentDidMount() {
    initTheme();
    parseHash();
    this._bootstrap();
    window.addEventListener('hashchange', () => parseHash());
  }

  private async _bootstrap() {
    const hasCreds = restoreAuth();
    if (hasCreds) {
      globalLoading.value = true;
      const valid = await validateSession();
      if (valid) {
        const r = route.value;
        if (r === 'login') navigate('dashboard');
        // If we're on board/list route, auto-fetch
        const params = routeParams.value;
        if (params.projectId && (r === 'board' || r === 'list')) {
          await fetchBoard(parseInt(params.projectId, 10));
        } else {
          await fetchDashboard();
        }
      } else {
        navigate('login');
      }
      globalLoading.value = false;
    } else {
      navigate('login');
    }
  }

  render() {
    return createElement('div', { className: 'min-h-screen bg-background text-foreground' },
      createElement(Toaster, { position: 'bottom-right' }),
      S(() => {
        if (!isAuthenticated.value) {
          return createElement(LoginView, null);
        }

        const r = route.value;
        if (r === 'login') return createElement(LoginView, null);

        // Authenticated layout
        return createElement('div', { className: 'flex h-screen overflow-hidden' },

          // --- SIDEBAR ---
          createElement('aside', {
            className: `${sidebarCollapsed.value ? 'w-16' : 'w-64'} flex-shrink-0 border-r border-border/50 bg-sidebar text-sidebar-foreground flex flex-col transition-all duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] shadow-[1px_0_10px_rgba(0,0,0,0.02)] z-40`,
          },
            // Sidebar header (Brand)
            createElement('div', {
              className: 'h-14 border-b border-sidebar-border/50 flex items-center justify-between px-3',
            },
              createElement('div', { className: 'flex items-center gap-2 overflow-hidden' },
                // Logo Icon
                createElement('div', { className: 'flex shrink-0 items-center justify-center size-8 rounded-lg bg-primary/10 text-primary' },
                  IconBoard('size-5'),
                ),
                !sidebarCollapsed.value && createElement('span', {
                  className: 'font-bold text-[15px] tracking-tight truncate text-sidebar-foreground',
                }, 'Kanboard'),
              ),
              createElement(Button, {
                variant: 'ghost', size: 'icon',
                className: 'size-8 text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent shrink-0',
                onClick: () => { sidebarCollapsed.value = !sidebarCollapsed.value; },
              }, sidebarCollapsed.value ? IconMenu('size-4') : IconChevronLeft('size-4')),
            ),

            // Nav items
            createElement('nav', { className: 'flex-1 py-3 px-2 space-y-1 overflow-y-auto no-scrollbar' },
              SidebarItem('dashboard', IconHome, 'Dashboard'),
              // Project list
              !sidebarCollapsed.value && createElement('div', { className: 'pt-4 pb-2 px-3 flex items-center justify-between' },
                createElement('span', { className: 'text-[11px] font-semibold text-sidebar-foreground/40 uppercase tracking-widest' }, 'Projects'),
              ),
              S(() => {
                const pp = projects.value;
                if (!pp.length) return null;
                return createElement('div', { className: 'space-y-0.5 mt-1' },
                  ...pp.slice(0, 12).map(p =>
                    createElement(Button, {
                      variant: 'ghost',
                      size: 'sm',
                      className: `w-full justify-start gap-2.5 h-9 text-sm font-medium transition-colors ${
                        currentProject.value?.id === p.id 
                            ? 'bg-sidebar-accent text-sidebar-foreground shadow-sm ring-1 ring-border/20' 
                            : 'text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50'
                      }`,
                      onClick: () => {
                        navigate('board', { projectId: String(p.id) });
                        fetchBoard(p.id);
                      },
                    },
                      // Project visual indicator
                      sidebarCollapsed.value
                        ? createElement('div', { 
                            className: 'flex shrink-0 items-center justify-center size-6 rounded-md opacity-90 text-[11px] font-bold text-white shadow-sm',
                            style: { backgroundColor: `hsl(${(p.id * 137.5) % 360}, 60%, 45%)` }
                          }, (p.identifier || p.name[0]).slice(0, 2).toUpperCase())
                        : createElement('div', { 
                            className: 'flex shrink-0 items-center justify-center size-3.5 rounded-[4px] opacity-90 shadow-sm',
                            style: { backgroundColor: `hsl(${(p.id * 137.5) % 360}, 60%, 45%)` }
                          }),
                      !sidebarCollapsed.value && createElement('span', { className: 'truncate' }, p.name),
                    ),
                  ),
                );
              }),
            ),

            // Sidebar footer
            createElement('div', { className: 'border-t border-sidebar-border/50 p-2 space-y-1 bg-sidebar/50 backdrop-blur-sm' },
              // User Profile Section
              S(() => {
                  const u = currentUser.value;
                  if (!u) return null;
                  return createElement('div', { 
                      className: 'flex items-center gap-3 px-2 py-2 mb-1 hover:bg-sidebar-accent/80 rounded-lg cursor-pointer group transition-all duration-200' 
                  },
                      createElement(Avatar, { className: 'size-8 shrink-0 ring-1 ring-border/50 shadow-sm' },
                          (u as any).avatar_path
                            ? createElement(AvatarImage, { src: (u as any).avatar_path, alt: u.name || '' })
                            : null,
                          createElement(AvatarFallback, { className: 'text-xs font-semibold bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors' },
                              (u.name || u.username || '?').slice(0, 2).toUpperCase(),
                          ),
                      ),
                      !sidebarCollapsed.value && createElement('div', { className: 'flex flex-col flex-1 min-w-0' },
                          createElement('span', { className: 'text-sm font-semibold truncate leading-tight text-sidebar-foreground' }, u.name || u.username),
                          createElement('span', { className: 'text-[11px] text-muted-foreground truncate leading-tight mt-0.5' }, u.role || 'Member')
                      )
                  );
              }),
              SidebarItem('settings', IconSettings, 'Settings'),
              createElement(Button, {
                variant: 'ghost',
                size: 'sm',
                className: `w-full justify-start gap-2 h-9 text-sm font-medium text-sidebar-foreground/50 hover:text-destructive hover:bg-destructive/10 transition-colors`,
                onClick: () => { logout(); toast('Signed out'); },
              },
                IconLogout(sidebarCollapsed.value ? 'size-[18px] mx-auto' : 'size-[18px]'),
                !sidebarCollapsed.value ? 'Sign out' : null,
              ),
            ),
          ),

          // --- MAIN ---
          createElement('div', { className: 'flex-1 flex flex-col overflow-hidden' },

            // TOP NAV
            createElement('header', {
              className: 'h-14 border-b bg-background/80 backdrop-blur-md flex items-center justify-between px-4 shrink-0 z-30',
            },
              // Left: breadcrumb
              S(() => {
                const p = currentProject.value;
                return createElement('div', { className: 'flex items-center gap-2 min-w-0' },
                  r === 'dashboard'
                    ? createElement('h1', { className: 'text-sm font-semibold' }, 'Dashboard')
                    : p
                      ? createElement('div', { className: 'flex items-center gap-1.5 min-w-0' },
                          createElement(Button, {
                            variant: 'ghost', size: 'sm',
                            className: 'h-7 px-2 text-xs text-muted-foreground',
                            onClick: () => { navigate('dashboard'); fetchDashboard(); },
                          }, 'Projects'),
                          createElement('span', { className: 'text-muted-foreground/50' }, '/'),
                          createElement('span', { className: 'text-sm font-semibold truncate max-w-[200px]' }, p.name),
                          // View toggle
                          createElement('div', { className: 'flex items-center ml-3 border rounded-md' },
                            createElement(Button, {
                              variant: r === 'board' ? 'secondary' : 'ghost',
                              size: 'sm',
                              className: 'h-7 px-2 text-xs rounded-r-none',
                              onClick: () => navigate('board', { projectId: String(p.id) }),
                            }, IconBoard('size-3.5 mr-1'), 'Board'),
                            createElement(Button, {
                              variant: r === 'list' ? 'secondary' : 'ghost',
                              size: 'sm',
                              className: 'h-7 px-2 text-xs rounded-l-none border-l',
                              onClick: () => { navigate('list', { projectId: String(p.id) }); },
                            }, IconList('size-3.5 mr-1'), 'List'),
                          ),
                        )
                      : null,
                );
              }),

              // Right: controls
              createElement('div', { className: 'flex items-center gap-2' },
                createElement(ThemeSelector, null),
                createElement(ThemeToggle, null),
                S(() => {
                  const u = currentUser.value;
                  if (!u) return null;
                  return createElement(Avatar, { className: 'size-7' },
                    (u as any).avatar_path
                      ? createElement(AvatarImage, { src: (u as any).avatar_path, alt: u.name || '' })
                      : null,
                    createElement(AvatarFallback, { className: 'text-[10px] bg-primary text-primary-foreground' },
                      (u.name || u.username || '?').slice(0, 2).toUpperCase(),
                    ),
                  );
                }),
              ),
            ),

            // CONTENT
            createElement('main', { className: 'flex-1 overflow-auto' },
              S(() => {
                if (globalLoading.value) {
                  return createElement('div', { className: 'flex items-center justify-center h-full' },
                    IconSpinner('size-8 text-primary'),
                  );
                }
                switch (route.value) {
                  case 'dashboard': return createElement(DashboardView, null);
                  case 'board': return createElement(BoardView, null);
                  case 'list': return createElement(ListView, null);
                  case 'task': return createElement(TaskDetailView, null);
                  case 'settings': return createElement(SettingsView, null);
                  default: return createElement(DashboardView, null);
                }
              }),
            ),
          ),
        );
      }),
    );
  }
}

// ---------------------------------------------------------------------------
// Sidebar navigation item
// ---------------------------------------------------------------------------

function SidebarItem(r: string, icon: (cls?: string) => any, label: string) {
  return S(() => {
    const active = route.value === r;
    const collapsed = sidebarCollapsed.value;
    return createElement(Button, {
      variant: 'ghost',
      size: 'sm',
      className: `w-full justify-start gap-2 h-8 text-[13px] font-normal ${
        active
          ? 'bg-sidebar-accent text-sidebar-foreground font-medium'
          : 'text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent'
      }`,
      onClick: () => {
        navigate(r as any);
        if (r === 'dashboard') fetchDashboard();
      },
    },
      icon(collapsed ? 'size-4 mx-auto' : 'size-4'),
      !collapsed ? label : null,
    );
  });
}
