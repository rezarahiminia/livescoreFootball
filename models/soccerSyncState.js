const mongoose = require('../database');

const SoccerSyncStateSchema = new mongoose.Schema({
    provider: {
        type: String,
        required: true,
        trim: true,
        lowercase: true,
        default: 'upstream'
    },
    league_slug: {
        type: String,
        required: true,
        trim: true,
        lowercase: true
    },
    resource_type: {
        type: String,
        required: true,
        enum: ['scoreboard', 'summary', 'plays', 'clubs', 'standings']
    },
    resource_key: {
        type: String,
        required: true,
        trim: true
    },
    status: {
        type: String,
        enum: ['idle', 'polling', 'healthy', 'error', 'stopped'],
        default: 'idle'
    },
    last_polled_at: Date,
    last_success_at: Date,
    next_poll_at: Date,
    cursor: mongoose.Schema.Types.Mixed,
    consecutive_errors: { type: Number, min: 0, default: 0 },
    error: {
        code: { type: String, default: '' },
        message: { type: String, default: '' },
        occurred_at: Date
    },
    lease: {
        owner: { type: String, default: '' },
        expires_at: Date
    },
    metadata: mongoose.Schema.Types.Mixed
}, {
    collection: 'soccer_sync_states',
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    versionKey: false
});

SoccerSyncStateSchema.index(
    { provider: 1, league_slug: 1, resource_type: 1, resource_key: 1 },
    { name: 'soccer_sync_resource_unique', unique: true }
);
SoccerSyncStateSchema.index(
    { status: 1, next_poll_at: 1 },
    { name: 'soccer_sync_due_poll' }
);
SoccerSyncStateSchema.index(
    { 'lease.expires_at': 1 },
    { name: 'soccer_sync_lease_expiry' }
);

const SoccerSyncState = mongoose.model('SoccerSyncState', SoccerSyncStateSchema);

module.exports = SoccerSyncState;
