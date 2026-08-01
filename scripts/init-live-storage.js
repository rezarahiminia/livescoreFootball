/**
 * Creates the collections and indexes used by an external live-score listener.
 *
 * This script does not call any external data provider. It only prepares
 * MongoDB storage for multi-league soccer data and listener coordination.
 *
 * Usage:
 *   npm run db:init-live
 */

const { loadEnvConfig } = require('../config/env');

loadEnvConfig();

const mongoose = require('../database');
const SoccerLeague = require('../models/soccerLeague');
const SoccerClub = require('../models/soccerClub');
const SoccerMatch = require('../models/soccerMatch');
const SoccerMatchEvent = require('../models/soccerMatchEvent');
const SoccerStanding = require('../models/soccerStanding');
const SoccerSyncState = require('../models/soccerSyncState');

async function ensureCollection(model) {
    try {
        await model.createCollection();
    } catch (error) {
        if (error.code !== 48 && error.codeName !== 'NamespaceExists') {
            throw error;
        }
    }

    await model.createIndexes();
}

async function initLiveStorage() {
    await mongoose.connection.asPromise();

    const models = [
        SoccerLeague,
        SoccerClub,
        SoccerMatch,
        SoccerMatchEvent,
        SoccerStanding,
        SoccerSyncState
    ];

    for (const model of models) {
        await ensureCollection(model);
    }

    console.log('Live storage is ready.');
    for (const model of models) {
        const count = await model.countDocuments();
        console.log(`  ${model.collection.collectionName}: ${count}`);
    }
}

initLiveStorage()
    .then(() => mongoose.disconnect())
    .catch(async(error) => {
        console.error('Failed to initialize live storage:', error.message);
        await mongoose.disconnect().catch(() => {});
        process.exitCode = 1;
    });
