# گزارش بررسی دیتابیس Soccer

زمان بررسی: ۲۲ ژوئیهٔ ۲۰۲۶، منطقه زمانی Asia/Tehran

این بررسی فقط‌خواندنی بود و هیچ سند، collection یا index دیتابیس تغییر نکرد.

## دیتابیس فعال

API از دیتابیس `soccer` و collectionهای نرمال‌شدهٔ `soccer_*` استفاده می‌کند.

## آمار مشاهده‌شده

| مورد | تعداد |
|---|---:|
| کل رقابت‌ها در `soccer_leagues` | 169 |
| رقابت باشگاهی فعال | 125 |
| رقابت ملی/بین‌المللی فعال | 44 |
| رقابت دارای حداقل یک مسابقه | 167 |
| اسناد کامل باشگاه در `soccer_clubs` | 48 |
| مسابقات در `soccer_matches` | 753 |
| رویدادهای play-by-play | 20,048 |
| اسناد standings | 24 |
| وضعیت‌های sync | 674 |
| sync سالم | 668 |
| sync خطادار | 6 |

آخرین sync موفق مشاهده‌شده:

```text
2026-07-21T21:09:08.764Z
league: concacaf.w.champions_cup
resource: scoreboard
```

## یافته‌های مهم

1. ساختار normalized برای `soccer_matches`، `soccer_match_events` و لیگ‌ها فعال است.
2. پوشش مسابقه خوب است، اما catalog مستقل باشگاه‌ها هنوز ناقص است؛ ۴۸ سند موجود فقط یک رقابت را پوشش می‌دهند.
3. سرویس clubs برای جلوگیری از پاسخ خالی، اطلاعات پایه باشگاه را از `home` و `away` مسابقات استخراج می‌کند. این fallback جای roster و coach کامل را نمی‌گیرد.
4. standings فعلاً پوشش محدودی دارد و برای لیگ‌های فاقد داده، `children` خالی برمی‌گردد.
5. collectionهای `soccer_events` و `soccer_snapshots` متعلق به فرایند listener هستند و API عمومی مستقیماً از آن‌ها نمی‌خواند.
6. indexهای normalized و تعدادی index سازگاری با writer قبلی هم‌زمان وجود دارند. حذف indexهای قدیمی تا پایان مهاجرت listener توصیه نمی‌شود.

## اقدام لازم در listener

- برای هر لیگ، club catalog را از منبع دریافت و با کلید `source.provider + source.club_id` upsert کند.
- `league_slugs` باشگاه را با `$addToSet` نگهداری کند.
- standings همه لیگ‌های قابل ارائه را به ساختار group-based جدید تبدیل کند.
- شش sync state خطادار را بررسی کند، بدون حذف آخرین snapshot معتبر.
- پس از تکمیل migration و تأیید writer جدید، فیلدها و indexهای legacy را در یک migration جداگانه پاک‌سازی کند.
