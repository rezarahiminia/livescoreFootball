const mongoose = require('../database');

const SoccerMatchEventSchema = new mongoose.Schema({
    source: {
        provider: {
            type: String,
            required: true,
            trim: true,
            lowercase: true,
            default: 'upstream'
        },
        event_key: {
            type: String,
            required: true,
            trim: true
        },
        modified_at: Date
    },
    league_slug: {
        type: String,
        required: true,
        trim: true,
        lowercase: true
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
    sequence: { type: Number, min: 0 },
    event_type: {
        id: { type: String, default: '' },
        name: { type: String, required: true },
        text: { type: String, default: '' }
    },
    text: { type: String, default: '' },
    alternative_text: { type: String, default: '' },
    clock: {
        value: { type: Number, min: 0 },
        display_value: { type: String, default: '' },
        added_value: { type: Number, min: 0 },
        added_display_value: { type: String, default: '' }
    },
    period: { type: Number, min: 0 },
    wallclock: Date,
    home_score: { type: Number, min: 0 },
    away_score: { type: Number, min: 0 },
    score_value: { type: Number, min: 0 },
    club: {
        source_id: { type: String, default: '' },
        side: {
            type: String,
            enum: ['home', 'away', 'unknown'],
            default: 'unknown'
        },
        name: { type: String, default: '' }
    },
    athlete_source_ids: [{ type: String, trim: true }],
    flags: {
        scoring_play: { type: Boolean, default: false },
        yellow_card: { type: Boolean, default: false },
        red_card: { type: Boolean, default: false },
        substitution: { type: Boolean, default: false },
        penalty_kick: { type: Boolean, default: false },
        own_goal: { type: Boolean, default: false },
        shootout: { type: Boolean, default: false }
    },
    valid: { type: Boolean, default: true },
    raw: {
        type: mongoose.Schema.Types.Mixed,
        select: false
    }
}, {
    collection: 'soccer_match_events',
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    versionKey: false
});

SoccerMatchEventSchema.index(
    { 'source.provider': 1, league_slug: 1, event_id: 1, 'source.event_key': 1 },
    { name: 'soccer_match_event_source_unique', unique: true }
);
SoccerMatchEventSchema.index(
    { league_slug: 1, event_id: 1, sequence: 1 },
    { name: 'soccer_match_event_timeline' }
);
SoccerMatchEventSchema.index(
    { league_slug: 1, event_id: 1, 'event_type.name': 1, period: 1 },
    { name: 'soccer_match_event_filter' }
);

const SoccerMatchEvent = mongoose.model('SoccerMatchEvent', SoccerMatchEventSchema);

module.exports = SoccerMatchEvent;
