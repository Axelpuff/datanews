# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Forward plan

Architectural direction for upcoming work lives at [`docs/stack-plan.md`](docs/stack-plan.md). When making non-trivial changes (new panes, ingestion pipeline, schema changes, hosting choices), check whether the plan already covers the area and prefer its choices unless there's a concrete reason to deviate. The plan is forward-looking — most of it is not implemented yet.

## Commands

- `npm run dev` — Vite dev server (frontend only; the `/api/*` routes are not served here, they only run when deployed to Vercel or via `vercel dev`).
- `npm run build` — type-check (`tsc -b`) then build with Vite. Use this to verify TypeScript compiles; there is no separate typecheck script.
- `npm run lint` — ESLint over the repo (flat config in `eslint.config.js`, browser globals, `typescript-eslint` recommended + react-hooks + react-refresh).
- `npm run preview` — preview the production build.

There is no test runner configured.

## Architecture

This is a single-page "World Data Surface" dashboard (`NOW`) deployed on Vercel. Frontend is a Vite-built React 19 + TypeScript SPA; backend is a handful of Vercel Node.js serverless functions in `api/` that proxy a Supabase Postgres database.

### Frontend (`src/`)

- `main.tsx` mounts `App` in `StrictMode`. There is no router despite `react-router-dom` being installed.
- `App.tsx` owns all top-level state and is the single fetch point: it `Promise.all`s `/api/events`, `/api/topics`, `/api/weather`, `/api/casualties` once on mount, then fans the data out as props to `WorldMap`, `EventPanel`, `TopicList`, `FinancialBar`, plus `WarningModal`. The `FinancialBar` data is currently hard-coded inside `App.tsx` (placeholder, not from the API).
- `mapMode` toggle in the header switches `WorldMap` between `'weather'` and `'casualty'` rendering of the same SVG continents.
- Styling is Tailwind CSS v4 via `@tailwindcss/vite` (no `tailwind.config.js`), mixed with inline `style={{...}}` for monospace/numeric UI; default font is `monospace`.
- `src/lib/supabase.js` exists for direct browser-side Supabase access using the anon key, but `App.tsx` does not currently use it — all reads go through the `/api/*` routes.

### API (`api/`, Vercel functions)

- One file per route (`events.js`, `topics.js`, `weather.js`, `casualties.js`). Each is a default-exported `(req, res)` handler that sets permissive CORS, branches on `req.method`, and queries Supabase via the shared client. Tables: `events`, `topics`, `weather_data`, `casualty_events`.
- `_supabase.js` constructs the server-side client with `SUPABASE_SERVICE_ROLE_KEY` (bypasses RLS) and wraps `fetch` so any 5xx response calls `triggerRestore()`.
- `_wake.js` posts to `FULLSTACK_RESTORE_API_URL` with `FULLSTACK_PROJECT_REF` to wake/restore a paused Supabase project. It self-throttles via `_restoreTriggered` for 60s. Files prefixed with `_` are helpers, not routes.
- New API routes: add `api/<name>.js` exporting a default `handler`; mirror the CORS preamble and `try/catch` shape from the existing files.

### Environment & deployment

- `vercel.json` is gitignored — it lives only on local disks (and inlines secrets for `vercel dev`). Production env vars are managed in the Vercel project dashboard, not in this file. Do not add `vercel.json` back to git.
- Two parallel naming schemes coexist: server functions read `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`; the browser client reads `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`. Keep both in sync when changing Supabase config.
- `vite.config.ts` optionally loads `./.vite-source-tags.js` (gitignored, may be absent locally) — the `try/catch` around the dynamic import is intentional, do not remove it.
