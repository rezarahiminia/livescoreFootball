const mongoose = require('../database');

const SoccerLeagueSchema = new mongoose.Schema({
    slug: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    abbreviation: {
        type: String,
        default: '',
        trim: true
    },
    country: {
        type: String,
        default: '',
        trim: true
    },
    kind: {
        type: String,
        enum: ['club', 'international'],
        default: 'club',
        index: true
    },
    logo: {
        type: String,
        default: ''
    },
    active: {
        type: Boolean,
        default: true,
        index: true
    },
    sort_order: {
        type: Number,
        default: 0
    },
    source: {
        provider: {
            type: String,
            required: true,
            trim: true,
            lowercase: true,
            default: 'upstream'
        },
        source_id: {
            type: String,
            default: '',
            trim: true
        }
    },
    season: {
        year: Number,
        display_name: String,
        current: Boolean,
        type_id: String,
        type_name: String
    },
    calendar: [{
        type: mongoose.Schema.Types.Mixed
    }],
    last_synced_at: Date,
    metadata: mongoose.Schema.Types.Mixed
}, {
    collection: 'soccer_leagues',
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    versionKey: false
});

SoccerLeagueSchema.index(
    { active: 1, sort_order: 1, name: 1 },
    { name: 'soccer_league_public_list' }
);

const SoccerLeague = mongoose.model('SoccerLeague', SoccerLeagueSchema);

module.exports = SoccerLeague;
