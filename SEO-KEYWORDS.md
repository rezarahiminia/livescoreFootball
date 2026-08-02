# SEO keyword map for worldcup26.ir

Last reviewed: 2026-08-02

This document maps one search intent to one useful page. It deliberately avoids
keyword stuffing: Google says unique titles, descriptions, crawlable links and
helpful page content matter, while the `meta keywords` tag is not a ranking
signal.

## Priority 1 — build authority here first

These broad terms match features that are already live:

| Keyword cluster | Primary page | Content to maintain |
|---|---|---|
| `football live scores` | `/` | Active leagues, live state, today's matches |
| `football live scores today` | `/` | Today's fixtures and live score freshness |
| `football fixtures today` | `/` | Current date, kickoff time and competition |
| `football results today` | `/` | Completed score and match detail links |
| `football league tables` / `football standings` | `/` | Links to verified tables by league |
| `free football API` | `/api-docs/` and GitHub README | JSON examples, limits, freshness, endpoint docs |
| `free football API GitHub` | GitHub repository | Clear project title, description, topics and examples |

Do not split these into many nearly identical thin pages until the root page has
search impressions and enough match content to justify them.

## Priority 2 — league pages with high intent

Each active competition automatically receives `/football/{league-slug}`. The
title, H1, description, schema and visible copy cover these patterns naturally:

### England

- `Premier League live scores`
- `Premier League live scores today`
- `Premier League fixtures` / `Premier League schedule`
- `Premier League results`
- `Premier League table` / `Premier League standings`
- `EFL Championship live scores`, fixtures and table
- `League One live scores`, fixtures and table
- `League Two live scores`, fixtures and table
- `FA Cup live scores`, fixtures and results
- `Carabao Cup live scores`, fixtures and results
- `Women's Super League live scores` and table

### Spain

- `LaLiga live scores`
- `LaLiga fixtures`
- `LaLiga results`
- `LaLiga table` / `LaLiga standings`
- `LaLiga 2 live scores` and standings
- `Copa del Rey live scores`, fixtures and results
- `Liga F live scores` and standings

The autocomplete patterns reviewed in August 2026 repeatedly included `live
scores today`, `fixtures`, `schedule`, `table`, `standings`, `results`, `stats`
and `games`. They are covered as related intent, not repeated mechanically.

## Priority 3 — developer/API searches

Use the GitHub README, Swagger descriptions and real code examples for:

- `free football API`
- `free football API for developers`
- `free football API GitHub`
- `free football API JSON`
- `free football API live score`
- `football fixtures API`
- `football standings API`
- `Premier League API`
- `LaLiga API`
- `open source football data API`

Add copy about rate limits, update frequency, sample responses and whether an API
key is required. These details answer the search intent better than repeating the
same phrase.

## Future keywords — publish only when the data is live

Create and index these pages after the listener has verified fixtures, scores and
standings for each competition:

1. `Champions League live scores`, fixtures, games, table and standings
2. `Serie A live scores`, fixtures and table
3. `Bundesliga live scores`, fixtures and table
4. `Ligue 1 live scores`, fixtures and table
5. `Europa League live scores`, fixtures and standings
6. Portugal, Netherlands, Turkey, Saudi Arabia, USA, Brazil and Argentina league clusters

Publishing empty pages early creates thin content and wastes crawl budget. The
dynamic route and sitemap already support new league records without another SEO
code change.

## Persian keyword opportunity

If Persian-speaking users are a target market, build real `/fa/` translations
before targeting these terms:

- `نتایج زنده فوتبال`
- `نتایج زنده فوتبال امروز`
- `برنامه بازی های امروز فوتبال`
- `نتایج لیگ برتر انگلیس`
- `جدول لیگ برتر انگلیس`
- `برنامه بازی های لیگ انگلیس`
- `نتایج لالیگا`
- `جدول لالیگا`
- `نتایج لیگ قهرمانان اروپا`
- `جدول لیگ قهرمانان اروپا`

Do not target `پخش زنده رایگان فوتبال` or English variants such as `watch free
football stream` unless the product actually provides licensed video. The current
service provides free scores and match data, not video streaming.

## On-page rules

1. Keep one descriptive H1 and one unique title/description per page.
2. Keep URLs stable and use the same URL in internal links, canonical tags and the sitemap.
3. Show real league-specific fixtures and results in server-rendered HTML.
4. Link every country page to its leagues and every league page back to its country.
5. Index active pages with useful data; return `404` plus `noindex` for unknown leagues.
6. Do not make unsupported claims such as free video streaming.

## After deployment

1. Add `https://worldcup26.ir/sitemap.xml` to Google Search Console.
2. Request indexing for `/`, `/football/eng.1` and `/football/esp.1` first.
3. Review queries, impressions, click-through rate and position every 28 days.
4. Improve pages already ranking in positions 5–20 before creating new generic articles.
5. Add match/team editorial pages only when each page can contain unique, useful data.

References: [Google SEO guide for developers](https://developers.google.com/search/docs/fundamentals/get-started-developers),
[title links](https://developers.google.com/search/docs/appearance/title-link),
[snippets and meta descriptions](https://developers.google.com/search/docs/appearance/snippet),
and [sitemaps](https://developers.google.com/search/docs/crawling-indexing/sitemaps/overview).
