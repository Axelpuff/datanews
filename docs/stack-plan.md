# Stack Plan — DataNews ("NOW")

> Forward-looking architecture plan agreed with the project owner. The current
> repo state does not yet implement everything described here — treat this as
> "the direction" rather than "what exists today". When working on something
> covered below, prefer the choices laid out here unless there's a concrete
> reason to deviate. Authored 2026-05-01.

## Context

DataNews is a public, read-only "world data surface" dashboard whose goal is to surface present-tense facts (events, weather, casualties, population, AI buildout, climate signals) with as little editorial framing as possible. Headlines are short and unembellished; sources lean primary; LLMs are used sparingly and transparently; the visual language is monospace + minimal white.

Today the repo already has a working Vite + React 19 + Tailwind v4 SPA, Vercel serverless functions in `api/`, and Supabase tables (`events`, `topics`, `weather_data`, `casualty_events`). MapLibre + Open-Meteo are wired up. **What is missing is the data pipeline** — there is no scraper, scheduler, or ingestion code anywhere in the repo, and the financial ticker is hard-coded in `App.tsx`.

The stack decisions below are scoped to: keeping cost flat as users grow, getting real data flowing reliably, staying within news-licensing rules, and avoiding a cookie-consent banner.

---

## Recommended stack

### Frontend — keep Vite SPA, drop `react-router-dom`

Stay on Vite + React 19. The app is single-page, has no auth, and SEO is not a primary acquisition channel — the two arguments for migrating to Next.js (SSR/ISR, file-based routing) don't pay back the migration cost here. Remove `react-router-dom` (installed at `package.json` but unused per the explore report). Continue Tailwind v4 + monospace + inline numeric styles already established in `src/components/*`.

If, later, you add a `/topics/:id` deep-linked view or per-event permalinks for sharing, revisit Next.js then. The migration is straightforward because there is no router state today.

### Hosting — Vercel for the SPA, AWS for the pipeline

- **SPA + edge-cached read API**: keep on Vercel. The four `api/*.js` functions become read-only and CDN-cached (see "Cost model" below).
- **Ingestion / ETL**: AWS Lambda + EventBridge cron, paid for with the YC AWS credits. This is where the per-minute scraping, RSS polling, GDELT pulls, weather snapshots, and LLM calls happen. Lambda also writes to Supabase using the service role key.

Why split: Vercel Cron exists but its free tier is constrained (1/day on Hobby), and you want minute-grain cadence for breaking events. Lambda + EventBridge gives you flexible cron + the credits cover it.

### Database — keep Supabase Postgres

Already wired. Add tables for the new panes (see Schema below). Use the existing `_supabase.js` wake/restore mechanism. Frontend continues to read via the Vercel `/api/*` proxy (so the anon key + RLS aren't on the critical path). Lambda writes via service-role key.

### Analytics — self-hosted Plausible on AWS, no banner

Plausible Community Edition is cookieless and stores no personal data; under GDPR/ePrivacy it does not require consent because no cookies and no fingerprinting are used. Self-hosting on a small EC2/Fargate task costs ~constant against the credits and means analytics never blocks a banner.

Alternative if you want zero ops: hosted Plausible or Fathom (~$9–14/mo, also cookieless, also banner-free). Both publish DPA + GDPR notes you can link from a one-line privacy page.

Avoid Google Analytics — it sets cookies and requires consent in most jurisdictions, which contradicts your "no banner" goal.

### Data ingestion plan (the missing piece)

Each source below is a separate Lambda, scheduled by EventBridge, writing to Supabase.

**News headlines**
- Primary: **GDELT 2.0 Doc API** — free, global, real-time, indexes most major outlets, returns titles + URLs + tone + geo. Good fit for "primary sources first" because you can filter by source domain.
- Secondary: **RSS feeds** from Reuters (`reutersagency.com`), AP (`apnews.com`), Al Jazeera (`aljazeera.com`), AFP (via partners), BBC, NHK World, official government feeds (whitehouse.gov, gov.uk, kremlin.ru). Polling RSS is explicitly permitted by publishers; it is not "scraping".
- Tertiary (paid, only if needed): **NewsAPI.org** (~$449/mo) or **MediaStack** for backfill.
- **Legality**: headlines are facts, not copyrightable in the US/EU; linking to source articles is standard. You are not republishing article bodies, so you stay clear of TOS issues. Cache the original source URL and render small icons that link out — this matches your spec.
- **De-dup / story-clustering**: hash-normalize titles, then use Claude to cluster same-story headlines from different outlets (one cluster per row in `events`, multiple `source_url` icons rendered).

**Weather** — already on Open-Meteo, free, no key. Keep.

**Casualty events** — ACLED (subscription, but free for academic/non-profit; commercial requires a license), UCDP (free, monthly), Reliefweb (free, real-time). Combine; flag reliability per row (`reporting_reliability` column already exists).

**Population**
- World Bank Indicators API (free, no key) for country-level totals + birth/death/migration rates.
- UN Population Division for projections.
- For migrations as "wind", use UNHCR Refugee Statistics API.

**AI buildouts**
- Datacenter announcements: hand-curated initially (rare events, low volume) + GDELT filter on `data center` keyword + domain whitelist.
- Energy consumption: IEA reports (annual), regional grid operator APIs (e.g., ERCOT, EIA) for hourly load.
- Time horizon / benchmarks: METR's HCAST data, Epoch AI's compute index — both have CSV/API endpoints.

**Climate**
- USGS Earthquake API (free, GeoJSON).
- NOAA NHC (hurricanes/tropical storms), free.
- Smithsonian Global Volcanism Program (weekly volcano report, RSS + JSON).
- Open-Meteo historical archive for "scroll backwards in days".

**Financial** (replace the hard-coded `FinancialBar`)
- Yahoo Finance unofficial endpoints work but are fragile. Better: Alpha Vantage (free 25/day), Twelve Data (free 800/day), or polygon.io flat-files via S3 (cheap with credits). Cache server-side and serve from `/api/markets`.

### LLM use — minimal, transparent, cached

Use Claude (Anthropic) and follow the rules already in `WarningModal.tsx`:
- **Allowed**: clustering same-story headlines from different outlets into one event row, and picking the "least embellished" of those titles to display.
- **Not allowed**: deciding which events make the cut, writing topic summaries, assigning categories, ordering severity, writing any original prose. Topic descriptions and category labels stay rule-based or human-curated for now.
- **Transparency**: every event row already has `llm_summarized` and `llm_model` columns. Surface these in the UI (small "LLM" badge per event) — partially done already; verify.
- **Cost control**: Claude Haiku 4.5 for clustering/dedup; Sonnet 4.6 only for the rare cases where Haiku is uncertain. Cache by content hash so re-runs don't pay twice. This is the canonical case for prompt caching since the system prompt + headline corpus changes slowly.

Ballpark: ~5K headlines/day × Haiku 4.5 ≈ pennies per day before caching.

### Cost model — flat as users grow

The trick is to make read traffic free at the per-request margin:

1. The four `/api/*` routes set `Cache-Control: public, s-maxage=60, stale-while-revalidate=300`. Vercel's edge caches the response, so 1 user and 100,000 users hit the cache, not Supabase.
2. With caching, Supabase reads are bounded by `(routes × 1/min × 1440 min/day)` ≈ 5,760/day regardless of users.
3. Lambda ingestion runs on a fixed cron schedule — cost depends on cadence, not users.
4. Plausible self-hosted is fixed-cost.

So the only user-scaling cost is Vercel bandwidth (free up to 100 GB/mo on Pro), which is the desired property.

### Cookies / consent — none needed

Plan to ship **zero cookies**. The Warning modal can persist its dismissal in `localStorage` (already does, per `sessionStorage` in `WarningModal.tsx` — verify and keep). Plausible cookieless. No auth means no session cookies. Result: no banner is required under GDPR/ePrivacy/CCPA. Add a one-line `/privacy` link in the footer that says "no cookies, no tracking, server logs retained 7 days."

---

## Schema additions (Supabase)

New tables to add (existing four stay as-is):

- `event_sources` — one row per (event_id, source_url, source_name, source_icon_url). Lets one event surface multiple icons on the right side, as specified.
- `population_country` — iso3, year, total, birth_rate, death_rate, net_migration, growth_rate, growth_2nd_derivative.
- `migration_flow` — origin_iso3, dest_iso3, year, magnitude, kind (refugee/economic/displaced).
- `ai_compute_site` — id, name, lat, lon, operator, capacity_mw, status (planned/under_construction/operating), announced_at.
- `ai_signal` — id, kind (statement/benchmark/buildout), source_url, payload jsonb, timestamp.
- `climate_event` — id, kind (earthquake/hurricane/volcano/storm), magnitude, lat, lon, started_at, ended_at, source_url.
- `market_snapshot` — symbol, value, change_pct, fetched_at.

Refactor `events` to drop the duplicated single-source columns once `event_sources` lands; keep them during migration.

---

## Critical files

Modify:
- `src/App.tsx` — add fetches for new panes; remove hardcoded financial data; thread new props.
- `src/components/EventPanel.tsx` — render multi-source icon row per event.
- `src/components/FinancialBar.tsx` — read from `/api/markets`.
- `src/components/WorldMap.tsx` — gain pane-mode prop (overview/population/ai/climate); each mode picks layers + markers.
- `api/_supabase.js`, `api/events.js` — add `Cache-Control` headers; widen `events` query to join `event_sources`.
- `vercel.json` — gitignored as of the rebase on 2026-05-01; manage env vars in the Vercel dashboard, not in this file. The local copy is for `vercel dev` only.
- `package.json` — remove `react-router-dom`.

Add:
- `api/markets.js`, `api/population.js`, `api/ai.js`, `api/climate.js` — new read routes mirroring the existing CORS + try/catch shape.
- `infra/lambdas/<source>.ts` — one Lambda per ingestion source, deployed via SST or AWS CDK. Outside the Vite tree.
- `infra/cdk/` (or `infra/sst.config.ts`) — IaC for EventBridge schedules, Lambda functions, IAM, Plausible Fargate task.
- `src/components/PaneSwitcher.tsx` — top-level switch between Overview / Population / AI / Climate (currently only weather/casualty exists in `App.tsx` `mapMode`).

Reuse:
- `api/_supabase.js` wake-on-5xx mechanism — reuse pattern in Lambdas if they ever read from Supabase.
- `WarningModal.tsx` LLM-disclosure language — extend the same wording to per-event "LLM" badges.
- MapLibre layer pattern in `WorldMap.tsx` — extend rather than rewrite for new panes.

---

## Verification

End-to-end checks once the pipeline ships:

1. `npm run dev` then `vercel dev` in a second tab — confirm `/api/events` returns rows from Supabase including new `event_sources` join.
2. Hit `/api/events` twice within 60s — second response should show CDN `HIT` in `x-vercel-cache` header (cost model gate).
3. Trigger one ingestion Lambda manually via AWS console, watch CloudWatch for success, then refresh the dashboard — new event appears within 60s of cache TTL.
4. Open browser devtools Network tab — confirm zero `Set-Cookie` headers from any request (banner gate).
5. Open `/privacy` and confirm the one-line statement is correct.
6. Add a new pane (e.g., Population) — confirm the `PaneSwitcher` swaps `WorldMap` into population mode with valid data.
7. Run `npm run build` — TypeScript clean, no `react-router-dom` import errors after removal.
