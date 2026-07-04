const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'FIFA World Cup 2026 API',
      version: '1.0.4',
      description: 'Complete REST API for FIFA World Cup 2026 - United States, Mexico & Canada',
      contact: {
        name: 'API Support',
        email: 'support@worldcup2026.com'
      },
      license: {
        name: 'ISC',
        url: 'https://opensource.org/licenses/ISC'
      }
    },
    servers: [
      {
        url: 'http://localhost:3050',
        description: 'Development server'
      },
      {
        url: 'http://worldcup26.ir:3050',
        description: 'Production server'
      },
      {
        url: 'https://worldcup26.ir',
        description: 'Production server (HTTPS)'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter JWT token'
        }
      },
      schemas: {
        User: {
          type: 'object',
          required: ['name', 'email', 'password'],
          properties: {
            name: {
              type: 'string',
              description: 'User full name'
            },
            email: {
              type: 'string',
              format: 'email',
              description: 'User email address'
            },
            password: {
              type: 'string',
              format: 'password',
              description: 'User password (min 6 characters)'
            }
          }
        },
        Group: {
          type: 'object',
          properties: {
            _id: {
              type: 'string',
              description: 'Group ID'
            },
            name: {
              type: 'string',
              description: 'Group name (A-L)'
            },
            winner: {
              type: 'string',
              description: 'Winner team'
            },
            runnerUp: {
              type: 'string',
              description: 'Runner-up team'
            }
          }
        },
        Team: {
          type: 'object',
          properties: {
            _id: {
              type: 'string',
              description: 'Team ID'
            },
            name: {
              type: 'string',
              description: 'Team name'
            },
            flag: {
              type: 'string',
              description: 'Team flag URL'
            },
            group: {
              type: 'string',
              description: 'Group reference ID'
            },
            games: {
              type: 'array',
              items: {
                type: 'string'
              },
              description: 'Array of game IDs'
            }
          }
        },
        Game: {
          type: 'object',
          properties: {
            _id: {
              type: 'string',
              description: 'MongoDB document ID'
            },
            id: {
              type: 'string',
              description: 'Public match ID (1-104)'
            },
            home_team_id: {
              type: 'string',
              description: 'Home team public ID'
            },
            away_team_id: {
              type: 'string',
              description: 'Away team public ID'
            },
            home_score: {
              type: 'string',
              description: 'Home team score after regulation or extra time. Never includes penalty shootout goals (see home_penalties)'
            },
            away_score: {
              type: 'string',
              description: 'Away team score after regulation or extra time. Never includes penalty shootout goals (see away_penalties)'
            },
            home_scorers: {
              type: 'string',
              description: 'Home team scorers list or null string'
            },
            away_scorers: {
              type: 'string',
              description: 'Away team scorers list or null string'
            },
            home_penalties: {
              type: 'string',
              description: 'Knockout matches only — group matches never carry this field. Home team converted penalties in a shootout; "null" or absent when the match was not decided by a shootout'
            },
            away_penalties: {
              type: 'string',
              description: 'Knockout matches only — group matches never carry this field. Away team converted penalties in a shootout; "null" or absent when the match was not decided by a shootout'
            },
            extra_time: {
              type: 'string',
              description: 'Knockout matches only — group matches never carry this field. TRUE when the match went beyond 90 minutes, FALSE or absent otherwise'
            },
            group: {
              type: 'string',
              description: 'Group/stage code (A-L, R32, R16, QF, SF, 3RD, FINAL)'
            },
            matchday: {
              type: 'string',
              description: 'Matchday number as string'
            },
            local_date: {
              type: 'string',
              description: 'Local date in MM/DD/YYYY HH:mm format'
            },
            persian_date: {
              type: 'string',
              description: 'Persian calendar date/time'
            },
            stadium_id: {
              type: 'string',
              description: 'Stadium public ID'
            },
            date: {
              type: 'string',
              format: 'date-time',
              description: 'Parsed game date/time (ISO)'
            },
            finished: {
              type: 'string',
              description: 'Match finished status (e.g. FALSE/TRUE)'
            },
            time_elapsed: {
              type: 'string',
              description: 'Match clock status (e.g. notstarted, 45, HT, FT)'
            },
            type: {
              type: 'string',
              description: 'Tournament stage type (group, r32, r16, qf, sf, third, final)'
            },
            home_team_label: {
              type: 'string',
              description: 'Placeholder label for knockout home side'
            },
            away_team_label: {
              type: 'string',
              description: 'Placeholder label for knockout away side'
            },
            homeTeam: {
              type: 'string',
              description: 'Internal MongoDB ObjectId reference to home team'
            },
            visitingTeam: {
              type: 'string',
              description: 'Internal MongoDB ObjectId reference to away team'
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Creation timestamp'
            }
          }
        },
        MatchTable: {
          type: 'object',
          properties: {
            _id: {
              type: 'string',
              description: 'Match table ID'
            },
            group: {
              type: 'string',
              description: 'Group name (A-L)'
            },
            teams: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  team_id: {
                    type: 'string',
                    description: 'Team ID'
                  },
                  mp: {
                    type: 'number',
                    description: 'Matches played'
                  },
                  w: {
                    type: 'number',
                    description: 'Wins'
                  },
                  d: {
                    type: 'number',
                    description: 'Draws'
                  },
                  l: {
                    type: 'number',
                    description: 'Losses'
                  },
                  gf: {
                    type: 'number',
                    description: 'Goals for'
                  },
                  ga: {
                    type: 'number',
                    description: 'Goals against'
                  },
                  gd: {
                    type: 'number',
                    description: 'Goal difference'
                  },
                  pts: {
                    type: 'number',
                    description: 'Points'
                  }
                }
              }
            }
          }
        },
        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'string',
              description: 'Error message'
            }
          }
        }
      }
    },
    security: [
      {
        bearerAuth: []
      }
    ]
  },
  apis: ['./controllers/*.js', './index.js']
};

const specs = swaggerJsdoc(options);

module.exports = { swaggerUi, specs };
