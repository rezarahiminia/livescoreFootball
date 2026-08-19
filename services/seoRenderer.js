const SITE_NAME = 'Free Football Live Scores';
const GITHUB_URL = 'https://github.com/rezarahiminia/livescoreFootball';

const LEAGUE_NAME_OVERRIDES = {
    'eng.1': 'Premier League',
    'esp.1': 'LaLiga',
    'uefa.champions': 'UEFA Champions League',
    'uefa.europa': 'UEFA Europa League'
};

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function safeJson(value) {
    return JSON.stringify(value)
        .replace(/</g, '\\u003c')
        .replace(/>/g, '\\u003e')
        .replace(/&/g, '\\u0026');
}

function slugifyCountry(value) {
    return String(value || 'other')
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'other';
}

function leagueName(league = {}) {
    return LEAGUE_NAME_OVERRIDES[league.slug]
        || league.name
        || league.abbreviation
        || 'Football competition';
}

function leagueUrl(baseUrl, league) {
    return `${baseUrl}/football/${encodeURIComponent(league.slug)}`;
}

function countryUrl(baseUrl, country) {
    return `${baseUrl}/football/country/${slugifyCountry(country)}`;
}

function seasonName(league = {}) {
    return league.season?.display_name
        || (league.season?.year ? `${league.season.year} season` : 'current season');
}

function formatMatchDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Date to be confirmed';
    return new Intl.DateTimeFormat('en-GB', {
        timeZone: 'UTC',
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    }).format(date);
}

function formatPageDate(value = new Date()) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'today';
    return new Intl.DateTimeFormat('en-GB', {
        timeZone: 'UTC',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    }).format(date);
}

function matchStatus(match) {
    if (match.status?.state === 'in') return match.status.clock || 'Live';
    if (match.status?.state === 'post') {
        const homeScore = match.home?.score;
        const awayScore = match.away?.score;
        return homeScore == null || awayScore == null ? 'Full time' : `${homeScore}–${awayScore}`;
    }
    return 'Scheduled';
}

function renderLeagueCards(leagues, baseUrl) {
    if (!leagues.length) {
        return '<p class="seo-empty">Competition pages will appear as verified league data becomes available.</p>';
    }

    return `<div class="competition-grid">${leagues.map(league => {
        const name = leagueName(league);
        const country = league.country || 'International';
        return `<a class="competition-link" href="${escapeHtml(leagueUrl(baseUrl, league))}">
            <span>${escapeHtml(country)}</span>
            <h3>${escapeHtml(name)}</h3>
            <p>Live scores, fixtures and results${league.hasStandings ? ', plus the current table' : ''}</p>
        </a>`;
    }).join('')}</div>`;
}

function renderCountryLinks(leagues, baseUrl) {
    const countries = [...new Set(leagues.map(league => league.country || 'International'))]
        .sort((a, b) => a.localeCompare(b, 'en'));
    if (!countries.length) return '';

    return `<nav class="country-links" aria-label="Football competitions by country">
        ${countries.map(country => `<a href="${escapeHtml(countryUrl(baseUrl, country))}">${escapeHtml(country)} football</a>`).join('')}
    </nav>`;
}

function renderMatchList(title, matches, options = {}) {
    if (!matches?.length) {
        return options.emptyMessage
            ? `<section class="seo-match-block"><h3>${escapeHtml(title)}</h3><p class="seo-empty">${escapeHtml(options.emptyMessage)}</p></section>`
            : '';
    }

    return `<section class="seo-match-block">
        <h3>${escapeHtml(title)}</h3>
        <ol class="seo-match-list">${matches.map(match => {
        const home = match.home?.display_name || match.home?.name || 'Home team';
        const away = match.away?.display_name || match.away?.name || 'Away team';
        const isoDate = new Date(match.date);
        const dateTime = Number.isNaN(isoDate.getTime()) ? '' : isoDate.toISOString();
        return `<li>
                <span>${options.showLeague && match.league ? `<a class="match-competition" href="${escapeHtml(leagueUrl(options.baseUrl, match.league))}">${escapeHtml(leagueName(match.league))}</a>` : ''}<strong>${escapeHtml(home)}</strong> vs <strong>${escapeHtml(away)}</strong></span>
                <time${dateTime ? ` datetime="${dateTime}"` : ''}>${escapeHtml(formatMatchDate(match.date))}</time>
                <b>${escapeHtml(matchStatus(match))}</b>
            </li>`;
    }).join('')}</ol>
    </section>`;
}

function standingStat(entry, names) {
    const stats = entry?.stats;
    for (const name of names) {
        if (stats instanceof Map && stats.has(name)) return stats.get(name);
        if (stats && Object.prototype.hasOwnProperty.call(stats, name)) return stats[name];
    }
    return '–';
}

function renderStandings(standings, name) {
    const availableGroups = (standings || []).filter(group => group?.entries?.length);
    if (!availableGroups.length) {
        return `<section class="seo-standing"><h2>${escapeHtml(name)} standings</h2><p class="seo-empty">A verified league table is not stored for this competition yet.</p></section>`;
    }

    return `<section class="seo-standing" aria-labelledby="seo-standing-title">
        <div class="seo-section-heading">
            <p class="overline">Latest stored table</p>
            <h2 id="seo-standing-title">${escapeHtml(name)} standings</h2>
        </div>
        <div class="seo-standing-groups">${availableGroups.map(standing => `<div class="table-wrap"><table class="standings-table"><caption>${escapeHtml(standing.group_name || `${name} table`)}</caption>
            <thead><tr><th scope="col">Pos</th><th scope="col">Club</th><th scope="col">Played</th><th scope="col">GD</th><th scope="col">Points</th></tr></thead>
            <tbody>${standing.entries.slice(0, 20).map(entry => `<tr>
                <td class="rank">${escapeHtml(entry.rank || '–')}</td>
                <td>${escapeHtml(entry.club?.display_name || 'Club')}</td>
                <td>${escapeHtml(standingStat(entry, ['gamesPlayed', 'played']))}</td>
                <td>${escapeHtml(standingStat(entry, ['pointDifferential', 'goalDifference']))}</td>
                <td class="points">${escapeHtml(standingStat(entry, ['points']))}</td>
            </tr>`).join('')}</tbody>
        </table></div>`).join('')}</div>
    </section>`;
}

function homeContent(context) {
    const { leagues, baseUrl, todayMatches, recentMatches } = context;
    const today = formatPageDate(context.generatedAt);
    return `<section class="seo-directory seo-today shell" id="today" aria-labelledby="today-title">
        <div class="seo-section-heading">
            <p class="overline">Updated football data for ${escapeHtml(today)} (UTC)</p>
            <h2 id="today-title">Football live scores and fixtures today</h2>
            <p>View today's stored football matches across every verified league. Live games show their current match state, completed games show the final score, and scheduled fixtures show the kickoff time.</p>
        </div>
        <div class="seo-match-columns">
            ${renderMatchList("Today's football scores and fixtures", todayMatches, { showLeague: true, baseUrl, emptyMessage: 'No matches are stored for today yet. Upcoming schedules remain available on each league page.' })}
            ${renderMatchList('Latest football results', recentMatches, { showLeague: true, baseUrl, emptyMessage: 'No completed results are stored yet.' })}
        </div>
    </section>
    <section class="seo-directory shell" id="competitions" aria-labelledby="coverage-title">
        <div class="seo-section-heading">
            <p class="overline">Free live football score center</p>
            <h2 id="coverage-title">Free live scores for football leagues</h2>
            <p>Choose a competition for live scores, upcoming fixtures, completed results and match details. League tables are shown only where verified standings are stored. Coverage currently includes ${escapeHtml(leagues.length)} active competitions and expands after each new league is validated.</p>
        </div>
        ${renderCountryLinks(leagues, baseUrl)}
        ${renderLeagueCards(leagues, baseUrl)}
        <div class="seo-topics">
            <article>
                <h2>Premier League and LaLiga scores</h2>
                <p>Open a dedicated competition page for the Premier League schedule, English football results, LaLiga fixtures, Spanish league standings and live match updates.</p>
            </article>
            <article>
                <h2>UEFA Champions League and more</h2>
                <p>European and additional country competitions are published only when fixtures, live status and results are available. This avoids empty or misleading league pages.</p>
            </article>
            <article>
                <h2>Free football API with no API key</h2>
                <p>Use the open JSON REST API for fixtures, live scores, clubs, match events and standings. <a href="/football-api">Read the free football API guide</a> or <a href="/api-docs/">try the interactive documentation</a>.</p>
            </article>
        </div>
    </section>
    <section class="seo-directory shell" id="about-live-scores" aria-labelledby="about-live-title">
        <div class="seo-section-heading">
            <p class="overline">How the free service works</p>
            <h2 id="about-live-title">Live football data without a subscription</h2>
            <p>The score center and API are free to use. A dedicated listener refreshes normalized football records in MongoDB, while public requests read the stored data without waiting for an upstream provider.</p>
        </div>
        <div class="seo-topics faq-grid">
            <article><h2>Are football scores updated live?</h2><p>Live match snapshots are refreshed by the listener. Every league and match response exposes stored status and freshness information so users can see what is currently available.</p></article>
            <article><h2>Which football leagues are covered?</h2><p>Verified coverage includes the Premier League, EFL competitions, FA Cup, LaLiga, LaLiga 2, Copa del Rey and additional English and Spanish competitions.</p></article>
            <article><h2>Is the football API really free?</h2><p>Yes. The public read API currently requires no API key. Fair-use rate limits protect availability, and the complete source code is published on <a href="${GITHUB_URL}">GitHub</a>.</p></article>
        </div>
    </section>`;
}

function countryContent(context) {
    const { leagues, baseUrl, country, todayMatches, recentMatches } = context;
    return `<section class="seo-directory shell" id="competitions" aria-labelledby="coverage-title">
        <nav class="breadcrumbs" aria-label="Breadcrumb"><a href="/">Home</a><span>›</span><span>${escapeHtml(country)} football</span></nav>
        <div class="seo-section-heading">
            <p class="overline">${escapeHtml(country)} football data</p>
            <h2 id="coverage-title">${escapeHtml(country)} football live scores and fixtures</h2>
            <p>Choose from ${escapeHtml(leagues.length)} verified ${escapeHtml(country)} competitions for live score updates, today's matches, upcoming schedules, completed results and available league tables.</p>
        </div>
        <div class="seo-match-columns">
            ${renderMatchList(`${country} football matches today`, todayMatches, { showLeague: true, baseUrl, emptyMessage: `No ${country} matches are stored for today.` })}
            ${renderMatchList(`Latest ${country} football results`, recentMatches, { showLeague: true, baseUrl, emptyMessage: `No recent ${country} results are stored yet.` })}
        </div>
        ${renderLeagueCards(leagues, baseUrl)}
        <p class="seo-disclaimer">Scores and match details are free to view. This service provides football data and does not claim to provide live video streaming.</p>
    </section>`;
}

function leagueContent(context) {
    const { league, relatedLeagues, upcomingMatches, recentMatches, matchCount, standings, baseUrl } = context;
    const name = leagueName(league);
    const country = league.country || 'International';
    const season = seasonName(league);
    const hasTable = (standings || []).some(group => group?.entries?.length);

    return `<section class="seo-directory shell" id="competition-guide" aria-labelledby="coverage-title">
        <nav class="breadcrumbs" aria-label="Breadcrumb">
            <a href="/">Home</a><span>›</span>
            <a href="${escapeHtml(countryUrl(baseUrl, country))}">${escapeHtml(country)} football</a><span>›</span>
            <span>${escapeHtml(name)}</span>
        </nav>
        <div class="seo-section-heading">
            <p class="overline">${escapeHtml(season)}</p>
            <h2 id="coverage-title">${escapeHtml(name)} live scores, fixtures and results</h2>
            <p>Follow ${escapeHtml(name)} live scores today, upcoming fixtures, completed results and detailed match events. ${hasTable ? 'The latest stored league table is included below.' : 'A league table will appear when verified standings are available.'} All score data remains free to view.</p>
        </div>
        <dl class="seo-facts">
            <div><dt>Competition</dt><dd>${escapeHtml(name)}</dd></div>
            <div><dt>Country</dt><dd>${escapeHtml(country)}</dd></div>
            <div><dt>Season</dt><dd>${escapeHtml(season)}</dd></div>
            <div><dt>Stored matches</dt><dd>${escapeHtml(matchCount)}</dd></div>
        </dl>
        <div class="seo-match-columns">
            ${renderMatchList(`${name} upcoming fixtures`, upcomingMatches, { emptyMessage: `No upcoming ${name} fixtures are stored yet.` })}
            ${renderMatchList(`${name} latest results`, recentMatches, { emptyMessage: `No completed ${name} results are stored yet.` })}
        </div>
        ${renderStandings(standings, name)}
        ${relatedLeagues?.length ? `<div class="related-competitions"><h2>More ${escapeHtml(country)} football competitions</h2>${renderLeagueCards(relatedLeagues, baseUrl)}</div>` : ''}
        <p class="seo-disclaimer">This page covers scores, schedules${hasTable ? ', tables' : ''} and match data. It does not advertise or provide unauthorised video streams.</p>
    </section>`;
}

function apiContent(context) {
    return `<section class="seo-directory shell api-guide" id="free-football-api" aria-labelledby="api-guide-title">
        <nav class="breadcrumbs" aria-label="Breadcrumb"><a href="/">Home</a><span>›</span><span>Free football API</span></nav>
        <div class="seo-section-heading">
            <p class="overline">Open-source JSON REST API</p>
            <h2 id="api-guide-title">Free football API for live scores, fixtures and standings</h2>
            <p>Build football apps with a free, database-backed API covering ${escapeHtml(context.leagues.length)} verified competitions. No API key is currently required for public read endpoints.</p>
        </div>
        <dl class="seo-facts api-facts">
            <div><dt>Price</dt><dd>Free</dd></div>
            <div><dt>Authentication</dt><dd>No API key</dd></div>
            <div><dt>Format</dt><dd>JSON REST</dd></div>
            <div><dt>License</dt><dd>ISC</dd></div>
        </dl>
        <div class="api-example-grid">
            <article><h2>Football fixtures API</h2><p>Browse a stored league schedule, filter by date or status, and paginate results.</p><code>GET /get/soccer/eng.1/fixtures?status=all</code></article>
            <article><h2>Live score API</h2><p>Read fixtures, in-progress match status, scores and available statistics for a date.</p><code>GET /get/soccer/eng.1/scoreboard?dates=20260822</code></article>
            <article><h2>Football standings API</h2><p>Retrieve the latest verified table or competition groups for a league and season.</p><code>GET /get/soccer/esp.1/standings?season=2026</code></article>
            <article><h2>Match events API</h2><p>Read stored match summaries and paginated play-by-play, including goals, cards and substitutions when available.</p><code>GET /get/soccer/esp.1/events/{eventId}/plays</code></article>
        </div>
        <div class="api-actions"><a class="seo-primary-link" href="/api-docs/">Open interactive API documentation</a><a class="seo-home-link" href="${GITHUB_URL}">View source code on GitHub</a></div>
        <div class="seo-topics">
            <article><h2>Stable stored data</h2><p>Public requests read MongoDB and never call an upstream football provider during the customer request.</p></article>
            <article><h2>Live data freshness</h2><p>A separate listener refreshes scores and match events. API metadata exposes collection coverage and the latest successful synchronization.</p></article>
            <article><h2>Fair-use limits</h2><p>Public endpoints use configurable rate limits to keep the free service available. Clients should cache responses and avoid unnecessary polling.</p></article>
        </div>
    </section>`;
}

function notFoundContent() {
    return `<section class="seo-directory shell">
        <div class="seo-section-heading"><h2>Competition not found</h2><p>This league is not active yet. Browse the verified football competitions currently available.</p></div>
        <a class="seo-home-link" href="/">View all football leagues</a>
    </section>`;
}

function unavailableContent() {
    return `<section class="seo-directory shell"><div class="seo-section-heading"><h2>Football data is temporarily unavailable</h2><p>The score database could not be read. Please try again shortly.</p></div></section>`;
}

function itemListSchema(leagues, baseUrl) {
    return {
        '@type': 'ItemList',
        itemListElement: leagues.map((league, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            name: leagueName(league),
            url: leagueUrl(baseUrl, league)
        }))
    };
}

function structuredData(context, canonical, description) {
    const organization = {
        '@type': 'Organization',
        '@id': `${context.baseUrl}/#organization`,
        name: SITE_NAME,
        url: `${context.baseUrl}/`,
        sameAs: [GITHUB_URL]
    };
    const website = {
        '@type': 'WebSite',
        '@id': `${context.baseUrl}/#website`,
        url: `${context.baseUrl}/`,
        name: SITE_NAME,
        publisher: { '@id': `${context.baseUrl}/#organization` },
        inLanguage: 'en',
        description: 'Free live football scores, fixtures, results, standings and open JSON API data.'
    };

    if (['notFound', 'unavailable'].includes(context.kind)) {
        return {};
    }

    if (context.kind === 'league') {
        const name = leagueName(context.league);
        const country = context.league.country || 'International';
        const hasTable = (context.standings || []).some(group => group?.entries?.length);
        return {
            '@context': 'https://schema.org',
            '@graph': [
                organization,
                website,
                {
                    '@type': 'CollectionPage',
                    '@id': `${canonical}#webpage`,
                    url: canonical,
                    name: `${name} live scores, fixtures and ${hasTable ? 'standings' : 'results'}`,
                    description,
                    isPartOf: { '@id': `${context.baseUrl}/#website` },
                    about: { '@id': `${canonical}#dataset` },
                    dateModified: context.league.last_synced_at,
                    inLanguage: 'en'
                },
                {
                    '@type': 'Dataset',
                    '@id': `${canonical}#dataset`,
                    name: `${name} fixtures, results${hasTable ? ' and standings' : ''}`,
                    description,
                    url: canonical,
                    isAccessibleForFree: true,
                    creator: { '@id': `${context.baseUrl}/#organization` },
                    license: 'https://opensource.org/licenses/ISC',
                    distribution: [{
                        '@type': 'DataDownload',
                        encodingFormat: 'application/json',
                        contentUrl: `${context.baseUrl}/get/soccer/${encodeURIComponent(context.league.slug)}/fixtures`
                    }]
                },
                {
                    '@type': 'BreadcrumbList',
                    itemListElement: [
                        { '@type': 'ListItem', position: 1, name: 'Football live scores', item: `${context.baseUrl}/` },
                        { '@type': 'ListItem', position: 2, name: `${country} football`, item: countryUrl(context.baseUrl, country) },
                        { '@type': 'ListItem', position: 3, name, item: canonical }
                    ]
                }
            ]
        };
    }

    if (context.kind === 'api') {
        return {
            '@context': 'https://schema.org',
            '@graph': [
                organization,
                website,
                {
                    '@type': 'WebPage',
                    '@id': `${canonical}#webpage`,
                    url: canonical,
                    name: 'Free football API for live scores, fixtures and standings',
                    description,
                    isPartOf: { '@id': `${context.baseUrl}/#website` },
                    mainEntity: { '@id': `${canonical}#software` },
                    inLanguage: 'en'
                },
                {
                    '@type': 'SoftwareApplication',
                    '@id': `${canonical}#software`,
                    name: 'Free Football Live Scores API',
                    applicationCategory: 'DeveloperApplication',
                    operatingSystem: 'Web',
                    isAccessibleForFree: true,
                    license: 'https://opensource.org/licenses/ISC',
                    url: canonical,
                    downloadUrl: GITHUB_URL,
                    featureList: ['Live football scores', 'Fixtures and results', 'League standings', 'Clubs and rosters', 'Match events and play-by-play']
                }
            ]
        };
    }

    const isCountry = context.kind === 'country';
    const pageName = isCountry ? `${context.country} football live scores and fixtures` : 'Football live scores, fixtures and league tables';
    return {
        '@context': 'https://schema.org',
        '@graph': [
            organization,
            website,
            {
                '@type': 'CollectionPage',
                '@id': `${canonical}#webpage`,
                url: canonical,
                name: pageName,
                description,
                isPartOf: { '@id': `${context.baseUrl}/#website` },
                isAccessibleForFree: true,
                inLanguage: 'en'
            },
            ...(!isCountry ? [{
                '@type': 'WebApplication',
                '@id': `${context.baseUrl}/#score-center`,
                name: 'Free Football Live Score Center',
                url: `${context.baseUrl}/`,
                applicationCategory: 'SportsApplication',
                operatingSystem: 'Web',
                isAccessibleForFree: true
            }, {
                '@type': 'FAQPage',
                mainEntity: [{
                    '@type': 'Question',
                    name: 'Are football scores updated live?',
                    acceptedAnswer: { '@type': 'Answer', text: 'Live match snapshots are refreshed by a dedicated listener and published from stored football data.' }
                }, {
                    '@type': 'Question',
                    name: 'Which football leagues are covered?',
                    acceptedAnswer: { '@type': 'Answer', text: 'Verified coverage includes Premier League, EFL, FA Cup, LaLiga, LaLiga 2, Copa del Rey and additional English and Spanish competitions.' }
                }, {
                    '@type': 'Question',
                    name: 'Is the football API free?',
                    acceptedAnswer: { '@type': 'Answer', text: 'Yes. Public read endpoints are free and currently require no API key, subject to fair-use rate limits.' }
                }]
            }] : []),
            itemListSchema(context.leagues || [], context.baseUrl),
            ...(isCountry ? [{
                '@type': 'BreadcrumbList',
                itemListElement: [
                    { '@type': 'ListItem', position: 1, name: 'Football live scores', item: `${context.baseUrl}/` },
                    { '@type': 'ListItem', position: 2, name: `${context.country} football`, item: canonical }
                ]
            }] : [])
        ]
    };
}

function pageMetadata(context) {
    if (context.kind === 'league') {
        const name = leagueName(context.league);
        const country = context.league.country || 'International';
        const hasTable = (context.standings || []).some(group => group?.entries?.length);
        return {
            title: `${name} Live Scores Today, Fixtures & ${hasTable ? 'Table' : 'Results'}`,
            description: `Free ${name} live scores, today's fixtures, results and match details for the ${seasonName(context.league)}.${hasTable ? ' View the latest league table.' : ''}`,
            canonical: leagueUrl(context.baseUrl, context.league),
            overline: `${country} football · ${seasonName(context.league)}`,
            heading: `${escapeHtml(name)} live scores, fixtures <em>&amp; ${hasTable ? 'table' : 'results'}.</em>`,
            lede: `Today's ${escapeHtml(name)} matches, results and schedule${hasTable ? ', plus the latest standings' : ''} in one free live score center.`,
            content: leagueContent(context),
            pageKind: 'league',
            leagueSlug: context.league.slug,
            country
        };
    }

    if (context.kind === 'country') {
        return {
            title: `${context.country} Football Live Scores Today & Fixtures`,
            description: `Free ${context.country} football live scores today, fixtures, results and available league tables across ${context.leagues.length} verified competitions.`,
            canonical: countryUrl(context.baseUrl, context.country),
            overline: 'Football competitions by country',
            heading: `${escapeHtml(context.country)} football live scores <em>&amp; fixtures.</em>`,
            lede: `Schedules, results, league tables and live match details for verified ${escapeHtml(context.country)} competitions.`,
            content: countryContent(context),
            pageKind: 'country',
            leagueSlug: '',
            country: context.country
        };
    }

    if (context.kind === 'api') {
        return {
            title: 'Free Football API for Live Scores, Fixtures & Standings',
            description: `Free JSON football API with no API key. Access live scores, fixtures, results, standings, clubs and match events across ${context.leagues.length} verified competitions.`,
            canonical: `${context.baseUrl}/football-api`,
            overline: 'Free and open-source football data',
            heading: 'Free football API for live scores, fixtures <em>&amp; standings.</em>',
            lede: 'Build football websites and apps with documented JSON endpoints, no API key and expanding verified league coverage.',
            content: apiContent(context),
            pageKind: 'api',
            leagueSlug: '',
            country: '',
            robots: 'index, follow, max-image-preview:large'
        };
    }

    if (context.kind === 'notFound') {
        return {
            title: `Competition Not Found | ${SITE_NAME}`,
            description: 'The requested football competition is not available.',
            canonical: context.canonical || `${context.baseUrl}/`,
            overline: 'Football competition',
            heading: 'Competition <em>not found.</em>',
            lede: 'Browse the active leagues with verified fixtures, results and standings.',
            content: notFoundContent(),
            pageKind: 'not-found',
            leagueSlug: '',
            country: '',
            robots: 'noindex, nofollow'
        };
    }

    if (context.kind === 'unavailable') {
        return {
            title: `Service Temporarily Unavailable | ${SITE_NAME}`,
            description: 'Football score data is temporarily unavailable.',
            canonical: `${context.baseUrl}/`,
            overline: 'Temporary service issue',
            heading: 'Football data is <em>temporarily unavailable.</em>',
            lede: 'Please try again shortly.',
            content: unavailableContent(),
            pageKind: 'unavailable',
            leagueSlug: '',
            country: '',
            robots: 'noindex, nofollow'
        };
    }

    return {
        title: 'Free Football Live Scores Today, Fixtures & Results',
        description: `Free live football scores today, fixtures, results and available league tables across ${context.leagues.length} verified competitions, plus an open football API.`,
        canonical: `${context.baseUrl}/`,
        overline: 'Free live football score center and API',
        heading: 'Free football live scores today, fixtures <em>&amp; results.</em>',
        lede: "Follow today's football matches, live scores, schedules, results and verified league tables across England and Spain.",
        content: homeContent(context),
        pageKind: 'home',
        leagueSlug: '',
        country: '',
        robots: 'index, follow, max-image-preview:large'
    };
}

function renderSeoPage(template, context) {
    const metadata = pageMetadata(context);
    const schema = structuredData(context, metadata.canonical, metadata.description);
    const replacements = {
        '{{SEO_TITLE}}': escapeHtml(metadata.title),
        '{{SEO_DESCRIPTION}}': escapeHtml(metadata.description),
        '{{SEO_ROBOTS}}': escapeHtml(metadata.robots || 'index, follow, max-image-preview:large'),
        '{{SEO_CANONICAL}}': escapeHtml(metadata.canonical),
        '{{SEO_JSON_LD}}': safeJson(schema),
        '{{SEO_OVERLINE}}': escapeHtml(metadata.overline),
        '{{SEO_HEADING}}': metadata.heading,
        '{{SEO_LEDE}}': metadata.lede,
        '{{SEO_CONTENT}}': metadata.content,
        '{{PAGE_KIND}}': escapeHtml(metadata.pageKind),
        '{{LEAGUE_SLUG}}': escapeHtml(metadata.leagueSlug),
        '{{COUNTRY_NAME}}': escapeHtml(metadata.country)
    };

    return Object.entries(replacements).reduce(
        (html, [token, value]) => html.split(token).join(value),
        template
    );
}

module.exports = {
    countryUrl,
    escapeHtml,
    leagueName,
    leagueUrl,
    pageMetadata,
    renderSeoPage,
    slugifyCountry
};
