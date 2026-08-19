# Free Football Live Scores API — Premier League, LaLiga & More

<a href="https://www.buymeacoffee.com/rahiminia"><img src="https://img.buymeacoffee.com/button-api/?text=Buy me a coffee&emoji=&slug=rahiminia&button_colour=FFDD00&font_colour=000000&font_family=Arial&outline_colour=000000&coffee_colour=ffffff" /></a>

An open-source, database-backed REST API and web score center for football live scores, today's fixtures, results, league tables, match summaries, play-by-play events, clubs and rosters.

**Live football score center:** [worldcup26.ir](https://worldcup26.ir/)

**Interactive football API docs:** [worldcup26.ir/api-docs](https://worldcup26.ir/api-docs/)

Current verified coverage focuses on England and Spain, including the Premier League, EFL competitions, FA Cup, LaLiga, LaLiga 2, Copa del Rey and women's competitions. UEFA Champions League and additional countries are added only after their data coverage is verified.

The public API never calls an upstream provider during a customer request. A separate listener project fetches upstream data and writes normalized documents to MongoDB; this service only reads and publishes those documents.

## Product scope

This project is a country-based club football service with one stable API and
data model across all supported leagues. England and Spain are the initial
markets, followed by country-by-country expansion.

| Phase | Scope | Status |
|---|---|---|
| 1 | Launch England and Spain, starting with the Premier League (`eng.1`) and LaLiga (`esp.1`) | First priority |
| 2 | Add leagues from other countries one country at a time | Planned |

## Search-friendly competition pages

The website serves crawlable, server-rendered landing pages with unique titles,
descriptions, canonical URLs, structured data and internal links:

- `/football/eng.1` — Premier League live scores, fixtures, results and table
- `/football/esp.1` — LaLiga live scores, fixtures, results and standings
- `/football/country/england` — all verified England football competitions
- `/football/country/spain` — all verified Spain football competitions

The XML sitemap discovers every active league automatically, so newly verified
countries and competitions receive an indexable page without hard-coding new
routes. The full keyword map and publishing rules are in
[SEO-KEYWORDS.md](SEO-KEYWORDS.md).

## Rollout strategy

England and Spain are the reference implementations for the multi-league
platform. Their ingestion, storage, API responses, and customer experience
should be stable before broader country expansion.

A new country or league is considered ready only when:

1. Its stable league slug and country metadata are registered.
2. Fixtures, results, live status, clubs, and standings are normalized in
   MongoDB.
3. Match details and important events are returned without calling an upstream
   provider during the customer request.
4. Data freshness, missing-data behavior, and listener failures are observable.
5. API contract tests and at least one stored end-to-end example have been
   verified.
6. Swagger, the customer documentation, and the web league selector have been
   updated.

After England and Spain meet these requirements, additional countries will be
enabled individually. This avoids advertising incomplete coverage and allows
each rollout to be tested, monitored, and rolled back independently.

## Architecture

```text
Upstream football data
          │
          ▼
External listener project
          │  MongoDB upserts
          ▼
soccer_* collections
          │  read-only customer requests
          ▼
Soccer Clubs Data API
```

This separation keeps customer traffic independent from upstream availability and lets the listener control polling, retries, normalization, and failover.

## Public API

Base path:

```text
/get/soccer
```

| Endpoint | Description |
|---|---|
| `GET /get/soccer/meta` | Current service capabilities, collection counts, and freshness |
| `GET /get/soccer/leagues?kind=club&available=true` | Club competitions available for customer selection, with coverage counts |
| `GET /get/soccer/{league}/scoreboard?dates=YYYYMMDD` | Fixtures, live status, scores, and match statistics |
| `GET /get/soccer/{league}/fixtures?status=all&from=YYYYMMDD&to=YYYYMMDD` | Paginated stored schedule and results; dates are optional |
| `GET /get/soccer/{league}/summary?event={eventId}` | Complete stored match summary |
| `GET /get/soccer/{league}/events/{eventId}` | Summary path alias |
| `GET /get/soccer/{league}/events/{eventId}/plays` | Paginated play-by-play |
| `GET /get/soccer/{league}/clubs` | Clubs in the selected league |
| `GET /get/soccer/{league}/clubs/{clubId}` | Club, roster, and coach |
| `GET /get/soccer/{league}/standings?season=YYYY` | League table or competition groups |
| `GET /health` | Application and database health |

Examples:

```bash
curl "http://localhost:3050/get/soccer/leagues"
curl "http://localhost:3050/get/soccer/meta"
curl "http://localhost:3050/get/soccer/leagues?kind=club&available=true"
curl "http://localhost:3050/get/soccer/eng.1/scoreboard?dates=20260822"
curl "http://localhost:3050/get/soccer/esp.1/fixtures?limit=100"
curl "http://localhost:3050/get/soccer/eng.1/clubs"
curl "http://localhost:3050/get/soccer/eng.1/standings?season=2026"
```

Responses for scoreboard, summary, and plays use a stable provider-compatible shape while remaining backed entirely by this project's MongoDB.

Match details include stored goal scorers, substitutions (player in/out, team, and minute), key-event timeline, statistics, and summary data. League-wide top scorers are intentionally not exposed yet: the database currently has no validated structured collection for them, and raw `soccer_snapshots` remain internal.

The league catalog defaults to `kind=club`. Use `kind=international` or
`kind=all` when those competitions are required. Every league includes a
`coverage` object with match, club, and standings counts. Passing
`available=true` hides competitions that do not yet have stored customer data.

When the dedicated `soccer_clubs` catalog has not yet been populated for a
league, the clubs endpoint builds a basic catalog from the normalized home and
away participants already stored in `soccer_matches`. The response metadata
states whether this fallback was used; roster and coach data are available only
from dedicated club documents.

## MongoDB collections

| Collection | Purpose |
|---|---|
| `soccer_leagues` | Selectable club leagues and current-season metadata |
| `soccer_clubs` | Club identity, branding, venue, roster, and coach |
| `soccer_matches` | Match schedule, score, status, statistics, and summary data |
| `soccer_match_events` | Idempotent play-by-play events |
| `soccer_standings` | League tables and competition groups |
| `soccer_sync_states` | Listener cursor, polling state, errors, and leases |

The listener write contract, indexes, schemas, and upsert examples are documented in [LIVE-LISTENER-DATABASE.md](LIVE-LISTENER-DATABASE.md).

## Getting started

Requirements:

- Node.js 18 or newer
- MongoDB 6 or newer

Install dependencies:

```bash
npm install
```

Create `.env.development` or `.env.production`:

```env
NODE_ENV=development
PORT=3050
MONGODB_URL=mongodb://localhost:27017/soccer
ENABLE_SWAGGER=true
LOG_LEVEL=debug
CORS_ORIGINS=*

RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=500
PUBLIC_RATE_LIMIT_WINDOW_MS=60000
PUBLIC_RATE_LIMIT_MAX=120
```

Create the club-football collections and indexes:

```bash
npm run db:init-live
```

Start the API:

```bash
npm start
```

Swagger UI is available at:

```text
http://localhost:3050/api-docs
```

Only the club-football API and health endpoints are included in the public Swagger specification.

The raw, non-cached OpenAPI document is available at `/openapi.json`. The root
page is an interactive competition explorer powered exclusively by the public
Swagger endpoints. `/robots.txt` and `/sitemap.xml` describe the football API.

The browser application derives its country selector from the normalized
`country` field returned by the league catalog. It uses `fixtures` for schedules
and results, `standings` for tables, and `events/{eventId}` plus `plays` for the
match drawer. Live match details refresh every 15 seconds while the drawer is
open.

## Data freshness

The API does not run a listener. Freshness depends on the external writer's polling interval and last successful MongoDB update.

- Live scoreboard, summary, and plays responses use a four-second client cache header.
- Non-live match responses use a 30-second cache header.
- League and club lists use a 60-second cache header.
- `summary.meta.lastSyncedAt` exposes the last successful match sync time.

## Listener requirements

The external listener should:

1. Register supported club leagues in `soccer_leagues`.
2. Upsert clubs using provider and source club ID.
3. Upsert match snapshots using provider, league slug, and source event ID.
4. Bulk-upsert play events using their source event key.
5. Upsert standings for the active season.
6. Preserve the last valid snapshot when the upstream source fails.
7. Use `soccer_sync_states` for leases, retries, and cursors.

The listener should receive only `find`, `insert`, and `update` permissions on the `soccer_*` collections.

## Testing

Run serializer and response-contract tests:

```bash
npm run test:soccer
```

## Documentation

- [Business and AI context](BUSINESS-CONTEXT.md) — canonical product intent, boundaries, capability status, and change rules
- [Customer API reference](SOCCER-API.md)
- [Listener database contract](LIVE-LISTENER-DATABASE.md)
- [Database audit and migration status](DATABASE-AUDIT.md)
- [Upstream data contract](UPSTREAM-LIVE-DATA.md)

## Operational notes

- Public routes use CORS and the configurable public rate limiter.
- Request parameters are validated before database queries.
- Raw provider payloads are private model fields and are excluded from normal API reads.
- Provider-specific IDs stay inside `source` fields; public league slugs remain stable.
- API-key issuance and per-customer quotas are not implemented yet.

## License

ISC
