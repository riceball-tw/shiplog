# one-on-one

A local tool for preparing 1:1 meetings. It reads the git history of all your repos, keeps only the commits you authored, and shows them on a draggable timeline: an overview of stacked bars by repo plus one swimlane per repo. A summary panel groups the commits in the selected range by type or ticket and exports a Markdown pitch you can paste into your notes.

## Requirements

- Node.js >= 20
- pnpm
- git (on your `PATH`)

## Quick start

```sh
pnpm install
pnpm dev            # UI on http://localhost:5173, API on 127.0.0.1:4317
```

Or run a production build, where the API serves the UI too:

```sh
pnpm build && pnpm start   # everything on http://127.0.0.1:4317
```

## First-run setup

Open the **Settings** page:

1. Add one or more scan folders (use **Browse...** to pick them). Repos are discovered recursively. You can also pin individual repos.
2. Pick your author emails from the detected authors, so only your commits are shown.
3. Save. The app rescans and the timeline fills in.

## Configuration

Settings are stored in `~/.one-on-one/config.json`. Set `ONE_ON_ONE_HOME` to use a different directory (the file is then `$ONE_ON_ONE_HOME/config.json`). The Settings page edits this file; you can also edit it by hand. `~` is expanded in paths.

| Field | Meaning | Default |
| --- | --- | --- |
| `scanRoots` | Directories scanned recursively for git repos | `[]` |
| `pinnedRepos` | Extra repo paths that are always included | `[]` |
| `excludedRepos` | Repo paths to skip | `[]` |
| `authorEmails` | Emails identifying you (case-insensitive) | your global `git config user.email` |
| `scanDepth` | Max directory depth when scanning roots | `5` |
| `ignoreDirs` | Directory names skipped while scanning | `node_modules`, `vendor`, `.cache`, `dist`, `build`, `.venv`, `Pods` |
| `excludeFromStats` | Globs excluded from line counts | lock files, `*.min.js`, `dist/**`, snapshots, `go.sum` |
| `since` | Only read history newer than this (ISO date or `"12 months ago"`) | `12 months ago` |
| `classifier.keywords` | Extra keyword rules per commit type (regex source strings), checked before the built-in ones | `{}` |

## How commits are classified

Each commit gets a type (`feat`, `fix`, `refactor`, `perf`, `test`, `docs`, `ci`, `build`, `chore`, `style`, `revert`, `other`).

1. If the subject is a Conventional Commit (`feat(scope): ...`, `fix!: ...`), that type is used with high confidence.
2. Otherwise a heuristic guesses from keywords in the subject (your `classifier.keywords` first, then built-in rules), then from the changed file paths (only tests, only docs, only CI files). These are low confidence and drawn as faded dots on the timeline, and marked "(guessed)" in tooltips.

Ticket ids found in subjects are collected and can be used to group the summary.

## Privacy and security

- The server binds to `127.0.0.1` only.
- Requests whose `Host` header is not loopback (`127.0.0.1`, `localhost`, `[::1]`) are rejected with 403, which blocks DNS-rebinding attacks from web pages.
- Commits are held in memory only; they are re-read from git on each scan and never written to disk by this app. Only the config file is persisted.
- Nothing is sent off your machine.

## Project layout

```
packages/
  shared/   TypeScript types and the API contract (AppConfig, Commit, ...)
  server/   Hono API: config, repo discovery, git log parsing, classifier, in-memory store
  web/      Vue 3 + Vite + Tailwind v4 + shadcn-vue + Pinia + ECharts UI
```

## Scripts

Run from the repo root:

| Command | What it does |
| --- | --- |
| `pnpm dev` | Server and web dev servers with reload |
| `pnpm build` | Build all packages (type-checks the web app first) |
| `pnpm start` | Run the built server, serving the built UI |
| `pnpm test` | Run all unit tests (vitest) |
| `pnpm typecheck` | Type-check all packages |
