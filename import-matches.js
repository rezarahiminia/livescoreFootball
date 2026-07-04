require('dotenv').config();
const mongoose = require('./database');
const Game = require('./models/game');
const Team = require('./models/team');
const fs = require('fs');

async function importMatches() {
    try {
        console.log('Connecting to MongoDB...');
        
        // Wait for connection
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        console.log('Clearing existing games...');
        // Drop the games collection
        await mongoose.connection.db.dropCollection('games').catch(() => {
            console.log('Collection does not exist yet, will create new one');
        });
        
        console.log('Reading matches file...');
        const matchesData = JSON.parse(
            fs.readFileSync('./football.matches.json', 'utf8')
        );
        
        console.log(`Found ${matchesData.length} matches to import`);
        
        // Get all teams to map team_id to ObjectId
        const teams = await Team.find({});
        console.log(`Found ${teams.length} teams in database`);
        
        if (teams.length === 0) {
            console.error('❌ No teams found! Please import teams first using: node import-teams.js');
            process.exit(1);
        }
        
        // Create a map of team id to their ObjectIds
        // Match by team id field directly from database
        const teamMap = {};
        
        for (const team of teams) {
            teamMap[team.id] = team._id;
            console.log(`  Mapped team id ${team.id} → ${team.name_en} (${team._id})`);
        }
        
        console.log(`Mapped ${Object.keys(teamMap).length} teams`);
        
        // Import matches
        let imported = 0;
        for (const item of matchesData) {
            const homeTeamId = teamMap[item.home_team_id];
            const awayTeamId = teamMap[item.away_team_id];
            const isGroup = (item.type || 'group') === 'group';

            if (isGroup && (!homeTeamId || !awayTeamId)) {
                console.warn(`⚠️  Skipping match ${item.id}: Missing team mapping (home: ${item.home_team_id}, away: ${item.away_team_id})`);
                continue;
            }

            const gameData = {
                id: item.id,
                home_team_id: item.home_team_id,
                away_team_id: item.away_team_id,
                home_score: item.home_score,
                away_score: item.away_score,
                home_scorers: item.home_scorers,
                away_scorers: item.away_scorers,
                // Knockout-only fields; undefined for group matches, so the
                // paths stay unset on group documents.
                home_penalties: item.home_penalties,
                away_penalties: item.away_penalties,
                extra_time: item.extra_time,
                group: item.group,
                matchday: item.matchday,
                local_date: item.local_date,
                persian_date: item.persian_date,
                stadium_id: item.stadium_id,
                finished: item.finished,
                time_elapsed: item.time_elapsed,
                type: item.type,
                home_team_label: item.home_team_label || "",
                away_team_label: item.away_team_label || "",
                homeTeam: homeTeamId || null,
                visitingTeam: awayTeamId || null,
                date: new Date(item.local_date)
            };
            
            await Game.create(gameData);
            imported++;
            
            if (imported % 10 === 0) {
                console.log(`Imported ${imported}/${matchesData.length} matches...`);
            }
        }
        
        console.log('\n✅ Import completed successfully!');
        console.log(`Total matches imported: ${imported}`);
        
        // Verify
        const count = await Game.countDocuments();
        console.log(`Games in database: ${count}`);
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Error during import:', error);
        process.exit(1);
    }
}

// Run import
importMatches();
