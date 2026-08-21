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

test('club crests from the listener are limited to http(s) URLs', () => {
    const render = logo => renderSeoPage(template, {
        kind: 'club',
        baseUrl: 'https://worldcup26.ir',
        club: {
            source: { club_id: '359' },
            slug: 'eng.arsenal',
            display_name: 'Arsenal',
            abbreviation: 'ARS',
            country: 'England',
            logo
        },
        leagues: [premierLeague],
        upcomingMatches: [],
        recentMatches: [],
        matchCount: 0
    });

    const safe = render('https://worldcup26.ir/media/clubs/arsenal.png');
    assert.match(safe, /<img src="https:\/\/worldcup26\.ir\/media\/clubs\/arsenal\.png"/);

    // A hostile scheme is dropped rather than rendered, and the badge falls back
    // to the club abbreviation.
    const hostile = render('javascript:alert(1)');
    assert.doesNotMatch(hostile, /javascript:/);
    assert.match(hostile, /class="club-badge-fallback"[^>]*>ARS</);
});

test('match pages escape club and venue names supplied by the listener', () => {
    const evil = '<script>alert(1)</script>';
    const html = renderSeoPage(template, {
        kind: 'match',
        baseUrl: 'https://worldcup26.ir',
        league: premierLeague,
        match: {
            league_slug: 'eng.1',
            source: { event_id: '401879322' },
            date: new Date('2026-08-22T14:00:00.000Z'),
            status: { state: 'pre' },
            home: { source_id: '1', display_name: evil },
            away: { source_id: '2', display_name: 'Liverpool' },
            venue: { name: evil, city: 'London' }
        },
        events: [{ event_type: { name: 'Goal' }, text: evil, clock: { display_value: "23'" }, flags: { scoring_play: true } }],
        headToHead: []
    });

    assert.doesNotMatch(html.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/, ''), /<script>alert/);
    assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
});
