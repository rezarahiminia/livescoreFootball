function normalizeMatchClub(club, leagueSlug) {
    if (!club?.source_id) return null;

    return {
        source: {
            provider: 'database-snapshot',
            club_id: String(club.source_id),
            uid: club.uid || ''
        },
        source_id: String(club.source_id),
        uid: club.uid || '',
        league_slugs: [leagueSlug],
        slug: club.slug || '',
        name: club.name || club.display_name || String(club.source_id),
        display_name: club.display_name || club.name || String(club.source_id),
        short_display_name: club.short_display_name || club.display_name || club.name || '',
        abbreviation: club.abbreviation || '',
        country: club.country || '',
        city: club.city || '',
        logo: club.logo || '',
        logos: club.logos || [],
        color: club.color || '',
        alternate_color: club.alternate_color || '',
        active: true,
        catalog_source: 'match-snapshot'
    };
}

function mergeClubCatalog(storedClubs, matches, leagueSlug) {
    const clubsById = new Map();

    for (const match of matches || []) {
        for (const competitor of [match.home, match.away]) {
            const club = normalizeMatchClub(competitor, leagueSlug);
            if (club) clubsById.set(club.source.club_id, club);
        }
    }

    // Dedicated catalog documents contain richer identity, venue and roster
    // data, so they intentionally replace match-derived snapshots.
    for (const club of storedClubs || []) {
        const id = String(club.source?.club_id || club.source_id || '');
        if (id) clubsById.set(id, { ...club, catalog_source: 'club-catalog' });
    }

    return [...clubsById.values()].sort((a, b) => (
        String(a.display_name || a.name).localeCompare(String(b.display_name || b.name))
    ));
}

function findClubInMatches(matches, clubId, leagueSlug) {
    const targetId = String(clubId);
    const catalog = mergeClubCatalog([], matches, leagueSlug);
    return catalog.find(club => club.source.club_id === targetId) || null;
}

module.exports = {
    findClubInMatches,
    mergeClubCatalog,
    normalizeMatchClub
};
