# Soccer Clubs Data API — Business and AI Context

Document status: canonical product context
Last reviewed: 2026-07-22
Audience: customers, product owners, developers, operators, and AI coding agents

## 1. Executive summary

Soccer Clubs Data API is a customer-facing football data service. A customer selects a country and league, views fixtures or completed results, opens league standings, and selects a match to see its score, status, venue, statistics, goal scorers, substitutions, and timeline.

This repository is the **read and delivery layer**. It must not fetch an upstream provider while serving a customer request. A separate listener application fetches upstream data, normalizes it, and updates the shared MongoDB database. This API reads that stored data and returns a stable, documented response.

The product's primary model is multi-league club football. England and Spain are the initial markets, followed by country-by-country expansion. International competitions may still be supported when explicitly requested with the league catalog filters.

## 2. Product promise

The service aims to provide:

- one stable API over football data stored in our database;
- customer isolation from upstream latency, downtime, and response-shape changes;
- selectable countries and leagues;
- schedules, live scores, completed results, standings, clubs, and match details;
- provider-compatible response shapes where they are useful to existing consumers;
- explicit freshness and coverage information instead of fabricated data.

The product does **not** promise that every league has every feature. Availability depends on what the listener has successfully normalized and stored. An empty array means that no normalized customer data is currently available for that section; it must not be silently filled from an upstream request.

## 3. Actors and responsibilities

| Actor | Responsibility | Must not do |
|---|---|---|
| Customer | Calls the documented API and renders returned data | Call or depend on the upstream provider through this service |
| Web application | Uses only public Swagger endpoints | Read MongoDB directly or expose raw snapshots |
| Customer API — this repository | Validates requests, reads MongoDB, serializes stable responses, applies cache/rate limits | Poll an upstream provider or mutate live football data during reads |
| External listener | Polls upstream services, validates responses, normalizes and upserts MongoDB documents | Serve customer traffic or erase the last valid snapshot on an upstream failure |
| MongoDB | Shared hand-off boundary between listener and API | Act as a public customer interface |
| Operator | Monitors sync health, coverage, errors, and data freshness | Treat an HTTP 200 with an empty feature as proof that the listener stored that feature |

## 4. System boundary

```text
Upstream football provider
          │
          │ polling, retries, validation
          ▼
External listener project
          │
          │ normalized/idempotent MongoDB upserts
          ▼
soccer_* collections
          │
          │ read-only customer requests
          ▼
Soccer Clubs Data API
          │
          ├── Swagger / OpenAPI consumers
          └── English web application
```

The MongoDB schema is the integration contract between two independently deployed projects. Changes to field names, identifiers, or upsert keys are cross-project changes and must be documented before deployment.

## 5. Customer journey

The intended customer flow is:

1. Load service coverage from `GET /get/soccer/meta`.
2. Load selectable club competitions from `GET /get/soccer/leagues?kind=club&available=true`.
3. Select a country derived from each league's normalized `country` field.
4. Select a league using its stable `slug`.
5. View its schedule/results through `fixtures` and its table through `standings`.
6. Select a fixture using `event.id`.
7. Load match summary and important timeline events in parallel.
8. Refresh an open match every 15 seconds while its state is `in`.

The public website is English and left-to-right. Customer-facing labels, errors, metadata, and Swagger descriptions should remain English unless localization is introduced as a separate product feature.

## 6. Public capability matrix

| Capability | Public status | Primary stored source | Important condition |
|---|---|---|---|
| League discovery | Available | `soccer_leagues` | Only active leagues are public |
| Country selection | Available | Normalized league `country` | Inferred from slug only when missing |
| Fixtures and results | Available | `soccer_matches` | Completeness depends on listener coverage |
| Live scores/status | Available when stored | `soccer_matches` | Freshness depends on listener polling |
| Standings | Conditionally available | `soccer_standings` | Some leagues currently return no groups |
| Club catalog | Available with fallback | `soccer_clubs`, then match participants | Fallback has no guaranteed roster or coach |
| Match summary/statistics | Available when stored | `soccer_matches` | Missing sections remain empty/null |
| Goal scorers | Available when stored | `soccer_matches.key_events`, timeline | `scoringPlay=true`; athlete data may be optional |
| Important match timeline | Available when stored | `soccer_match_events` plus `key_events` | UI merges both sources |
| Substitutions | Available when stored | timeline participants plus match rosters | Accurate IN/OUT labels require participant or roster data |
| League top scorers | Not publicly available | No validated structured collection | Raw snapshots are internal and must not be exposed |

“Available when stored” is a deliberate business state. The API must return truthful absence rather than inventing a value or making an upstream call.

## 7. Public API map

Base path: `/get/soccer`

| Endpoint | Business use |
|---|---|
| `GET /meta` | Service capabilities, collection coverage, and latest successful sync |
| `GET /leagues` | Country/league selection catalog |
| `GET /{league}/fixtures` | Paginated schedule, live games, and results |
| `GET /{league}/scoreboard` | Date-specific scoreboard |
| `GET /{league}/standings` | League table or competition groups |
| `GET /{league}/clubs` | League club catalog |
| `GET /{league}/clubs/{clubId}` | Stored club, roster, and coach detail |
| `GET /{league}/events/{eventId}` | Match score, teams, summary, key events, statistics, and rosters |
| `GET /{league}/events/{eventId}/plays` | Stored play-by-play timeline |
| `GET /{league}/events/{eventId}/plays?important=true` | Goals, cards, and substitutions without ordinary passes/actions |

Swagger UI at `/api-docs/` and `/openapi.json` are the executable customer contract. This document explains intent and business rules; it does not replace OpenAPI request/response validation.

## 8. Match-detail composition rules

The match drawer is composed from two public calls:

```text
events/{eventId}                       → summary, stats, keyEvents, rosters
events/{eventId}/plays?important=true  → stored goals, cards, substitutions
```

The UI merges both event sources chronologically and removes obvious duplicates. It must not discard the play feed merely because some `keyEvents` exist, because summary key events can include goals/cards while omitting substitutions.

### Goals

- A goal is identified by `scoringPlay: true` or a normalized goal event type.
- Prefer `keyEvents[].athletesInvolved[]` for scorer identity.
- Team identity is resolved against the match's home/away competitor IDs.
- Penalty and own-goal flags should be displayed when stored.

### Substitutions

- A substitution is identified by normalized type `substitution` or its substitution flag.
- Preferred event data includes `participants`, team, and clock.
- Preferred roster data includes `subbedIn`, `subbedOut`, `subbedInFor`, and `subbedOutFor`.
- The UI matches participant IDs to roster flags to determine player IN and player OUT.
- If roster flags are missing, participant order is only a compatibility fallback; the listener should store explicit relationships for reliable customer output.
- If the database contains neither substitution events nor roster substitution fields, the correct public result is “No substitutions have been stored for this match.”

## 9. Data ownership and source of truth

| Collection | Owner | Publicly read | Business meaning |
|---|---|---:|---|
| `soccer_leagues` | Listener/configuration | Yes | Supported selectable competitions |
| `soccer_clubs` | Listener | Yes | Stable club identity and optional roster/coach |
| `soccer_matches` | Listener | Yes | Match schedule, score, status, summary, statistics, key events |
| `soccer_match_events` | Listener | Yes | Normalized event timeline |
| `soccer_standings` | Listener | Yes | League/group tables |
| `soccer_sync_states` | Listener/operator | No | Polling state, lease, cursor, errors |
| `soccer_snapshots` | Listener/operator | No | Raw diagnostic/cache payloads; not a customer contract |

The API must not use `soccer_snapshots` as an implicit customer fallback. A new public feature must first receive a validated normalized model and collection/write contract.

## 10. Identifier rules

- `league` means the stable league slug, for example `esp.1`, `eng.1`, or `bra.1`.
- `uefa.champions` is intentionally grouped under the customer-facing country category `Other`; this explicit product override takes precedence over a stored or inferred country.
- Public match ID is the provider event ID serialized as a string.
- The canonical normalized event schema stores the match ID in `event_id` and the individual play ID in `source.event_key`.
- During listener migration, the API also supports documents where match ID is in `match_id` and the individual play ID is in `event_id`.
- IDs must not be converted to numbers in customer contracts; leading zeros and provider formats must remain safe.
- If both normalized and compatibility event shapes exist, avoid returning duplicate events.

## 11. Freshness and availability semantics

- Customer requests never trigger data acquisition.
- `summary.meta.lastSyncedAt` reports match freshness.
- `GET /meta` reports the latest healthy listener sync and current collection counts.
- Live responses use short cache headers, but a short cache does not guarantee a recent listener write.
- Non-live matches may use a longer client cache because their result is expected to be stable.
- Preserve the last valid stored match when upstream polling fails.
- An empty array and a failed sync are different states; consult sync state and freshness before diagnosing upstream completeness.
- No formal customer SLA, data-delay guarantee, or provider completeness guarantee is defined yet.

## 12. Customer trust and safety rules

The API and UI MUST:

- return only database-backed data;
- keep raw provider payloads private;
- validate league, event, date, pagination, and filter parameters;
- expose missing data honestly;
- keep the public web experience English;
- preserve stable public field names when internal schemas evolve;
- document newly public fields in Swagger and the written API reference;
- avoid breaking existing consumers without a versioning/migration decision.

The API and UI MUST NOT:

- call an upstream provider during a customer request;
- expose `soccer_snapshots`, sync leases, internal errors, or provider credentials;
- claim that a feature is available for a match solely because the provider says play-by-play is available;
- fabricate players, scores, standings, event times, or data freshness;

## 13. Known product gaps

- Per-customer API keys, plans, quotas, usage reporting, and billing are not implemented.
- Public routes currently use shared rate limits rather than customer-specific entitlements.
- League top scorers have no validated structured model or endpoint.
- Dedicated club documents and standings do not yet cover every league.
- Some matches have scoreboard/key-event data but no stored play events or rosters.
- Upstream licensing, redistribution terms, commercial attribution, and service SLA require separate business/legal decisions before a paid launch.

These gaps should not be hidden behind UI claims. They are roadmap items or commercial launch dependencies.

## 14. Diagnostic example: data availability is match-specific

On 2026-07-22, match `bra.1 / 401840810` (Chapecoense 4–2 Santos) contained score, statistics, and 12 goal/card key events, but had:

- zero matching documents in `soccer_match_events`;
- zero substitution events in `key_events`;
- an empty `rosters` response;
- no match snapshot containing substitution data.

Therefore the correct API/UI behavior at that time was to show no stored substitutions. The UI merge bug was separately fixed so future substitutions stored only in the play feed are not discarded. This is a historical diagnostic example, not a permanent assertion; always re-query the current database before making a new operational conclusion.

## 15. Change policy and definition of done

A customer-facing feature is complete only when all applicable items are true:

1. The business meaning and missing-data behavior are defined.
2. The listener write location, unique key, and normalization rules are documented.
3. The API reads MongoDB only and serializes a stable response.
4. Swagger/OpenAPI describes parameters and response fields.
5. The English web UI uses only Swagger-documented endpoints.
6. Empty, partial, live, and completed match states are handled.
7. Serializer/contract tests pass.
8. At least one real stored example is verified end to end.
9. Raw snapshots and internal sync fields remain private.
10. README, customer API docs, and this business context are updated when behavior changes.

## 16. Instructions for AI agents and new contributors

Before changing this project:

1. Read this document for product intent.
2. Read `SOCCER-API.md` for customer behavior.
3. Read `LIVE-LISTENER-DATABASE.md` before changing any shared database field.
4. Inspect `/openapi.json` or Swagger for the actual public contract.
5. Inspect current MongoDB data read-only before assuming a field is populated.
6. Distinguish an API/UI bug from missing listener data.
7. Do not add upstream HTTP calls to controllers, serializers, or browser code.
8. Do not expose raw snapshots to solve a missing normalized feature.
9. Update tests and documentation with every public behavior change.
10. Report verified facts, assumptions, and remaining data gaps separately.

When documentation disagrees, use this precedence:

1. Current OpenAPI and executable validation for request/response mechanics;
2. this document for business intent and boundaries;
3. `SOCCER-API.md` for customer examples;
4. `LIVE-LISTENER-DATABASE.md` for the listener write contract;
5. `DATABASE-AUDIT.md` only as a dated snapshot of observed coverage.

Do not reinterpret a dated audit count as a permanent business guarantee.

## 17. Documentation map

| Document/resource | Purpose |
|---|---|
| `BUSINESS-CONTEXT.md` | Canonical product intent, ownership, rules, gaps, and AI context |
| `README.md` | Repository overview and local operation |
| `SOCCER-API.md` | Customer-facing API behavior and examples |
| `LIVE-LISTENER-DATABASE.md` | Cross-project MongoDB write contract |
| `DATABASE-AUDIT.md` | Dated database coverage/migration findings |
| `UPSTREAM-LIVE-DATA.md` | Upstream data contract; not the public API contract |
| `/api-docs/` | Interactive Swagger UI |
| `/openapi.json` | Machine-readable executable API contract |
| `/service-info.json` | Lightweight service discovery |
| `/get/soccer/meta` | Current runtime coverage and freshness |

## 18. Glossary

- **Customer API**: This repository's public, database-backed HTTP interface.
- **Listener**: Separate writer application that polls and normalizes upstream football data.
- **Upstream**: an external football data provider.
- **Summary**: Match-level data stored in `soccer_matches`.
- **Key event**: Compact important event, typically a goal or card, stored with the match.
- **Play**: Individual timeline event stored in `soccer_match_events`.
- **Snapshot**: Raw/internal provider response retained for diagnostics or listener processing.
- **Coverage**: Presence/count of normalized stored data, not a guarantee of completeness.
- **Freshness**: Time since the listener last successfully updated data.
- **League slug**: Stable public competition identifier used in API paths.
