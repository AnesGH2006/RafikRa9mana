# School Manager — رفيق الرقمنة

Algerian school management SaaS for middle schools. Full-stack Arabic-language web app.

## Stack

- **Frontend**: React 19 + Vite 7 + Tailwind CSS 4 + Wouter (routing) + Radix UI + Framer Motion
- **Backend**: Express 5 + TypeScript + Socket.IO
- **Database**: PostgreSQL via Drizzle ORM
- **Auth**: Replit OpenID Connect (PKCE)
- **Desktop agent**: Electron (Windows-only, in `agent/`)

## Running the app

```bash
pnpm run dev
```

Starts both the Express server (port 8080) and the Vite dev server (port 5000) concurrently via the **Start application** workflow.

## Database

Schema is managed with Drizzle ORM. Push schema changes to the database:

```bash
pnpm run db:push
```

Browse the database visually:

```bash
pnpm run db:studio
```

The `DATABASE_URL` is managed automatically by Replit — no manual setup needed.

## Environment variables / secrets

| Key | Required | Notes |
|-----|----------|-------|
| `DATABASE_URL` | ✅ Runtime-managed | Set automatically by Replit |
| `SESSION_SECRET` | ✅ | Long random string for session cookies |
| `GROQ_API_KEY` | — | لا حاجة له؛ يضيف كل مشترك مفتاحه الشخصي من الإعدادات |
| `SMTP_HOST/USER/PASS/PORT` | Optional | Email notifications |
| `TWILIO_ACCOUNT_SID` | Optional | SMS/WhatsApp via Twilio |
| `SMS_API_KEY` | Optional | Alternate SMS gateway |

## Project structure

```
server/          Express API + Socket.IO server
client/          React frontend (Vite)
shared/          Shared types, Drizzle schema, DB client
agent/           Windows Electron desktop agent (separate deployment)
artifacts/       Sub-projects (video, mockup sandbox, analyzer)
```

## Desktop agent

The Electron agent in `agent/` is Windows-only and connects to the deployed SaaS URL via WebSocket. See `agent/README.md` for build and installation instructions. It cannot run on Replit directly.

## User preferences

- Keep the Arabic RTL layout and direction throughout the UI.

## النشر على Render

1. أنشئ خدمة **Web Service** جديدة واربطها بمستودع المشروع.
2. اختر **Node**، ثم ضع الأوامر التالية:
	- **Build Command:** `npm run build`
	- **Start Command:** `npm start`
3. من **Environment Variables** أضف المتغيرات التالية:
	- `DATABASE_URL`: رابط قاعدة بيانات PostgreSQL.
	- `SESSION_SECRET`: نص عشوائي طويل لحماية جلسات الدخول.
4. اضغط **Create Web Service**. سيستمع الخادم تلقائيًا إلى المنفذ الذي يرسله Render عبر `PORT`.

### متغيرات المصادقة في Render

لأن Render لا يحقن إعدادات Replit تلقائيًا، أضف متغيرات المصادقة التالية في إعدادات الخدمة:

- `OIDC_ISSUER_URL`: عنوان موفر OpenID Connect (لـ Replit: `https://replit.com/oidc`).
- `OIDC_CLIENT_ID`: معرّف عميل OpenID Connect.
- `OIDC_CLIENT_SECRET`: السر إذا كان موفر الهوية يتطلبه.
- `APP_BASE_URL`: عنوان الخدمة العام، مثل `https://rafikra9mana.onrender.com`.

يمكن استخدام `REPL_ID` بدل `OIDC_CLIENT_ID` عند ربط الخدمة بتطبيق Replit. يجب أن يطابق عنوان callback المسجل لدى موفر الهوية:
`https://YOUR-RENDER-DOMAIN.onrender.com/api/callback`

### الحصول على مفتاح Groq

1. افتح [console.groq.com](https://console.groq.com) وسجّل الدخول أو أنشئ حسابًا.
2. افتح صفحة **API Keys** واضغط **Create API Key**.
3. انسخ المفتاح مرة واحدة، ثم سجّل الدخول إلى التطبيق وافتح **الإعدادات**.
4. ألصق المفتاح في قسم **مفتاح المساعد الذكي Groq** واحفظه. يُحفظ مشفراً لكل مشترك.
5. لا تضع المفتاح في Git أو داخل ملفات الواجهة.

إذا لم يضف المشترك مفتاحه، سيطلب منه المساعد إضافته من الإعدادات. أما `DATABASE_URL` و`SESSION_SECRET` فهما مطلوبان في Render لتشغيل التطبيق.

### تسجيل الدخول على Render

استخدم زر **تسجيل الدخول** في التطبيق أو افتح `/api/login`. لا تستخدم `/api/dev-login`؛ هذا رابط اختبار محلي ومغلق في النشر.
في Render يجب إعداد قيم المصادقة الخاصة بموفر OpenID Connect (`OIDC_CLIENT_ID` و`OIDC_ISSUER_URL` والسر إن لزم) وضبط `APP_BASE_URL`، ثم إضافة رابط callback التالي إلى إعدادات موفر تسجيل الدخول:
`https://YOUR-RENDER-DOMAIN.onrender.com/api/callback`
