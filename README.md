# ⚽ FIFA World Cup 2026 API — Free Open-Source REST API with Live Scores

<!-- GitHub Visitor Counter -->
![Visitor Count](https://komarev.com/ghpvc/?username=rezarahiminia-worldcup2026&label=Visitors&color=brightgreen&style=flat-square)

[![Node.js](https://img.shields.io/badge/Node.js-18.x-green?logo=node.js)](https://nodejs.org/)
[![Express.js](https://img.shields.io/badge/Express.js-4.x-lightgrey?logo=express)](https://expressjs.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-6.x-green?logo=mongodb)](https://www.mongodb.com/)
[![Swagger](https://img.shields.io/badge/Swagger-OpenAPI%203.0-orange?logo=swagger)](https://swagger.io/)
[![License](https://img.shields.io/badge/License-ISC-blue.svg)](LICENSE)
[![API Version](https://img.shields.io/badge/API%20Version-1.0.5-blue)]()
[![API Status](https://img.shields.io/badge/API-Live-brightgreen)](https://worldcup26.ir)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/rezarahiminia/worldcup2026/pulls)

> 🏆 **The first-ever 48-team FIFA World Cup — Free REST API with live scores, 104 matches, 16 stadiums, 12 groups, and real-time updates. No API key required for read access.**

A comprehensive, **free and open-source** REST API providing real-time data for the **2026 FIFA World Cup**, hosted across **United States 🇺🇸, Mexico 🇲🇽 & Canada 🇨🇦**. Access teams, groups, matches, stadiums, live scores, and standings — perfect for developers building World Cup apps, dashboards, widgets, bots, and data visualizations.

### 🎯 Why Use This API?

| Feature | Details |
|---------|---------|
| 💰 **100% Free** | No payment, no credit card, no hidden fees |
| 🔓 **Open Source** | Full source code — fork, modify, self-host |
| 🔴 **Live Scores** | Real-time match updates during the tournament |
| 📊 **Complete Data** | 48 teams, 12 groups, 104 matches, 16 stadiums |
| 🌍 **Multilingual** | English & Persian (Farsi) team/stadium names |
| 📖 **Swagger Docs** | Interactive try-it-out API documentation |
| ⚡ **Fast** | Express.js + MongoDB + compression + caching |
| 🔗 **REST + JSON** | Standard REST API — works with any language |

### ⚡ Quick Example

```bash
# Get all World Cup 2026 matches (no auth needed for demo)
curl https://worldcup26.ir/get/games

# Get group standings
curl https://worldcup26.ir/get/groups

# Get all 48 teams
curl https://worldcup26.ir/get/teams

# Get all 16 stadiums
curl https://worldcup26.ir/get/stadiums
```

> 📖 **Full documentation:** [worldcup26.ir/api-docs](https://worldcup26.ir/api-docs/)

---

## 📑 Table of Contents

- [Key Features](#-key-features)
- [Tournament Information](#-tournament-information)
- [Technologies](#️-technologies)
- [Getting Started](#-getting-started)
- [Data Import](#-data-import)
- [Swagger API Documentation](#-swagger-api-documentation)
- [API Endpoints](#-api-endpoints)
- [Live Score Updates](#-live-score-updates)
- [World Cup 2026 Groups](#-world-cup-2026-groups)
- [Host Stadiums](#️-host-stadiums)
- [Response Codes](#-response-codes)
- [Contributing](#-contributing)
- [License](#-license)
- [Support This Project](#-support-this-project)
- [Contact & Support](#-contact--support)

---

## 🌟 Key Features

- 🔴 **Live Match Updates** — Real-time scores updated during matches
- 🏟️ **16 Host Stadiums** — Complete venue information across 3 countries
- 👥 **48 National Teams** — All qualified teams with full details
- 📊 **12 Groups (A-L)** — Full group stage standings with auto-update
- 📅 **104 Matches** — From group stage to the grand final
- 🌍 **Multi-language Support** — English & Persian (Farsi) data
- 📖 **Swagger UI** — Interactive API documentation with try-it-out
- 🔒 **JWT Authentication** — Secure access with token-based auth
- ⚡ **Rate Limiting** — Built-in rate limiter for fair usage
- 🧠 **Public API Cache** — In-memory cache for high-traffic public GET endpoints
- 🗜️ **Compression & Helmet** — Optimized & secure responses

---

## 📅 Tournament Information

| Info | Details |
|------|---------|
| **Tournament** | FIFA World Cup 2026™ |
| **Host Countries** | 🇺🇸 United States, 🇲🇽 Mexico, 🇨🇦 Canada |
| **Teams** | 48 (expanded from 32) |
| **Groups** | 12 (A through L) |
| **Total Matches** | 104 (72 group stage + 32 knockout) |
| **Opening Match** | June 11, 2026 — Mexico City 🇲🇽 |
| **Round of 32 begins** | June 28, 2026 |
| **Final** | July 19, 2026 — MetLife Stadium, East Rutherford 🇺🇸 |

---

## 🛠️ Technologies

| Technology | Purpose |
|-----------|---------|
| [Node.js](https://nodejs.org/) | Runtime environment |
| [Express.js](https://expressjs.com/) | Web framework |
| [MongoDB](https://www.mongodb.com/) | Database |
| [Mongoose](https://mongoosejs.com/) | ODM for MongoDB |
| [JWT](https://jwt.io/) | Authentication |
| [Swagger/OpenAPI 3.0](https://swagger.io/) | API Documentation |
| [Helmet](https://helmetjs.github.io/) | Security headers |
| [express-rate-limit](https://www.npmjs.com/package/express-rate-limit) | Rate limiting |

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18.x or higher
- MongoDB 6.x or higher
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/rezarahiminia/worldcup2026.git

# Navigate to project directory
cd worldcup2026

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.development

# Start development server
npm run dev

# Or start production server
npm run prod
```

### Environment Variables

Create a `.env.development` or `.env.production` file:

```env
NODE_ENV=development
PORT=3050
MONGODB_URL=mongodb://localhost:27017/worldcup2026
JWT_SECRET=your_jwt_secret_key
SECRET=your_secret_key
ENABLE_SWAGGER=true
LOG_LEVEL=debug
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=500
PUBLIC_RATE_LIMIT_WINDOW_MS=60000
PUBLIC_RATE_LIMIT_MAX=120
PUBLIC_CACHE_TTL_MS=30000
PUBLIC_CACHE_MAX_ITEMS=1000
CORS_ORIGINS=*
```

#### Rate Limit and Cache Settings

These settings are useful in production when public endpoints receive heavy traffic:

| Variable | Default | Description |
|----------|---------|-------------|
| `RATE_LIMIT_WINDOW_MS` | `60000` | Global rate-limit window in milliseconds. `60000` means 60 seconds. |
| `RATE_LIMIT_MAX` | `500` | Maximum requests per IP for non-public routes inside the global window. |
| `PUBLIC_RATE_LIMIT_WINDOW_MS` | `60000` | Rate-limit window for public `/get/*` endpoints. |
| `PUBLIC_RATE_LIMIT_MAX` | `120` | Maximum `/get/*` requests per IP inside the public window. Requests above this return `429`. |
| `PUBLIC_CACHE_TTL_MS` | `30000` | How long public GET responses stay in memory cache. `30000` means 30 seconds. |
| `PUBLIC_CACHE_MAX_ITEMS` | `1000` | Maximum number of unique public GET URLs stored in cache. |
| `LOG_LEVEL` | `debug` in development, `error` in production | Set to `error` in production to avoid noisy per-request logs under heavy traffic. |

Example production values:

```env
LOG_LEVEL=error
PUBLIC_RATE_LIMIT_WINDOW_MS=60000
PUBLIC_RATE_LIMIT_MAX=120
PUBLIC_CACHE_TTL_MS=30000
PUBLIC_CACHE_MAX_ITEMS=1000
```

### NPM Scripts

| Script | Command | Description |
|--------|---------|-------------|
| `npm start` | `node index.js` | Start server |
| `npm run dev` | `nodemon index.js` | Development mode with hot-reload |
| `npm run prod` | `node index.js` | Production mode |
| `npm run import:all` | — | Import all data (groups, teams, stadiums, matches) |

---

## 📥 Data Import

The API comes with CSV data files and import scripts to populate your MongoDB database. You **must** import data before using the API.

### Quick Import (All Data at Once)

```bash
# Import everything: groups, teams, stadiums, and matches
npm run import:all
```

### Step-by-Step Import

Import data in this specific order (dependencies matter):

```bash
# Step 1: Import 12 Groups (A-L)
npm run import:groups

# Step 2: Import 48 Teams
npm run import:teams

# Step 3: Import 16 Stadiums
npm run import:stadiums

# Step 4: Import 104 Matches
npm run import:matches
```

### Alternative: Using Node Directly

```bash
# Import all at once with the import-all script
node import-all.js

# Or individually:
node import-groups.js
node import-teams.js
node import-stadiums.js
node import-matches.js
```

### Data Source Files (CSV)

| File | Description | Records |
|------|-------------|---------|
| `worldcup2026.groups.csv` | Group definitions (A-L) | 12 |
| `worldcup2026.teams.csv` | All qualified national teams | 48 |
| `worldcup2026.stadia.csv` | Host stadiums across 3 countries | 16 |
| `worldcup2026.games.csv` | All tournament matches | 104 |

### JSON Data Files

Pre-formatted MongoDB-ready JSON files are also available:

| File | Description |
|------|-------------|
| `football.teams.json` | Teams collection |
| `football.matches.json` | Matches collection |
| `football.matchtables.json` | Group standings |
| `football.stadiums.json` | Stadiums collection |

> ⚠️ **Note:** Make sure MongoDB is running before importing. The import scripts will connect using the `MONGODB_URL` from your environment configuration.

---

## 📖 Swagger API Documentation

This API includes full **interactive Swagger UI** documentation powered by OpenAPI 3.0.

| Info | Details |
|------|---------|
| **Swagger Version** | OpenAPI 3.0 (`swagger-jsdoc` 6.x + `swagger-ui-express` 5.x) |
| **API Version** | 1.0.5 |
| **Dev URL** | [http://localhost:3050/api-docs/](http://localhost:3050/api-docs/) |
| **Production (HTTPS)** | [https://worldcup26.ir/api-docs/](https://worldcup26.ir/api-docs/) |

### How to Use Swagger UI

1. Start the server (`npm run dev` or `npm run prod`)
2. Open your browser and go to `/api-docs/`
3. Click **Authorize** 🔒 and enter your JWT token
4. Try out any endpoint directly from the browser

> 💡 **Tip:** Swagger is enabled by default in development mode. In production, set `ENABLE_SWAGGER=true` in your `.env.production` file.

---

## 📖 API Endpoints

### 🔐 Authentication

All endpoints (except auth routes) require a valid JWT token in the Authorization header.

```http
Authorization: Bearer YOUR_TOKEN
```

---

### 🔑 Auth Endpoints

#### Register New User
```http
POST /auth/register
Content-Type: application/json
```

**Request Body:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "your_secure_password"
}
```

| Parameter | Type | Description |
|:----------|:-----|:------------|
| `name` | `string` | **Required**. User's full name |
| `email` | `string` | **Required**. Valid email address (must be unique) |
| `password` | `string` | **Required**. User password (will be hashed) |

**Success Response (200):**
```json
{
  "user": {
    "_id": "...",
    "name": "John Doe",
    "email": "john@example.com",
    "createdAt": "2026-02-06T..."
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Error Responses:**
| Code | Message |
|------|---------|
| `400` | User already exists |
| `400` | Registration failed |

---

#### Login / Authenticate
```http
POST /auth/authenticate
Content-Type: application/json
```

**Request Body:**
```json
{
  "email": "john@example.com",
  "password": "your_password"
}
```

| Parameter | Type | Description |
|:----------|:-----|:------------|
| `email` | `string` | **Required**. Registered email address |
| `password` | `string` | **Required**. Account password |

**Success Response (200):**
```json
{
  "user": {
    "_id": "...",
    "name": "John Doe",
    "email": "john@example.com"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Error Responses:**
| Code | Message |
|------|---------|
| `400` | User not found |
| `400` | Invalid password |

---

### 🔒 Token Usage

After successful login/registration, use the returned token for all API requests:

```javascript
// Example using fetch
fetch('https://worldcup26.ir/get/teams', {
  headers: {
    'Authorization': 'Bearer YOUR_JWT_TOKEN'
  }
})
```

```bash
# Example using cURL
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  https://worldcup26.ir/get/teams
```

> ⏰ **Token Expiry:** Tokens are valid for **84 days** (7,257,600 seconds). After expiration, you'll need to login again.

---

### 👥 Team Endpoints

#### Get All Teams
```http
GET /get/teams
Authorization: Bearer ${Token}
```
Returns all 48 qualified teams for World Cup 2026.

**Response Example:**
```json
{
  "id": "37",
  "name_en": "Argentina",
  "name_fa": "آرژانتین",
  "fifa_code": "ARG",
  "groups": "J",
  "flag": "https://..."
}
```

#### Get Team by ID
```http
GET /get/team/${teamId}
Authorization: Bearer ${Token}
```
| Parameter | Type | Description |
|:----------|:-----|:------------|
| `teamId` | `string` | **Required**. Unique team identifier |

#### Get Team by Name
```http
GET /get/team/?name=${teamName}
Authorization: Bearer ${Token}
```
| Parameter | Type | Description |
|:----------|:-----|:------------|
| `teamName` | `string` | Team name (English or Persian) |

#### Get Teams by Group
```http
GET /get/teams/?group=${groupName}
Authorization: Bearer ${Token}
```
| Parameter | Type | Description |
|:----------|:-----|:------------|
| `groupName` | `string` | Group letter (A-L) |

---

### 📊 Group Endpoints

#### Get All Groups
```http
GET /get/groups
Authorization: Bearer ${Token}
```
Returns all 12 groups with standings table.

**Response Example:**
```json
{
  "group": "G",
  "teams": [
    { "team_id": "25", "pts": "0", "gf": "0", "ga": "0" },
    { "team_id": "26", "pts": "0", "gf": "0", "ga": "0" },
    { "team_id": "27", "pts": "0", "gf": "0", "ga": "0" },
    { "team_id": "28", "pts": "0", "gf": "0", "ga": "0" }
  ]
}
```

#### Get Group by ID
```http
GET /get/group/${groupId}
Authorization: Bearer ${Token}
```
| Parameter | Type | Description |
|:----------|:-----|:------------|
| `groupId` | `string` | **Required**. Group identifier |

#### Get Group by Name
```http
GET /get/group/?name=${groupName}
Authorization: Bearer ${Token}
```
| Parameter | Type | Description |
|:----------|:-----|:------------|
| `groupName` | `string` | Group letter (A, B, C... L) |

---

### ⚽ Match Endpoints

#### Get All Matches
```http
GET /get/games
Authorization: Bearer ${Token}
```
Returns all 104 matches of the tournament.

**Response Example:**
```json
{
  "games": [
    {
      "_id": "679c9c8a5749c4077500e001",
      "id": "1",
      "home_team_id": "1",
      "away_team_id": "2",
      "home_score": "0",
      "away_score": "0",
      "home_scorers": "null",
      "away_scorers": "null",
      "group": "A",
      "matchday": "1",
      "local_date": "06/11/2026 13:00",
      "persian_date": "1405-03-21 13:00",
      "stadium_id": "1",
      "finished": "FALSE",
      "time_elapsed": "notstarted",
      "type": "group",
      "home_team_name_en": "Mexico",
      "home_team_name_fa": "مکزیک",
      "away_team_name_en": "South Africa",
      "away_team_name_fa": "آفریقای جنوبی"
    }
  ]
}
```

#### Get Match by ID
```http
GET /get/game/${matchId}
Authorization: Bearer ${Token}
```
| Parameter | Type | Description |
|:----------|:-----|:------------|
| `matchId` | `string` | **Required**. Match identifier (1–104) |

**Response Example (Group Match):**
```json
{
  "game": {
    "_id": "679c9c8a5749c4077500e001",
    "id": "1",
    "home_team_id": "1",
    "away_team_id": "2",
    "home_score": "0",
    "away_score": "0",
    "home_scorers": "null",
    "away_scorers": "null",
    "group": "A",
    "matchday": "1",
    "local_date": "06/11/2026 13:00",
    "persian_date": "1405-03-21 13:00",
    "stadium_id": "1",
    "finished": "FALSE",
    "time_elapsed": "notstarted",
    "type": "group"
  }
}
```

**Response Example (Knockout Match — teams TBD):**
```json
{
  "game": {
    "_id": "679c9c8a5749c4077500e049",
    "id": "73",
    "home_team_id": "0",
    "away_team_id": "0",
    "home_score": "0",
    "away_score": "0",
    "home_scorers": "null",
    "away_scorers": "null",
    "group": "R32",
    "matchday": "4",
    "local_date": "06/28/2026 12:00",
    "persian_date": "1405-04-07 12:00",
    "stadium_id": "16",
    "finished": "FALSE",
    "time_elapsed": "notstarted",
    "type": "r32",
    "home_team_label": "Runner-up Group A",
    "away_team_label": "Runner-up Group B"
  }
}
```

##### Tournament Stages

The `type` field identifies the stage of each match. For knockout matches before the bracket is filled in, opponents are referenced through the `home_team_label` / `away_team_label` placeholder fields (e.g. `"Winner Group A"`, `"3rd Group C/D/F/G/H"`, `"Winner Match 73"`, `"Loser Match 101"`). Once the opposing teams are determined, update `home_team_id` and `away_team_id` accordingly.

| `type` | `group` | `matchday` | Stage | Matches | IDs |
|--------|---------|------------|-------|---------|-----|
| `group` | A–L | 1–3 | Group stage | 72 | 1–72 |
| `r32`   | R32   | 4 | Round of 32 | 16 | 73–88 |
| `r16`   | R16   | 5 | Round of 16 | 8  | 89–96 |
| `qf`    | QF    | 6 | Quarterfinals | 4 | 97–100 |
| `sf`    | SF    | 7 | Semifinals | 2 | 101–102 |
| `third` | 3RD   | 8 | Match for third place | 1 | 103 |
| `final` | FINAL | 9 | Final | 1 | 104 |

**Knockout Stage Schedule:**

| Stage | Dates | Venues |
|-------|-------|--------|
| Round of 32 | June 28 – July 3, 2026 | 13 stadiums across US, Mexico & Canada |
| Round of 16 | July 4 – 7, 2026 | 8 stadiums |
| Quarterfinals | July 9 – 11, 2026 | Foxborough, Inglewood, Miami Gardens, Kansas City |
| Semifinals | July 14 – 15, 2026 | Arlington, Atlanta |
| Third place | July 18, 2026 | Hard Rock Stadium, Miami Gardens |
| **Final** | **July 19, 2026** | **MetLife Stadium, East Rutherford** |

> 📌 Source: [Wikipedia — 2026 FIFA World Cup](https://en.wikipedia.org/wiki/2026_FIFA_World_Cup)

---

### 🏟️ Stadium Endpoints

#### Get All Stadiums
```http
GET /get/stadiums
Authorization: Bearer ${Token}
```
Returns all 16 host stadiums.

**Response Example:**
```json
{
  "id": "11",
  "name_en": "MetLife Stadium",
  "name_fa": "استادیوم متلایف",
  "fifa_name": "New York/New Jersey Stadium",
  "city_en": "East Rutherford, NJ",
  "country_en": "United States",
  "capacity": 82500
}
```

---

### 🏥 Health Check Endpoints

#### Health Status
```http
GET /health
```
No authentication required. Returns the health status of the API and database.

**Response Example:**
```json
{
  "status": "healthy",
  "timestamp": "2026-02-09T12:30:00.000Z",
  "uptime": 3600,
  "version": "1.0.5",
  "environment": "production",
  "database": {
    "status": "connected",
    "name": "worldcup2026"
  },
  "memory": {
    "used": "45 MB",
    "total": "128 MB"
  }
}
```

**Alternative Endpoint:**
```http
GET /api/health
```

---

## 🔴 Live Score Updates

> **⚡ During the FIFA World Cup 2026 tournament (June 11 — July 19, 2026), match scores and statistics will be updated in real-time!**

### Live Data Includes:
- ✅ Current match scores
- ✅ Goal scorers with timestamps
- ✅ Match status (upcoming, live, finished)
- ✅ Time elapsed
- ✅ Group standings automatically updated

---

## 🏆 World Cup 2026 Groups

| Group A | Group B | Group C | Group D |
|---------|---------|---------|---------|
| 🇲🇽 Mexico | 🇨🇦 Canada | 🇧🇷 Brazil | 🇺🇸 USA |
| 🇿🇦 South Africa | 🇨🇭 Switzerland | 🇲🇦 Morocco | 🇵🇾 Paraguay |
| 🇰🇷 South Korea | 🇶🇦 Qatar | 🇭🇹 Haiti | 🇦🇺 Australia |
| CZ Czech Republic | BA Bosnia and Herzegovina  | 🏴󠁧󠁢󠁳󠁣󠁴󠁿 Scotland | TR Turkiye |

| Group E | Group F | Group G | Group H |
|---------|---------|---------|---------|
| 🇩🇪 Germany | 🇳🇱 Netherlands | 🇧🇪 Belgium | 🇪🇸 Spain |
| 🇨🇼 Curaçao | 🇯🇵 Japan | 🇪🇬 Egypt | 🇨🇻 Cape Verde |
| 🇨🇮 Ivory Coast | 🇹🇳 Tunisia | 🇮🇷 Iran | 🇸🇦 Saudi Arabia |
| 🇪🇨 Ecuador | SE Sweden | 🇳🇿 New Zealand | 🇺🇾 Uruguay |

| Group I | Group J | Group K | Group L |
|---------|---------|---------|---------|
| 🇫🇷 France | 🇦🇷 Argentina | 🇵🇹 Portugal | 🏴󠁧󠁢󠁥󠁮󠁧󠁿 England |
| 🇸🇳 Senegal | 🇩🇿 Algeria | 🇨🇴 Colombia | 🇭🇷 Croatia |
| 🇳🇴 Norway | 🇦🇹 Austria | 🇺🇿 Uzbekistan | 🇬🇭 Ghana |
| IQ Iraq | 🇯🇴 Jordan | CD Congo DR | 🇵🇦 Panama |

---

## 🏟️ Host Stadiums

### 🇺🇸 United States (11 Venues)
| Stadium | City | Capacity |
|---------|------|----------|
| MetLife Stadium | New York/New Jersey | 82,500 |
| AT&T Stadium | Dallas | 94,000 |
| SoFi Stadium | Los Angeles | 70,000 |
| Hard Rock Stadium | Miami | 65,000 |
| Mercedes-Benz Stadium | Atlanta | 75,000 |
| NRG Stadium | Houston | 72,000 |
| Lincoln Financial Field | Philadelphia | 69,000 |
| Levi's Stadium | San Francisco | 71,000 |
| Lumen Field | Seattle | 69,000 |
| Gillette Stadium | Boston | 65,000 |
| Arrowhead Stadium | Kansas City | 73,000 |

### 🇲🇽 Mexico (3 Venues)
| Stadium | City | Capacity |
|---------|------|----------|
| Estadio Azteca | Mexico City | 83,000 |
| Estadio Akron | Guadalajara | 48,000 |
| Estadio BBVA | Monterrey | 53,500 |

### 🇨🇦 Canada (2 Venues)
| Stadium | City | Capacity |
|---------|------|----------|
| BC Place | Vancouver | 54,000 |
| BMO Field | Toronto | 45,000 |

---

## 📊 Response Codes

| Code | Description |
|------|-------------|
| `200` | ✅ Success |
| `400` | ❌ Bad Request — Invalid parameters |
| `401` | 🔒 Unauthorized — Invalid or missing JWT token |
| `404` | 🔍 Resource not found |
| `429` | ⏱️ Too many requests — Rate limit exceeded |
| `500` | 💥 Internal Server Error |

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

### 💡 Use Cases & Project Ideas

Built something with this API? Open a PR to add it here!

- 📱 **Mobile App** — Build a World Cup tracker app (React Native, Flutter)
- 📊 **Dashboard** — Live score dashboard with charts and predictions
- 🤖 **Discord/Telegram Bot** — Match notifications and score updates
- 📈 **Data Visualization** — D3.js charts of goals, standings, team stats
- 🎮 **Prediction Game** — Let users predict match outcomes
- 🔔 **Push Notifications** — Alert service for favorite team matches
- 📰 **Widget** — Embeddable World Cup widget for websites

**Built with this API:**

- 🤖 **[BigFish — Predictive Betting AI](https://jesunahmadushno.github.io/BigFish/)** — Predictive betting dashboard that uses this API’s live match data with a Dixon–Coles model to estimate expected goals (xG) and derive betting odds.

- 📱 **[MUNDIAL '26](https://github.com/andamagodwin/worldcup26)** — Open-source FIFA World Cup 2026 companion app (Expo / React Native): live scores, group standings, knockout bracket, all 48 teams & 16 stadiums, with an English / Farsi toggle.

  <a href="https://github.com/andamagodwin/worldcup26"><img src="https://raw.githubusercontent.com/andamagodwin/worldcup26/main/assets/screenshots/matches-screen.png" alt="MUNDIAL '26 — matches screen" width="240" /></a>

---

## 📄 License

This project is licensed under the ISC License — see the [LICENSE](LICENSE) file for details.

---

## 🔗 Related Links

- 🌐 [Live Website](https://worldcup26.ir)
- 📖 [API Swagger Docs](https://worldcup26.ir/api-docs/)
- 💻 [GitHub Repository](https://github.com/rezarahiminia/worldcup2026)
- 🌐 [FIFA Official Website](https://www.fifa.com/fifaplus/en/tournaments/mens/worldcup/canadamexicousa2026)
- 🏆 [World Cup 2026 Official](https://www.fifa.com/worldcup/)

---

## 💝 Support This Project

This API is completely **free and open-source**. If you find it useful, consider supporting its development:


### 💰 Donate with USDT

| Network | Address | Min Amount |
|---------|---------|------------|
| **TRC20** (TRON) | `TH1cqV6bmZcmtV3SWDtH1N1roCEcAGpB7V` | 1 USDT |
| **BEP20** (BNB Smart Chain) | `0xD492E850a67346b96C1F6107CC06E3132aAEec9A` | 1 USDT |
| **ERC20** (Ethereum) | `0xD492E850a67346b96C1F6107CC06E3132aAEec9A` | 1 USDT |

> ⚠️ **Important:** Only send **USDT** on the correct network. Sending other assets will result in permanent loss.

### Or via NOWPayments:

<a href="https://nowpayments.io/donation?api_key=ebc9f078-46a5-413b-a28e-8b4737ec4d18" target="_blank" rel="noreferrer noopener">
   <img src="https://nowpayments.io/images/embeds/donation-button-black.svg" alt="Crypto donation button by NOWPayments">
</a>

---

<a href="https://buymeacoffee.com/rahiminia" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" height="50"></a>

## �📧 Contact & Support

For questions, issues, or suggestions, please open an issue on GitHub.

⭐ **Star this repo** if you find it useful!

---

<p align="center">
  <b>Keywords:</b> FIFA World Cup 2026 API, free World Cup API, free football API, free soccer API, World Cup REST API, World Cup live scores API, live soccer scores API, free sports data API, open source football API, FIFA 2026 API, World Cup 2026 data, World Cup 2026 schedule API, World Cup 2026 fixtures, World Cup 2026 results, World Cup 2026 groups, World Cup 2026 standings, World Cup 2026 teams, World Cup 2026 stadiums, 48 team World Cup, Node.js football API, Express.js sports API, MongoDB sports database, Swagger OpenAPI sports, real-time match scores, World Cup bracket, soccer data API free, football data API, World Cup JSON data, USA Mexico Canada World Cup, World Cup developer API, sports API 2026, World Cup 2026 live results, free live score API, World Cup prediction API, football fixtures API, soccer standings API
</p>
