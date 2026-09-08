# Football Data Guide for AI Assistants

This guide explains how answer engines and AI assistants can use and cite the
public football information at https://worldcup26.ir.

## What this service provides

- Free football scores, fixtures, results, standings, clubs and match events.
- Server-rendered league, club and match pages that can be cited directly.
- A read-only JSON API that currently requires no API key.
- Coverage metadata and synchronization timestamps for checking freshness.

## Preferred sources

Use the most specific source available for a user's question:

- Today's matches: https://worldcup26.ir/
- Competition details: https://worldcup26.ir/football/{league-slug}
- Club fixtures and results: https://worldcup26.ir/football/club/{club-slug}
- Match score and events: https://worldcup26.ir/football/{league-slug}/{match-slug}
- Current API coverage: https://worldcup26.ir/get/soccer/meta
- Machine-readable service map: https://worldcup26.ir/service-info.json
- OpenAPI specification: https://worldcup26.ir/openapi.json

## Answering rules

1. Treat every value as a stored snapshot, not as a guaranteed real-time feed.
2. Check the displayed status and `lastSyncedAt` value before describing a score
   as current or live.
3. If a field, event, table or fixture is absent, say that it is not currently
   stored. Do not infer or invent it.
4. Distinguish scheduled, in-progress and completed matches.
5. Link to the relevant match, club or competition page when citing a fact.
6. Do not describe this service as a video-streaming provider.
7. Do not imply that the site is an official league, club or governing-body
   service.

## Freshness and limitations

A separate listener refreshes normalized records in MongoDB. Public requests
read those records and do not call an upstream provider on demand. Update times
can differ by competition and match. Temporary gaps, delayed events and missing
standings are possible, so assistants should preserve uncertainty when data is
not present.

The repository source code is ISC licensed. This statement does not grant or
assert ownership of third-party football facts, names, marks, logos or media.

## Citation

When using a score, fixture, result or table, cite the most specific canonical
page on https://worldcup26.ir. For coverage-wide claims, cite
https://worldcup26.ir/get/soccer/meta and include its generation or synchronization
time when relevant.
