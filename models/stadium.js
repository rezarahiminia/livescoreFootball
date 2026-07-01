const mongoose = require('../database');

const StadiumSchema = new mongoose.Schema({
    id: {
        type: String,
        required: true,
        unique: true
    },
    name_en: {
        type: String,
        required: true
    },
    name_fa: {
        type: String,
        required: true
    },
    fifa_name: {
        type: String
    },
    city_en: {
        type: String,
        required: true
    },
    city_fa: {
        type: String,
        required: true
    },
    country_en: {
        type: String,
        required: true
    },
    country_fa: {
        type: String,
        required: true
    },
    capacity: {
        type: Number,
        required: true
    },
    region: {
        type: String
    },
    timezone: {
        type: String
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

const Stadium = mongoose.model('Stadium', StadiumSchema);

module.exports = Stadium;
