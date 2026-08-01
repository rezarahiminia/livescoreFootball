const test = require('node:test');
const assert = require('node:assert/strict');

const {
    inferLeagueCountry,
    serializePlay,
    serializeScoreboardEvent,
    serializeStandingGroup,
    serializeSummary,
    statsToArray
} = require('../services/soccerSerializer');

const league = {
    slug: 'eng.1',
    name: 'English Premier League',
    abbreviation: 'Premier League',
    kind: 'club',
    active: true,
    source: { provider: 'upstream', source_id: '700' },
    season: { year: 2026 },
    calendar: []
};

const match = {
    source: {
        provider: 'upstream',
        event_id: '900001',
        competition_id: '900001',
        uid: 's:600~l:700~e:900001'
    },
    league_slug: 'eng.1',
    scoreboard_date: '20260719',
    date: new Date('2026-07-19T19:00:00Z'),
    name: 'Example United at Example FC',
    short_name: 'UNI @ EXF',
    season: { year: 2026, slug: 'final' },
    status: {
        state: 'in',
        name: 'STATUS_IN_PROGRESS',
        clock: "2'",
        clock_seconds: 120,
        period: 1,
        completed: false
    },
    home: {
        source_id: '1001',
        name: 'Example FC',
        display_name: 'Example FC',
        abbreviation: 'EXF',
        score: 0,
        stats: { possessionPct: 75.9 }
    },
    away: {
        source_id: '1002',
        name: 'Example United',
        display_name: 'Example United',
        abbreviation: 'UNI',
        score: 0,
        stats: { possessionPct: 24.1 }
    },
    venue: { source_id: '2001', name: 'Example Stadium', country: 'England' },
    key_events: [],
    lineups: [],
    officials: [],
    commentary: [],
    broadcasts: [],
    odds: [],
    leaders: [],
    news: [],
    videos: [],
    last_synced_at: new Date('2026-07-19T19:08:00Z')
};

test('scoreboard serializer returns provider-compatible status and competitors', () => {
    const event = serializeScoreboardEvent(match);

    assert.equal(event.id, '900001');
    assert.equal(event.status.type.state, 'in');
    assert.equal(event.status.displayClock, "2'");
    assert.equal(event.competitions[0].competitors[0].homeAway, 'home');
    assert.equal(event.competitions[0].competitors[0].score, '0');
    assert.equal(
        event.competitions[0].competitors[0].statistics[0].displayValue,
        '75.9'
    );
});

test('summary serializer exposes freshness without leaking source payload', () => {
    const summary = serializeSummary(match, league);

    assert.equal(summary.header.league.slug, 'eng.1');
    assert.equal(summary.header.competitions[0].id, '900001');
    assert.equal(summary.boxscore.teams.length, 2);
    assert.equal(summary.meta.dataSource, 'database');
    assert.equal(summary.meta.lastSyncedAt, '2026-07-19T19:08:00.000Z');
    assert.equal(summary.meta.dataAvailability.timeline.available, true);
    assert.equal(summary.meta.dataAvailability.leagueTopScorers.available, false);
    assert.equal(summary.source_payload, undefined);
});

test('league serializer exposes database coverage', () => {
    const serialized = require('../services/soccerSerializer').serializeLeague({
        ...league,
        coverage: {
            matches: 15,
            clubs: 29,
            dedicatedClubs: 0,
            standingsGroups: 0,
            hasData: true
        }
    });

    assert.equal(serialized.kind, 'club');
    assert.equal(serialized.coverage.matches, 15);
    assert.equal(serialized.coverage.clubs, 29);
    assert.equal(serialized.coverage.hasData, true);
});

test('league country is inferred from a club competition slug', () => {
    assert.equal(inferLeagueCountry({ slug: 'esp.1', country: '' }), 'Spain');
    assert.equal(inferLeagueCountry({ slug: 'uefa.champions', country: '' }), 'Other');
    assert.equal(inferLeagueCountry({ slug: 'uefa.champions', country: 'Europe' }), 'Other');
    assert.equal(inferLeagueCountry({ slug: 'uefa.europa', country: '' }), 'International');
    assert.equal(inferLeagueCountry({ slug: 'custom.league', country: '' }), 'Other');
});

test('play serializer maps flags, scores, and timestamps', () => {
    const play = serializePlay({
        source: {
            event_key: '49878786',
            modified_at: new Date('2026-07-19T19:06:00Z')
        },
        event_type: { id: '80', name: 'kickoff', text: 'Kickoff' },
        text: 'First Half begins.',
        clock: { value: 0, display_value: '' },
        period: 1,
        home_score: 0,
        away_score: 0,
        flags: { scoring_play: false, yellow_card: false },
        valid: true
    });

    assert.equal(play.id, '49878786');
    assert.equal(play.type.type, 'kickoff');
    assert.equal(play.homeScore, 0);
    assert.equal(play.valid, true);
    assert.equal(play.modified, '2026-07-19T19:06:00.000Z');
});

test('play serializer supports listener documents that use match_id and camelCase fields', () => {
    const play = serializePlay({
        event_id: '49483413',
        match_id: '760415',
        source: { provider: 'upstream', event_key: '49483413' },
        event_type: { id: '70', text: 'Goal', type: 'goal' },
        clock: { value: 513, displayValue: "9'" },
        period: 1,
        scoring_play: true,
        team: { id: '203' },
        participants: [{ athlete: { id: '10', displayName: 'Example Player' } }]
    });

    assert.equal(play.id, '49483413');
    assert.equal(play.type.type, 'goal');
    assert.equal(play.clock.displayValue, "9'");
    assert.equal(play.scoringPlay, true);
    assert.deepEqual(play.team, { id: '203' });
    assert.equal(play.participants[0].athlete.displayName, 'Example Player');
});

test('standing serializer maps numeric stats to display values', () => {
    const group = serializeStandingGroup({
        group_id: 'A',
        group_name: 'Group A',
        season_year: 2026,
        entries: [{
            rank: 1,
            club: {
                source_id: '1001',
                display_name: 'Example FC',
                abbreviation: 'EXF'
            },
            stats: { points: 7 }
        }]
    });

    assert.equal(group.standings.entries[0].team.displayName, 'Example FC');
    assert.equal(group.standings.entries[0].stats[0].displayValue, '7');
});

test('stats serializer accepts Mongoose-style maps', () => {
    const stats = statsToArray(new Map([['totalShots', 5]]));
    assert.deepEqual(stats, [{
        name: 'totalShots',
        abbreviation: 'SHOT',
        displayValue: '5'
    }]);
});
