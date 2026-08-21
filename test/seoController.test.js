const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

const express = require('express');

const leagues = [{
    slug: 'eng.1',
    name: 'English Premier League',
    abbreviation: 'Premier League',
    country: 'England',
    kind: 'club',
    active: true,
    season: { display_name: '2026-27 English Premier League' },
    last_synced_at: new Date('2026-08-02T08:00:00.000Z')
}, {
    slug: 'esp.1',
    name: 'Spanish LALIGA',
    abbreviation: 'LALIGA',
    country: 'Spain',
    kind: 'club',
    active: true,
    season: { display_name: '2026-27 Spanish LALIGA' },
    last_synced_at: new Date('2026-08-02T08:00:00.000Z')
}];

const upcomingMatch = {
    league_slug: 'eng.1',
    source: { event_id: '401879322', competition_id: '700' },
    date: new Date('2026-08-22T14:00:00.000Z'),
    status: { state: 'pre' },
    home: { source_id: '359', display_name: 'Arsenal', form: 'WWDWL' },
    away: { source_id: '364', display_name: 'Liverpool', form: 'WLWWD' },
    venue: { name: 'Emirates Stadium', city: 'London', country: 'England' },
    season: { year: 2026 },
    last_synced_at: new Date('2026-08-21T20:00:00.000Z')
};

const finishedMatch = {
    league_slug: 'eng.1',
    source: { event_id: '401879999', competition_id: '700' },
    date: new Date('2026-08-15T14:00:00.000Z'),
    status: { state: 'post', detail: 'Full Time' },
    home: { source_id: '359', display_name: 'Arsenal', score: 3 },
    away: { source_id: '364', display_name: 'Liverpool', score: 1 },
    last_synced_at: new Date('2026-08-15T16:00:00.000Z')
};

const arsenal = {
    source: { club_id: '359' },
    slug: 'eng.arsenal',
    name: 'Arsenal',
    display_name: 'Arsenal',
    abbreviation: 'ARS',
    country: 'England',
    city: 'London',
    logo: 'https://worldcup26.ir/media/clubs/arsenal.png',
    league_slugs: ['eng.1'],
    active: true,
    venue: { name: 'Emirates Stadium' },
    last_synced_at: new Date('2026-08-20T08:00:00.000Z')
};

const matchEvents = [{
    sequence: 1,
    event_type: { name: 'Goal' },
    text: 'Goal! Arsenal 1, Liverpool 0. Bukayo Saka scores.',
    clock: { value: 23, display_value: "23'" },
    home_score: 1,
    away_score: 0,
    flags: { scoring_play: true }
}, {
    sequence: 2,
    event_type: { name: 'Yellow Card' },
    text: 'Yellow card shown to Declan Rice.',
    clock: { value: 55, display_value: "55'" },
    flags: { yellow_card: true }
}];

// Mongoose only returns the fields a query selects. Honouring that here means a
// route that forgets to select a field it renders fails the test instead of
// silently dropping content in production.
function project(value, fields) {
    if (!fields || !value) return value;
    if (Array.isArray(value)) return value.map(item => project(item, fields));
    const allowed = fields.split(/\s+/).filter(Boolean).map(field => field.split('.')[0]);
    return Object.fromEntries(Object.entries(value).filter(([key]) => allowed.includes(key)));
}

function queryResult(value) {
    let fields = null;
    const query = {
        sort() { return query; },
        select(projection) { fields = projection; return query; },
        limit() { return query; },
        skip() { return query; },
        lean() { return Promise.resolve(project(value, fields)); }
    };
    return query;
}

const soccerLeagueStub = {
    find() { return queryResult(leagues); }
};

const soccerMatchStub = {
    distinct() { return Promise.resolve(['eng.1', 'esp.1']); },
    find(filter) {
        if (filter?.['source.event_id']?.$ne) return queryResult([finishedMatch]);
        if (filter?.['status.state'] === 'post') return queryResult([]);
        return queryResult([upcomingMatch]);
    },
    findOne(filter) {
        const eventId = filter?.['source.event_id'];
        if (eventId === upcomingMatch.source.event_id) return queryResult(upcomingMatch);
        if (eventId === finishedMatch.source.event_id) return queryResult(finishedMatch);
        return queryResult(null);
    },
    countDocuments() { return Promise.resolve(380); },
    estimatedDocumentCount() { return Promise.resolve(971); }
};

const soccerClubStub = {
    find() { return queryResult([arsenal]); },
    findOne(filter) {
        if (filter?.slug === arsenal.slug) return queryResult(arsenal);
        if (filter?.['source.club_id'] === arsenal.source.club_id) return queryResult(arsenal);
        return queryResult(null);
    },
    countDocuments() { return Promise.resolve(470); }
};

const soccerMatchEventStub = {
    find() { return queryResult(matchEvents); }
};

const soccerStandingStub = {
    distinct() { return Promise.resolve(['eng.1', 'esp.1']); },
    find() {
        return queryResult([{
            season_year: 2026,
            group_name: 'Premier League',
            entries: [{
                rank: 1,
                club: { display_name: 'Arsenal' },
                stats: { gamesPlayed: 1, goalDifference: 2, points: 3 }
            }]
        }]);
    }
};

const soccerSyncStateStub = {
    findOne() {
        return queryResult({ last_success_at: new Date('2026-08-02T08:00:00.000Z') });
    }
};

require.cache[require.resolve('../models/soccerClub')] = { exports: soccerClubStub };
require.cache[require.resolve('../models/soccerLeague')] = { exports: soccerLeagueStub };
require.cache[require.resolve('../models/soccerMatch')] = { exports: soccerMatchStub };
require.cache[require.resolve('../models/soccerMatchEvent')] = { exports: soccerMatchEventStub };
require.cache[require.resolve('../models/soccerStanding')] = { exports: soccerStandingStub };
require.cache[require.resolve('../models/soccerSyncState')] = { exports: soccerSyncStateStub };

process.env.PUBLIC_SITE_URL = 'https://worldcup26.ir';
const mountSeoRoutes = require('../controllers/seoController');

async function withServer(callback) {
    const app = express();
    mountSeoRoutes(app);
    const server = http.createServer(app);
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    try {
        await callback(`http://127.0.0.1:${address.port}`);
    } finally {
        await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    }
}

test('SEO routes serve unique HTML pages and a complete dynamic sitemap', async() => {
    await withServer(async baseUrl => {
        const [home, league, country, api, sitemap, robots, legacyLeague, uppercaseLeague] = await Promise.all([
            fetch(`${baseUrl}/`),
            fetch(`${baseUrl}/football/eng.1`),
            fetch(`${baseUrl}/football/country/england`),
            fetch(`${baseUrl}/football-api`),
            fetch(`${baseUrl}/sitemap.xml`),
            fetch(`${baseUrl}/robots.txt`),
            fetch(`${baseUrl}/?league=eng.1`, { redirect: 'manual' }),
            fetch(`${baseUrl}/football/ENG.1`, { redirect: 'manual' })
        ]);
        const [homeHtml, leagueHtml, countryHtml, apiHtml, sitemapXml, robotsTxt] = await Promise.all([
            home.text(), league.text(), country.text(), api.text(), sitemap.text(), robots.text()
        ]);

        assert.equal(home.status, 200);
        assert.match(home.headers.get('content-type'), /^text\/html/);
        assert.match(homeHtml, /Free Football Live Scores Today, Fixtures &amp; Results/);
        assert.match(homeHtml, /\/football\/eng\.1/);
        assert.match(homeHtml, /Football live scores and fixtures today/);

        assert.equal(league.status, 200);
        assert.match(leagueHtml, /Premier League Live Scores Today, Fixtures &amp; Table/);
        assert.match(leagueHtml, /Arsenal/);
        assert.match(leagueHtml, /Latest stored table/);
        assert.match(leagueHtml, /data-league-slug="eng\.1"/);

        assert.equal(country.status, 200);
        assert.match(countryHtml, /England Football Live Scores Today &amp; Fixtures/);
        assert.match(countryHtml, /data-page-kind="country"/);

        assert.equal(api.status, 200);
        assert.match(apiHtml, /Free Football API for Live Scores, Fixtures &amp; Standings/);
        assert.match(apiHtml, /No API key/);

        assert.equal(sitemap.status, 200);
        assert.match(sitemap.headers.get('content-type'), /^application\/xml/);
        assert.match(sitemapXml, /<sitemapindex/);
        assert.match(sitemapXml, /https:\/\/worldcup26\.ir\/sitemap-pages\.xml/);
        assert.match(sitemapXml, /https:\/\/worldcup26\.ir\/sitemap-leagues\.xml/);
        assert.match(sitemapXml, /https:\/\/worldcup26\.ir\/sitemap-clubs\.xml/);
        assert.match(sitemapXml, /https:\/\/worldcup26\.ir\/sitemap-matches-1\.xml/);

        assert.equal(robots.status, 200);
        assert.match(robotsTxt, /Sitemap: https:\/\/worldcup26\.ir\/sitemap\.xml/);

        assert.equal(legacyLeague.status, 301);
        assert.equal(legacyLeague.headers.get('location'), '/football/eng.1');
        assert.equal(uppercaseLeague.status, 301);
        assert.equal(uppercaseLeague.headers.get('location'), '/football/eng.1');
    });
});

test('unknown competition returns a crawl-safe HTML 404', async() => {
    await withServer(async baseUrl => {
        const response = await fetch(`${baseUrl}/football/not-real`);
        const html = await response.text();

        assert.equal(response.status, 404);
        assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow');
        assert.match(response.headers.get('content-type'), /^text\/html/);
        assert.match(html, /Competition Not Found/);
    });
});

test('match pages render SportsEvent schema, a scoreline and match events', async() => {
    await withServer(async baseUrl => {
        const response = await fetch(`${baseUrl}/football/eng.1/arsenal-vs-liverpool-401879322`);
        const html = await response.text();

        assert.equal(response.status, 200);
        assert.match(response.headers.get('content-type'), /^text\/html/);
        assert.match(html, /data-page-kind="match"/);
        assert.match(html, /<link rel="canonical" href="https:\/\/worldcup26\.ir\/football\/eng\.1\/arsenal-vs-liverpool-401879322">/);
        assert.match(html, /<title>Arsenal vs Liverpool Live Score — Premier League<\/title>/);
        assert.match(html, /Emirates Stadium/);

        const schema = JSON.parse(html.match(/<script type="application\/ld\+json">\s*([\s\S]*?)\s*<\/script>/)[1]);
        const sportsEvent = schema['@graph'].find(node => node['@type'] === 'SportsEvent');
        assert.ok(sportsEvent, 'SportsEvent node is present');
        assert.equal(sportsEvent.startDate, '2026-08-22T14:00:00.000Z');
        assert.equal(sportsEvent.homeTeam.name, 'Arsenal');
        assert.equal(sportsEvent.awayTeam.name, 'Liverpool');
        assert.equal(sportsEvent.eventStatus, 'https://schema.org/EventScheduled');
        assert.equal(sportsEvent.location.name, 'Emirates Stadium');

        const breadcrumb = schema['@graph'].find(node => node['@type'] === 'BreadcrumbList');
        assert.equal(breadcrumb.itemListElement.length, 4);

        // Goals and cards are the unique content that justifies the page.
        assert.match(html, /Bukayo Saka scores/);
        assert.match(html, /Yellow card/);
    });
});

test('a finished match uses the score in its title and marks the event completed', async() => {
    await withServer(async baseUrl => {
        const response = await fetch(`${baseUrl}/football/eng.1/arsenal-vs-liverpool-401879999`);
        const html = await response.text();

        assert.equal(response.status, 200);
        assert.match(html, /<title>Arsenal 3-1 Liverpool — Premier League Result<\/title>/);

        const schema = JSON.parse(html.match(/<script type="application\/ld\+json">\s*([\s\S]*?)\s*<\/script>/)[1]);
        const sportsEvent = schema['@graph'].find(node => node['@type'] === 'SportsEvent');
        assert.equal(sportsEvent.eventStatus, 'https://schema.org/EventCompleted');
    });
});

test('a stale match slug redirects to the canonical URL', async() => {
    await withServer(async baseUrl => {
        const response = await fetch(`${baseUrl}/football/eng.1/old-name-vs-liverpool-401879322`, { redirect: 'manual' });

        assert.equal(response.status, 301);
        assert.equal(response.headers.get('location'), '/football/eng.1/arsenal-vs-liverpool-401879322');
    });
});

test('an unknown match id returns a crawl-safe 404', async() => {
    await withServer(async baseUrl => {
        const response = await fetch(`${baseUrl}/football/eng.1/made-up-vs-team-999999`);

        assert.equal(response.status, 404);
        assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow');
    });
});

test('club pages render SportsTeam schema, fixtures and league position', async() => {
    await withServer(async baseUrl => {
        const response = await fetch(`${baseUrl}/football/club/eng.arsenal`);
        const html = await response.text();

        assert.equal(response.status, 200);
        assert.match(html, /data-page-kind="club"/);
        assert.match(html, /<title>Arsenal Fixtures, Results &amp; Table<\/title>/);
        assert.match(html, /<link rel="canonical" href="https:\/\/worldcup26\.ir\/football\/club\/eng\.arsenal">/);
        assert.match(html, /Emirates Stadium/);

        const schema = JSON.parse(html.match(/<script type="application\/ld\+json">\s*([\s\S]*?)\s*<\/script>/)[1]);
        const team = schema['@graph'].find(node => node['@type'] === 'SportsTeam');
        assert.ok(team, 'SportsTeam node is present');
        assert.equal(team.name, 'Arsenal');
        assert.equal(team.memberOf.name, 'Premier League');
        assert.equal(team.location.name, 'Emirates Stadium');
    });
});

test('an unknown club slug returns a crawl-safe 404', async() => {
    await withServer(async baseUrl => {
        const response = await fetch(`${baseUrl}/football/club/eng.not-a-club`);

        assert.equal(response.status, 404);
        assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow');
    });
});

test('sub-sitemaps list league, club and match URLs', async() => {
    await withServer(async baseUrl => {
        const [pages, leagues, clubs, matches, emptyPage] = await Promise.all([
            fetch(`${baseUrl}/sitemap-pages.xml`),
            fetch(`${baseUrl}/sitemap-leagues.xml`),
            fetch(`${baseUrl}/sitemap-clubs.xml`),
            fetch(`${baseUrl}/sitemap-matches-1.xml`),
            fetch(`${baseUrl}/sitemap-matches-0.xml`)
        ]);
        const [pagesXml, leaguesXml, clubsXml, matchesXml] = await Promise.all([
            pages.text(), leagues.text(), clubs.text(), matches.text()
        ]);

        assert.match(pagesXml, /https:\/\/worldcup26\.ir\/football\/country\/england/);
        assert.match(pagesXml, /https:\/\/worldcup26\.ir\/football-api/);
        assert.match(leaguesXml, /https:\/\/worldcup26\.ir\/football\/esp\.1/);
        assert.match(clubsXml, /https:\/\/worldcup26\.ir\/football\/club\/eng\.arsenal/);
        assert.match(matchesXml, /https:\/\/worldcup26\.ir\/football\/eng\.1\/arsenal-vs-liverpool-401879322/);
        assert.equal(emptyPage.status, 404);
    });
});

test('robots.txt and llms.txt expose the site to search and answer engines', async() => {
    await withServer(async baseUrl => {
        const [robots, llms, manifest] = await Promise.all([
            fetch(`${baseUrl}/robots.txt`),
            fetch(`${baseUrl}/llms.txt`),
            fetch(`${baseUrl}/manifest.webmanifest`)
        ]);
        const [robotsTxt, llmsTxt] = await Promise.all([robots.text(), llms.text()]);

        assert.match(robotsTxt, /User-agent: GPTBot/);
        assert.match(robotsTxt, /User-agent: PerplexityBot/);
        assert.match(robotsTxt, /Disallow: \/get\//);
        assert.match(robotsTxt, /Sitemap: https:\/\/worldcup26\.ir\/sitemap\.xml/);

        assert.equal(llms.status, 200);
        assert.match(llms.headers.get('content-type'), /^text\/plain/);
        assert.match(llmsTxt, /^# Free Football Live Scores/);
        assert.match(llmsTxt, /\/football\/eng\.1/);
        assert.match(llmsTxt, /\{home\}-vs-\{away\}-\{event-id\}/);
        assert.match(llmsTxt, /no API key/i);

        assert.equal(manifest.status, 200);
    });
});

test('every page carries an absolute og:image for social and answer engines', async() => {
    await withServer(async baseUrl => {
        const responses = await Promise.all([
            fetch(`${baseUrl}/`),
            fetch(`${baseUrl}/football/eng.1`),
            fetch(`${baseUrl}/football/eng.1/arsenal-vs-liverpool-401879322`),
            fetch(`${baseUrl}/football/club/eng.arsenal`)
        ]);
        const pages = await Promise.all(responses.map(response => response.text()));

        for (const html of pages) {
            assert.match(html, /<meta property="og:image" content="https:\/\/worldcup26\.ir\/og-image\.png">/);
            assert.match(html, /<meta name="twitter:card" content="summary_large_image">/);
            assert.doesNotMatch(html, /\{\{SEO_[A-Z_]+\}\}/, 'no template token is left unreplaced');
        }
    });
});

test('directory pages link to individual match pages so crawlers can reach them', async() => {
    await withServer(async baseUrl => {
        const [home, league] = await Promise.all([
            fetch(`${baseUrl}/`),
            fetch(`${baseUrl}/football/eng.1`)
        ]);
        const [homeHtml, leagueHtml] = await Promise.all([home.text(), league.text()]);

        for (const html of [homeHtml, leagueHtml]) {
            assert.match(html, /href="https:\/\/worldcup26\.ir\/football\/eng\.1\/arsenal-vs-liverpool-401879322"/);
        }
    });
});
