const mongoose = require('../database');

const GameSchema = new mongoose.Schema({
    id: {
        type: String,
        required: true,
        unique: true
    },
    home_team_id: {
        type: String,
        required: true
    },
    away_team_id: {
        type: String,
        required: true
    },
    home_score: {
        type: String,
        default: "0"
    },
    away_score: {
        type: String,
        default: "0"
    },
    home_penalty_score: {
        type: String,
        default: null
    },
    away_penalty_score: {
        type: String,
        default: null
    },
    winner_team_id: {
        type: String,
        default: null
    },
    home_scorers: {
        type: String,
        default: "null"
    },
    away_scorers: {
        type: String,
        default: "null"
    },
    // Knockout matches only; group matches never carry these fields.
    // home_score / away_score always hold the score after regulation or
    // extra time; a penalty shootout is reported here and never folded
    // into the score fields. "null" or absent means the match was not
    // decided by a shootout.
    home_penalties: {
        type: String
    },
    away_penalties: {
        type: String
    },
    // "TRUE" when the match went beyond 90 minutes. "FALSE"/absent means
    // it was decided in regulation time. Knockout matches only.
    extra_time: {
        type: String
    },
    group: {
        type: String
    },
    matchday: {
        type: String
    },
    local_date: {
        type: String
    },
    persian_date: {
        type: String
    },
    stadium_id: {
        type: String,
        required: true
    },
    finished: {
        type: String,
        default: "FALSE"
    },
    time_elapsed: {
        type: String,
        default: "notstarted"
    },
    type: {
        type: String,
        default: "group"
    },
    home_team_label: {
        type: String,
        default: ""
    },
    away_team_label: {
        type: String,
        default: ""
    },
    homeTeam: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Team'
    },
    visitingTeam: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Team'
    },
    date: {
        type: Date,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

const Game = mongoose.model('Game', GameSchema);

module.exports = Game;
