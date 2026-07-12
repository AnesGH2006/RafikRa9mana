# School Grade Analyzer

A full-stack web app for Algerian school administrators to log in, choose a subscription plan, upload Excel grade files, and instantly see analyzed results with stats, rankings, and pass/fail breakdowns — supporting CEM and Lycée school modes.

## Run & Operate

- `pnpm -w run dev:client` — run the Vite frontend (port 5000)
- `pnpm run dev` — run both frontend and backend together (recommended)
- `pnpm -w run dev:server` — run the Express API server (port 8080)
- `pnpm run typecheck` — typecheck all code
- `pnpm run db:push` — push schema changes to the database
- Requires PostgreSQL (`DATABASE_URL`) and `SESSION_SECRET` env vars

## Stack

- Flat single-package project, Node.js 24, TypeScript 5.9
- API: Express 5 + multer (file uploads) + xlsx (Excel parsing) + openid-client (Replit Auth) + drizzle-orm + pg
- Frontend: React + Vite + Tailwind CSS 4 + shadcn/ui + framer-motion + wouter
- Auth: `client/src/hooks/use-auth.ts` — `useAuth()` hook (login/logout/user/isAuthenticated)
- Validation: Zod schemas in `shared/schemas.ts` (no codegen needed)
- Dev: `tsx watch` for server, `vite` for client

## Where things live

- `client/src/` — all React frontend source
- `client/src/App.tsx` — auth gate + routing + header
- `client/src/pages/home.tsx` — main analyzer page with school mode toggle
- `client/src/pages/pricing.tsx` — subscription plan selection
- `client/src/contexts/subscription-context.tsx` — SubscriptionProvider + useSubscription
- `client/src/i18n.ts` — all translations (EN/AR/FR)
- `client/src/hooks/use-auth.ts` — Replit Auth hook
- `server/routes/grades.ts` — Excel upload & analysis route (auth + school mode)
- `server/routes/subscriptions.ts` — plan list, get my sub, activate
- `server/routes/auth.ts` — Replit OIDC login/callback/logout
- `server/lib/auth.ts` — session management helpers
- `server/middlewares/authMiddleware.ts` — req.user + token refresh
- `shared/schemas.ts` — Zod validation schemas (shared server + client types)
- `shared/types.ts` — TypeScript interfaces
- `shared/schema.ts` — Drizzle ORM table definitions
- `shared/db.ts` — PostgreSQL connection
- `vite.config.ts` — Vite config at root (root: "client/")
- `drizzle.config.ts` — Drizzle config at root

## Architecture decisions

- Flat structure: `client/`, `server/`, `shared/` at workspace root — no pnpm sub-packages
- File upload handled via multer with in-memory storage (no disk writes)
- Multipart file upload uses raw `fetch` on the frontend
- Excel parsing detects columns dynamically — CEM: arabic/french/math/science/islamic/history; Lycée: arabic/french/math/science/physics/english
- Pass threshold is 10/20; averages calculated per-student then aggregated for class summary
- All UI text routed through `i18n.ts` translation map — switching language is instant
- `SubscriptionProvider` is mounted INSIDE `AuthGate` so it only fetches after successful login (avoids 401 spam)
- Server uses relative imports to `shared/` (e.g. `../../shared/db.js`); client uses `@shared/` Vite alias

## Product

- Replit Auth login gate — full OIDC flow, no custom credentials
- 4-tier subscription plans: Gratuit (free/CEM), Standard (2000DA/CEM), Pro (3000DA/CEM+Lycée), Max (5000DA)
- Pricing page at /pricing with plan cards, school mode selector, and Activate flow
- School mode toggle (CEM / Lycée) on the analyzer — Lycée locked behind Pro/Max
- Upload .xlsx or .xls grade files via drag-and-drop or file picker
- Results table with dynamic subject columns (per school mode)
- Shows class summary: class average, top student, weakest student, pass rate
- Full trilingual support: English, Arabic (RTL), French
- Dark/light mode toggle with localStorage persistence
- Smooth framer-motion animations for page and language transitions

## User preferences

- Flat architecture: client/, server/, shared/ at root
- Trilingual UI: Arabic, English, French with RTL support for Arabic
- Dark and light mode both required
- Smooth animations throughout
- Clean, professional educational aesthetic

## Gotchas

- Vite root is `client/` — `@/` alias resolves to `client/src/`, `@shared/` to `shared/`
- Server files must use relative imports to `shared/` (tsx doesn't resolve path aliases at runtime)
- `SubscriptionProvider` must remain inside `AuthGate` — moving it outside causes 401 errors
- Excel column detection is case-insensitive and supports Arabic/French column name variants
- Scores are clamped to 0–20 range
- Workflows run from artifact dirs — dev commands use `pnpm -w run <script>` to execute from workspace root
