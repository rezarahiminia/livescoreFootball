const mongoose = require('../database');

const MatchStatusSchema = new mongoose.Schema({
    state: {
        type: String,
        enum: ['pre', 'in', 'post', 'unknown'],
        default: 'unknown'
    },
    name: { type: String, default: '' },
    description: { type: String, default: '' },
    detail: { type: String, default: '' },
    short_detail: { type: String, default: '' },
    clock: { type: String, default: '' },
    clock_seconds: { type: Number, min: 0 },
    period: { type: Number, min: 0 },
    completed: { type: Boolean, default: false },
    suspended: { type: Boolean, default: false }
}, { _id: false });

const MatchClubSchema = new mongoose.Schema({
    source_id: {
        type: String,
        required: true,
        trim: true
    },
    uid: { type: String, default: '' },
    name: { type: String, required: true, trim: true },
    display_name: { type: String, required: true, trim: true },
    abbreviation: { type: String, default: '', trim: true },
    logo: { type: String, default: '' },
    color: { type: String, default: '' },
    alternate_color: { type: String, default: '' },
    score: { type: Number, min: 0 },
    aggregate_score: { type: Number, min: 0 },
    shootout_score: { type: Number, min: 0 },
    winner: { type: Boolean, default: false },
    advance: { type: Boolean },
    form: { type: String, default: '' },
    stats: {
        type: Map,
        of: Number,
        default: undefined
    }
}, { _id: false });

const MatchVenueSchema = new mongoose.Schema({
    source_id: { type: String, default: '' },
    name: { type: String, default: '' },
    city: { type: String, default: '' },
    country: { type: String, default: '' }
}, { _id: false });

const SoccerMatchSchema = new mongoose.Schema({
    source: {
        provider: {
            type: String,
            required: true,
            trim: true,
            lowercase: true,
            default: 'upstream'
        },
        event_id: {
            type: String,
            required: true,
            trim: true
        },
        competition_id: {
            type: String,
            required: true,
            trim: true
        },
        uid: { type: String, default: '' },
        modified_at: Date
    },
    league_slug: {
        type: String,
        required: true,
        trim: true,
        lowercase: true
    },
    scoreboard_date: {
        type: String,
        required: true,
        match: /^\d{8}$/
    },
    date: {
        type: Date,
        required: true
    },
    name: { type: String, required: true, trim: true },
    short_name: { type: String, default: '', trim: true },
    season: {
        year: Number,
        type_id: String,
        slug: String,
        name: String
    },
    status: {
        type: MatchStatusSchema,
        required: true
    },
    home: {
        type: MatchClubSchema,
        required: true
    },
    away: {
        type: MatchClubSchema,
        required: true
    },
    venue: {
        type: MatchVenueSchema,
        default: undefined
    },
    attendance: { type: Number, min: 0 },
    note: { type: String, default: '' },
    play_by_play_available: { type: Boolean, default: false },
    broadcasts: [{ type: mongoose.Schema.Types.Mixed }],
    odds: [{ type: mongoose.Schema.Types.Mixed }],
    key_events: [{ type: mongoose.Schema.Types.Mixed }],
    lineups: [{ type: mongoose.Schema.Types.Mixed }],
    officials: [{ type: mongoose.Schema.Types.Mixed }],
    commentary: [{ type: mongoose.Schema.Types.Mixed }],
    leaders: [{ type: mongoose.Schema.Types.Mixed }],
    news: [{ type: mongoose.Schema.Types.Mixed }],
    videos: [{ type: mongoose.Schema.Types.Mixed }],
    format: mongoose.Schema.Types.Mixed,
    last_synced_at: {
        type: Date,
        required: true
    },
    source_payload: {
        type: mongoose.Schema.Types.Mixed,
        select: false
    }
}, {
    collection: 'soccer_matches',
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    versionKey: false
});

SoccerMatchSchema.index(
    { 'source.provider': 1, league_slug: 1, 'source.event_id': 1 },
    { name: 'soccer_match_source_unique', unique: true }
);
SoccerMatchSchema.index(
    { league_slug: 1, scoreboard_date: 1, date: 1 },
    { name: 'soccer_match_scoreboard' }
);
SoccerMatchSchema.index(
    { league_slug: 1, 'status.state': 1, date: 1 },
    { name: 'soccer_match_live_state' }
);

const SoccerMatch = mongoose.model('SoccerMatch', SoccerMatchSchema);

module.exports = SoccerMatch;
