module.exports = app => {
    require('./healthController')(app);
    require('./soccerController')(app);
    require('./seoController')(app);
};
