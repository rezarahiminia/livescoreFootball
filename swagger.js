const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Free Football Live Scores API',
      version: '2.0.0',
      description: 'Open-source JSON football API for Premier League, LaLiga and expanding multi-country coverage. Read fixtures, live score snapshots, results, tables, clubs, match summaries, play-by-play and rosters from a database-backed REST service. Customer requests never call the upstream provider directly. Use GET /get/soccer/meta to inspect current coverage.',
      license: {
        name: 'ISC',
        url: 'https://opensource.org/licenses/ISC'
      }
    },
    externalDocs: {
      description: 'Business context, product boundaries, capability status, and AI contributor rules',
      url: `${String(process.env.API_URL || 'http://localhost:3050').replace(/\/$/, '')}/business-context.md`
    },
    servers: [
      {
        url: process.env.API_URL || 'http://localhost:3050',
        description: process.env.API_URL ? 'Configured server' : 'Development server'
      }
    ],
    tags: [
      {
        name: 'Soccer Data',
        description: 'Multi-league club data read from MongoDB'
      },
      {
        name: 'Health',
        description: 'Service and database health'
      }
    ],
    components: {
      schemas: {
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string' }
          }
        },
        League: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            abbreviation: { type: 'string' },
            slug: { type: 'string', example: 'eng.1' },
            country: { type: 'string', example: 'England' },
            kind: { type: 'string', enum: ['club', 'international'] },
            logo: { type: 'string' },
            active: { type: 'boolean' },
            lastSyncedAt: { type: 'string', format: 'date-time', nullable: true },
            coverage: { $ref: '#/components/schemas/Coverage' }
          }
        },
        Coverage: {
          type: 'object',
          required: ['matches', 'clubs', 'dedicatedClubs', 'standingsGroups', 'hasData'],
          properties: {
            matches: { type: 'integer', minimum: 0 },
            clubs: { type: 'integer', minimum: 0, description: 'Best available club count, including match-derived participants' },
            dedicatedClubs: { type: 'integer', minimum: 0, description: 'Full documents stored in soccer_clubs' },
            standingsGroups: { type: 'integer', minimum: 0 },
            hasData: { type: 'boolean' }
          }
        },
        Club: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            displayName: { type: 'string' },
            shortDisplayName: { type: 'string' },
            abbreviation: { type: 'string' },
            country: { type: 'string' },
            city: { type: 'string' },
            logo: { type: 'string' },
            color: { type: 'string' },
            foundedYear: { type: 'integer', nullable: true },
            venue: { type: 'object', nullable: true },
            isActive: { type: 'boolean' },
            catalogSource: { type: 'string', enum: ['club-catalog', 'match-snapshot'] }
          }
        },
        ServiceMeta: {
          type: 'object',
          properties: {
            service: { type: 'object' },
            coverage: {
              type: 'object',
              properties: {
                competitions: { type: 'integer' },
                activeClubCompetitions: { type: 'integer' },
                activeInternationalCompetitions: { type: 'integer' },
                competitionsWithMatches: { type: 'integer' },
                dedicatedClubDocuments: { type: 'integer' },
                matches: { type: 'integer' },
                playByPlayEvents: { type: 'integer' },
                standingsGroups: { type: 'integer' }
              }
            },
            features: { type: 'array', items: { type: 'string' } },
            lastSuccessfulSyncAt: { type: 'string', format: 'date-time', nullable: true },
            generatedAt: { type: 'string', format: 'date-time' }
          }
        },
        MatchStatus: {
          type: 'object',
          properties: {
            clock: { type: 'number' },
            displayClock: { type: 'string' },
            period: { type: 'integer' },
            type: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                state: { type: 'string', enum: ['pre', 'in', 'post', 'unknown'] },
                completed: { type: 'boolean' },
                description: { type: 'string' },
                detail: { type: 'string' },
                shortDetail: { type: 'string' }
              }
            }
          }
        },
        MatchDataAvailability: {
          type: 'object',
          description: 'Storage-backed match features and intentionally unavailable league-wide data',
          properties: {
            timeline: {
              type: 'object',
              properties: {
                available: { type: 'boolean', example: true },
                storedIn: { type: 'string', example: 'soccer_match_events' }
              }
            },
            matchGoals: {
              type: 'object',
              properties: {
                available: { type: 'boolean', example: true },
                storedIn: {
                  type: 'array',
                  items: { type: 'string' },
                  example: ['soccer_match_events', 'soccer_matches.key_events']
                }
              }
            },
            statisticsAndSummary: {
              type: 'object',
              properties: {
                available: { type: 'boolean', example: true },
                storedIn: { type: 'string', example: 'soccer_matches' }
              }
            },
            leagueTopScorers: {
              type: 'object',
              properties: {
                available: { type: 'boolean', example: false },
                reason: { type: 'string' }
              }
            }
          }
        },
        MatchSummary: {
          type: 'object',
          description: 'Stored match summary with score, teams, statistics, key events, and data availability',
          properties: {
            header: { type: 'object' },
            boxscore: { type: 'object' },
            keyEvents: {
              type: 'array',
              description: 'Goals, cards, and other important events; goal items have scoringPlay=true and may include athletesInvolved',
              items: { type: 'object' }
            },
            rosters: { type: 'array', items: { type: 'object' } },
            gameInfo: { type: 'object' },
            commentary: { type: 'array', items: { type: 'object' } },
            meta: {
              type: 'object',
              properties: {
                dataSource: { type: 'string', example: 'database' },
                provider: { type: 'string', example: 'upstream' },
                lastSyncedAt: { type: 'string', format: 'date-time', nullable: true },
                dataAvailability: { $ref: '#/components/schemas/MatchDataAvailability' }
              }
            }
          }
        },
        MatchPlay: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            type: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                text: { type: 'string', example: 'Goal' },
                type: { type: 'string', example: 'goal' }
              }
            },
            text: { type: 'string' },
            period: { type: 'object' },
            clock: { type: 'object' },
            scoringPlay: { type: 'boolean' },
            scoreValue: { type: 'number' },
            redCard: { type: 'boolean' },
            yellowCard: { type: 'boolean' },
            penaltyKick: { type: 'boolean' },
            ownGoal: { type: 'boolean' },
            substitution: { type: 'boolean' },
            team: { type: 'object', nullable: true },
            athletesInvolved: { type: 'array', items: { type: 'object' } },
            participants: {
              type: 'array',
              description: 'Players involved in an event; substitution events normally contain the incoming and outgoing players',
              items: { type: 'object' }
            }
          }
        }
      }
    }
  },
  apis: [
    './controllers/soccerController.js',
    './controllers/healthController.js'
  ]
};

const specs = swaggerJsdoc(options);

module.exports = { swaggerUi, specs };
