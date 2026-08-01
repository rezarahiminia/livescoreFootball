# قرارداد دیتابیس پروژهٔ listener فوتبال

این پروژه ارائه‌دهندهٔ API به مشتری است و فقط از MongoDB می‌خواند. پروژهٔ listener مسئول دریافت اطلاعات از منبع بالادستی، نرمال‌سازی و نوشتن آن در MongoDB است. هیچ درخواست مستقیمی به سرویس خارجی در این مخزن وجود ندارد.

هدف محصول، مالکیت اجزا، وضعیت قابلیت‌ها و قواعد تغییرات بین دو پروژه در [BUSINESS-CONTEXT.md](BUSINESS-CONTEXT.md) تعریف شده است.

## Collectionها

| Collection | داده | کلید upsert |
|---|---|---|
| `soccer_leagues` | لیگ‌های قابل انتخاب مشتری | `slug` |
| `soccer_clubs` | باشگاه‌ها و roster اختیاری | `source.provider + source.club_id` |
| `soccer_matches` | برنامه، نتیجه، وضعیت، آمار و summary | `source.provider + league_slug + source.event_id` |
| `soccer_match_events` | play-by-play مسابقه | `source.provider + league_slug + event_id + source.event_key` |
| `soccer_standings` | جدول لیگ یا گروه‌ها | `league_slug + season_year + group_id` |
| `soccer_sync_states` | cursor، خطا، polling و lease | `provider + league_slug + resource_type + resource_key` |

### وضعیت داده‌های جزئیات مسابقه

- timeline در `soccer_match_events` ذخیره و از endpoint `plays` منتشر می‌شود؛
- گل‌های هر مسابقه هم در timeline و هم در `soccer_matches.key_events` قابل نگهداری‌اند؛
- آمار و summary مسابقه در `soccer_matches` قرار می‌گیرد؛
- جدول گل‌زنان برتر لیگ هنوز مدل ساختاریافته ندارد. پاسخ خام احتمالی در `soccer_snapshots` داخلی است و نباید مستقیماً به API مشتری متصل شود. پیش از انتشار endpoint گل‌زنان، listener باید collection اختصاصی با کلید یکتای لیگ، فصل و بازیکن ایجاد و validate کند.

> وضعیت فعلی مهاجرت: collectionهای match و event برای تعداد زیادی لیگ پر شده‌اند، اما catalog کامل `soccer_clubs` هنوز برای همه لیگ‌ها موجود نیست. API موقتاً می‌تواند باشگاه‌های پایه را از home/away مسابقات استخراج کند، ولی listener باید در نهایت اسناد مستقل باشگاه را برای هر لیگ upsert کند تا roster، مربی، ورزشگاه و هویت پایدار ارائه شوند.

## ایجاد collectionها و indexها

بعد از تنظیم `MONGODB_URL` اجرا شود:

```bash
npm run db:init-live
```

این دستور idempotent و غیرمخرب است: داده‌ای دریافت یا حذف نمی‌کند و فقط شش collection و indexهای لازم را می‌سازد.

## ۱. ثبت لیگ

تا وقتی لیگ در `soccer_leagues` با `active: true` ثبت نشده باشد، API آن را به مشتری نمایش نمی‌دهد.

```javascript
await db.collection('soccer_leagues').updateOne(
  { slug: 'eng.1' },
  {
    $set: {
      name: 'English Premier League',
      abbreviation: 'Premier League',
      country: 'England',
      kind: 'club',
      logo: 'https://example.com/premier-league.png',
      active: true,
      sort_order: 10,
      source: { provider: 'upstream', source_id: '700' },
      season: {
        year: 2026,
        display_name: '2026-27 English Premier League',
        current: true,
        type_id: '1',
        type_name: 'Regular Season'
      },
      last_synced_at: new Date(),
      updated_at: new Date()
    },
    $setOnInsert: { created_at: new Date() }
  },
  { upsert: true }
);
```

نمونه slugهای قابل ثبت:

```text
eng.1, esp.1, ger.1, ita.1, fra.1,
uefa.champions, uefa.europa, conmebol.libertadores
```

## ۲. ثبت باشگاه

یک باشگاه می‌تواند عضو چند رقابت باشد؛ همهٔ slugها در `league_slugs` قرار می‌گیرند. شناسهٔ منبع در `team.id` توسط listener در `source.club_id` ذخیره می‌شود.

```json
{
  "source": {
    "provider": "upstream",
    "club_id": "CLUB_ID",
    "uid": "SOURCE_CLUB_UID"
  },
  "league_slugs": ["eng.1", "uefa.champions"],
  "slug": "example-fc",
  "name": "Example FC",
  "display_name": "Example FC",
  "short_display_name": "Example",
  "abbreviation": "EXA",
  "country": "England",
  "city": "London",
  "logo": "https://example.com/example-fc.png",
  "logos": [],
  "color": "c60b1e",
  "alternate_color": "FFFFFF",
  "active": true,
  "roster": [],
  "coach": null,
  "last_synced_at": "2026-08-22T14:00:00.000Z"
}
```

برای حفظ عضویت‌های قبلی بهتر است listener از `$addToSet` برای `league_slugs` استفاده کند.

## ۳. ثبت snapshot مسابقه

هر مسابقه یک سند در `soccer_matches` دارد. همان سند هم scoreboard و هم summary مشتری را تغذیه می‌کند.

```json
{
  "source": {
    "provider": "upstream",
    "event_id": "EVENT_ID",
    "competition_id": "COMPETITION_ID",
    "uid": "SOURCE_EVENT_UID",
    "modified_at": "2026-08-22T14:08:00.000Z"
  },
  "league_slug": "eng.1",
  "scoreboard_date": "20260822",
  "date": "2026-08-22T14:00:00.000Z",
  "name": "Example United at Example FC",
  "short_name": "EXU @ EXA",
  "season": {
    "year": 2026,
    "type_id": "1",
    "slug": "regular-season",
    "name": "2026-27 English Premier League"
  },
  "status": {
    "state": "in",
    "name": "STATUS_IN_PROGRESS",
    "description": "In Progress",
    "detail": "2'",
    "short_detail": "2'",
    "clock": "2'",
    "clock_seconds": 120,
    "period": 1,
    "completed": false,
    "suspended": false
  },
  "home": {
    "source_id": "HOME_CLUB_ID",
    "uid": "HOME_CLUB_UID",
    "name": "Example FC",
    "display_name": "Example FC",
    "abbreviation": "EXA",
    "logo": "https://example.com/example-fc.png",
    "score": 0,
    "aggregate_score": 0,
    "shootout_score": 0,
    "winner": false,
    "advance": false,
    "form": "WWWWW",
    "stats": {
      "possessionPct": 75.9,
      "totalShots": 0,
      "shotsOnTarget": 0,
      "wonCorners": 0,
      "foulsCommitted": 1
    }
  },
  "away": {
    "source_id": "AWAY_CLUB_ID",
    "uid": "AWAY_CLUB_UID",
    "name": "Example United",
    "display_name": "Example United",
    "abbreviation": "EXU",
    "logo": "https://example.com/example-united.png",
    "score": 0,
    "winner": false,
    "form": "WWWWW",
    "stats": { "possessionPct": 24.1 }
  },
  "venue": {
    "source_id": "VENUE_ID",
    "name": "Example Stadium",
    "city": "London",
    "country": "England"
  },
  "attendance": 0,
  "note": "English Premier League",
  "play_by_play_available": true,
  "broadcasts": [],
  "odds": [],
  "key_events": [],
  "lineups": [],
  "officials": [],
  "commentary": [],
  "leaders": [],
  "news": [],
  "videos": [],
  "format": { "regulation": { "periods": 2 } },
  "last_synced_at": "2026-08-22T14:08:00.000Z"
}
```

قواعد مهم:

- `scoreboard_date` همیشه رشتهٔ `YYYYMMDD` باشد؛
- امتیازها در دیتابیس `Number` یا در حالت نامشخص غایب باشند؛
- نتیجهٔ مجموع دو بازی و ضربات پنالتی در `aggregate_score` و `shootout_score` ذخیره شوند؛
- باشگاه‌ها همیشه با `home` و `away` نرمال شوند؛
- آمار به object عددی تبدیل شود، نه آرایه؛
- زمان‌ها `Date` و UTC باشند؛
- فیلدهای سنگین summary فقط در صورت نیاز نوشته شوند؛
- در خطای منبع آخرین snapshot معتبر با مقدار خالی جایگزین نشود.

نمونهٔ upsert:

```javascript
await db.collection('soccer_matches').updateOne(
  {
    'source.provider': 'upstream',
    league_slug: 'eng.1',
    'source.event_id': 'EVENT_ID'
  },
  {
    $set: normalizedMatch,
    $setOnInsert: { created_at: new Date() },
    $currentDate: { updated_at: true }
  },
  { upsert: true }
);
```

## ۴. ثبت play-by-play

هر اتفاق یک سند مستقل در `soccer_match_events` است:

```json
{
  "source": {
    "provider": "upstream",
    "event_key": "SOURCE_PLAY_ID",
    "modified_at": "2026-08-22T14:06:00.000Z"
  },
  "league_slug": "eng.1",
  "event_id": "EVENT_ID",
  "competition_id": "COMPETITION_ID",
  "sequence": 1,
  "event_type": {
    "id": "80",
    "name": "kickoff",
    "text": "Kickoff"
  },
  "text": "First Half begins.",
  "alternative_text": "First Half begins.",
  "clock": {
    "value": 0,
    "display_value": "",
    "added_value": 0,
    "added_display_value": ""
  },
  "period": 1,
  "wallclock": "2026-08-22T14:05:58.000Z",
  "home_score": 0,
  "away_score": 0,
  "score_value": 0,
  "club": {
    "source_id": "",
    "side": "unknown",
    "name": ""
  },
  "athlete_source_ids": [],
  "flags": {
    "scoring_play": false,
    "yellow_card": false,
    "red_card": false,
    "substitution": false,
    "penalty_kick": false,
    "own_goal": false,
    "shootout": false
  },
  "valid": true
}
```

اتفاقات با `bulkWrite` و `upsert: true` نوشته شوند. `event_key` مانع ساخت رویداد تکراری و امکان اصلاح اتفاق توسط منبع را فراهم می‌کند.

## ۵. ثبت standings

برای لیگ‌های باشگاهی معمولی از یک رکورد با `group_id: "overall"` استفاده شود. برای رقابت‌های گروهی مانند لیگ قهرمانان، هر گروه رکورد جدا دارد.

```json
{
  "league_slug": "eng.1",
  "season_year": 2026,
  "group_id": "overall",
  "group_name": "League Table",
  "entries": [
    {
      "rank": 1,
      "club": {
        "source_id": "CLUB_ID",
        "display_name": "Example FC",
        "abbreviation": "EXA",
        "logo": "https://example.com/example-fc.png"
      },
      "stats": {
        "gamesPlayed": 3,
        "wins": 2,
        "ties": 1,
        "losses": 0,
        "points": 7,
        "goalDifference": 4
      },
      "note": null
    }
  ],
  "last_synced_at": "2026-08-22T18:00:00.000Z"
}
```

## ۶. وضعیت listener

`soccer_sync_states` فقط برای پروژهٔ listener است و به مشتری ارائه نمی‌شود.

```json
{
  "provider": "upstream",
  "league_slug": "eng.1",
  "resource_type": "plays",
  "resource_key": "EVENT_ID",
  "status": "healthy",
  "last_polled_at": "2026-07-19T19:08:00.000Z",
  "last_success_at": "2026-07-19T19:08:00.000Z",
  "next_poll_at": "2026-07-19T19:08:05.000Z",
  "cursor": { "last_event_key": "49878820", "count": 37 },
  "consecutive_errors": 0,
  "lease": {
    "owner": "listener-1",
    "expires_at": "2026-07-19T19:08:15.000Z"
  }
}
```

مقادیر `resource_type`:

```text
scoreboard, summary, plays, clubs, standings
```

## ترتیب امن listener

1. لیگ‌های فعال را از تنظیمات خودش یا `soccer_leagues` بخواند.
2. برای resource موردنظر lease اتمیک بگیرد.
3. داده را از منبع بالادستی دریافت و پاسخ را validate کند.
4. league/club/match/standing را upsert کند.
5. playها را با `bulkWrite` و کلید یکتا upsert کند.
6. `last_success_at` و cursor را ذخیره و lease را آزاد کند.
7. در خطا فقط sync state را تغییر دهد و دادهٔ معتبر قبلی را نگه دارد.

## سطح دسترسی MongoDB پیشنهادی

listener فقط به `find`، `insert` و `update` روی collectionهای `soccer_*` نیاز دارد. مجوزهای `dropCollection`، حذف گسترده و مدیریت کاربران لازم نیست.
