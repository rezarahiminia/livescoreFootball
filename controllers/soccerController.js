const express = require('express');
const router = express.Router();

const SoccerLeague = require('../models/soccerLeague');
const SoccerClub = require('../models/soccerClub');
const SoccerMatch = require('../models/soccerMatch');
const SoccerMatchEvent = require('../models/soccerMatchEvent');
const SoccerStanding = require('../models/soccerStanding');
const SoccerSyncState = require('../models/soccerSyncState');
const {
    findClubInMatches,
    mergeClubCatalog
} = require('../services/soccerCatalog');
const {
    serializeLeague,
    serializeClub,
    serializePlay,
    serializeScoreboardEvent,
    serializeStandingGroup,
    serializeSummary
} = require('../services/soccerSerializer');

const LEAGUE_PATTERN = /^[a-z0-9][a-z0-9._-]{0,63}$/;
const EVENT_PATTERN = /^[a-zA-Z0-9_-]{1,128}$/;
const DATE_PATTERN = /^\d{8}$/;

function todayUtc() {
    return new Date().toISOString().slice(0, 10).replace(/-/g, '');
}

function isValidDateKey(value) {
    if (!DATE_PATTERN.test(value)) return false;
    const year = Number(value.slice(0, 4));
    const month = Number(value.slice(4, 6));
    const day = Number(value.slice(6, 8));
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year
        && date.getUTCMonth() === month - 1
        && date.getUTCDate() === day;
}

function parsePositiveInteger(value, fallback, max) {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed) || parsed < 1) return fallback;
    return Math.min(parsed, max);
}

function validateLeague(req, res, next) {
    const league = String(req.params.league || '').toLowerCase();
    if (!LEAGUE_PATTERN.test(league)) {
        return res.status(400).json({ error: 'Invalid league slug' });
    }
    req.params.league = league;
    return next();
}

function validateEvent(req, res, next) {
    const eventId = String(req.params.eventId || req.query.event || '');
    if (!EVENT_PATTERN.test(eventId)) {
        return res.status(400).json({ error: 'Invalid or missing event ID' });
    }
    req.eventId = eventId;
    return next();
}

async function getLeague(slug) {
    return SoccerLeague.findOne({ slug, active: true }).lean();
}

function countsToMap(rows) {
    return new Map(rows.map(row => [row._id, row.count]));
}

async function getLeagueCoverage() {
    const [matchRows, storedClubRows, matchClubRows, standingRows] = await Promise.all([
        SoccerMatch.aggregate([
            { $group: { _id: '$league_slug', count: { $sum: 1 } } }
        ]),
        SoccerClub.aggregate([
            { $unwind: '$league_slugs' },
            { $group: { _id: '$league_slugs', count: { $sum: 1 } } }
        ]),
        SoccerMatch.aggregate([
            {
                $project: {
                    league_slug: 1,
                    club_ids: ['$home.source_id', '$away.source_id']
                }
            },
            { $unwind: '$club_ids' },
            { $match: { club_ids: { $nin: [null, ''] } } },
            { $group: { _id: { league: '$league_slug', club: '$club_ids' } } },
            { $group: { _id: '$_id.league', count: { $sum: 1 } } }
        ]),
        SoccerStanding.aggregate([
            { $group: { _id: '$league_slug', count: { $sum: 1 } } }
        ])
    ]);

    return {
        matches: countsToMap(matchRows),
        storedClubs: countsToMap(storedClubRows),
        matchClubs: countsToMap(matchClubRows),
        standings: countsToMap(standingRows)
    };
}

function enrichLeagueCoverage(league, coverageMaps) {
    const matches = coverageMaps.matches.get(league.slug) || 0;
    const dedicatedClubs = coverageMaps.storedClubs.get(league.slug) || 0;
    const clubs = Math.max(dedicatedClubs, coverageMaps.matchClubs.get(league.slug) || 0);
    const standingsGroups = coverageMaps.standings.get(league.slug) || 0;

    return {
        ...league,
        coverage: {
            matches,
            clubs,
            dedicatedClubs,
            standingsGroups,
            hasData: matches > 0 || clubs > 0 || standingsGroups > 0
        }
    };
}

function sendError(res, error) {
    console.error('Soccer API error:', error);
    return res.status(500).json({ error: 'Unable to read soccer data' });
}

/**
 * @swagger
 * /get/soccer/leagues:
 *   get:
 *     summary: List available soccer leagues
 *     tags: [Soccer Data]
 *     security: []
 *     parameters:
 *       - in: query
 *         name: kind
 *         schema: { type: string, enum: [club, international, all], default: club }
 *         description: Competition type; the club catalog is the default
 *       - in: query
 *         name: available
 *         schema: { type: boolean, default: false }
 *         description: When true, only competitions with stored matches, clubs, or standings are returned
 *     responses:
 *       200:
 *         description: Active leagues that customers can select
 */
router.get('/leagues', async(req, res) => {
    try {
        const kind = String(req.query.kind || 'club').toLowerCase();
        if (!['club', 'international', 'all'].includes(kind)) {
            return res.status(400).json({ error: 'kind must be club, international, or all' });
        }
        if (req.query.available !== undefined && !['true', 'false'].includes(String(req.query.available))) {
            return res.status(400).json({ error: 'available must be true or false' });
        }

        const filter = { active: true };
        if (kind !== 'all') filter.kind = kind;

        const [leagues, coverageMaps] = await Promise.all([
            SoccerLeague.find(filter)
            .sort({ sort_order: 1, name: 1 })
                .lean(),
            getLeagueCoverage()
        ]);
        const enriched = leagues.map(league => enrichLeagueCoverage(league, coverageMaps));
        const visible = req.query.available === 'true'
            ? enriched.filter(league => league.coverage.hasData)
            : enriched;

        res.set('Cache-Control', 'public, max-age=60');
        return res.json({
            meta: {
                kind,
                availableOnly: req.query.available === 'true',
                count: visible.length,
                generatedAt: new Date().toISOString()
            },
            leagues: visible.map(serializeLeague)
        });
    } catch (error) {
        return sendError(res, error);
    }
});

/**
 * @swagger
 * /get/soccer/meta:
 *   get:
 *     summary: Get service capabilities and current database coverage
 *     tags: [Soccer Data]
 *     security: []
 *     responses:
 *       200:
 *         description: Live collection counts, competition coverage, freshness, and supported features
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ServiceMeta'
 */
router.get('/meta', async(req, res) => {
    try {
        const [
            activeClubLeagues,
            activeInternationalLeagues,
            leagues,
            clubs,
            matches,
            events,
            standingsGroups,
            leaguesWithMatches,
            latestSync
        ] = await Promise.all([
            SoccerLeague.countDocuments({ active: true, kind: 'club' }),
            SoccerLeague.countDocuments({ active: true, kind: 'international' }),
            SoccerLeague.countDocuments(),
            SoccerClub.countDocuments(),
            SoccerMatch.countDocuments(),
            SoccerMatchEvent.countDocuments(),
            SoccerStanding.countDocuments(),
            SoccerMatch.distinct('league_slug'),
            SoccerSyncState.findOne({ status: 'healthy' })
                .sort({ last_success_at: -1 })
                .select('last_success_at')
                .lean()
        ]);

        res.set('Cache-Control', 'public, max-age=60');
        return res.json({
            service: {
                name: 'Free Football Live Scores API',
                version: require('../package.json').version,
                dataSource: 'MongoDB',
                upstreamCallsDuringRequest: false
            },
            coverage: {
                competitions: leagues,
                activeClubCompetitions: activeClubLeagues,
                activeInternationalCompetitions: activeInternationalLeagues,
                competitionsWithMatches: leaguesWithMatches.length,
                dedicatedClubDocuments: clubs,
                matches,
                playByPlayEvents: events,
                standingsGroups
            },
            features: [
                'league-catalog',
                'club-catalog',
                'fixtures-and-live-scores',
                'match-summary',
                'play-by-play',
                'standings'
            ],
            lastSuccessfulSyncAt: latestSync?.last_success_at || null,
            generatedAt: new Date().toISOString()
        });
    } catch (error) {
        return sendError(res, error);
    }
});

/**
 * @swagger
 * /get/soccer/{league}/scoreboard:
 *   get:
 *     summary: Get stored scores and fixtures for a league and date
 *     tags: [Soccer Data]
 *     security: []
 *     parameters:
 *       - in: path
 *         name: league
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: dates
 *         schema: { type: string, pattern: '^\\d{8}$' }
 *         description: Date in YYYYMMDD format; defaults to current UTC date
 *     responses:
 *       200:
 *         description: Provider-compatible scoreboard read only from MongoDB
 *       404:
 *         description: League not found
 */
router.get('/:league/scoreboard', validateLeague, async(req, res) => {
    try {
        const dates = String(req.query.dates || todayUtc());
        if (!isValidDateKey(dates)) {
            return res.status(400).json({ error: 'dates must be a valid YYYYMMDD date' });
        }

        const league = await getLeague(req.params.league);
        if (!league) return res.status(404).json({ error: 'League not found' });

        const matches = await SoccerMatch.find({
            league_slug: req.params.league,
            scoreboard_date: dates
        }).sort({ date: 1 }).lean();

        const live = matches.some(match => match.status?.state === 'in');
        res.set('Cache-Control', `public, max-age=${live ? 4 : 30}`);
        return res.json({
            leagues: [serializeLeague(league)],
            events: matches.map(serializeScoreboardEvent)
        });
    } catch (error) {
        return sendError(res, error);
    }
});

/**
 * @swagger
 * /get/soccer/{league}/fixtures:
 *   get:
 *     summary: List stored fixtures and results for a league
 *     description: Returns a paginated schedule. Unlike scoreboard, a date is optional and the full stored league schedule can be browsed.
 *     tags: [Soccer Data]
 *     security: []
 *     parameters:
 *       - in: path
 *         name: league
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: from
 *         schema: { type: string, pattern: '^\\d{8}$' }
 *         description: Optional start date in YYYYMMDD
 *       - in: query
 *         name: to
 *         schema: { type: string, pattern: '^\\d{8}$' }
 *         description: Optional end date in YYYYMMDD
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [all, scheduled, live, finished], default: all }
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 200, default: 100 }
 *     responses:
 *       200:
 *         description: Paginated provider-compatible fixtures and results
 *       400:
 *         description: Invalid date, status, or pagination
 *       404:
 *         description: League not found
 */
router.get('/:league/fixtures', validateLeague, async(req, res) => {
    try {
        const from = req.query.from === undefined ? null : String(req.query.from);
        const to = req.query.to === undefined ? null : String(req.query.to);
        const status = String(req.query.status || 'all').toLowerCase();

        if (from && !isValidDateKey(from)) {
            return res.status(400).json({ error: 'from must be a valid YYYYMMDD date' });
        }
        if (to && !isValidDateKey(to)) {
            return res.status(400).json({ error: 'to must be a valid YYYYMMDD date' });
        }
        if (from && to && from > to) {
            return res.status(400).json({ error: 'from must be before or equal to to' });
        }
        if (!['all', 'scheduled', 'live', 'finished'].includes(status)) {
            return res.status(400).json({ error: 'status must be all, scheduled, live, or finished' });
        }
        if (req.query.page !== undefined
            && (!/^\d+$/.test(String(req.query.page)) || Number(req.query.page) < 1)) {
            return res.status(400).json({ error: 'page must be a positive integer' });
        }
        if (req.query.limit !== undefined
            && (!/^\d+$/.test(String(req.query.limit)) || Number(req.query.limit) < 1)) {
            return res.status(400).json({ error: 'limit must be a positive integer' });
        }

        const page = parsePositiveInteger(req.query.page, 1, 10000);
        const limit = parsePositiveInteger(req.query.limit, 100, 200);
        const league = await getLeague(req.params.league);
        if (!league) return res.status(404).json({ error: 'League not found' });

        const filter = { league_slug: req.params.league };
        if (from || to) {
            filter.scoreboard_date = {};
            if (from) filter.scoreboard_date.$gte = from;
            if (to) filter.scoreboard_date.$lte = to;
        }
        const stateByStatus = { scheduled: 'pre', live: 'in', finished: 'post' };
        if (status !== 'all') filter['status.state'] = stateByStatus[status];

        const [count, matches] = await Promise.all([
            SoccerMatch.countDocuments(filter),
            SoccerMatch.find(filter)
                .sort({ date: 1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .lean()
        ]);
        const live = matches.some(match => match.status?.state === 'in');

        res.set('Cache-Control', `public, max-age=${live ? 4 : 30}`);
        return res.json({
            league: serializeLeague(league),
            count,
            pageIndex: page,
            pageSize: limit,
            pageCount: Math.ceil(count / limit),
            filters: { from, to, status },
            events: matches.map(serializeScoreboardEvent)
        });
    } catch (error) {
        return sendError(res, error);
    }
});

async function sendSummary(req, res) {
    try {
        const [league, match] = await Promise.all([
            getLeague(req.params.league),
            SoccerMatch.findOne({
                league_slug: req.params.league,
                'source.event_id': req.eventId
            }).lean()
        ]);

        if (!league) return res.status(404).json({ error: 'League not found' });
        if (!match) return res.status(404).json({ error: 'Match not found' });

        res.set('Cache-Control', `public, max-age=${match.status?.state === 'in' ? 4 : 30}`);
        return res.json(serializeSummary(match, league));
    } catch (error) {
        return sendError(res, error);
    }
}

/**
 * @swagger
 * /get/soccer/{league}/summary:
 *   get:
 *     summary: Get a stored match summary
 *     tags: [Soccer Data]
 *     security: []
 *     parameters:
 *       - in: path
 *         name: league
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: event
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Provider-compatible match summary read only from MongoDB
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/MatchSummary' }
 */
router.get('/:league/summary', validateLeague, validateEvent, sendSummary);

/**
 * @swagger
 * /get/soccer/{league}/events/{eventId}:
 *   get:
 *     summary: Get a stored match summary by event path
 *     tags: [Soccer Data]
 *     security: []
 *     parameters:
 *       - in: path
 *         name: league
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: eventId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Provider-compatible match summary read only from MongoDB
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/MatchSummary' }
 *       404:
 *         description: League or match not found
 */
router.get('/:league/events/:eventId', validateLeague, validateEvent, sendSummary);

/**
 * @swagger
 * /get/soccer/{league}/events/{eventId}/plays:
 *   get:
 *     summary: Get paginated stored play-by-play events
 *     tags: [Soccer Data]
 *     security: []
 *     parameters:
 *       - in: path
 *         name: league
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: eventId
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 300, default: 100 }
 *       - in: query
 *         name: important
 *         schema: { type: boolean, default: false }
 *         description: When true, return only goals, cards, substitutions, and other flagged key events
 *     responses:
 *       200:
 *         description: Paginated timeline, including goals, cards, substitutions, and other stored match events
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 count: { type: integer }
 *                 pageIndex: { type: integer }
 *                 pageSize: { type: integer }
 *                 pageCount: { type: integer }
 *                 dataSource: { type: string, example: database }
 *                 items:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/MatchPlay' }
 */
router.get('/:league/events/:eventId/plays', validateLeague, validateEvent, async(req, res) => {
    try {
        if (req.query.page !== undefined
            && (!/^\d+$/.test(String(req.query.page)) || Number(req.query.page) < 1)) {
            return res.status(400).json({ error: 'page must be a positive integer' });
        }
        if (req.query.limit !== undefined
            && (!/^\d+$/.test(String(req.query.limit)) || Number(req.query.limit) < 1)) {
            return res.status(400).json({ error: 'limit must be a positive integer' });
        }
        if (req.query.important !== undefined
            && !['true', 'false'].includes(String(req.query.important))) {
            return res.status(400).json({ error: 'important must be true or false' });
        }
        const page = parsePositiveInteger(req.query.page, 1, 10000);
        const limit = parsePositiveInteger(req.query.limit, 100, 300);
        const importantOnly = req.query.important === 'true';
        const normalizedFilter = {
            league_slug: req.params.league,
            event_id: req.eventId,
            valid: { $ne: false }
        };
        const listenerFilter = {
            league_slug: req.params.league,
            match_id: req.eventId,
            valid: { $ne: false }
        };

        const [league, match, normalizedCount] = await Promise.all([
            getLeague(req.params.league),
            SoccerMatch.findOne(filterForMatch(req.params.league, req.eventId), 'status').lean(),
            SoccerMatchEvent.countDocuments(normalizedFilter)
        ]);

        if (!league) return res.status(404).json({ error: 'League not found' });
        if (!match) return res.status(404).json({ error: 'Match not found' });

        // New listener builds may store the match identifier in `match_id`
        // and reserve `event_id` for the individual play. Prefer the normalized
        // collection shape when both exist so duplicate imports are not exposed.
        const sourceFilter = normalizedCount > 0 ? normalizedFilter : listenerFilter;
        const importantFilter = {
            $or: [
                { 'event_type.name': /^substitution$/i },
                { 'event_type.type': /^substitution$/i },
                { 'event_type.text': /^substitution$/i },
                { 'type.type': /^substitution$/i },
                { 'type.text': /^substitution$/i },
                { 'flags.scoring_play': true },
                { 'flags.yellow_card': true },
                { 'flags.red_card': true },
                { 'flags.substitution': true },
                { scoring_play: true },
                { yellow_card: true },
                { red_card: true },
                { substitution: true }
            ]
        };
        const filter = importantOnly
            ? { $and: [sourceFilter, importantFilter] }
            : sourceFilter;
        const [count, events] = await Promise.all([
            !importantOnly && normalizedCount > 0
                ? Promise.resolve(normalizedCount)
                : SoccerMatchEvent.countDocuments(filter),
            SoccerMatchEvent.find(filter)
                .sort({ sequence: 1, wallclock: 1, _id: 1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .lean()
        ]);

        res.set('Cache-Control', `public, max-age=${match.status?.state === 'in' ? 4 : 30}`);
        return res.json({
            count,
            pageIndex: page,
            pageSize: limit,
            pageCount: Math.ceil(count / limit),
            dataSource: 'database',
            importantOnly,
            items: events.map(serializePlay)
        });
    } catch (error) {
        return sendError(res, error);
    }
});

function filterForMatch(league, eventId) {
    return {
        league_slug: league,
        'source.event_id': eventId
    };
}

/**
 * @swagger
 * /get/soccer/{league}/clubs:
 *   get:
 *     summary: List stored clubs in a league
 *     tags: [Soccer Data]
 *     security: []
 *     parameters:
 *       - in: path
 *         name: league
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Clubs in the selected league
 */
router.get('/:league/clubs', validateLeague, async(req, res) => {
    try {
        const [league, storedClubs, matches] = await Promise.all([
            getLeague(req.params.league),
            SoccerClub.find({ league_slugs: req.params.league })
                .select('-roster -coach -source_payload')
                .sort({ display_name: 1 })
                .lean(),
            SoccerMatch.find({ league_slug: req.params.league })
                .select('home away')
                .lean()
        ]);
        if (!league) return res.status(404).json({ error: 'League not found' });

        const clubs = mergeClubCatalog(storedClubs, matches, req.params.league);

        res.set('Cache-Control', 'public, max-age=60');
        return res.json({
            league: serializeLeague(league),
            clubs: clubs.map(serializeClub),
            meta: {
                count: clubs.length,
                dedicatedCatalogCount: storedClubs.length,
                matchSnapshotFallback: storedClubs.length < clubs.length
            }
        });
    } catch (error) {
        return sendError(res, error);
    }
});

/**
 * @swagger
 * /get/soccer/{league}/clubs/{clubId}:
 *   get:
 *     summary: Get a stored club, roster, and coach
 *     tags: [Soccer Data]
 *     security: []
 *     parameters:
 *       - in: path
 *         name: league
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: clubId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Club details
 *       404:
 *         description: League or club not found
 */
router.get('/:league/clubs/:clubId', validateLeague, async(req, res) => {
    try {
        if (!EVENT_PATTERN.test(req.params.clubId)) {
            return res.status(400).json({ error: 'Invalid club ID' });
        }
        const [league, storedClub, matches] = await Promise.all([
            getLeague(req.params.league),
            SoccerClub.findOne({
                league_slugs: req.params.league,
                'source.club_id': req.params.clubId
            }).lean(),
            SoccerMatch.find({
                league_slug: req.params.league,
                $or: [
                    { 'home.source_id': req.params.clubId },
                    { 'away.source_id': req.params.clubId }
                ]
            }).select('home away').lean()
        ]);
        if (!league) return res.status(404).json({ error: 'League not found' });
        const club = storedClub || findClubInMatches(matches, req.params.clubId, req.params.league);
        if (!club) return res.status(404).json({ error: 'Club not found' });

        res.set('Cache-Control', 'public, max-age=60');
        return res.json({
            club: serializeClub(club),
            roster: storedClub?.roster || [],
            coach: storedClub?.coach || null,
            lastSyncedAt: storedClub?.last_synced_at || null,
            meta: {
                catalogSource: storedClub ? 'club-catalog' : 'match-snapshot',
                rosterAvailable: Boolean(storedClub?.roster?.length)
            }
        });
    } catch (error) {
        return sendError(res, error);
    }
});

/**
 * @swagger
 * /get/soccer/{league}/standings:
 *   get:
 *     summary: Get stored standings for a league
 *     tags: [Soccer Data]
 *     security: []
 *     parameters:
 *       - in: path
 *         name: league
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: season
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: League or group standings
 */
router.get('/:league/standings', validateLeague, async(req, res) => {
    try {
        const league = await getLeague(req.params.league);
        if (!league) return res.status(404).json({ error: 'League not found' });

        if (req.query.season !== undefined && !/^\d{4}$/.test(String(req.query.season))) {
            return res.status(400).json({ error: 'season must be a four-digit year' });
        }

        let seasonYear = Number.parseInt(req.query.season, 10);
        if (!Number.isFinite(seasonYear)) seasonYear = league.season?.year;

        const filter = { league_slug: req.params.league };
        if (seasonYear) filter.season_year = seasonYear;

        const groups = await SoccerStanding.find(filter)
            .sort({ group_name: 1 })
            .lean();

        res.set('Cache-Control', 'public, max-age=30');
        return res.json({
            id: league.source?.source_id || league.slug,
            name: league.name,
            abbreviation: league.abbreviation,
            season: seasonYear || null,
            children: groups.map(serializeStandingGroup)
        });
    } catch (error) {
        return sendError(res, error);
    }
});

module.exports = app => app.use('/get/soccer', router);
