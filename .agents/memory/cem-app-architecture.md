---
name: CEM App Architecture
description: Key decisions for the Algerian CEM school management app structure and data model
---

## Flat structure
- `client/`, `server/`, `shared/` at repo root (not pnpm sub-packages)
- `@shared/` Vite alias → `shared/` for client; server uses relative imports `../../shared/...`
- All shared types in `shared/types.ts`, Zod schemas in `shared/schemas.ts`, DB tables in `shared/schema.ts`, subjects in `shared/subjects.ts`

## DB tables
- `sessions`, `users`, `school_info` (with directeur+phone), `students`, `grades`, `absences`
- Migration: `pnpm tsx scripts/migrate.ts` (idempotent, uses IF NOT EXISTS)

**Why:** Flat structure avoids TS project reference complexity; all schemas colocated for easier maintenance.

## Grades model
- One row per (student_id, trimestre 1-3, subject, score 0-20)
- Subjects defined in `shared/subjects.ts` as `CEM_SUBJECTS[]` with key, arLabel, coef, optional levels
- `calcWeightedAvg(scores, subjects)` does coefficient-weighted average
- Trimester averages → annual average = mean of T1/T2/T3

## Sidebar 6 sections
1. التلاميذ (/, /students)
2. النتائج (/results, /subjects, /failed)
3. أعمال نهاية السنة (/yearend, /yearend/passed, /yearend/failed)
4. التوجيه المسبق (/orientation — coming soon stub)
5. البيانات (/import)
6. المزيد (/settings, /account)

Sections auto-expand when a child route is active; collapse/expand with AnimatePresence.

## How to apply
- New pages → add route in App.tsx Switch + NavItemDef in SECTIONS array
- New subjects → add to `shared/subjects.ts` CEM_SUBJECTS array
- New DB columns → add to `shared/schema.ts` + add `ALTER TABLE ADD COLUMN IF NOT EXISTS` in `scripts/migrate.ts`
