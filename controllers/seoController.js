const fs = require('fs');
const path = require('path');

const SoccerLeague = require('../models/soccerLeague');
const SoccerMatch = require('../models/soccerMatch');
const SoccerStanding = require('../models/soccerStanding');
const SoccerSyncState = require('../models/soccerSyncState');
const { renderSeoPage, slugifyCountry } = require('../services/seoRenderer');
const { inferLeagueCountry } = require('../services/soccerSerializer');

const PAGE_TEMPLATE = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
const LEAGUE_PATTERN = /^[a-z0-9][a-z0-9._-]{0,63}$/;
const COUNTRY_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;

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
            .select('league_slug date status home away last_synced_at')
            .lean(),
        SoccerMatch.find({
            league_slug: { $in: slugs },
            'status.state': 'post'
        })
            .sort({ date: -1 })
            .limit(12)
            .select('league_slug date status home away last_synced_at')
            .lean()
    ]);

    return {
        todayMatches: attachLeagueNames(todayMatches, leagues),
        recentMatches: attachLeagueNames(recentMatches, leagues)
    };
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
                    .select('date status home away')
                    .lean(),
                SoccerMatch.find({ league_slug: requestedLeague, 'status.state': 'post' })
                    .sort({ date: -1 })
                    .limit(8)
                    .select('date status home away')
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

    app.get('/robots.txt', (req, res) => {
        const baseUrl = siteUrl(req);
        res.type('text/plain');
        res.set('Cache-Control', 'public, max-age=3600');
        return res.send([
            'User-agent: *',
            'Allow: /',
            'Disallow: /get/',
            'Disallow: /health',
            'Disallow: /api/health',
            'Disallow: /openapi.json',
            'Disallow: /service-info.json',
            '',
            `Sitemap: ${baseUrl}/sitemap.xml`,
            ''
        ].join('\n'));
    });

    app.get('/sitemap.xml', async(req, res) => {
        const baseUrl = siteUrl(req);
        try {
            const [leagues, sync] = await Promise.all([
                availableLeagues(),
                SoccerSyncState.findOne({ status: 'healthy' })
                    .sort({ last_success_at: -1 })
                    .select('last_success_at')
                    .lean()
                    .then(value => value?.last_success_at || null)
            ]);
            const fallbackDate = sync || leagues.reduce((latest, league) => {
                const value = new Date(league.last_synced_at || 0);
                return !Number.isNaN(value.getTime()) && (!latest || value > latest) ? value : latest;
            }, null);
            const countries = [...new Set(leagues.map(league => league.country).filter(Boolean))]
                .sort((a, b) => a.localeCompare(b, 'en'));
            const entries = [
                { loc: `${baseUrl}/`, lastmod: fallbackDate },
                { loc: `${baseUrl}/football-api`, lastmod: fallbackDate },
                ...countries.map(country => ({
                    loc: `${baseUrl}/football/country/${slugifyCountry(country)}`,
                    lastmod: fallbackDate
                })),
                ...leagues.map(league => ({
                    loc: `${baseUrl}/football/${encodeURIComponent(league.slug)}`,
                    lastmod: league.last_synced_at || fallbackDate
                })),
                { loc: `${baseUrl}/api-docs/`, lastmod: fallbackDate }
            ];
            const urls = entries.map(entry => `  <url>
    <loc>${xmlEscape(entry.loc)}</loc>
    ${!entry.lastmod || Number.isNaN(new Date(entry.lastmod).getTime()) ? '' : `<lastmod>${new Date(entry.lastmod).toISOString()}</lastmod>`}
  </url>`).join('\n');

            res.type('application/xml');
            res.set('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
            return res.send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`);
        } catch (error) {
            console.warn('Unable to read sitemap freshness:', error.message);
            res.status(503);
            res.set('Retry-After', '60');
            res.set('X-Robots-Tag', 'noindex');
            return res.type('text/plain').send('Sitemap temporarily unavailable.');
        }
    });
};
