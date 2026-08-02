(() => {
    'use strict';

    const state = {
        leagues: [],
        league: null,
        fixtures: [],
        fixturePage: 1,
        fixturePageCount: 1,
        standings: [],
        matchTimer: null,
        currentEventId: null
    };

    const statLabels = {
        gamesPlayed: 'Played', wins: 'Wins', ties: 'Draws', losses: 'Losses',
        points: 'Points', pointDifferential: 'Goal difference', goalDifference: 'Goal difference',
        pointsFor: 'Goals for', pointsAgainst: 'Goals against', possessionPct: 'Possession',
        totalShots: 'Total shots', shotsOnTarget: 'Shots on target', wonCorners: 'Corners',
        foulsCommitted: 'Fouls'
    };

    const elements = Object.fromEntries([
        'service-status', 'stat-competitions', 'stat-matches', 'stat-events',
        'country-select', 'league-select', 'league-card', 'league-logo', 'league-name',
        'league-season', 'coverage-matches', 'coverage-clubs', 'coverage-tables',
        'welcome-state', 'league-dashboard', 'dashboard-country', 'dashboard-title',
        'refresh-button', 'fixtures-tab', 'standings-tab', 'fixture-count', 'fixtures-view',
        'standings-view', 'date-from', 'date-to', 'fixture-status', 'apply-fixture-filter',
        'fixtures-loading', 'fixtures-empty', 'fixtures-list', 'fixtures-load-more', 'standings-loading',
        'standings-empty', 'standings-content', 'match-dialog', 'dialog-status',
        'dialog-date', 'dialog-content', 'close-dialog', 'toast'
    ].map(id => [id, document.getElementById(id)]));

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function safeUrl(value) {
        try {
            const url = new URL(String(value));
            return ['http:', 'https:'].includes(url.protocol) ? escapeHtml(url.href) : '';
        } catch {
            return '';
        }
    }

    function formatNumber(value) {
        return new Intl.NumberFormat('en-US').format(Number(value) || 0);
    }

    function formatDate(value, options = {}) {
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return 'Time unavailable';
        return new Intl.DateTimeFormat('en-US', {
            timeZone: 'Asia/Tehran',
            weekday: options.weekday === false ? undefined : 'long',
            month: 'long',
            day: 'numeric',
            year: options.year ? 'numeric' : undefined
        }).format(date);
    }

    function formatTime(value) {
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return '—';
        return new Intl.DateTimeFormat('en-GB', {
            timeZone: 'Asia/Tehran', hour: '2-digit', minute: '2-digit', hour12: false
        }).format(date);
    }

    async function fetchJson(path) {
        const response = await fetch(path, { headers: { Accept: 'application/json' } });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) {
            const message = typeof body.error === 'string'
                ? body.error
                : body.error?.message || `HTTP ${response.status}`;
            throw new Error(message);
        }
        return body;
    }

    function showToast(message) {
        elements.toast.textContent = message;
        elements.toast.hidden = false;
        window.clearTimeout(showToast.timer);
        showToast.timer = window.setTimeout(() => { elements.toast.hidden = true; }, 4200);
    }

    function localCountryName(country) {
        return country || 'Other';
    }

    function setServiceStatus(type, text) {
        elements['service-status'].className = `nav-status ${type ? `is-${type}` : ''}`;
        elements['service-status'].lastElementChild.textContent = text;
    }

    function teamLogo(team, className = 'team-logo') {
        const logo = safeUrl(team?.logo || team?.logos?.[0]?.href);
        const abbreviation = escapeHtml(team?.abbreviation || 'FC');
        return `<span class="${className}">${logo ? `<img src="${logo}" alt="" loading="lazy">` : abbreviation}</span>`;
    }

    function competitionFromEvent(event) {
        return event?.competitions?.[0] || {};
    }

    function competitorsFromEvent(event) {
        const competitors = competitionFromEvent(event).competitors || [];
        return {
            home: competitors.find(item => item.homeAway === 'home') || competitors[0] || {},
            away: competitors.find(item => item.homeAway === 'away') || competitors[1] || {}
        };
    }

    function statusInfo(event) {
        const status = event?.status || competitionFromEvent(event).status || {};
        const type = status.type || {};
        const stateName = type.state || 'unknown';
        if (stateName === 'in') {
            return { state: 'live', label: status.displayClock || type.shortDetail || 'Live' };
        }
        if (stateName === 'post' || type.completed) {
            return { state: 'finished', label: type.shortDetail || 'Full time' };
        }
        return { state: 'scheduled', label: type.shortDetail || 'Scheduled' };
    }

    function setLoading(kind, loading) {
        elements[`${kind}-loading`].hidden = !loading;
        if (loading) elements[`${kind}-empty`].hidden = true;
    }

    async function loadMeta() {
        try {
            const data = await fetchJson('/get/soccer/meta');
            elements['stat-competitions'].textContent = formatNumber(data.coverage.activeClubCompetitions);
            elements['stat-matches'].textContent = formatNumber(data.coverage.matches);
            elements['stat-events'].textContent = formatNumber(data.coverage.playByPlayEvents);
            setServiceStatus('online', 'Service online');
        } catch (error) {
            setServiceStatus('error', 'Service unavailable');
        }
    }

    async function loadLeagues() {
        const data = await fetchJson('/get/soccer/leagues?kind=club&available=true');
        state.leagues = data.leagues || [];
        populateCountries();
    }

    function populateCountries() {
        const countries = [...new Set(state.leagues.map(league => league.country || 'Other'))]
            .sort((a, b) => localCountryName(a).localeCompare(localCountryName(b), 'en'));

        elements['country-select'].replaceChildren(new Option('Choose a country', ''));
        for (const country of countries) {
            elements['country-select'].add(new Option(localCountryName(country), country));
        }
        elements['country-select'].disabled = false;

        const requestedSlug = document.body.dataset.leagueSlug
            || new URLSearchParams(location.search).get('league');
        const requestedCountry = document.body.dataset.country;
        const preferredLeague = state.leagues.find(item => item.slug === requestedSlug)
            || state.leagues.find(item => requestedCountry && item.country === requestedCountry)
            || state.leagues.find(item => item.slug === 'esp.1')
            || state.leagues[0];

        if (preferredLeague) {
            elements['country-select'].value = preferredLeague.country || 'Other';
            populateLeagues(preferredLeague.slug);
        }
    }

    function populateLeagues(preferredSlug = '') {
        const country = elements['country-select'].value;
        const leagues = state.leagues.filter(league => (league.country || 'Other') === country);
        elements['league-select'].replaceChildren(new Option('Choose a league', ''));
        for (const league of leagues) {
            const suffix = league.coverage?.matches ? ` · ${formatNumber(league.coverage.matches)} matches` : '';
            elements['league-select'].add(new Option(`${league.name}${suffix}`, league.slug));
        }
        elements['league-select'].disabled = !country;

        const selected = leagues.find(league => league.slug === preferredSlug) || null;
        if (selected) {
            elements['league-select'].value = selected.slug;
            selectLeague(selected.slug);
        } else {
            clearDashboard();
        }
    }

    function clearDashboard() {
        state.league = null;
        elements['league-card'].hidden = true;
        elements['welcome-state'].hidden = false;
        elements['league-dashboard'].hidden = true;
    }

    function updateLeagueCard(league) {
        elements['league-card'].hidden = false;
        elements['league-name'].textContent = league.name;
        elements['league-season'].textContent = league.season?.display_name || `Season ${league.season?.year || '—'}`;
        elements['coverage-matches'].textContent = formatNumber(league.coverage?.matches);
        elements['coverage-clubs'].textContent = formatNumber(league.coverage?.clubs);
        elements['coverage-tables'].textContent = formatNumber(league.coverage?.standingsGroups);

        const logo = safeUrl(league.logo);
        elements['league-logo'].innerHTML = logo
            ? `<img src="${logo}" alt="">`
            : escapeHtml(league.abbreviation?.slice(0, 3) || 'SC');
    }

    async function selectLeague(slug) {
        const league = state.leagues.find(item => item.slug === slug);
        if (!league) return clearDashboard();

        state.league = league;
        window.clearInterval(state.matchTimer);
        updateLeagueCard(league);
        elements['welcome-state'].hidden = true;
        elements['league-dashboard'].hidden = false;
        elements['dashboard-country'].textContent = localCountryName(league.country);
        elements['dashboard-title'].textContent = league.name;

        await Promise.allSettled([loadFixtures(), loadStandings()]);
    }

    function fixtureQuery(page) {
        const params = new URLSearchParams({
            limit: '100',
            page: String(page),
            status: elements['fixture-status'].value
        });
        if (elements['date-from'].value) params.set('from', elements['date-from'].value.replaceAll('-', ''));
        if (elements['date-to'].value) params.set('to', elements['date-to'].value.replaceAll('-', ''));
        return params;
    }

    async function loadFixtures({ append = false } = {}) {
        if (!state.league) return;
        setLoading('fixtures', true);
        if (!append) {
            state.fixturePage = 1;
            state.fixtures = [];
            elements['fixtures-list'].replaceChildren();
        }
        try {
            const page = append ? state.fixturePage + 1 : 1;
            const data = await fetchJson(`/get/soccer/${encodeURIComponent(state.league.slug)}/fixtures?${fixtureQuery(page)}`);
            state.fixturePage = data.pageIndex || page;
            state.fixturePageCount = data.pageCount || 1;
            state.fixtures = append
                ? [...state.fixtures, ...(data.events || [])]
                : (data.events || []);
            elements['fixture-count'].textContent = formatNumber(data.count);
            renderFixtures(state.fixtures);
        } catch (error) {
            elements['fixtures-empty'].hidden = false;
            showToast(`Unable to load fixtures: ${error.message}`);
        } finally {
            setLoading('fixtures', false);
        }
    }

    function renderFixtures(fixtures) {
        elements['fixtures-empty'].hidden = fixtures.length > 0;
        elements['fixtures-load-more'].hidden = !fixtures.length || state.fixturePage >= state.fixturePageCount;
        if (!fixtures.length) return;

        const groups = new Map();
        for (const event of fixtures) {
            const key = String(event.date || '').slice(0, 10) || 'unknown';
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key).push(event);
        }

        elements['fixtures-list'].innerHTML = [...groups.entries()].map(([, events]) => `
            <section class="fixture-day">
                <div class="day-label">${escapeHtml(formatDate(events[0].date, { year: true }))}</div>
                ${events.map(renderMatchRow).join('')}
            </section>
        `).join('');
    }

    function renderMatchRow(event) {
        const { home, away } = competitorsFromEvent(event);
        const status = statusInfo(event);
        const hasScore = status.state !== 'scheduled';
        const center = hasScore
            ? `<span class="score">${escapeHtml(home.score ?? '—')} - ${escapeHtml(away.score ?? '—')}</span>`
            : `<span class="kickoff">${escapeHtml(formatTime(event.date))}</span>`;

        return `<button class="match-row" type="button" data-event-id="${escapeHtml(event.id)}" aria-label="Match details for ${escapeHtml(home.team?.displayName)} versus ${escapeHtml(away.team?.displayName)}">
            <span class="match-team home">${teamLogo(home.team)}<span class="team-name">${escapeHtml(home.team?.displayName || home.team?.name || 'Home')}</span></span>
            <span class="match-center">${center}<span class="match-state ${status.state}">${escapeHtml(status.label)}</span></span>
            <span class="match-team away"><span class="team-name">${escapeHtml(away.team?.displayName || away.team?.name || 'Away')}</span>${teamLogo(away.team)}</span>
            <span class="match-arrow" aria-hidden="true">‹</span>
        </button>`;
    }

    async function loadStandings() {
        if (!state.league) return;
        setLoading('standings', true);
        elements['standings-content'].replaceChildren();
        try {
            const data = await fetchJson(`/get/soccer/${encodeURIComponent(state.league.slug)}/standings`);
            state.standings = data.children || [];
            renderStandings(state.standings);
        } catch (error) {
            elements['standings-empty'].hidden = false;
            showToast(`Unable to load standings: ${error.message}`);
        } finally {
            setLoading('standings', false);
        }
    }

    function statValue(entry, ...names) {
        const stats = entry.stats || [];
        for (const name of names) {
            const stat = stats.find(item => item.name === name);
            if (stat) return stat.displayValue ?? '—';
        }
        return '—';
    }

    function renderStandings(groups) {
        elements['standings-empty'].hidden = groups.length > 0;
        if (!groups.length) return;

        elements['standings-content'].innerHTML = groups.map(group => {
            const entries = group.standings?.entries || [];
            return `<section class="standing-group">
                <h3>${escapeHtml(group.name || 'League table')}</h3>
                <div class="table-wrap"><table class="standings-table">
                    <thead><tr><th>Pos</th><th>Team</th><th>Pl</th><th>W</th><th>D</th><th>L</th><th>GD</th><th>Pts</th></tr></thead>
                    <tbody>${entries.map(entry => `<tr>
                        <td class="rank">${escapeHtml(entry.rank ?? statValue(entry, 'rank'))}</td>
                        <td><span class="standing-team">${teamLogo(entry.team)}<span>${escapeHtml(entry.team?.displayName || entry.team?.name || '—')}</span></span></td>
                        <td>${escapeHtml(statValue(entry, 'gamesPlayed'))}</td>
                        <td>${escapeHtml(statValue(entry, 'wins'))}</td>
                        <td>${escapeHtml(statValue(entry, 'ties', 'draws'))}</td>
                        <td>${escapeHtml(statValue(entry, 'losses'))}</td>
                        <td>${escapeHtml(statValue(entry, 'goalDifference', 'pointDifferential'))}</td>
                        <td class="points">${escapeHtml(statValue(entry, 'points'))}</td>
                    </tr>`).join('')}</tbody>
                </table></div>
            </section>`;
        }).join('');
    }

    function switchView(view) {
        const fixtures = view === 'fixtures';
        elements['fixtures-view'].hidden = !fixtures;
        elements['standings-view'].hidden = fixtures;
        elements['fixtures-tab'].classList.toggle('is-active', fixtures);
        elements['standings-tab'].classList.toggle('is-active', !fixtures);
        elements['fixtures-tab'].setAttribute('aria-selected', String(fixtures));
        elements['standings-tab'].setAttribute('aria-selected', String(!fixtures));
    }

    async function openMatch(eventId) {
        state.currentEventId = eventId;
        window.clearInterval(state.matchTimer);
        if (!elements['match-dialog'].open) elements['match-dialog'].showModal();
        await loadMatchDetails(eventId, false);
    }

    async function loadMatchDetails(eventId, silent) {
        if (!state.league || state.currentEventId !== eventId) return;
        if (!silent) {
            elements['dialog-status'].textContent = 'Loading';
            elements['dialog-status'].className = 'match-state';
            elements['dialog-date'].textContent = '—';
            elements['dialog-content'].innerHTML = '<div class="content-state"><span class="loader"></span><p>Loading match details…</p></div>';
        }

        const base = `/get/soccer/${encodeURIComponent(state.league.slug)}/events/${encodeURIComponent(eventId)}`;
        const [summaryResult, playsResult] = await Promise.allSettled([
            fetchJson(base),
            fetchJson(`${base}/plays?important=true&limit=300`)
        ]);

        if (summaryResult.status === 'rejected') {
            elements['dialog-content'].innerHTML = `<div class="content-state"><span class="empty-icon">!</span><p>${escapeHtml(summaryResult.reason.message)}</p></div>`;
            return;
        }

        const summary = summaryResult.value;
        const plays = playsResult.status === 'fulfilled' ? playsResult.value.items || [] : [];
        renderMatchDetails(summary, plays);

        const competition = summary.header?.competitions?.[0] || {};
        const status = competition.status?.type?.state;
        if (status === 'in') {
            window.clearInterval(state.matchTimer);
            state.matchTimer = window.setInterval(() => loadMatchDetails(eventId, true), 15000);
        }
    }

    function matchEventKind(event) {
        const type = `${event.type?.type || ''} ${event.type?.text || ''}`.toLowerCase();
        if (event.scoringPlay || type.includes('goal')) return 'goal';
        if (event.redCard || type.includes('red card')) return 'red-card';
        if (event.yellowCard || type.includes('yellow card')) return 'yellow-card';
        if (event.substitution || type.includes('substitution')) return 'substitution';
        return 'event';
    }

    function eventTeam(event, home, away) {
        const id = String(event.team?.id || event.team?.source_id
            || event.athletesInvolved?.[0]?.team?.id || '');
        const homeId = String(home.id || home.team?.id || '');
        const awayId = String(away.id || away.team?.id || '');
        if (id && id === homeId) return home.team;
        if (id && id === awayId) return away.team;
        if (event.team?.side === 'home') return home.team;
        if (event.team?.side === 'away') return away.team;
        return event.team || null;
    }

    function normalizeMatchEvent(event, index, source, home, away) {
        const athlete = event.athletesInvolved?.[0] || null;
        const participants = (event.participants || []).map(participant =>
            participant.athlete || participant).filter(Boolean);
        const kind = matchEventKind(event);
        const typeText = event.type?.text || event.type?.type || 'Match event';
        const team = eventTeam(event, home, away);
        const athleteName = athlete?.displayName || athlete?.fullName || athlete?.shortName || '';
        const text = event.text || event.alternativeText
            || (athleteName ? `${athleteName} · ${typeText}` : typeText);
        return {
            id: event.id || `${source}-${index}`,
            source,
            kind,
            text,
            typeText,
            athlete,
            participants,
            team,
            clock: event.clock?.displayValue || '',
            clockValue: Number(event.clock?.value) || 0,
            scoringPlay: kind === 'goal',
            penaltyKick: Boolean(event.penaltyKick),
            ownGoal: Boolean(event.ownGoal)
        };
    }

    function substitutionPlayers(event, summary) {
        const roster = (summary.rosters || []).flatMap(team => team.roster || []);
        const participantIds = new Set((event.participants || []).map(player => String(player.id || '')));
        const eventText = String(event.text || '').toLowerCase();
        const belongsToEvent = entry => {
            const athlete = entry.athlete || {};
            return participantIds.has(String(athlete.id || ''))
                || (athlete.displayName && eventText.includes(athlete.displayName.toLowerCase()));
        };
        const incomingEntry = roster.find(entry => entry.subbedIn && belongsToEvent(entry));
        const outgoingEntry = roster.find(entry => entry.subbedOut && belongsToEvent(entry));
        const incoming = incomingEntry?.athlete || outgoingEntry?.subbedOutFor?.athlete
            || event.participants?.[0] || null;
        const outgoing = outgoingEntry?.athlete || incomingEntry?.subbedInFor?.athlete
            || event.participants?.[1] || null;
        return { incoming, outgoing };
    }

    function matchTimeline(summary, plays, home, away) {
        const keyEvents = (summary.keyEvents || []).map((event, index) =>
            normalizeMatchEvent(event, index, 'key-event', home, away));
        const playEvents = (plays || []).map((event, index) =>
            normalizeMatchEvent(event, index, 'play', home, away));

        // Summary keyEvents can omit substitutions even when they exist in the
        // stored play feed. Merge both sources and prefer the richer summary
        // item when the same event occurs in both.
        const events = [];
        const seen = new Set();
        for (const event of [...keyEvents, ...playEvents]) {
            const teamId = event.team?.id || event.team?.source_id || event.team?.displayName || '';
            const signature = `${event.kind}|${event.clockValue}|${teamId}`;
            if (seen.has(signature)) continue;
            seen.add(signature);
            events.push(event);
        }
        return events.sort((left, right) => left.clockValue - right.clockValue);
    }

    function eventBadge(kind) {
        const labels = {
            goal: 'GOAL',
            'red-card': 'RED',
            'yellow-card': 'YELLOW',
            substitution: 'SUB',
            event: 'EVENT'
        };
        return `<span class="event-badge ${kind}">${labels[kind]}</span>`;
    }

    function renderMatchDetails(summary, plays) {
        const competition = summary.header?.competitions?.[0] || {};
        const event = { date: competition.date, competitions: [competition], status: competition.status };
        const { home, away } = competitorsFromEvent(event);
        const status = statusInfo(event);
        const venue = summary.gameInfo?.venue;
        const homeStats = summary.boxscore?.teams?.find(item => item.homeAway === 'home')?.statistics || [];
        const awayStats = summary.boxscore?.teams?.find(item => item.homeAway === 'away')?.statistics || [];
        const events = matchTimeline(summary, plays, home, away);
        const scorers = events.filter(event => event.scoringPlay);
        const substitutions = events.filter(event => event.kind === 'substitution').map(event => ({
            ...event,
            ...substitutionPlayers(event, summary)
        }));

        elements['dialog-status'].textContent = status.label;
        elements['dialog-status'].className = `match-state ${status.state}`;
        elements['dialog-date'].textContent = `${formatDate(competition.date, { year: true })} · ${formatTime(competition.date)}`;

        const statNames = [...new Set([...homeStats, ...awayStats].map(item => item.name))].slice(0, 12);
        const statRows = statNames.map(name => {
            const homeValue = homeStats.find(item => item.name === name)?.displayValue ?? '—';
            const awayValue = awayStats.find(item => item.name === name)?.displayValue ?? '—';
            return `<div class="stat-row"><strong>${escapeHtml(homeValue)}</strong><span>${escapeHtml(statLabels[name] || name)}</span><strong>${escapeHtml(awayValue)}</strong></div>`;
        }).join('');

        const scorerRows = scorers.map(goal => {
            const detail = [
                goal.team?.displayName || goal.team?.name,
                goal.penaltyKick ? 'Penalty' : '',
                goal.ownGoal ? 'Own goal' : ''
            ].filter(Boolean).join(' · ');
            return `<div class="scorer-row">
                ${eventBadge('goal')}
                <div><strong>${escapeHtml(goal.athlete?.displayName || goal.athlete?.fullName || goal.text || 'Scorer unavailable')}</strong>
                <span>${escapeHtml(detail || goal.typeText)}</span></div>
                <time>${escapeHtml(goal.clock || '—')}</time>
            </div>`;
        }).join('');

        const timeline = events.map(event => `<div class="play-row ${event.kind}">
            <span class="play-time">${escapeHtml(event.clock || '—')}</span>
            ${eventBadge(event.kind)}
            <div><p>${escapeHtml(event.text)}</p>${event.team?.displayName || event.team?.name
                ? `<small>${escapeHtml(event.team.displayName || event.team.name)}</small>` : ''}</div>
        </div>`).join('');

        const substitutionRows = substitutions.map(item => `<div class="substitution-row">
            <div class="substitution-team">${teamLogo(item.team, 'substitution-logo')}<span>${escapeHtml(item.team?.displayName || item.team?.name || 'Team unavailable')}</span></div>
            <div class="player-change">
                <span class="player-in"><i>IN</i><strong>${escapeHtml(item.incoming?.displayName || item.incoming?.fullName || 'Player unavailable')}</strong></span>
                <span class="player-out"><i>OUT</i><strong>${escapeHtml(item.outgoing?.displayName || item.outgoing?.fullName || 'Player unavailable')}</strong></span>
            </div>
            <time>${escapeHtml(item.clock || '—')}</time>
        </div>`).join('');

        elements['dialog-content'].innerHTML = `
            <section class="match-hero">
                <div class="dialog-team">${teamLogo(home.team)}<strong>${escapeHtml(home.team?.displayName || 'Home')}</strong></div>
                <div><div class="dialog-score">${escapeHtml(home.score ?? '—')} - ${escapeHtml(away.score ?? '—')}</div><div class="dialog-clock">${escapeHtml(competition.status?.displayClock || status.label)}</div></div>
                <div class="dialog-team">${teamLogo(away.team)}<strong>${escapeHtml(away.team?.displayName || 'Away')}</strong></div>
            </section>
            <div class="match-meta">
                <span>Venue: ${escapeHtml(venue?.fullName || 'Unknown')}</span>
                <span>City: ${escapeHtml(venue?.address?.city || '—')}</span>
                <span>Attendance: ${escapeHtml(competition.attendance || '—')}</span>
            </div>
            <div class="detail-grid">
                <section class="detail-section full"><h3>Goal scorers</h3><div class="scorers-list">${scorerRows || '<p class="detail-empty">No goals have been stored for this match.</p>'}</div></section>
                <section class="detail-section full"><h3>Substitutions</h3><div class="substitutions-list">${substitutionRows || '<p class="detail-empty">No substitutions have been stored for this match.</p>'}</div></section>
                <section class="detail-section"><h3>Match statistics</h3>${statRows || '<p class="detail-empty">No statistics have been stored for this match.</p>'}</section>
                <section class="detail-section"><h3>Match information</h3>
                    <div class="stat-row"><strong>${escapeHtml(home.team?.abbreviation || '—')}</strong><span>Home / Away</span><strong>${escapeHtml(away.team?.abbreviation || '—')}</strong></div>
                    <div class="stat-row"><strong>${escapeHtml(home.form || '—')}</strong><span>Form</span><strong>${escapeHtml(away.form || '—')}</strong></div>
                    <div class="stat-row"><strong>${escapeHtml(home.winner ? 'Winner' : '—')}</strong><span>Result</span><strong>${escapeHtml(away.winner ? 'Winner' : '—')}</strong></div>
                </section>
                <section class="detail-section full"><h3>Match timeline</h3><div class="timeline">${timeline || '<p class="detail-empty">No play-by-play events have been stored for this match yet.</p>'}</div></section>
                <section class="detail-section full"><h3>Data availability</h3>
                    <div class="availability-grid">
                        <div class="availability-item available"><strong>Match timeline</strong><span>Stored in soccer_match_events</span></div>
                        <div class="availability-item available"><strong>Match goals</strong><span>Timeline and key_events</span></div>
                        <div class="availability-item available"><strong>Statistics &amp; summary</strong><span>Stored in soccer_matches</span></div>
                        <div class="availability-item unavailable"><strong>League top scorers</strong><span>Not structurally stored; raw snapshots are internal</span></div>
                    </div>
                </section>
            </div>`;
    }

    function closeMatchDialog() {
        window.clearInterval(state.matchTimer);
        state.matchTimer = null;
        state.currentEventId = null;
        elements['match-dialog'].close();
    }

    function bindEvents() {
        elements['country-select'].addEventListener('change', () => populateLeagues());
        elements['league-select'].addEventListener('change', event => {
            const slug = event.target.value;
            if (slug) window.location.assign(`/football/${encodeURIComponent(slug)}`);
        });
        elements['refresh-button'].addEventListener('click', () => Promise.allSettled([loadFixtures(), loadStandings(), loadMeta()]));
        elements['apply-fixture-filter'].addEventListener('click', () => loadFixtures());
        elements['fixtures-load-more'].addEventListener('click', () => loadFixtures({ append: true }));
        elements['fixtures-tab'].addEventListener('click', () => switchView('fixtures'));
        elements['standings-tab'].addEventListener('click', () => switchView('standings'));
        elements['fixtures-list'].addEventListener('click', event => {
            const button = event.target.closest('[data-event-id]');
            if (button) openMatch(button.dataset.eventId);
        });
        elements['close-dialog'].addEventListener('click', closeMatchDialog);
        elements['match-dialog'].addEventListener('click', event => {
            if (event.target === elements['match-dialog']) closeMatchDialog();
        });
        elements['match-dialog'].addEventListener('cancel', event => {
            event.preventDefault();
            closeMatchDialog();
        });
    }

    async function initialize() {
        bindEvents();
        const results = await Promise.allSettled([loadMeta(), loadLeagues()]);
        if (results[1].status === 'rejected') {
            elements['country-select'].replaceChildren(new Option('Unable to load leagues', ''));
            showToast(`Unable to load the league catalog: ${results[1].reason.message}`);
        }
    }

    initialize();
})();
