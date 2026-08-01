const test = require('node:test');
const assert = require('node:assert/strict');

const {
    findClubInMatches,
    mergeClubCatalog
} = require('../services/soccerCatalog');

const matches = [{
    home: {
        source_id: '1001',
        name: 'Example FC',
        display_name: 'Example FC',
        abbreviation: 'EXF'
    },
    away: {
        source_id: '1002',
        name: 'Example United',
        display_name: 'Example United',
        abbreviation: 'EXU'
    }
}, {
    home: {
        source_id: '1002',
        name: 'Example United',
        display_name: 'Example United',
        abbreviation: 'EXU'
    },
    away: {
        source_id: '1001',
        name: 'Example FC',
        display_name: 'Example FC',
        abbreviation: 'EXF'
    }
}];

test('club catalog deduplicates match participants', () => {
    const clubs = mergeClubCatalog([], matches, 'eng.1');

    assert.equal(clubs.length, 2);
    assert.equal(clubs[0].catalog_source, 'match-snapshot');
    assert.deepEqual(clubs[0].league_slugs, ['eng.1']);
});

test('dedicated club document replaces match snapshot', () => {
    const clubs = mergeClubCatalog([{
        source: { provider: 'upstream', club_id: '1001' },
        name: 'Example Football Club',
        display_name: 'Example Football Club',
        roster: [{ id: 'player-1' }]
    }], matches, 'eng.1');
    const club = clubs.find(item => item.source.club_id === '1001');

    assert.equal(club.catalog_source, 'club-catalog');
    assert.equal(club.display_name, 'Example Football Club');
    assert.equal(club.roster.length, 1);
});

test('single club can be resolved from match snapshots', () => {
    const club = findClubInMatches(matches, '1002', 'eng.1');

    assert.equal(club.display_name, 'Example United');
    assert.equal(club.source.club_id, '1002');
});
