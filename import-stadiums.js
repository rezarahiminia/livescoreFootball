require('dotenv').config();
const mongoose = require('./database');
const Stadium = require('./models/stadium');
const fs = require('fs');

async function importStadiums() {
    try {
        console.log('Connecting to MongoDB...');
        
        // Wait for connection
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        console.log('Clearing existing stadiums...');
        // Drop the stadiums collection
        await mongoose.connection.db.dropCollection('stadiums').catch(() => {
            console.log('Collection does not exist yet, will create new one');
        });
        
        console.log('Reading stadiums file...');
        const stadiumsData = JSON.parse(
            fs.readFileSync('./football.stadiums.json', 'utf8')
        );
        
        console.log(`Found ${stadiumsData.length} stadiums to import`);
        
        // Import stadiums
        for (const item of stadiumsData) {
            const stadiumData = {
                id: item.id,
                name_en: item.name_en,
                name_fa: item.name_fa,
                fifa_name: item.fifa_name,
                city_en: item.city_en,
                city_fa: item.city_fa,
                country_en: item.country_en,
                country_fa: item.country_fa,
                capacity: item.capacity,
                region: item.region,
                timezone: item.timezone
            };
            
            console.log(`Creating stadium ${stadiumData.name_en}...`);
            await Stadium.create(stadiumData);
        }
        
        console.log('\n✅ Import completed successfully!');
        console.log(`Total stadiums imported: ${stadiumsData.length}`);
        
        // Verify
        const count = await Stadium.countDocuments();
        console.log(`Stadiums in database: ${count}`);
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Error during import:', error);
        process.exit(1);
    }
}

// Run import
importStadiums();
