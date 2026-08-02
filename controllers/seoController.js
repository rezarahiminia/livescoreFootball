const fs = require('fs');
const path = require('path');

const SoccerLeague = require('../models/soccerLeague');
const SoccerMatch = require('../models/soccerMatch');
const SoccerSyncState = require('../models/soccerSyncState');
const { renderSeoPage, slugifyCountry } = require('../services/seoRenderer');
const { inferLeagueCountry } = require('../services/soccerSerializer');

const PAGE_TEMPLATE = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
const LEAGUE_PATTERN = /^[a-z0-9][a-z0-9._-]{0,63}$/;
const COUNTRY_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;

function siteUrl(req) {
    const configuredUrl = process.env.PUBLIC_SITE_URL || process.env.API_URL;
    if (configuredUrl) return String(configuredUrl).replace(/\/$/, '');
    if (process.env.NODE_ENV === 'production') return 'https://worldcup26.ir';
    return `${req.protocol}://${req.get('host')}`.replace(/\/$/, '');
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
    const [catalog, leagueSlugsWithMatches] = await Promise.all([
        activeLeagues(),
        SoccerMatch.distinct('league_slug')
    ]);
    const availableSlugs = new Set(leagueSlugsWithMatches);
    return catalog.filter(league => availableSlugs.has(league.slug));
}

function renderResponse(res, context, status = 200) {
    res.status(status);
    res.type('html');
    res.set('Cache-Control', status === 200 ? 'public, max-age=60, stale-while-revalidate=300' : 'no-store');
    if (status !== 200) res.set('X-Robots-Tag', 'noindex, nofollow');
    return res.send(renderSeoPage(PAGE_TEMPLATE, context));
}

function renderNotFound(req, res) {
    return renderResponse(res, { kind: 'notFound', baseUrl: siteUrl(req), leagues: [] }, 404);
}

module.exports = app => {
    app.get('/', async(req, res) => {
        const legacyLeague = String(req.query.league || '').toLowerCase();
        if (LEAGUE_PATTERN.test(legacyLeague)) {
            return res.redirect(301, `/football/${encodeURIComponent(legacyLeague)}`);
        }

        let leagues = [];
        try {
            leagues = await availableLeagues();
        } catch (error) {
            console.warn('Unable to load SEO league directory:', error.message);
        }

        return renderResponse(res, { kind: 'home', baseUrl: siteUrl(req), leagues });
    });

    app.get('/football/country/:countrySlug', async(req, res, next) => {
        const requestedCountry = String(req.params.countrySlug || '').toLowerCase();
        if (!COUNTRY_PATTERN.test(requestedCountry)) return renderNotFound(req, res);

        try {
            const catalog = await availableLeagues();
            const leagues = catalog.filter(league => slugifyCountry(league.country || 'International') === requestedCountry);
            if (!leagues.length) return renderNotFound(req, res);

            return renderResponse(res, {
                kind: 'country',
                baseUrl: siteUrl(req),
                country: leagues[0].country || 'International',
                leagues
            });
        } catch (error) {
            return next(error);
        }
    });

    app.get('/football/:leagueSlug', async(req, res, next) => {
        const requestedLeague = String(req.params.leagueSlug || '').toLowerCase();
        if (!LEAGUE_PATTERN.test(requestedLeague)) return renderNotFound(req, res);

        try {
            const catalog = await availableLeagues();
            const league = catalog.find(item => item.slug === requestedLeague);
            if (!league) return renderNotFound(req, res);

            const relatedLeagues = catalog
                .filter(item => item.slug !== requestedLeague && item.country === league.country)
                .slice(0, 8);
            const [upcomingMatches, recentMatches, matchCount] = await Promise.all([
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
                SoccerMatch.countDocuments({ league_slug: requestedLeague })
            ]);

            return renderResponse(res, {
                kind: 'league',
                baseUrl: siteUrl(req),
                league,
                upcomingMatches,
                recentMatches,
                relatedLeagues,
                matchCount
            });
        } catch (error) {
            return next(error);
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
        let latestSync = new Date();
        let leagues = [];

        try {
            [leagues, latestSync] = await Promise.all([
                availableLeagues(),
                SoccerSyncState.findOne({ status: 'healthy' })
                    .sort({ last_success_at: -1 })
                    .select('last_success_at')
                    .lean()
                    .then(sync => sync?.last_success_at || new Date())
            ]);
        } catch (error) {
            console.warn('Unable to read sitemap freshness:', error.message);
        }

        const countries = [...new Set(leagues.map(league => league.country || 'International'))];
        const entries = [
            { loc: `${baseUrl}/`, lastmod: latestSync },
            ...countries.map(country => ({
                loc: `${baseUrl}/football/country/${slugifyCountry(country)}`,
                lastmod: latestSync
            })),
            ...leagues.map(league => ({
                loc: `${baseUrl}/football/${encodeURIComponent(league.slug)}`,
                lastmod: league.last_synced_at || latestSync
            })),
            { loc: `${baseUrl}/api-docs/`, lastmod: latestSync }
        ];
        const urls = entries.map(entry => `  <url>
    <loc>${xmlEscape(entry.loc)}</loc>
    <lastmod>${new Date(entry.lastmod).toISOString()}</lastmod>
  </url>`).join('\n');

        res.type('application/xml');
        res.set('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
        return res.send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`);
    });
};
