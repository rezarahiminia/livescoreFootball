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
    date: new Date('2026-08-22T14:00:00.000Z'),
    status: { state: 'pre' },
    home: { display_name: 'Arsenal' },
    away: { display_name: 'Liverpool' }
};

function queryResult(value) {
    const query = {
        sort() { return query; },
        select() { return query; },
        limit() { return query; },
        lean() { return Promise.resolve(value); }
    };
    return query;
}

const soccerLeagueStub = {
    find() { return queryResult(leagues); }
};

const soccerMatchStub = {
    distinct() { return Promise.resolve(['eng.1', 'esp.1']); },
    find(filter) {
        return queryResult(filter['status.state'] === 'post' ? [] : [upcomingMatch]);
    },
    countDocuments() { return Promise.resolve(380); }
};

const soccerSyncStateStub = {
    findOne() {
        return queryResult({ last_success_at: new Date('2026-08-02T08:00:00.000Z') });
    }
};

require.cache[require.resolve('../models/soccerLeague')] = { exports: soccerLeagueStub };
require.cache[require.resolve('../models/soccerMatch')] = { exports: soccerMatchStub };
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
        const [home, league, country, sitemap, legacyLeague] = await Promise.all([
            fetch(`${baseUrl}/`),
            fetch(`${baseUrl}/football/eng.1`),
            fetch(`${baseUrl}/football/country/england`),
            fetch(`${baseUrl}/sitemap.xml`),
            fetch(`${baseUrl}/?league=eng.1`, { redirect: 'manual' })
        ]);
        const [homeHtml, leagueHtml, countryHtml, sitemapXml] = await Promise.all([
            home.text(), league.text(), country.text(), sitemap.text()
        ]);

        assert.equal(home.status, 200);
        assert.match(home.headers.get('content-type'), /^text\/html/);
        assert.match(homeHtml, /Football Live Scores, Fixtures &amp; Tables/);
        assert.match(homeHtml, /\/football\/eng\.1/);

        assert.equal(league.status, 200);
        assert.match(leagueHtml, /Premier League Live Scores, Fixtures &amp; Table/);
        assert.match(leagueHtml, /Arsenal/);
        assert.match(leagueHtml, /data-league-slug="eng\.1"/);

        assert.equal(country.status, 200);
        assert.match(countryHtml, /England Football Live Scores &amp; Fixtures/);
        assert.match(countryHtml, /data-page-kind="country"/);

        assert.equal(sitemap.status, 200);
        assert.match(sitemap.headers.get('content-type'), /^application\/xml/);
        assert.match(sitemapXml, /https:\/\/worldcup26\.ir\/football\/country\/england/);
        assert.match(sitemapXml, /https:\/\/worldcup26\.ir\/football\/esp\.1/);

        assert.equal(legacyLeague.status, 301);
        assert.equal(legacyLeague.headers.get('location'), '/football/eng.1');
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
