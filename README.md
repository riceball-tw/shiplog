# shiplog

A local tool for preparing 1:1 meetings. It reads the git history of all your repos, keeps only the commits you authored, and shows them on a draggable timeline: an overview of stacked bars by repo plus a themes timeline (one row per theme, density and starred highlights; click a row to jump to its card). Per-repo swimlanes live in a collapsible "Repo lanes" section. Below it, a **Story** tab (your themes, exportable as a Markdown pitch you can paste into your notes) a **Breakdown** tab (the commits grouped by ticket, type or repo) and a **Commits** tab (the raw list; clicking a dot in the repo lanes opens it at that commit) cover the selected range. **Hide noise** (chore/ci/style/build) sits in the timeline header.

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

Settings are stored in `~/.shiplog/config.json`. Set `SHIPLOG_HOME` to use a different directory (the file is then `$SHIPLOG_HOME/config.json`). If you ran it under its old name, `~/.one-on-one/config.json` is copied over on first start. The Settings page edits this file; you can also edit it by hand. `~` is expanded in paths.

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

Ticket ids found in subjects are collected and can be used to group the Breakdown.

## Themes and highlights

A review is told as a handful of **themes** ("Payments migration", "Checkout performance"), each with a one-line **outcome** ("cut checkout p95 from 800 to 300 ms"). Git can't know impact, so you type the outcomes; shiplog makes the grouping fast.

- The **Story** tab (the default) shows one card per theme with work in the selected range: editable name and outcome, time span, repos, ticket/commit counts, its highlights, and its tickets (collapsed).
- Work not in any theme is listed under **Unassigned**; use **Add to theme** on a ticket (or on a no-ticket group) to file it, or create a theme on the spot. Themes can be reordered and deleted (deleting only removes the grouping, never commits). Themes with no work in the range are collapsed at the bottom.
- **Sorting fast**: on a wide Story panel the Unassigned inbox sits on the left (sticky) and the theme cards on the right, with a draggable divider between them (its position is remembered); on a narrow one the inbox is on top. Drag a ticket (or no-ticket group) onto a theme card, onto a collapsed theme chip, or onto the dashed **+ New theme** zone; drag work back onto the inbox to unassign, or between theme cards to move it. Cmd/Ctrl+click toggles selection, Shift+click selects a range, and dragging a selected row drags the whole selection (Esc clears). Keyboard: focus an inbox row (arrow keys move), press **1-9** to add it to that theme (numbers show on the cards), **N** for a new theme, **Space** to select; **U** on a focused row in a theme card unassigns it. Every move shows an **Undo** bar for about 5 seconds. The Add to theme menu stays as the touch fallback.
- A commit belongs to the first theme (in theme order) that lists it explicitly, else one that lists one of its tickets, else one that lists its repo. Each commit is in at most one theme.
- **Highlights**: star the handful of commits worth mentioning, in the Commits list or in an expanded ticket. Starred commits lead their theme in the Story and its export.
- **Export** in the Story tab opens a dialog whose **Copy Markdown** exports each theme as a heading with its outcome, highlights first, then its tickets, then an "Other work" list.
- The story export also starts with a Mermaid `gantt` block (the themes timeline: one section per theme, one bar per stretch of activity, a milestone per starred highlight, muted "Other work"). It renders in Obsidian, GitHub and GitLab. Untick **Include timeline** in the dialog to leave it out. The dialog draws the diagram with [pele](https://github.com/obsidianmd/pele); **Copy image** (PNG, 2x, white background; downloads the file if the browser can't write images to the clipboard) and **Download SVG** give you the same picture for Slack, Google Docs or email, which don't render Mermaid.

Themes and highlights are saved to `notes.json` next to the config (`~/.shiplog/notes.json`, or `$SHIPLOG_HOME/notes.json`). Commits are referenced by `<repoId>:<hash>`; the API is `GET`/`PUT /api/notes`.

## Presenting

Click **Present** in the Story toolbar (or open `#/present?from=YYYY-MM-DD&to=YYYY-MM-DD`) to walk through the range as full-screen slides: a title with headline numbers, the themes timeline, one slide per theme with work (outcome, highlights, top tickets), and "Other work". It uses the same range, repo filters and noise setting as the Story, and follows light/dark. Themes without an outcome show "No outcome written yet", so check before the meeting.

- **Right / Space / PageDown** next, **Left / PageUp** previous, **Home / End** first / last. Clicking the right or left half of the screen also moves.
- **Esc** (or the X) returns to the main view with the same range.
- The slide number is kept in the URL (`&slide=3`), so a refresh stays put.

## Privacy and security

- The server binds to `127.0.0.1` only.
- Requests whose `Host` header is not loopback (`127.0.0.1`, `localhost`, `[::1]`) are rejected with 403, which blocks DNS-rebinding attacks from web pages.
- Commits are held in memory only; they are re-read from git on each scan and never written to disk by this app. Only the config file and your notes (`notes.json`: theme names, outcomes, and the tickets/commit ids you assigned or starred) are persisted, both locally.
- Nothing is sent off your machine.

## Project layout

```
packages/
  shared/   TypeScript types and the API contract (AppConfig, Commit, ...)
  server/   Hono API: config, repo discovery, git log parsing, classifier, in-memory store
  web/      Vue 3 + Vite + Tailwind v4 + shadcn-vue + Pinia + ECharts UI
  e2e/      Playwright browser tests on synthetic git repos
```

## Scripts

Run from the repo root:

| Command | What it does |
| --- | --- |
| `pnpm dev` | Server and web dev servers with reload |
| `pnpm build` | Build all packages (type-checks the web app first) |
| `pnpm start` | Run the built server, serving the built UI |
| `pnpm test` | Run all unit tests (vitest; does not include e2e) |
| `pnpm test:e2e` | Build, then run the Playwright browser tests (see Testing) |
| `pnpm typecheck` | Type-check all packages |

## Testing

- **Unit tests**: `pnpm test` (vitest, server and web). Fast, no browser.
- **End-to-end tests**: `pnpm test:e2e` builds the app and drives the production bundle in headless Chromium with Playwright (`packages/e2e`). First time only, install the browser: `pnpm --filter @shiplog/e2e exec playwright install chromium`. To rerun without rebuilding: `pnpm --filter @shiplog/e2e e2e` (add `--ui` or `--headed` to watch, or a spec name to run one file).

The e2e run never touches your real data. It creates throwaway git repos (commits by `e2e@example.com`, dated relative to today) and a temp `SHIPLOG_HOME` in the OS temp dir, starts the server on port **4399** (not 4317 or 5173, so your dev servers can keep running), and deletes everything on exit. The tests share one server and run serially; notes are reset before each test.

Reports and traces land in `packages/e2e/playwright-report/` and `packages/e2e/test-results/` (git-ignored). Traces and screenshots are kept for failures only: `pnpm --filter @shiplog/e2e exec playwright show-report`, or `playwright show-trace <trace.zip>`.
