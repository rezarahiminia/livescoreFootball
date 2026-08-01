const mongoose = require('../database');

const SoccerClubSchema = new mongoose.Schema({
    source: {
        provider: {
            type: String,
            required: true,
            trim: true,
            lowercase: true,
            default: 'upstream'
        },
        club_id: {
            type: String,
            required: true,
            trim: true
        },
        uid: {
            type: String,
            default: ''
        }
    },
    league_slugs: [{
        type: String,
        trim: true,
        lowercase: true
    }],
    slug: {
        type: String,
        default: '',
        trim: true
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    display_name: {
        type: String,
        required: true,
        trim: true
    },
    short_display_name: {
        type: String,
        default: '',
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
    city: {
        type: String,
        default: '',
        trim: true
    },
    logo: {
        type: String,
        default: ''
    },
    logos: [{
        type: mongoose.Schema.Types.Mixed
    }],
    color: {
        type: String,
        default: ''
    },
    alternate_color: {
        type: String,
        default: ''
    },
    founded_year: {
        type: Number,
        min: 1800
    },
    venue: mongoose.Schema.Types.Mixed,
    active: {
        type: Boolean,
        default: true
    },
    roster: [{
        type: mongoose.Schema.Types.Mixed
    }],
    coach: mongoose.Schema.Types.Mixed,
    last_synced_at: Date,
    source_payload: {
        type: mongoose.Schema.Types.Mixed,
        select: false
    }
}, {
    collection: 'soccer_clubs',
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    versionKey: false
});

SoccerClubSchema.index(
    { 'source.provider': 1, 'source.club_id': 1 },
    { name: 'soccer_club_source_unique', unique: true }
);
SoccerClubSchema.index(
    { league_slugs: 1, display_name: 1 },
    { name: 'soccer_club_league_name' }
);

const SoccerClub = mongoose.model('SoccerClub', SoccerClubSchema);

module.exports = SoccerClub;
