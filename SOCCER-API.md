# API عمومی لیگ‌ها و باشگاه‌های فوتبال

این API دادهٔ ذخیره‌شده در MongoDB را به مشتری ارائه می‌دهد. هیچ‌کدام از endpointهای زیر سرویس خارجی را مستقیم فراخوانی نمی‌کنند.

برای هدف محصول، مرز مسئولیت API و listener، وضعیت قابلیت‌ها و قواعدی که توسعه‌دهنده یا AI باید رعایت کند، سند مرجع [BUSINESS-CONTEXT.md](BUSINESS-CONTEXT.md) را بخوانید.

Base path:

```text
/get/soccer
```

## معرفی و پوشش سرویس

```http
GET /get/soccer/meta
```

این مسیر نسخه سرویس، قابلیت‌ها، تعداد اسناد اصلی، تعداد رقابت‌های دارای مسابقه و زمان آخرین sync موفق را برمی‌گرداند. اعداد از MongoDB خوانده می‌شوند و مقدار ثابت داخل کد نیستند.

## انتخاب لیگ

```http
GET /get/soccer/leagues?kind=club&available=true
```

فقط لیگ‌های دارای `active: true` برگردانده می‌شوند. مقدار پیش‌فرض `kind=club` است. مقادیر مجاز `club`، `international` و `all` هستند. با `available=true` فقط رقابت‌هایی نمایش داده می‌شوند که حداقل مسابقه، باشگاه یا standings ذخیره‌شده دارند.

هر لیگ یک فیلد `coverage` دارد:

```json
{
  "matches": 15,
  "clubs": 29,
  "dedicatedClubs": 0,
  "standingsGroups": 0,
  "hasData": true
}
```

`clubs` می‌تواند از شرکت‌کنندگان snapshot مسابقات محاسبه شود، اما `dedicatedClubs` فقط تعداد اسناد کامل collection باشگاه‌هاست. مشتری مقدار `slug` مانند `eng.1` یا `esp.1` را برای درخواست‌های بعدی استفاده می‌کند.

## Scoreboard

```http
GET /get/soccer/{league}/scoreboard?dates=YYYYMMDD
```

مثال:

```http
GET /get/soccer/eng.1/scoreboard?dates=20260822
```

پاسخ ساختاری پایدار و مستقل از تأمین‌کننده دارد و شامل `leagues[]` و `events[]` می‌شود. هر event نتیجه، وضعیت، دقیقه، میزبان/مهمان، آمار، ورزشگاه، پخش و داده‌های اختیاری مسابقه را دارد.

اگر `dates` ارسال نشود، تاریخ جاری UTC استفاده می‌شود. فرمت دیگری غیر از هشت رقم پذیرفته نمی‌شود.

## برنامه و نتایج لیگ

```http
GET /get/soccer/{league}/fixtures
```

این endpoint برای نمایش UI برنامه مسابقات است و برخلاف scoreboard به یک تاریخ محدود نیست. پارامترها:

| پارامتر | مقدار |
|---|---|
| `from` | تاریخ شروع اختیاری با فرمت `YYYYMMDD` |
| `to` | تاریخ پایان اختیاری با فرمت `YYYYMMDD` |
| `status` | `all`، `scheduled`، `live` یا `finished` |
| `page` | شماره صفحه، پیش‌فرض ۱ |
| `limit` | تعداد رکورد، پیش‌فرض ۱۰۰ و حداکثر ۲۰۰ |

مثال:

```http
GET /get/soccer/esp.1/fixtures?status=all&limit=100
```

هر عضو `events[]` همان ساختار پایدار scoreboard را دارد و برای باز کردن جزئیات باید `event.id` به summary یا plays داده شود.

## Summary مسابقه

```http
GET /get/soccer/{league}/summary?event={eventId}
```

مسیر معادل:

```http
GET /get/soccer/{league}/events/{eventId}
```

پاسخ شامل `header`، `boxscore`، `keyEvents`، `rosters`، `gameInfo`، `commentary`، `broadcasts`، `odds`، `leaders`، `news` و `videos` است. بخش‌هایی که listener ذخیره نکرده باشد آرایهٔ خالی یا `null` برمی‌گردند.

گل‌زنان هر مسابقه از رویدادهای دارای `scoringPlay: true` در `keyEvents` قابل استخراج‌اند. در صورت وجود، `athletesInvolved[]` نام بازیکن، شناسه، شماره پیراهن و تیم را ارائه می‌کند. وضعیت قابلیت‌های ذخیره‌شده نیز در `meta.dataAvailability` اعلام می‌شود:

| داده | وضعیت | منبع دیتابیس |
|---|---|---|
| timeline مسابقه | موجود | `soccer_match_events` |
| گل‌های مسابقه | موجود | timeline و `soccer_matches.key_events` |
| آمار و summary | موجود | `soccer_matches` |
| جدول گل‌زنان برتر لیگ | فعلاً ناموجود | فقط پاسخ خام ممکن است در `soccer_snapshots` باشد و به مشتری ارائه نمی‌شود |

فیلد زیر زمان آخرین sync را مشخص می‌کند:

```text
meta.lastSyncedAt
```

## Play-by-play

```http
GET /get/soccer/{league}/events/{eventId}/plays?page=1&limit=100
```

`limit` حداکثر ۳۰۰ است. پاسخ:

```json
{
  "count": 114,
  "pageIndex": 1,
  "pageSize": 100,
  "pageCount": 2,
  "items": []
}
```

هر item می‌تواند نوع اتفاق، متن، زمان، نتیجه، نیمه و فلگ‌های گل، کارت، پنالتی، گل‌به‌خودی و تعویض را داشته باشد.

برای گل‌ها فیلد `scoringPlay` برابر `true` است. فیلدهای `team` و `athletesInvolved` در صورتی برگردانده می‌شوند که listener آن‌ها را ذخیره کرده باشد. API هر دو شکل ذخیره‌سازی timeline را پشتیبانی می‌کند: شناسه مسابقه در `event_id` (ساختار normalized) یا در `match_id` (ساختار listener جدید). اگر هر دو شکل وجود داشته باشند، نسخه normalized انتخاب می‌شود تا رویداد تکراری به مشتری برنگردد.

در رویدادهای `type.type: "substitution"`، آرایهٔ `participants` بازیکنان درگیر در تعویض را برمی‌گرداند. برای تشخیص قطعی بازیکن واردشده و خارج‌شده، داده با `rosters[].roster[].subbedIn`، `subbedOut`، `subbedInFor` و `subbedOutFor` تطبیق داده می‌شود. رابط کاربری نام هر دو بازیکن، تیم و دقیقه تعویض را نمایش می‌دهد.

برای دریافت timeline فشرده شامل گل، کارت و تعویض بدون واکشی صدها پاس و حرکت عادی:

```http
GET /get/soccer/{league}/events/{eventId}/plays?important=true&limit=300
```

رابط کاربری همین پاسخ را با `keyEvents` ادغام می‌کند؛ بنابراین تعویض‌هایی که فقط در `soccer_match_events` باشند نیز نمایش داده می‌شوند.

endpoint مستقلی برای جدول گل‌زنان لیگ منتشر نشده است، چون این داده هنوز collection ساختاریافته و قابل اتکایی ندارد. `soccer_snapshots` یک مخزن داخلی/raw است و بخشی از API مشتری نیست.

## باشگاه‌های لیگ

```http
GET /get/soccer/{league}/clubs
GET /get/soccer/{league}/clubs/{clubId}
```

در فهرست باشگاه‌ها roster حذف می‌شود تا پاسخ سبک بماند. endpoint تک‌باشگاه، `roster` و `coach` ذخیره‌شده را نیز برمی‌گرداند.

اگر listener هنوز `soccer_clubs` را برای لیگ انتخابی پر نکرده باشد، سرویس اطلاعات پایه باشگاه را از `home` و `away` مسابقات همان لیگ استخراج می‌کند. پاسخ list در این حالت `meta.matchSnapshotFallback: true` دارد. در endpoint تک‌باشگاه نیز `meta.catalogSource` برابر `match-snapshot` خواهد بود و roster خالی است.

## جدول

```http
GET /get/soccer/{league}/standings
GET /get/soccer/{league}/standings?season=2026
```

برای رقابت‌های گروهی، هر عضو `children[]` یک گروه است. برای لیگ عادی یک گروه با شناسهٔ `overall` برگردانده می‌شود.

## Status codeها

| کد | معنی |
|---|---|
| `200` | پاسخ موفق؛ ممکن است events خالی باشد |
| `400` | slug، event، date یا pagination نامعتبر |
| `404` | لیگ، باشگاه یا مسابقه در دیتابیس ثبت نشده |
| `429` | عبور از rate limit عمومی پروژه |
| `500` | خطای خواندن دیتابیس |

## مستندات ماشین‌خوان

| مسیر | کاربرد |
|---|---|
| `/api-docs/` | Swagger UI بدون cache بلندمدت |
| `/openapi.json` | قرارداد OpenAPI 3 خام |
| `/service-info.json` | معرفی کوتاه سرویس و مسیرهای اصلی |

## جریان رابط کاربری

صفحه اصلی فقط همین endpointهای مستندشده را استفاده می‌کند:

1. `leagues?kind=club&available=true` برای ساخت انتخاب کشور و لیگ؛
2. `fixtures` برای برنامه، بازی‌های زنده و نتایج؛
3. `standings` برای جدول؛
4. `events/{eventId}` برای جزئیات بازی انتخاب‌شده؛
5. `events/{eventId}/plays` برای timeline بازی؛
6. `meta` برای نمایش وضعیت و آمار پوشش سرویس.

## تازگی داده

هنگام بازی پاسخ‌ها cache داخلی طولانی ندارند و هدر `Cache-Control` حداکثر چهار ثانیه است. تازگی واقعی همچنان به فاصلهٔ polling و موفقیت پروژهٔ listener وابسته است.
