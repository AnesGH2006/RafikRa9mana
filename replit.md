# School Grade Analyzer

A full-stack web app for school administrators to upload Excel grade files and instantly see analyzed results with stats, rankings, and pass/fail breakdowns.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server
- `pnpm --filter @workspace/school-analyzer run dev` — run the frontend
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- No database required — this app is stateless (file-based analysis only)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5 + multer (file uploads) + xlsx (Excel parsing)
- Frontend: React + Vite + Tailwind CSS + shadcn/ui + framer-motion
- Validation: Zod (`zod/v4`), Orval codegen
- Build: esbuild (CJS bundle for API), Vite (frontend)

## Where things live

- `artifacts/api-server/src/routes/grades.ts` — Excel upload & analysis route
- `artifacts/school-analyzer/src/` — React frontend
- `artifacts/school-analyzer/src/i18n.ts` — All translations (EN/AR/FR)
- `artifacts/school-analyzer/src/contexts/` — Theme and language providers
- `lib/api-spec/openapi.yaml` — API contract (source of truth)

## Architecture decisions

- File upload handled via multer with in-memory storage (no disk writes) — keeps the server stateless
- Multipart file upload uses raw `fetch` on the frontend (not generated hook) since Orval-generated hooks don't handle FormData natively
- Excel parsing assumes columns: name, math, arabic, science — with multi-language column name detection (Arabic/French variants)
- Pass threshold is 10/20; averages calculated per-student then aggregated for class summary
- All UI text routed through a single `i18n.ts` translation map — switching language is instant via React context

## Product

- Upload .xlsx or .xls grade files via drag-and-drop or file picker
- Auto-detects student columns (name, math, arabic, science) in multiple languages
- Displays per-student results: rank, scores, average, pass/fail status
- Shows class summary: class average, top student, weakest student, pass rate
- Full trilingual support: English, Arabic (RTL), French
- Dark/light mode toggle with localStorage persistence
- Smooth animations via framer-motion

## User preferences

- Trilingual UI: Arabic, English, French with RTL support for Arabic
- Dark and light mode both required
- Smooth animations throughout
- Clean, professional educational aesthetic

## Gotchas

- Excel column detection is case-insensitive and supports Arabic/French column name variants
- Scores are clamped to 0–20 range
- Run codegen after any change to `lib/api-spec/openapi.yaml`

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
