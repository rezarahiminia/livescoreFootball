const test = require('node:test');
const assert = require('node:assert/strict');

const { renderSeoPage, slugifyCountry } = require('../services/seoRenderer');

const template = `<!doctype html>
<html><head><title>{{SEO_TITLE}}</title>
<meta name="description" content="{{SEO_DESCRIPTION}}">
<meta name="robots" content="{{SEO_ROBOTS}}">
<link rel="canonical" href="{{SEO_CANONICAL}}">
<meta property="og:url" content="{{SEO_CANONICAL}}">
<script type="application/ld+json">{{SEO_JSON_LD}}</script></head>
<body data-page-kind="{{PAGE_KIND}}" data-league-slug="{{LEAGUE_SLUG}}" data-country="{{COUNTRY_NAME}}">
<p>{{SEO_OVERLINE}}</p><h1>{{SEO_HEADING}}</h1><p>{{SEO_LEDE}}</p>{{SEO_CONTENT}}</body></html>`;

const premierLeague = {
    slug: 'eng.1',
    name: 'English Premier League',
    abbreviation: 'Premier League',
    country: 'England',
    kind: 'club',
    season: { display_name: '2026-27 English Premier League' }
};

const laLiga = {
    slug: 'esp.1',
    name: 'Spanish LALIGA',
    abbreviation: 'LALIGA',
    country: 'Spain',
    kind: 'club',
    season: { display_name: '2026-27 Spanish LALIGA' }
};

test('country slugs are stable and URL-safe', () => {
    assert.equal(slugifyCountry('England'), 'england');
    assert.equal(slugifyCountry('United States'), 'united-states');
    assert.equal(slugifyCountry(''), 'other');
});

test('home page renders crawlable league and country links with complete metadata', () => {
    const html = renderSeoPage(template, {
        kind: 'home',
        baseUrl: 'https://worldcup26.ir',
        leagues: [premierLeague, laLiga]
    });

    assert.match(html, /<title>Free Football Live Scores Today, Fixtures &amp; Results/);
    assert.match(html, /rel="canonical" href="https:\/\/worldcup26\.ir\/"/);
    assert.match(html, /href="https:\/\/worldcup26\.ir\/football\/eng\.1"/);
    assert.match(html, /href="https:\/\/worldcup26\.ir\/football\/country\/spain"/);
    assert.match(html, /"@type":"WebApplication"/);
    assert.match(html, /"@type":"FAQPage"/);
    assert.match(html, /Football live scores and fixtures today/);
    assert.doesNotMatch(html, /\{\{[A-Z_]+\}\}/);
});

test('league page has unique intent, breadcrumb, fixtures and escaped match content', () => {
    const html = renderSeoPage(template, {
        kind: 'league',
        baseUrl: 'https://worldcup26.ir',
        league: premierLeague,
        relatedLeagues: [],
        matchCount: 380,
        standings: [{
            group_name: 'Premier League',
            entries: [{ rank: 1, club: { display_name: 'Arsenal' }, stats: { gamesPlayed: 1, goalDifference: 2, points: 3 } }]
        }, {
            group_name: 'Championship Group',
            entries: [{ rank: 1, club: { display_name: 'Liverpool' }, stats: { gamesPlayed: 1, goalDifference: 1, points: 3 } }]
        }],
        upcomingMatches: [{
            date: '2026-08-22T14:00:00.000Z',
            status: { state: 'pre' },
            home: { display_name: 'Arsenal <FC>' },
            away: { display_name: 'Liverpool' }
        }],
        recentMatches: []
    });

    assert.match(html, /Premier League Live Scores Today, Fixtures &amp; Table/);
    assert.match(html, /rel="canonical" href="https:\/\/worldcup26\.ir\/football\/eng\.1"/);
    assert.match(html, /data-league-slug="eng\.1"/);
    assert.match(html, /Premier League upcoming fixtures/);
    assert.match(html, /Arsenal &lt;FC&gt;/);
    assert.doesNotMatch(html, /Arsenal <FC>/);
    assert.match(html, /"@type":"Dataset"/);
    assert.match(html, /"@type":"BreadcrumbList"/);
    assert.match(html, /<caption>Premier League<\/caption>/);
    assert.match(html, /<caption>Championship Group<\/caption>/);
    assert.doesNotMatch(html, /\{\{[A-Z_]+\}\}/);
});

test('competition without standings does not claim to have a table', () => {
    const cup = { ...premierLeague, slug: 'eng.fa', name: 'English FA Cup', abbreviation: 'FA Cup' };
    const html = renderSeoPage(template, {
        kind: 'league',
        baseUrl: 'https://worldcup26.ir',
        league: cup,
        relatedLeagues: [],
        matchCount: 20,
        standings: [],
        upcomingMatches: [],
        recentMatches: []
    });

    assert.match(html, /English FA Cup Live Scores Today, Fixtures &amp; Results/);
    assert.match(html, /fixtures <em>&amp; results\.<\/em>/);
    assert.doesNotMatch(html, /English FA Cup fixtures, results and standings/);
});

test('free football API page targets developer intent with software schema', () => {
    const html = renderSeoPage(template, {
        kind: 'api',
        baseUrl: 'https://worldcup26.ir',
        leagues: [premierLeague, laLiga]
    });

    assert.match(html, /Free Football API for Live Scores, Fixtures &amp; Standings/);
    assert.match(html, /No API key/);
    assert.match(html, /\/get\/soccer\/eng\.1\/fixtures/);
    assert.match(html, /"@type":"SoftwareApplication"/);
    assert.match(html, /rel="canonical" href="https:\/\/worldcup26\.ir\/football-api"/);
});

test('unknown competition page does not leak template tokens', () => {
    const html = renderSeoPage(template, {
        kind: 'notFound',
        baseUrl: 'https://worldcup26.ir',
        leagues: []
    });

    assert.match(html, /Competition Not Found/);
    assert.match(html, /data-page-kind="not-found"/);
    assert.doesNotMatch(html, /\{\{[A-Z_]+\}\}/);
});
