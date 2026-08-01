# Upstream Live Data Contract

This document defines the provider-neutral data requirements for the external
listener. It intentionally avoids coupling the public API to a particular data
vendor, endpoint layout, or response format.

## System boundary

The listener is responsible for fetching, validating, and normalizing external
football data. The customer API in this repository reads only normalized
MongoDB documents and must never call an external service during a customer
request.

```text
External football data
          │
          ▼
Listener: fetch, validate, normalize, retry
          │
          ▼
MongoDB soccer_* collections
          │
          ▼
Customer API: read and serialize
```

## Required upstream capabilities

For every supported league, the listener should acquire:

- league identity, country, season, and availability;
- club identity, branding, venue, roster, and coach when available;
- fixtures, live match state, scores, venue, and broadcast metadata;
- completed results and match statistics;
- standings or competition groups;
- goals, cards, substitutions, and other important timeline events;
- source timestamps needed to report freshness.

Missing upstream fields must remain absent or null after normalization. The
listener must not fabricate values to make a response look complete.

## Normalized identity

Provider-specific identifiers belong only inside `source` objects:

```json
{
  "source": {
    "provider": "upstream",
    "source_id": "700",
    "event_key": "49483413",
    "updated_at": "2026-07-26T12:00:00.000Z"
  }
}
```

Public consumers use stable league slugs and string match IDs. Changing the
external vendor must not require changing public routes or response fields.

## Fetch and validation rules

The listener must:

1. Apply request timeouts, bounded retries, and backoff.
2. Validate response status, content type, and required identifiers.
3. Normalize all identifiers as strings.
4. Use idempotent upserts and stable unique keys.
5. Preserve the last valid snapshot when a fetch or validation step fails.
6. Record cursors, leases, failures, and successful sync times in
   `soccer_sync_states`.
7. Keep raw payloads private and short-lived when retained for diagnostics.
8. Avoid logging credentials or complete sensitive request headers.

## Read-path isolation

Controllers, serializers, middleware, and browser code in this repository must
not contain acquisition logic. A missing MongoDB document produces a truthful
empty or not-found response; it must not trigger a live external request.

## League rollout

England and Spain are the first production targets. A league is ready for
customer access only after fixtures, results, clubs, standings, match details,
freshness metadata, and failure behavior have been verified end to end.
Additional countries are enabled one at a time using the same contract.

The collection schemas, indexes, and upsert keys are documented in
[LIVE-LISTENER-DATABASE.md](LIVE-LISTENER-DATABASE.md).
