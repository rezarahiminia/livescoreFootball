const SITE_NAME = 'Soccer Clubs Data';

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
        || league.abbreviation
        || league.name
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
            <p>Live scores, fixtures, results${league.kind === 'club' ? ' and league tables' : ''}</p>
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

function renderMatchList(title, matches) {
    if (!matches?.length) return '';

    return `<section class="seo-match-block">
        <h3>${escapeHtml(title)}</h3>
        <ol class="seo-match-list">${matches.map(match => {
        const home = match.home?.display_name || match.home?.name || 'Home team';
        const away = match.away?.display_name || match.away?.name || 'Away team';
        const isoDate = new Date(match.date);
        const dateTime = Number.isNaN(isoDate.getTime()) ? '' : isoDate.toISOString();
        return `<li>
                <span><strong>${escapeHtml(home)}</strong> vs <strong>${escapeHtml(away)}</strong></span>
                <time${dateTime ? ` datetime="${dateTime}"` : ''}>${escapeHtml(formatMatchDate(match.date))}</time>
                <b>${escapeHtml(matchStatus(match))}</b>
            </li>`;
    }).join('')}</ol>
    </section>`;
}

function homeContent(context) {
    const { leagues, baseUrl } = context;
    return `<section class="seo-directory shell" id="competitions" aria-labelledby="coverage-title">
        <div class="seo-section-heading">
            <p class="overline">Free football score center</p>
            <h2 id="coverage-title">Football live scores by league and country</h2>
            <p>Track football live scores today, upcoming fixtures, completed results, league tables and match details. Coverage starts with England and Spain and expands country by country after each competition is verified.</p>
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
                <h2>Free football API for developers</h2>
                <p>Use the documented JSON REST API for football fixtures, live score data, clubs, match events and standings. <a href="/api-docs/">Explore the football API documentation</a>.</p>
            </article>
        </div>
    </section>`;
}

function countryContent(context) {
    const { leagues, baseUrl, country } = context;
    return `<section class="seo-directory shell" id="competitions" aria-labelledby="coverage-title">
        <nav class="breadcrumbs" aria-label="Breadcrumb"><a href="/">Home</a><span>›</span><span>${escapeHtml(country)} football</span></nav>
        <div class="seo-section-heading">
            <p class="overline">${escapeHtml(country)} football data</p>
            <h2 id="coverage-title">${escapeHtml(country)} football fixtures, results and tables</h2>
            <p>Choose a ${escapeHtml(country)} competition for live score updates, today's matches, upcoming schedules, completed results, clubs and current standings.</p>
        </div>
        ${renderLeagueCards(leagues, baseUrl)}
        <p class="seo-disclaimer">Scores and match details are free to view. This service provides football data and does not claim to provide live video streaming.</p>
    </section>`;
}

function leagueContent(context) {
    const { league, relatedLeagues, upcomingMatches, recentMatches, matchCount, baseUrl } = context;
    const name = leagueName(league);
    const country = league.country || 'International';
    const season = seasonName(league);

    return `<section class="seo-directory shell" id="competition-guide" aria-labelledby="coverage-title">
        <nav class="breadcrumbs" aria-label="Breadcrumb">
            <a href="/">Home</a><span>›</span>
            <a href="${escapeHtml(countryUrl(baseUrl, country))}">${escapeHtml(country)} football</a><span>›</span>
            <span>${escapeHtml(name)}</span>
        </nav>
        <div class="seo-section-heading">
            <p class="overline">${escapeHtml(season)}</p>
            <h2 id="coverage-title">${escapeHtml(name)} live scores, fixtures and standings</h2>
            <p>Follow ${escapeHtml(name)} live scores today, the complete fixture schedule, finished match results, the current table and detailed match events. Data refreshes throughout live matches and remains free to view.</p>
        </div>
        <dl class="seo-facts">
            <div><dt>Competition</dt><dd>${escapeHtml(name)}</dd></div>
            <div><dt>Country</dt><dd>${escapeHtml(country)}</dd></div>
            <div><dt>Season</dt><dd>${escapeHtml(season)}</dd></div>
            <div><dt>Stored matches</dt><dd>${escapeHtml(matchCount)}</dd></div>
        </dl>
        <div class="seo-match-columns">
            ${renderMatchList(`${name} upcoming fixtures`, upcomingMatches)}
            ${renderMatchList(`${name} latest results`, recentMatches)}
        </div>
        ${relatedLeagues?.length ? `<div class="related-competitions"><h2>More ${escapeHtml(country)} football competitions</h2>${renderLeagueCards(relatedLeagues, baseUrl)}</div>` : ''}
        <p class="seo-disclaimer">This page covers scores, schedules, tables and match data. It does not advertise or provide unauthorised video streams.</p>
    </section>`;
}

function notFoundContent() {
    return `<section class="seo-directory shell">
        <div class="seo-section-heading"><h2>Competition not found</h2><p>This league is not active yet. Browse the verified football competitions currently available.</p></div>
        <a class="seo-home-link" href="/">View all football leagues</a>
    </section>`;
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
        url: `${context.baseUrl}/`
    };
    const website = {
        '@type': 'WebSite',
        '@id': `${context.baseUrl}/#website`,
        url: `${context.baseUrl}/`,
        name: SITE_NAME,
        publisher: { '@id': `${context.baseUrl}/#organization` },
        inLanguage: 'en'
    };

    if (context.kind === 'notFound') {
        return {
            '@context': 'https://schema.org',
            '@type': 'WebPage',
            url: canonical,
            name: 'Competition not found',
            description
        };
    }

    if (context.kind === 'league') {
        const name = leagueName(context.league);
        const country = context.league.country || 'International';
        return {
            '@context': 'https://schema.org',
            '@graph': [
                organization,
                website,
                {
                    '@type': 'CollectionPage',
                    '@id': `${canonical}#webpage`,
                    url: canonical,
                    name: `${name} live scores, fixtures and standings`,
                    description,
                    isPartOf: { '@id': `${context.baseUrl}/#website` },
                    about: { '@id': `${canonical}#dataset` },
                    inLanguage: 'en'
                },
                {
                    '@type': 'Dataset',
                    '@id': `${canonical}#dataset`,
                    name: `${name} fixtures, results and standings`,
                    description,
                    url: canonical,
                    isAccessibleForFree: true,
                    creator: { '@id': `${context.baseUrl}/#organization` },
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

    const isCountry = context.kind === 'country';
    const pageName = isCountry ? `${context.country} football live scores and fixtures` : 'Football live scores, fixtures and league tables';
    return {
        '@context': 'https://schema.org',
        '@graph': [
            organization,
            website,
            {
                '@type': isCountry ? 'CollectionPage' : 'WebApplication',
                '@id': `${canonical}#webpage`,
                url: canonical,
                name: pageName,
                description,
                isAccessibleForFree: true,
                inLanguage: 'en',
                ...(isCountry ? {} : { applicationCategory: 'SportsApplication', operatingSystem: 'Web' })
            },
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
        return {
            title: `${name} Live Scores, Fixtures & Table | Soccer Clubs`,
            description: `Follow ${name} live scores, today's fixtures, results, schedule, table and match details for the ${seasonName(context.league)}. Free and regularly updated.`,
            keywords: `${name} live scores, ${name} fixtures, ${name} results, ${name} table, ${name} standings, ${country} football scores, football live scores today`,
            canonical: leagueUrl(context.baseUrl, context.league),
            overline: `${country} football · ${seasonName(context.league)}`,
            heading: `${escapeHtml(name)} live scores, fixtures <em>&amp; table.</em>`,
            lede: `Today's ${escapeHtml(name)} matches, results, schedule, standings and live match details in one free score center.`,
            content: leagueContent(context),
            pageKind: 'league',
            leagueSlug: context.league.slug,
            country
        };
    }

    if (context.kind === 'country') {
        return {
            title: `${context.country} Football Live Scores & Fixtures | Soccer Clubs`,
            description: `Follow ${context.country} football live scores, today's fixtures, results, schedules and league tables across every verified competition we cover.`,
            keywords: `${context.country} football live scores, ${context.country} football fixtures, ${context.country} league tables, ${context.country} football results, football scores today`,
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

    if (context.kind === 'notFound') {
        return {
            title: `Competition Not Found | ${SITE_NAME}`,
            description: 'The requested football competition is not available.',
            keywords: '',
            canonical: `${context.baseUrl}/`,
            overline: 'Football competition',
            heading: 'Competition <em>not found.</em>',
            lede: 'Browse the active leagues with verified fixtures, results and standings.',
            content: notFoundContent(),
            pageKind: 'not-found',
            leagueSlug: '',
            country: ''
        };
    }

    return {
        title: 'Football Live Scores, Fixtures & Tables | Soccer Clubs',
        description: "Follow free Premier League and LaLiga live scores, today's football fixtures, results, tables and match details. More leagues are added country by country.",
        keywords: 'football live scores, football live scores today, football fixtures, football results, league tables, Premier League scores, LaLiga scores, free football API',
        canonical: `${context.baseUrl}/`,
        overline: 'Free club football score center',
        heading: 'Football live scores, fixtures <em>&amp; tables.</em>',
        lede: "Follow today's matches, results, schedules and standings across England, Spain and every verified league we add next.",
        content: homeContent(context),
        pageKind: 'home',
        leagueSlug: '',
        country: ''
    };
}

function renderSeoPage(template, context) {
    const metadata = pageMetadata(context);
    const schema = structuredData(context, metadata.canonical, metadata.description);
    const replacements = {
        '{{SEO_TITLE}}': escapeHtml(metadata.title),
        '{{SEO_DESCRIPTION}}': escapeHtml(metadata.description),
        '{{SEO_KEYWORDS}}': escapeHtml(metadata.keywords),
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
