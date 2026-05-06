# School Grade Analyzer

A full-stack web app for Algerian school administrators to log in, choose a subscription plan, upload Excel grade files, and instantly see analyzed results with stats, rankings, and pass/fail breakdowns — supporting CEM and Lycée school modes.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server
- `pnpm --filter @workspace/school-analyzer run dev` — run the frontend
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- Requires PostgreSQL (`DATABASE_URL`) and `SESSION_SECRET` env vars

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5 + multer (file uploads) + xlsx (Excel parsing) + openid-client (Replit Auth) + drizzle-orm + pg
- Frontend: React + Vite + Tailwind CSS + shadcn/ui + framer-motion + wouter
- Auth: `lib/replit-auth-web` — `useAuth()` hook (login/logout/user/isAuthenticated)
- Validation: Zod (`zod/v4`), Orval codegen
- Build: esbuild (CJS bundle for API), Vite (frontend)

## Where things live

- `artifacts/api-server/src/routes/grades.ts` — Excel upload & analysis route (auth + school mode)
- `artifacts/api-server/src/routes/subscriptions.ts` — plan list, get my sub, activate
- `artifacts/api-server/src/auth.ts` — Replit OIDC setup + authMiddleware
- `artifacts/school-analyzer/src/App.tsx` — auth gate + routing + header
- `artifacts/school-analyzer/src/pages/home.tsx` — main analyzer page with school mode toggle
- `artifacts/school-analyzer/src/pages/pricing.tsx` — subscription plan selection
- `artifacts/school-analyzer/src/contexts/subscription-context.tsx` — SubscriptionProvider + useSubscription
- `artifacts/school-analyzer/src/i18n.ts` — All translations (EN/AR/FR)
- `artifacts/school-analyzer/src/contexts/` — Theme, language, subscription providers
- `lib/api-spec/openapi.yaml` — API contract (source of truth)
- `lib/db/src/schema/subscriptions.ts` — subscriptions table definition

## Architecture decisions

- File upload handled via multer with in-memory storage (no disk writes)
- Multipart file upload uses raw `fetch` on the frontend (Orval hooks don't handle FormData)
- Excel parsing detects columns dynamically — CEM: arabic/french/math/science/islamic/history; Lycée: arabic/french/math/science/physics/english
- Pass threshold is 10/20; averages calculated per-student then aggregated for class summary
- All UI text routed through a single `i18n.ts` translation map — switching language is instant
- `SubscriptionProvider` is mounted INSIDE `AuthGate` so it only fetches after successful login (avoids 401 spam)
- Orval conflict fix: codegen script patches api-zod barrel after orval to avoid duplicate export

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

## User preferences

- Trilingual UI: Arabic, English, French with RTL support for Arabic
- Dark and light mode both required
- Smooth animations throughout
- Clean, professional educational aesthetic

## Gotchas

- Excel column detection is case-insensitive and supports Arabic/French column name variants
- Scores are clamped to 0–20 range
- Run codegen after any change to `lib/api-spec/openapi.yaml`
- `SubscriptionProvider` must remain inside `AuthGate` — moving it outside causes 401 errors and React context issues

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
