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
| `GROQ_API_KEY` | Optional | AI assistant features |
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
