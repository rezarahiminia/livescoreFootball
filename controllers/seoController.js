const fs = require('fs');
const path = require('path');

const SoccerClub = require('../models/soccerClub');
const SoccerLeague = require('../models/soccerLeague');
const SoccerMatch = require('../models/soccerMatch');
const SoccerMatchEvent = require('../models/soccerMatchEvent');
const SoccerStanding = require('../models/soccerStanding');
const SoccerSyncState = require('../models/soccerSyncState');
const {
    clubUrl,
    matchSlugFor,
    matchUrl,
    renderSeoPage,
    slugifyCountry
} = require('../services/seoRenderer');
const { inferLeagueCountry } = require('../services/soccerSerializer');

const PAGE_TEMPLATE = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
const LEAGUE_PATTERN = /^[a-z0-9][a-z0-9._-]{0,63}$/;
const COUNTRY_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;
const CLUB_PATTERN = /^[a-z0-9][a-z0-9._-]{0,79}$/;
const MATCH_SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,159}$/;
const EVENT_ID_PATTERN = /^[a-z0-9]{1,32}$/;
// Google allows 50k URLs per sitemap; chunk well below that so a growing match
// archive never silently overflows a single file.
const SITEMAP_CHUNK = 20000;

function siteUrl(req) {
    const configuredUrl = process.env.PUBLIC_SITE_URL || process.env.API_URL;
    if (configuredUrl) {
        try {
            const url = new URL(String(configuredUrl));
            if (['http:', 'https:'].includes(url.protocol)) return url.origin;
        } catch {}
    }
    if (process.env.NODE_ENV === 'production') return 'https://worldcup26.ir';
    return `${req.protocol}://${req.get('host')}`.replace(/\/$/, '');
}

function utcScoreboardDate(date = new Date()) {
    return date.toISOString().slice(0, 10).replace(/-/g, '');
}

function xmlEscape(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

async function activeLeagues() {
    const leagues = await SoccerLeague.find({ active: true })
        .sort({ sort_order: 1, name: 1 })
        .select('slug name abbreviation country kind season last_synced_at')
        .lean();
    return leagues.map(league => ({ ...league, country: inferLeagueCountry(league) }));
}

async function availableLeagues() {
    const minimumSeason = new Date().getUTCFullYear() - 1;
    const [catalog, leagueSlugsWithMatches, leagueSlugsWithStandings] = await Promise.all([
        activeLeagues(),
        SoccerMatch.distinct('league_slug'),
        SoccerStanding.distinct('league_slug', { season_year: { $gte: minimumSeason } })
    ]);
    const availableSlugs = new Set(leagueSlugsWithMatches);
    const standingSlugs = new Set(leagueSlugsWithStandings);
    return catalog
        .filter(league => availableSlugs.has(league.slug))
        .filter(league => !league.season?.year || Number(league.season.year) >= minimumSeason)
        .map(league => ({ ...league, hasStandings: standingSlugs.has(league.slug) }));
}

function attachLeagueNames(matches, leagues) {
    const bySlug = new Map(leagues.map(league => [league.slug, league]));
    return matches.map(match => ({ ...match, league: bySlug.get(match.league_slug) }));
}

async function currentMatchContent(leagues) {
    const slugs = leagues.map(league => league.slug);
    if (!slugs.length) return { todayMatches: [], recentMatches: [] };

    const [todayMatches, recentMatches] = await Promise.all([
        SoccerMatch.find({
            league_slug: { $in: slugs },
            scoreboard_date: utcScoreboardDate()
        })
            .sort({ date: 1 })
            .select('league_slug source date status home away last_synced_at')
            .lean(),
        SoccerMatch.find({
            league_slug: { $in: slugs },
            'status.state': 'post'
        })
            .sort({ date: -1 })
            .limit(12)
            .select('league_slug source date status home away last_synced_at')
            .lean()
    ]);

    return {
        todayMatches: attachLeagueNames(todayMatches, leagues),
        recentMatches: attachLeagueNames(recentMatches, leagues)
    };
}

function standingValue(stats, names) {
    for (const name of names) {
        if (stats instanceof Map && stats.has(name)) return stats.get(name);
        if (stats && Object.prototype.hasOwnProperty.call(stats, name)) return stats[name];
    }
    return null;
}

function findStandingRow(standings, clubId) {
    for (const group of standings || []) {
        const entry = (group.entries || []).find(item => String(item.club?.source_id || '') === String(clubId));
        if (entry) {
            return {
                rank: entry.rank || null,
                points: standingValue(entry.stats, ['points']),
                played: standingValue(entry.stats, ['gamesPlayed', 'played']),
                groupName: group.group_name || '',
                leagueSlug: group.league_slug || ''
            };
        }
    }
    return null;
}

function lastmodTag(value) {
    const date = new Date(value);
    if (!value || Number.isNaN(date.getTime())) return '';
    return `\n    <lastmod>${date.toISOString()}</lastmod>`;
}

function sendSitemap(res, entries) {
    const urls = entries.map(entry => `  <url>
    <loc>${xmlEscape(entry.loc)}</loc>${lastmodTag(entry.lastmod)}
  </url>`).join('\n');

    res.type('application/xml');
    res.set('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
    return res.send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`);
}

function sendSitemapIndex(res, locations, lastmod) {
    const items = locations.map(loc => `  <sitemap>
    <loc>${xmlEscape(loc)}</loc>${lastmodTag(lastmod)}
  </sitemap>`).join('\n');

    res.type('application/xml');
    res.set('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
    return res.send(`<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${items}
</sitemapindex>`);
}

function sitemapUnavailable(res) {
    res.status(503);
    res.set('Retry-After', '60');
    res.set('X-Robots-Tag', 'noindex');
    return res.type('text/plain').send('Sitemap temporarily unavailable.');
}

function sitemapNotFound(res) {
    res.status(404);
    res.set('X-Robots-Tag', 'noindex');
    return res.type('text/plain').send('Sitemap not found.');
}

async function latestSyncDate() {
    const sync = await SoccerSyncState.findOne({ status: 'healthy' })
        .sort({ last_success_at: -1 })
        .select('last_success_at')
        .lean();
    return sync?.last_success_at || null;
}

function renderResponse(res, context, status = 200) {
    res.status(status);
    res.type('html');
    res.set('Cache-Control', status === 200 ? 'public, max-age=60, stale-while-revalidate=300' : 'no-store');
    if (status !== 200) res.set('X-Robots-Tag', 'noindex, nofollow');
    return res.send(renderSeoPage(PAGE_TEMPLATE, context));
}

function renderNotFound(req, res) {
    return renderResponse(res, {
        kind: 'notFound',
        baseUrl: siteUrl(req),
        canonical: `${siteUrl(req)}${req.path}`,
        leagues: []
    }, 404);
}

function renderUnavailable(req, res) {
    res.set('Retry-After', '60');
    return renderResponse(res, { kind: 'unavailable', baseUrl: siteUrl(req), leagues: [] }, 503);
}

function redirectToCanonical(req, res, canonicalPath) {
    if (req.path !== canonicalPath || Object.keys(req.query).length) {
        res.redirect(301, canonicalPath);
        return true;
    }
    return false;
}

module.exports = app => {
    app.get('/', async(req, res) => {
        const legacyLeague = String(req.query.league || '').toLowerCase();
        if (LEAGUE_PATTERN.test(legacyLeague)) {
            return res.redirect(301, `/football/${encodeURIComponent(legacyLeague)}`);
        }

        try {
            const leagues = await availableLeagues();
            const matches = await currentMatchContent(leagues);
            return renderResponse(res, {
                kind: 'home',
                baseUrl: siteUrl(req),
                leagues,
                ...matches,
                generatedAt: new Date()
            });
        } catch (error) {
            console.warn('Unable to load SEO league directory:', error.message);
            return renderUnavailable(req, res);
        }
    });

    app.get('/football/country/:countrySlug', async(req, res, next) => {
        const requestedCountry = String(req.params.countrySlug || '').toLowerCase();
        if (!COUNTRY_PATTERN.test(requestedCountry)) return renderNotFound(req, res);
        if (redirectToCanonical(req, res, `/football/country/${requestedCountry}`)) return;

        try {
            const catalog = await availableLeagues();
            const leagues = catalog.filter(league => slugifyCountry(league.country || 'International') === requestedCountry);
            if (!leagues.length) return renderNotFound(req, res);
            const matches = await currentMatchContent(leagues);

            return renderResponse(res, {
                kind: 'country',
                baseUrl: siteUrl(req),
                country: leagues[0].country || 'International',
                leagues,
                ...matches,
                generatedAt: new Date()
            });
        } catch (error) {
            console.warn('Unable to load country SEO page:', error.message);
            return renderUnavailable(req, res);
        }
    });

    app.get('/football/club/:clubSlug', async(req, res) => {
        const requestedClub = String(req.params.clubSlug || '').toLowerCase();
        if (!CLUB_PATTERN.test(requestedClub)) return renderNotFound(req, res);
        if (redirectToCanonical(req, res, `/football/club/${requestedClub}`)) return;

        try {
            const club = await SoccerClub.findOne({ slug: requestedClub, active: true })
                .select('source slug name display_name short_display_name abbreviation country city logo logos venue founded_year league_slugs last_synced_at')
                .lean();
            if (!club) return renderNotFound(req, res);

            const clubId = String(club.source?.club_id || '');
            if (!clubId) return renderNotFound(req, res);

            const catalog = await availableLeagues();
            const leagues = catalog.filter(league => (club.league_slugs || []).includes(league.slug));
            // A club with no live competition left would only produce a dead-end
            // page, so it stays out of the index.
            if (!leagues.length) return renderNotFound(req, res);

            const leagueSlugs = leagues.map(league => league.slug);
            const clubFilter = {
                league_slug: { $in: leagueSlugs },
                $or: [{ 'home.source_id': clubId }, { 'away.source_id': clubId }]
            };

            const [upcomingMatches, recentMatches, matchCount, standings] = await Promise.all([
                SoccerMatch.find({
                    ...clubFilter,
                    'status.state': { $in: ['pre', 'in'] },
                    date: { $gte: new Date(Date.now() - 6 * 60 * 60 * 1000) }
                })
                    .sort({ date: 1 })
                    .limit(8)
                    .select('league_slug source date status home away')
                    .lean(),
                SoccerMatch.find({ ...clubFilter, 'status.state': 'post' })
                    .sort({ date: -1 })
                    .limit(8)
                    .select('league_slug source date status home away')
                    .lean(),
                SoccerMatch.countDocuments(clubFilter),
                SoccerStanding.find({ league_slug: { $in: leagueSlugs } })
                    .sort({ season_year: -1 })
                    .select('league_slug season_year group_name entries')
                    .lean()
            ]);

            const standingRow = findStandingRow(standings, clubId);

            return renderResponse(res, {
                kind: 'club',
                baseUrl: siteUrl(req),
                club,
                leagues,
                upcomingMatches: attachLeagueNames(upcomingMatches, catalog),
                recentMatches: attachLeagueNames(recentMatches, catalog),
                matchCount,
                standingRow,
                generatedAt: new Date()
            });
        } catch (error) {
            console.warn('Unable to load club SEO page:', error.message);
            return renderUnavailable(req, res);
        }
    });

    app.get('/football-api', async(req, res) => {
        if (redirectToCanonical(req, res, '/football-api')) return;
        try {
            const leagues = await availableLeagues();
            return renderResponse(res, {
                kind: 'api',
                baseUrl: siteUrl(req),
                leagues,
                generatedAt: new Date()
            });
        } catch (error) {
            console.warn('Unable to load football API landing page:', error.message);
            return renderUnavailable(req, res);
        }
    });

    app.get('/football/:leagueSlug', async(req, res, next) => {
        const requestedLeague = String(req.params.leagueSlug || '').toLowerCase();
        if (!LEAGUE_PATTERN.test(requestedLeague)) return renderNotFound(req, res);
        if (redirectToCanonical(req, res, `/football/${requestedLeague}`)) return;

        try {
            const catalog = await availableLeagues();
            const league = catalog.find(item => item.slug === requestedLeague);
            if (!league) return renderNotFound(req, res);

            const relatedLeagues = catalog
                .filter(item => item.slug !== requestedLeague && item.country === league.country)
                .slice(0, 8);
            const standingFilter = { league_slug: requestedLeague };
            if (league.season?.year) standingFilter.season_year = Number(league.season.year);
            const [upcomingMatches, recentMatches, matchCount, standings] = await Promise.all([
                SoccerMatch.find({
                    league_slug: requestedLeague,
                    'status.state': { $in: ['pre', 'in'] },
                    date: { $gte: new Date(Date.now() - 6 * 60 * 60 * 1000) }
                })
                    .sort({ date: 1 })
                    .limit(8)
                    .select('league_slug source date status home away')
                    .lean(),
                SoccerMatch.find({ league_slug: requestedLeague, 'status.state': 'post' })
                    .sort({ date: -1 })
                    .limit(8)
                    .select('league_slug source date status home away')
                    .lean(),
                SoccerMatch.countDocuments({ league_slug: requestedLeague }),
                SoccerStanding.find(standingFilter)
                    .sort({ group_name: 1 })
                    .select('season_year group_name entries last_synced_at')
                    .lean()
            ]);

            return renderResponse(res, {
                kind: 'league',
                baseUrl: siteUrl(req),
                league,
                upcomingMatches,
                recentMatches,
                relatedLeagues,
                matchCount,
                standings,
                generatedAt: new Date()
            });
        } catch (error) {
            console.warn('Unable to load league SEO page:', error.message);
            return renderUnavailable(req, res);
        }
    });

    app.get('/football/:leagueSlug/:matchSlug', async(req, res) => {
        const requestedLeague = String(req.params.leagueSlug || '').toLowerCase();
        const requestedSlug = String(req.params.matchSlug || '').toLowerCase();
        if (!LEAGUE_PATTERN.test(requestedLeague) || !MATCH_SLUG_PATTERN.test(requestedSlug)) {
            return renderNotFound(req, res);
        }

        // The readable part of the slug can drift after a club rename, so the
        // trailing event id is what actually resolves the match.
        const eventId = requestedSlug.split('-').pop();
        if (!EVENT_ID_PATTERN.test(eventId)) return renderNotFound(req, res);

        try {
            const match = await SoccerMatch.findOne({
                league_slug: requestedLeague,
                'source.event_id': eventId
            })
                .select('league_slug source date status home away venue attendance season name last_synced_at play_by_play_available')
                .lean();
            if (!match) return renderNotFound(req, res);

            const canonicalPath = `/football/${requestedLeague}/${matchSlugFor(match)}`;
            if (redirectToCanonical(req, res, canonicalPath)) return;

            const catalog = await availableLeagues();
            const league = catalog.find(item => item.slug === requestedLeague);
            if (!league) return renderNotFound(req, res);

            const homeId = String(match.home?.source_id || '');
            const awayId = String(match.away?.source_id || '');

            const [events, homeClub, awayClub, headToHead] = await Promise.all([
                SoccerMatchEvent.find({
                    league_slug: requestedLeague,
                    'source.event_id': eventId,
                    valid: true
                })
                    .sort({ sequence: 1 })
                    .limit(120)
                    .select('sequence event_type text alternative_text clock period home_score away_score club flags')
                    .lean(),
                homeId
                    ? SoccerClub.findOne({ 'source.club_id': homeId, slug: { $ne: '' } }).select('slug display_name name').lean()
                    : null,
                awayId
                    ? SoccerClub.findOne({ 'source.club_id': awayId, slug: { $ne: '' } }).select('slug display_name name').lean()
                    : null,
                homeId && awayId
                    ? SoccerMatch.find({
                        'status.state': 'post',
                        'source.event_id': { $ne: eventId },
                        $or: [
                            { 'home.source_id': homeId, 'away.source_id': awayId },
                            { 'home.source_id': awayId, 'away.source_id': homeId }
                        ]
                    })
                        .sort({ date: -1 })
                        .limit(5)
                        .select('league_slug source date status home away')
                        .lean()
                    : []
            ]);

            return renderResponse(res, {
                kind: 'match',
                baseUrl: siteUrl(req),
                match,
                league,
                events,
                homeClub,
                awayClub,
                headToHead: attachLeagueNames(headToHead, catalog),
                generatedAt: new Date()
            });
        } catch (error) {
            console.warn('Unable to load match SEO page:', error.message);
            return renderUnavailable(req, res);
        }
    });

    app.get('/robots.txt', (req, res) => {
        const baseUrl = siteUrl(req);
        res.type('text/plain');
        res.set('Cache-Control', 'public, max-age=3600');
        const disallow = [
            'Disallow: /get/',
            'Disallow: /health',
            'Disallow: /api/health',
            'Disallow: /openapi.json',
            'Disallow: /service-info.json'
        ];
        // Answer engines are welcome: the score and league pages are the product,
        // and being cited in AI answers is a growth channel, not a leak.
        const answerEngines = [
            'GPTBot',
            'OAI-SearchBot',
            'ChatGPT-User',
            'ClaudeBot',
            'Claude-User',
            'PerplexityBot',
            'Perplexity-User',
            'Google-Extended',
            'Applebot-Extended',
            'CCBot',
            'Bingbot'
        ];

        return res.send([
            'User-agent: *',
            'Allow: /',
            ...disallow,
            '',
            ...answerEngines.flatMap(agent => [`User-agent: ${agent}`, 'Allow: /', ...disallow, '']),
            `Sitemap: ${baseUrl}/sitemap.xml`,
            ''
        ].join('\n'));
    });

    app.get('/llms.txt', async(req, res) => {
        const baseUrl = siteUrl(req);
        res.type('text/plain; charset=utf-8');
        try {
            const leagues = await availableLeagues();
            const countries = [...new Set(leagues.map(league => league.country).filter(Boolean))]
                .sort((a, b) => a.localeCompare(b, 'en'));

            res.set('Cache-Control', 'public, max-age=1800, stale-while-revalidate=3600');
            return res.send([
                '# Free Football Live Scores',
                '',
                `> Free live football scores, fixtures, results, league tables and match events for ${leagues.length} verified ${leagues.length === 1 ? 'competition' : 'competitions'}, plus an open JSON REST API that needs no API key.`,
                '',
                'All score and fixture data is free to view and free to query. There is no',
                'paywall, no account and no video streaming. Data is read from MongoDB that a',
                'separate listener keeps refreshed, so responses reflect stored snapshots and',
                'each response reports its own freshness.',
                '',
                '## Key pages',
                '',
                `- [Football live scores today](${baseUrl}/): today's matches, live states and latest results across every covered competition`,
                `- [Free football API](${baseUrl}/football-api): endpoints, limits and JSON examples`,
                `- [Interactive API documentation](${baseUrl}/api-docs/): OpenAPI/Swagger reference`,
                '',
                '## Countries',
                '',
                ...countries.map(country => `- [${country} football](${baseUrl}/football/country/${slugifyCountry(country)})`),
                '',
                '## Competitions',
                '',
                ...leagues.map(league => `- [${league.name}](${baseUrl}/football/${encodeURIComponent(league.slug)})${league.season?.display_name ? ` — ${league.season.display_name}` : ''}`),
                '',
                '## URL patterns',
                '',
                `- League: ${baseUrl}/football/{league-slug}`,
                `- Match: ${baseUrl}/football/{league-slug}/{home}-vs-{away}-{event-id}`,
                `- Club: ${baseUrl}/football/club/{club-slug}`,
                `- Country: ${baseUrl}/football/country/{country-slug}`,
                '',
                '## API quick reference',
                '',
                'No API key. JSON over HTTPS. Fair-use rate limits apply.',
                '',
                `- Leagues: GET ${baseUrl}/get/soccer/leagues`,
                `- Live scoreboard: GET ${baseUrl}/get/soccer/{league}/scoreboard?dates=YYYYMMDD`,
                `- Fixtures: GET ${baseUrl}/get/soccer/{league}/fixtures?status=all`,
                `- Standings: GET ${baseUrl}/get/soccer/{league}/standings?season=YYYY`,
                `- Clubs: GET ${baseUrl}/get/soccer/{league}/clubs`,
                `- Match summary: GET ${baseUrl}/get/soccer/{league}/summary?event={eventId}`,
                `- Coverage and freshness: GET ${baseUrl}/get/soccer/meta`,
                '',
                '## Licence and attribution',
                '',
                'Source code is ISC licensed and published at',
                'https://github.com/rezarahiminia/livescoreFootball',
                `When citing scores or tables, please link to the relevant page on ${baseUrl}.`,
                ''
            ].join('\n'));
        } catch (error) {
            console.warn('Unable to build llms.txt:', error.message);
            res.status(503);
            res.set('Retry-After', '60');
            return res.send('Temporarily unavailable.');
        }
    });

    app.get('/manifest.webmanifest', (req, res) => {
        res.type('application/manifest+json');
        res.set('Cache-Control', 'public, max-age=86400');
        return res.json({
            name: 'Free Football Live Scores',
            short_name: 'Live Football',
            description: 'Free football live scores, fixtures, results and league tables.',
            start_url: '/',
            scope: '/',
            display: 'standalone',
            background_color: '#07101d',
            theme_color: '#07101d',
            icons: [
                { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
                { src: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }
            ]
        });
    });

    app.get('/sitemap.xml', async(req, res) => {
        const baseUrl = siteUrl(req);
        try {
            const [fallbackDate, leagues] = await Promise.all([latestSyncDate(), availableLeagues()]);
            const leagueSlugs = leagues.map(league => league.slug);
            // Count exactly what the child sitemaps will list, so the index never
            // advertises a page that then 404s.
            const [matchCount, clubCount] = await Promise.all([
                SoccerMatch.countDocuments({ league_slug: { $in: leagueSlugs } }),
                SoccerClub.countDocuments({ active: true, slug: { $ne: '' }, league_slugs: { $in: leagueSlugs } })
            ]);
            const matchPages = Math.max(1, Math.ceil(matchCount / SITEMAP_CHUNK));
            const children = [
                `${baseUrl}/sitemap-pages.xml`,
                `${baseUrl}/sitemap-leagues.xml`,
                ...(clubCount ? [`${baseUrl}/sitemap-clubs.xml`] : []),
                ...Array.from({ length: matchPages }, (_, index) => `${baseUrl}/sitemap-matches-${index + 1}.xml`)
            ];

            return sendSitemapIndex(res, children, fallbackDate);
        } catch (error) {
            console.warn('Unable to build sitemap index:', error.message);
            return sitemapUnavailable(res);
        }
    });

    app.get('/sitemap-pages.xml', async(req, res) => {
        const baseUrl = siteUrl(req);
        try {
            const [leagues, fallbackDate] = await Promise.all([availableLeagues(), latestSyncDate()]);
            const countries = [...new Set(leagues.map(league => league.country).filter(Boolean))]
                .sort((a, b) => a.localeCompare(b, 'en'));

            return sendSitemap(res, [
                { loc: `${baseUrl}/`, lastmod: fallbackDate },
                { loc: `${baseUrl}/football-api`, lastmod: fallbackDate },
                ...countries.map(country => ({
                    loc: `${baseUrl}/football/country/${slugifyCountry(country)}`,
                    lastmod: fallbackDate
                })),
                { loc: `${baseUrl}/api-docs/`, lastmod: fallbackDate }
            ]);
        } catch (error) {
            console.warn('Unable to build page sitemap:', error.message);
            return sitemapUnavailable(res);
        }
    });

    app.get('/sitemap-leagues.xml', async(req, res) => {
        const baseUrl = siteUrl(req);
        try {
            const [leagues, fallbackDate] = await Promise.all([availableLeagues(), latestSyncDate()]);
            return sendSitemap(res, leagues.map(league => ({
                loc: `${baseUrl}/football/${encodeURIComponent(league.slug)}`,
                lastmod: league.last_synced_at || fallbackDate
            })));
        } catch (error) {
            console.warn('Unable to build league sitemap:', error.message);
            return sitemapUnavailable(res);
        }
    });

    app.get('/sitemap-clubs.xml', async(req, res) => {
        const baseUrl = siteUrl(req);
        try {
            const [leagues, fallbackDate] = await Promise.all([availableLeagues(), latestSyncDate()]);
            const leagueSlugs = leagues.map(league => league.slug);
            // Only clubs whose competition is still live get a crawlable URL,
            // matching what the club route is willing to render.
            const clubs = await SoccerClub.find({
                active: true,
                slug: { $ne: '' },
                league_slugs: { $in: leagueSlugs }
            })
                .sort({ slug: 1 })
                .limit(SITEMAP_CHUNK)
                .select('slug last_synced_at')
                .lean();

            return sendSitemap(res, clubs.map(club => ({
                loc: clubUrl(baseUrl, club),
                lastmod: club.last_synced_at || fallbackDate
            })));
        } catch (error) {
            console.warn('Unable to build club sitemap:', error.message);
            return sitemapUnavailable(res);
        }
    });

    app.get('/sitemap-matches-:page.xml', async(req, res) => {
        const baseUrl = siteUrl(req);
        const page = Number(req.params.page);
        if (!Number.isInteger(page) || page < 1 || page > 500) return sitemapNotFound(res);

        try {
            const [leagues, fallbackDate] = await Promise.all([availableLeagues(), latestSyncDate()]);
            const leagueSlugs = leagues.map(league => league.slug);
            // Sorting on the _id index keeps pagination stable and avoids an
            // in-memory sort as the match archive grows.
            const matches = await SoccerMatch.find({ league_slug: { $in: leagueSlugs } })
                .sort({ _id: 1 })
                .skip((page - 1) * SITEMAP_CHUNK)
                .limit(SITEMAP_CHUNK)
                .select('league_slug source home away last_synced_at')
                .lean();
            if (!matches.length) return sitemapNotFound(res);

            return sendSitemap(res, matches.map(match => ({
                loc: matchUrl(baseUrl, match),
                lastmod: match.last_synced_at || fallbackDate
            })));
        } catch (error) {
            console.warn('Unable to build match sitemap:', error.message);
            return sitemapUnavailable(res);
        }
    });
};
