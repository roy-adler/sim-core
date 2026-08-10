# Folder-Driven Example Projects + Template Zips Split

**Date:** 2026-08-10  
**Status:** Approved design  
**Components:** Vite static plugin (`packages/core/vite.config.ts`), example bootstrap (`seedExamples` / `bootstrapQuery`), File → Example projects menu, default route (`selectDefaultLinkableProject`), New project templates, `example_projects/`, new `project_templates/`

## Problem

1. **Example projects menu is not driven by the zip folder.** Bootstrap seeds from a hardcoded `EXAMPLE_PROJECT_SLUGS` list in `manifest.ts`. Adding or removing a zip under `example_projects/` does not automatically change the menu.
2. **Template zips share the examples folder.** `empty-project.zip` and `empty-template-project.zip` live beside shared demos, which makes “everything in this folder is an example” ambiguous.
3. **Consensus Algorithms should be the empty-state default.** `DEFAULT_EXAMPLE_SLUG` and `getOnboardingProject` already name consensus, but the default route prefers the most recent *user* project (correct) and otherwise picks examples by `updatedAt` (not consensus). The Example projects submenu is also incorrectly gated on `userProjects.length` and re-sorts by `updatedAt`, which can hide or scramble the intended set.

## Goals

1. Drive **File → Example projects** from the set of top-level `example_projects/*.zip` files (folder is source of truth).
2. Move Empty / Starter template zips to a sibling repo-root folder **`project_templates/`**, still loaded from zip bytes at runtime (no hardcoded project JSON).
3. On `/`, if the user has any user projects → open the most recent user project; otherwise open **Consensus Algorithms** when that zip is present.
4. Keep shared examples as stable `@examples/<slug>` localStorage copies seeded on bootstrap (seed-if-missing).

## Non-goals

- Pinning Consensus first in the Example projects menu (alphabetical / stable folder-derived order is enough).
- Always forcing Consensus on `/` when user projects exist.
- Cloud/API `specialProjects` GraphQL.
- Auto-deleting stale `@examples/*` localStorage entries when a zip is removed (menu omits them; orphan storage is acceptable).
- Changing Import project UX.

## Approach

**Scan the folders at serve/build time; expose a small index for the client.**

Extend the existing Vite `exampleProjectsStatic` plugin to:

| Path | Behavior |
|------|----------|
| `example_projects/*.zip` | Serve at `/example_projects/<file>.zip` |
| `example_projects/` listing | Serve **`/example_projects/index.json`**: `{ "zips": ["ant-foraging.zip", …] }` from a live directory scan (dev middleware) and write the same file on `closeBundle` for static builds |
| `project_templates/*.zip` | Serve at `/project_templates/<file>.zip` (same plugin or sibling helper) |

Bootstrap:

1. `GET /example_projects/index.json`
2. For each `*.zip` basename → slug = basename without `.zip`
3. Seed `@examples/<slug>` if missing; push metadata into Redux examples
4. Menu lists Redux examples (folder-backed), not a hardcoded slug array

Templates:

- Move `empty-project.zip` and `empty-template-project.zip` → `project_templates/`
- `TEMPLATE_ZIP_BY_KEY` keeps keys `empty` / `starter` but URLs resolve under `/project_templates/`
- `fetchExampleZip` (or a thin sibling) accepts a base path or dedicated `fetchTemplateZip`

## Folder layout

```text
example_projects/          # shared demos only (top-level *.zip)
  consensus-algorithms.zip
  wildfires-regrowth.zip
  …

project_templates/         # New project templates only
  empty-project.zip
  empty-template-project.zip
```

Docker Compose **development** profile: bind-mount both folders (read-only is fine) so host zip edits appear without image rebuild. Production image already `COPY . .` after WASM build, so both folders are baked in when present in the build context.

## Identity, default route & UI

- Shared examples: `pathWithNamespace` = `@examples/<slug>`, ref `main`, display name via existing `humanizeSlug` (or zip metadata later).
- Bootstrap: do not overwrite existing `project/@examples/<slug>/main` in localStorage.
- **My recent projects** continues to exclude `@examples/*`.
- **Example projects** submenu visible when `exampleProjects.length > 0` (not when `userProjects.length`).
- Menu order: stable alphabetical by display name (or index order); no requirement to pin Consensus.
- **Default linkable project** (`selectDefaultLinkableProject`):
  - If `userProjects.length > 0` → most recent by `updatedAt` (unchanged).
  - Else → project whose path ends with `/consensus-algorithms` if present in examples; else first example; else `null` (existing error path).

Keep `DEFAULT_EXAMPLE_SLUG = "consensus-algorithms"` as the only hardcoded example preference (default route + any remaining onboarding shim). Remove `EXAMPLE_PROJECT_SLUGS`.

## Data flow

```text
example_projects/*.zip
        │
        ▼
  Vite plugin ──► /example_projects/*.zip
              └─► /example_projects/index.json
                        │
                        ▼
                 seedExamples()
                        │
          ┌─────────────┴─────────────┐
          ▼                           ▼
  localStorage (if missing)    Redux examples
                                      │
                                      ▼
                           File → Example projects

project_templates/*.zip
        │
        ▼
  Vite plugin ──► /project_templates/*.zip
                        │
                        ▼
             New project Empty / Starter
```

## Errors

- Missing or invalid `index.json` → log; examples list empty; app still boots.
- One example zip fetch/parse failure → log and skip that slug; continue others.
- Template zip failure → fail New project create (user-visible / fatal as today).
- Default route with no user projects and no examples → keep “Could not find a default project”.

## Testing

- Unit/plugin or integration: index JSON lists every top-level `example_projects/*.zip` and omits `project_templates`.
- Menu: Consensus appears among examples when its zip is present; submenu shows with zero user projects if examples seeded.
- Default route: empty user projects → navigates to Consensus; with a user project → that project wins.
- New project Empty / Starter still produce projects whose files match the moved template zips.
- Smoke: add/remove a zip under `example_projects/` (dev restart or rebuild) changes `index.json` and the menu accordingly.

## Cleanup / follow-through

- Delete hardcoded `EXAMPLE_PROJECT_SLUGS` (and `TEMPLATE_ZIP_NAMES` if only used to filter the old shared folder).
- Update README notes that mention importing from `example_projects` / template locations.
- Align `docker-compose.yml` dev mounts with both folders.
- Prefer not to expand scope into pruning orphan `@examples/*` keys unless it becomes confusing in practice.

## Open details (non-blocking)

- Exact `index.json` shape (`{ zips: string[] }` vs `{ slugs: string[] }`) — prefer zip filenames for symmetry with static URLs.
- Whether production `closeBundle` copy is required while Docker still runs Vite `serve` — implement both middleware + `closeBundle` so either mode works.
