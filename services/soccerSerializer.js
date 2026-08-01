const STAT_ABBREVIATIONS = {
    possessionPct: 'PP',
    totalShots: 'SHOT',
    shotsOnTarget: 'SOG',
    wonCorners: 'CW',
    foulsCommitted: 'FC',
    goalAssists: 'A',
    totalGoals: 'G',
    shotAssists: 'SHAST',
    appearances: 'APP'
};

const COUNTRY_BY_SLUG_PREFIX = {
    arg: 'Argentina',
    aus: 'Australia',
    aut: 'Austria',
    bel: 'Belgium',
    bol: 'Bolivia',
    bra: 'Brazil',
    chi: 'Chile',
    chn: 'China',
    col: 'Colombia',
    crc: 'Costa Rica',
    cyp: 'Cyprus',
    den: 'Denmark',
    ecu: 'Ecuador',
    eng: 'England',
    esp: 'Spain',
    fra: 'France',
    ger: 'Germany',
    gha: 'Ghana',
    gre: 'Greece',
    idn: 'Indonesia',
    ind: 'India',
    irl: 'Ireland',
    ita: 'Italy',
    jpn: 'Japan',
    ksa: 'Saudi Arabia',
    mex: 'Mexico',
    mys: 'Malaysia',
    ned: 'Netherlands',
    nga: 'Nigeria',
    nor: 'Norway',
    par: 'Paraguay',
    per: 'Peru',
    por: 'Portugal',
    rsa: 'South Africa',
    sco: 'Scotland',
    sui: 'Switzerland',
    swe: 'Sweden',
    tha: 'Thailand',
    tur: 'Turkey',
    uru: 'Uruguay',
    usa: 'United States',
    ven: 'Venezuela'
};

const INTERNATIONAL_PREFIXES = new Set([
    'afc', 'caf', 'concacaf', 'conmebol', 'fifa', 'ofc', 'uefa'
]);

const COUNTRY_OVERRIDE_BY_LEAGUE = {
    'uefa.champions': 'Other'
};

function inferLeagueCountry(league) {
    const slug = String(league.slug || '').toLowerCase();
    if (COUNTRY_OVERRIDE_BY_LEAGUE[slug]) return COUNTRY_OVERRIDE_BY_LEAGUE[slug];
    if (league.country) return league.country;
    const prefix = slug.split('.')[0];
    if (INTERNATIONAL_PREFIXES.has(prefix)) return 'International';
    return COUNTRY_BY_SLUG_PREFIX[prefix] || 'Other';
}

function toIso(value) {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function toPlainMap(value) {
    if (!value) return {};
    if (value instanceof Map) return Object.fromEntries(value);
    return { ...value };
}

function statsToArray(stats) {
    return Object.entries(toPlainMap(stats)).map(([name, value]) => ({
        name,
        abbreviation: STAT_ABBREVIATIONS[name] || name,
        displayValue: value == null ? null : String(value)
    }));
}

function serializeLeague(league) {
    return {
        id: league.source?.source_id || league.slug,
        uid: league.source?.source_id ? `s:600~l:${league.source.source_id}` : undefined,
        name: league.name,
        abbreviation: league.abbreviation,
        slug: league.slug,
        country: inferLeagueCountry(league),
        kind: league.kind || 'club',
        logo: league.logo,
        season: league.season || null,
        calendar: league.calendar || [],
        active: league.active,
        lastSyncedAt: toIso(league.last_synced_at),
        coverage: league.coverage || {
            matches: 0,
            clubs: 0,
            dedicatedClubs: 0,
            standingsGroups: 0,
            hasData: false
        }
    };
}

function serializeClub(club) {
    if (!club) return null;
    return {
        id: club.source_id || club.source?.club_id,
        uid: club.uid || club.source?.uid || '',
        slug: club.slug || '',
        name: club.name || club.display_name,
        displayName: club.display_name || club.name,
        shortDisplayName: club.short_display_name || club.display_name,
        abbreviation: club.abbreviation || '',
        location: club.city || club.country || club.name,
        country: club.country || '',
        city: club.city || '',
        logo: club.logo || '',
        logos: club.logos || [],
        color: club.color || '',
        alternateColor: club.alternate_color || '',
        foundedYear: club.founded_year,
        venue: club.venue || null,
        isActive: club.active !== false,
        catalogSource: club.catalog_source || 'club-catalog'
    };
}

function serializeStatus(status = {}) {
    return {
        clock: status.clock_seconds ?? 0,
        displayClock: status.clock || '',
        period: status.period ?? 0,
        type: {
            name: status.name || 'STATUS_UNKNOWN',
            state: status.state || 'unknown',
            completed: Boolean(status.completed),
            description: status.description || '',
            detail: status.detail || '',
            shortDetail: status.short_detail || status.detail || ''
        }
    };
}

function serializeVenue(venue) {
    if (!venue) return null;
    return {
        id: venue.source_id || '',
        fullName: venue.name || '',
        address: {
            city: venue.city || '',
            country: venue.country || ''
        }
    };
}

function serializeCompetitor(club, homeAway) {
    return {
        id: club.source_id,
        uid: club.uid || '',
        type: 'team',
        homeAway,
        score: club.score == null ? null : String(club.score),
        aggregateScore: club.aggregate_score == null ? undefined : String(club.aggregate_score),
        shootoutScore: club.shootout_score == null ? undefined : String(club.shootout_score),
        winner: Boolean(club.winner),
        advance: club.advance,
        form: club.form || '',
        team: serializeClub(club),
        statistics: statsToArray(club.stats)
    };
}

function serializeCompetition(match) {
    const status = serializeStatus(match.status);
    return {
        id: match.source.competition_id,
        uid: match.source.uid || '',
        date: toIso(match.date),
        startDate: toIso(match.date),
        status,
        attendance: match.attendance ?? 0,
        venue: serializeVenue(match.venue),
        competitors: [
            serializeCompetitor(match.home, 'home'),
            serializeCompetitor(match.away, 'away')
        ],
        details: match.key_events || [],
        broadcasts: match.broadcasts || [],
        odds: match.odds || [],
        notes: match.note ? [{ text: match.note }] : [],
        format: match.format || null,
        playByPlayAvailable: Boolean(match.play_by_play_available),
        wasSuspended: Boolean(match.status?.suspended)
    };
}

function serializeScoreboardEvent(match) {
    return {
        id: match.source.event_id,
        uid: match.source.uid || '',
        date: toIso(match.date),
        name: match.name,
        shortName: match.short_name || match.name,
        season: match.season || null,
        competitions: [serializeCompetition(match)],
        status: serializeStatus(match.status),
        venue: match.venue ? { displayName: match.venue.name || '' } : null
    };
}

function serializeSummary(match, league) {
    const competition = serializeCompetition(match);
    const home = serializeCompetitor(match.home, 'home');
    const away = serializeCompetitor(match.away, 'away');

    return {
        header: {
            id: match.source.event_id,
            uid: match.source.uid || '',
            season: match.season || null,
            league: serializeLeague(league),
            competitions: [competition]
        },
        boxscore: {
            teams: [
                {
                    team: home.team,
                    statistics: home.statistics,
                    homeAway: 'home',
                    displayOrder: 1
                },
                {
                    team: away.team,
                    statistics: away.statistics,
                    homeAway: 'away',
                    displayOrder: 2
                }
            ]
        },
        keyEvents: match.key_events || [],
        rosters: match.lineups || [],
        gameInfo: {
            venue: serializeVenue(match.venue),
            officials: match.officials || []
        },
        commentary: match.commentary || [],
        broadcasts: match.broadcasts || [],
        odds: match.odds || [],
        leaders: match.leaders || [],
        news: match.news || [],
        videos: match.videos || [],
        format: match.format || null,
        meta: {
            dataSource: 'database',
            provider: match.source.provider,
            lastSyncedAt: toIso(match.last_synced_at),
            dataAvailability: {
                timeline: { available: true, storedIn: 'soccer_match_events' },
                matchGoals: {
                    available: true,
                    storedIn: ['soccer_match_events', 'soccer_matches.key_events']
                },
                statisticsAndSummary: { available: true, storedIn: 'soccer_matches' },
                leagueTopScorers: {
                    available: false,
                    reason: 'Not structurally stored; raw snapshots are not exposed by the customer API.'
                }
            }
        }
    };
}

function serializePlay(event) {
    const source = event.source || {};
    const type = event.event_type || event.type || event.raw?.type || {};
    const clock = event.clock || event.raw?.clock || {};
    const flags = event.flags || {};
    const rootFlag = (snakeCase, camelCase) => {
        if (flags[snakeCase] !== undefined) return Boolean(flags[snakeCase]);
        if (event[snakeCase] !== undefined) return Boolean(event[snakeCase]);
        if (event[camelCase] !== undefined) return Boolean(event[camelCase]);
        return Boolean(event.raw?.[camelCase]);
    };

    return {
        id: source.event_key || source.event_id || event.source_event_id
            || event.event_id || String(event._id || ''),
        type: {
            id: type.id || '',
            text: type.text || type.name || type.type || '',
            type: type.name || type.type || ''
        },
        text: event.text || event.alternative_text || type.text || '',
        alternativeText: event.alternative_text || event.alternativeText || '',
        awayScore: event.away_score ?? event.awayScore ?? null,
        homeScore: event.home_score ?? event.homeScore ?? null,
        period: { number: event.period ?? 0 },
        clock: {
            value: clock.value ?? 0,
            displayValue: clock.display_value || clock.displayValue || ''
        },
        addedClock: {
            value: clock.added_value ?? clock.addedValue ?? 0,
            displayValue: clock.added_display_value || clock.addedDisplayValue || ''
        },
        valid: event.valid !== false,
        scoringPlay: rootFlag('scoring_play', 'scoringPlay'),
        scoreValue: event.score_value ?? event.scoreValue ?? 0,
        substitution: rootFlag('substitution', 'substitution'),
        wallclock: toIso(event.wallclock || event.raw?.wallclock),
        redCard: rootFlag('red_card', 'redCard'),
        yellowCard: rootFlag('yellow_card', 'yellowCard'),
        penaltyKick: rootFlag('penalty_kick', 'penaltyKick'),
        ownGoal: rootFlag('own_goal', 'ownGoal'),
        shootout: rootFlag('shootout', 'shootout'),
        modified: toIso(source.modified_at || event.modified_at),
        // Kept as `team` in the public response for provider compatibility; the
        // normalized database field is named `club`.
        team: event.club || event.team || event.raw?.team || null,
        athleteSourceIds: event.athlete_source_ids || event.athleteSourceIds || [],
        athletesInvolved: event.athletes_involved || event.athletesInvolved || [],
        participants: event.participants || event.raw?.participants || []
    };
}

function serializeStandingGroup(group) {
    return {
        id: group.group_id,
        name: group.group_name,
        abbreviation: group.group_name,
        standings: {
            season: group.season_year,
            entries: (group.entries || []).map(entry => ({
                team: serializeClub(entry.club),
                stats: statsToArray(entry.stats),
                note: entry.note || null,
                rank: entry.rank ?? null
            }))
        },
        lastSyncedAt: toIso(group.last_synced_at)
    };
}

module.exports = {
    inferLeagueCountry,
    serializeLeague,
    serializeClub,
    serializePlay,
    serializeScoreboardEvent,
    serializeStandingGroup,
    serializeSummary,
    statsToArray
};
