# 📋 Sporeboard

**A modern, blazing-fast Kanban board frontend for [Kanboard](https://kanboard.org).**

Built on the [Spore](https://github.com/TekkadanPlays/spore) microframework — five tools, zero bloat.

## Quick Start

```bash
# 1. Install dependencies
bun install

# 2. Build CSS + client bundle
bun run build

# 3. Start the dev server (watches for file changes)
bun run dev
```

Open [http://localhost:3000](http://localhost:3000) and sign in with your Kanboard API credentials.

### Seed demo data (optional)

If you have a fresh Kanboard instance running at `localhost:8080`:

```bash
bun run seed-demo.ts
```

This creates 3 sample projects with tasks, subtasks, categories, and comments.

## Features

- **Dashboard** — project overview, overdue task alerts, quick project creation
- **Kanban Board** — drag-and-drop task cards, swimlanes, inline task creation, optimistic updates
- **List View** — sortable/filterable task table for a project
- **Task Detail** — full task view with subtasks, comments, metadata editing
- **Settings** — project columns, categories, swimlanes at a glance
- **Filters** — filter by category, assignee, color, or search text
- **Theming** — light/dark mode with OKLCH design tokens, multiple color themes via Blazecn
- **Auth** — login against any Kanboard instance via JSON-RPC, credentials persisted in localStorage

## Architecture

```
src/
├── server.ts             Hono BFF — proxies JSON-RPC to Kanboard, serves static files
├── kanboard-rpc.ts       Server-side JSON-RPC client (Basic Auth → Kanboard)
├── template.ts           HTML shell with theme-flash prevention
├── signals.ts            Reactive state layer (Preact Signals) — all app state lives here
├── styles.css            Tailwind v4 + OKLCH design tokens (light/dark)
└── client/
    ├── entry.ts          Client entry — mounts Inferno
    ├── App.ts            Application shell — router, sidebar, top nav
    ├── api.ts            Client-side fetch layer (BFF → signals)
    ├── bridge.ts         SignalBridge — connects Preact Signals to Inferno re-renders
    ├── icons.ts          SVG icon components (inline, no deps)
    └── views/
        ├── LoginView.ts        Glassmorphic auth screen
        ├── DashboardView.ts    Project grid + overdue tasks + quick create
        ├── BoardView.ts        Kanban board (drag-and-drop, swimlanes)
        ├── ListView.ts         Sortable task table
        ├── TaskDetailView.ts   Full task editor (subtasks, comments)
        └── SettingsView.ts     Project config viewer
```

## The Stack

| Layer | Tool | Why |
|-------|------|-----|
| **Runtime** | [Bun](https://bun.sh) | Fastest JS runtime. Bundles, serves, installs — in milliseconds. |
| **Server** | [Hono](https://hono.dev) | Ultra-fast routing, middleware, and static files in 14KB. |
| **UI** | [InfernoJS](https://infernojs.org) | Fastest virtual DOM. React-compatible API at a fraction of the size. |
| **Components** | [Blazecn](https://github.com/TekkadanPlays/blazecn) | 49 shadcn/ui-compatible components — no React, no Radix. |
| **State** | [Preact Signals](https://github.com/preactjs/signals) | Fine-grained reactivity. No providers, no selectors — just `.value`. |
| **Styling** | [Tailwind CSS v4](https://tailwindcss.com) | OKLCH color system, utility-first, compiles in 56ms. |
| **Backend** | [Kanboard](https://kanboard.org) | Open-source Kanban project management (PHP, JSON-RPC API). |

## Scripts

| Command | What it does |
|---------|-------------|
| `bun run dev` | Start server with file-watch restart |
| `bun run dev:css` | Watch and rebuild CSS on file changes |
| `bun run build` | Build CSS + client bundle for production |
| `bun run start` | Start production server |

## How It Works

**Server** — Hono acts as a BFF (backend-for-frontend). It accepts simplified REST-style requests from the client, translates them into Kanboard JSON-RPC calls with Basic Auth, and returns clean JSON. This keeps API tokens off the browser.

**Client** — Bun bundles `src/client/entry.ts` into a single JS file. InfernoJS mounts the App shell. Hash-based routing (`#dashboard`, `#board/3`, `#task/12`) drives view switching.

**State** — All application state lives in Preact Signals (`signals.ts`). A `SignalBridge` component (`S()`) subscribes to signals via `effect()` and triggers surgical Inferno re-renders — only the leaves that read a signal update when it changes.

**Theming** — Light and dark mode via OKLCH design tokens in `styles.css`. The `ThemeToggle` and `ThemeSelector` components from Blazecn handle persistence.

## Kanboard Setup

This frontend requires a running Kanboard instance with the JSON-RPC API enabled (it is by default).

1. Run Kanboard via [Docker](https://docs.kanboard.org/v1/admin/docker/):
   ```bash
   docker run -d --name kanboard -p 8080:80 kanboard/kanboard
   ```
2. Log into Kanboard at `http://localhost:8080` (default: `admin` / `admin`)
3. Grab your API token from **User Profile → API**
4. Start Sporeboard and sign in at `http://localhost:3000`

## License

MIT
