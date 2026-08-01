const mongoose = require('../database');

const StandingEntrySchema = new mongoose.Schema({
    rank: { type: Number, min: 1 },
    club: {
        source_id: { type: String, required: true },
        display_name: { type: String, required: true },
        abbreviation: { type: String, default: '' },
        logo: { type: String, default: '' }
    },
    stats: {
        type: Map,
        of: Number,
        default: undefined
    },
    note: mongoose.Schema.Types.Mixed
}, { _id: false });

const SoccerStandingSchema = new mongoose.Schema({
    league_slug: {
        type: String,
        required: true,
        trim: true,
        lowercase: true
    },
    season_year: {
        type: Number,
        required: true
    },
    group_id: {
        type: String,
        required: true,
        trim: true
    },
    group_name: {
        type: String,
        required: true,
        trim: true
    },
    entries: [StandingEntrySchema],
    last_synced_at: {
        type: Date,
        required: true
    },
    source_payload: {
        type: mongoose.Schema.Types.Mixed,
        select: false
    }
}, {
    collection: 'soccer_standings',
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    versionKey: false
});

SoccerStandingSchema.index(
    { league_slug: 1, season_year: 1, group_id: 1 },
    { name: 'soccer_standing_group_unique', unique: true }
);

const SoccerStanding = mongoose.model('SoccerStanding', SoccerStandingSchema);

module.exports = SoccerStanding;
