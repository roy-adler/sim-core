# Example Projects from Zips + Zip-Backed New Project Templates

**Date:** 2026-08-09  
**Status:** Approved design  
**Components:** File menu (`HashCoreHeaderMenuFiles`), bootstrap (`bootstrapQuery`), import/new-project templates, `example_projects/*.zip`

## Problem

1. **Example projects** were removed from the File menu (commented out). The Access Gate still tells users to find examples there. Builtin examples live as giant hardcoded JSON in `builtinSimulations.ts`, while the same projects already exist as zips under `example_projects/`.
2. **New project → Empty / Starter** clone from hardcoded JSON blobs in `templates.ts`, duplicated again as `empty-project.zip` and `empty-template-project.zip`. Content matches the zips (aside from behavior sidecar `*.json` files present only in the zips). Maintaining both is brittle and unnecessary.

## Goals

1. Restore **File → Example projects** as a nested submenu (same pattern as **My recent projects**).
2. Opening an example navigates to a **shared built-in copy** (no duplicate import each time).
3. Seed shared examples from `example_projects/*.zip` at bootstrap (reuse import/zip parsing rules).
4. Keep **New project → Empty / Starter** as “create a new named project” (modal), but load template **contents from the corresponding zips**.
5. Delete the hardcoded project blobs once zip loading works.
6. Share one zip→project helper across bootstrap, new-project templates, and Import project.

## Non-goals

- Lazy-loading examples only on click (first-open fetch)
- Build-time codegen of TS modules from zips
- Changing Import project UX (file picker still required)
- Making Empty/Starter open shared copies (they remain create-new flows)
- Cloud/API `specialProjects` GraphQL (local zip seeding replaces the migration shim)

## Approach

**Ship zips as static assets.** Convert each zip to `SimulationProjectWithHcFiles` with a shared helper (same file filtering as Import: skip directories/hidden; allow `src`, `data`, `views`, `dependencies`).

Three call sites:

| Call site | Behavior |
|-----------|----------|
| Bootstrap | Seed shared examples into localStorage **if missing**; populate Redux examples list |
| New project empty/starter | Load template zip → clone with modal name/namespace/path → user project |
| Import project | Existing file picker; call same helper under the hood |

## Zip roles

**Templates (not listed under Example projects):**

- `empty-project.zip` → New project → Empty simulation  
- `empty-template-project.zip` → New project → From starter template  

**Shared examples (Example projects submenu):** all other zips in `example_projects/` (e.g. `wildfires-regrowth`, `boids-3d`, `consensus-algorithms`, …).

## Identity & persistence

- Shared examples use stable `pathWithNamespace` **`@examples/<slug>`** where `<slug>` is the zip basename (e.g. `@examples/wildfires-regrowth`).
- Namespace: `@examples`. Ref: `main`.
- Bootstrap: if `project/@examples/<slug>/main` already exists in localStorage, **do not overwrite** (user edits on the shared copy persist until storage is cleared).
- Display name: humanize the slug (or read `hash.json` / README title if cheap); keep names readable in the menu.
- Default / first special project: keep pointing at a seeded example (today’s shim uses consensus-algorithms; preserve that choice unless product asks otherwise).
- **My recent projects** must **exclude** `@examples/*` when scanning localStorage, so shared copies appear only under Example projects (not in both menus).

New projects from Empty/Starter stay under the user’s chosen namespace (existing modal behavior), not `@examples`.

## UI

- Re-enable the commented **Example projects** block in `HashCoreHeaderMenuFiles`.
- Nested submenu lists seeded examples; click uses existing `Link` + `urlFromProject` / example path helpers (same as former Example list item mapping).
- Track analytics as today (`Open project` / Example context).
- **My recent projects**, Import, Export, New project entries unchanged in placement aside from restoring Examples.

## Data flow

```text
example_projects/*.zip  (static)
        │
        ▼
  zip → project helper
        │
        ├─ bootstrap ──► localStorage (@examples/…) if missing
        │                    └─► Redux examples ──► File → Example projects
        │
        ├─ /new + /new/starter ──► clone + rename ──► user project
        │
        └─ Import project ──► @imported/<slug> (unchanged namespace policy)
```

## Errors

- Bootstrap: failed fetch/parse of one zip → log and skip that example; do not fail the whole app boot.
- New project template zip failure → user-visible / fatal error (cannot create without template).
- Import: keep current validation (`Please upload a .zip file`, unzip errors).

## Testing

- Unit: zip→project helper (fixture zip or minimal in-memory zip).
- Menu: Example projects submenu appears when examples are seeded; items navigate.
- Smoke: bootstrap seeds without duplicating on reload; opening an example does not create a second `@imported` copy; Empty/Starter still create distinct user projects whose files match the template zips.

## Cleanup

- Remove hardcoded `EMPTY_PROJECT_JSON` / `STARTER_PROJECT_JSON` from `templates.ts` (or replace file with thin zip loader + `createNewSimulationProjectFromTemplate` that mutates identity fields).
- Remove or hollow out `builtinSimulations.ts` in favor of zip seeding.
- Fix `bootstrapQuery` `specialProjects` shim to list seeded `@examples/…` metadata (not a mismatched name/path pair).
- Ensure Vite/dev/Docker serve `example_projects` (or a copied `public/example_projects`) so runtime fetch works in both dev and production images.

## Open implementation details (non-blocking)

- Exact static asset path (`/example_projects/...` vs Vite `public` copy in Docker).
- Humanized display names vs slug-as-name.
- Whether behavior sidecar files from zips change any existing empty/starter tests (expect them to pass with richer file sets).
