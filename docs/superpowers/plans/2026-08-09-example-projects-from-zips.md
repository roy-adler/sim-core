# Example Projects from Zips Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore File → Example projects as shared copies seeded from `example_projects/*.zip`, and load Empty/Starter new-project templates from those zips instead of hardcoded JSON.

**Architecture:** Serve repo-root `example_projects/` as static `/example_projects/*.zip`. Shared `projectFromZip` helper turns zip bytes into `SimulationProjectWithHcFiles`. Bootstrap seeds `@examples/<slug>` into localStorage (if missing) and Redux examples; New project clones template zips with modal identity; Import reuses the same helper.

**Tech Stack:** TypeScript, React, Redux Toolkit, JSZip, Vite, Jest (ts-jest), Docker Compose (yarn-server)

## Global Constraints

- Shared examples use namespace `@examples` and `pathWithNamespace` `@examples/<slug>` (zip basename).
- Do not overwrite existing `project/@examples/<slug>/main` in localStorage on bootstrap.
- Exclude `@examples/*` from My recent projects localStorage scan.
- Templates only: `empty-project.zip` → empty; `empty-template-project.zip` → starter. Do not list them under Example projects.
- Prefer Docker for yarn/jest when possible: `docker compose --profile development run --rm hash-core-dev yarn …` (or existing package scripts inside the running container). Host Node only if Docker is unavailable.
- Do not reintroduce hardcoded `EMPTY_PROJECT_JSON` / `STARTER_PROJECT_JSON` / `BUILTIN_SIMULATIONS` blobs once zip loading works.

## File structure

| File | Responsibility |
|------|----------------|
| `packages/core/src/util/exampleProjects/manifest.ts` | Lists example slugs + template zip filenames + default example |
| `packages/core/src/util/exampleProjects/projectFromZip.ts` | Zip bytes / JSZip → `ProjectFile[]` + project builder |
| `packages/core/src/util/exampleProjects/projectFromZip.spec.ts` | Unit tests for zip parsing |
| `packages/core/src/util/exampleProjects/fetchExampleZip.ts` | `fetch('/example_projects/…')` → `ArrayBuffer` |
| `packages/core/src/util/exampleProjects/seedExamples.ts` | Bootstrap: fetch+seed examples, return partial metadata |
| `packages/core/src/util/exampleProjects/humanizeSlug.ts` | `wildfires-regrowth` → `Wildfires Regrowth` |
| `packages/core/vite.config.ts` | Serve/copy `../../example_projects` at `/example_projects` |
| `packages/core/src/features/files/hooks.ts` | Import uses `projectFromZip` |
| `packages/core/src/util/api/queries/bootstrapQuery.ts` | Seed from zips; filter my-projects; specialProjects from seed |
| `packages/core/src/components/HashRouter/Effect/templates/templates.ts` | Load empty/starter from zips (async) |
| `packages/core/src/components/HashRouter/Effect/NewProject.tsx` | Await async template create |
| `packages/core/src/components/HashCore/Header/Menu/Files/HashCoreHeaderMenuFiles.tsx` | Uncomment Example projects submenu |
| `packages/core/src/util/builtinSimulations.ts` | Delete or reduce to re-export shim removal |

---

### Task 1: `projectFromZip` helper + unit test

**Files:**
- Create: `packages/core/src/util/exampleProjects/projectFromZip.ts`
- Create: `packages/core/src/util/exampleProjects/projectFromZip.spec.ts`
- Create: `packages/core/src/util/exampleProjects/humanizeSlug.ts`

**Interfaces:**
- Produces:
  - `export function humanizeSlug(slug: string): string`
  - `export async function projectFilesFromZip(zip: JSZip): Promise<ProjectFile[]>`
  - `export function buildSimulationProjectFromFiles(opts: { files: ProjectFile[]; namespace: string; path: string; name?: string; visibility?: ProjectVisibility }): SimulationProjectWithHcFiles`
  - `export async function projectFromZipBuffer(buffer: ArrayBuffer, opts: { namespace: string; path: string; name?: string }): Promise<SimulationProjectWithHcFiles>`

- [ ] **Step 1: Write the failing test**

Create `projectFromZip.spec.ts`:

```ts
import JSZip from "jszip";
import {
  projectFilesFromZip,
  buildSimulationProjectFromFiles,
} from "./projectFromZip";
import { humanizeSlug } from "./humanizeSlug";

describe("humanizeSlug", () => {
  it("title-cases hyphenated slugs", () => {
    expect(humanizeSlug("wildfires-regrowth")).toBe("Wildfires Regrowth");
  });
});

describe("projectFilesFromZip", () => {
  it("extracts permitted files and skips hidden/disallowed dirs", async () => {
    const zip = new JSZip();
    zip.file("README.md", "# Hi");
    zip.file("src/globals.json", "{}");
    zip.file(".DS_Store", "x");
    zip.file("secrets/key.txt", "nope");
    zip.folder("src")?.file("init.json", "[]");

    const files = await projectFilesFromZip(zip);
    const paths = files.map((f) => f.path).sort();
    expect(paths).toEqual(["README.md", "src/globals.json", "src/init.json"]);
  });
});

describe("buildSimulationProjectFromFiles", () => {
  it("builds @examples pathWithNamespace", () => {
    const project = buildSimulationProjectFromFiles({
      files: [
        {
          name: "README.md",
          path: "README.md",
          contents: "hi",
          ref: "1.0",
        },
        {
          name: "globals.json",
          path: "src/globals.json",
          contents: "{}",
          ref: "1.0",
        },
        {
          name: "analysis.json",
          path: "views/analysis.json",
          contents: '{"outputs":{},"plots":[]}',
          ref: "1.0",
        },
        {
          name: "dependencies.json",
          path: "dependencies.json",
          contents: "{}",
          ref: "1.0",
        },
        {
          name: "experiments.json",
          path: "experiments.json",
          contents: "{}",
          ref: "1.0",
        },
        {
          name: "init.json",
          path: "src/init.json",
          contents: "[]",
          ref: "1.0",
        },
      ],
      namespace: "@examples",
      path: "wildfires-regrowth",
      name: "Wildfires Regrowth",
    });
    expect(project.pathWithNamespace).toBe("@examples/wildfires-regrowth");
    expect(project.namespace).toBe("@examples");
    expect(project.ref).toBe("main");
    expect(project.files.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (from repo root, prefer Docker):

```bash
docker compose --profile development run --rm hash-core-dev yarn workspace @hash/core test -- projectFromZip.spec.ts
```

Expected: FAIL (module not found / cannot find `./projectFromZip`).

- [ ] **Step 3: Write minimal implementation**

`humanizeSlug.ts`:

```ts
export const humanizeSlug = (slug: string): string =>
  slug
    .split("-")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
```

`projectFromZip.ts` — move the zip-entry filtering logic from `useImportFiles` in `packages/core/src/features/files/hooks.ts` (permitted dirs `src|data|views|dependencies`, skip dirs/hidden, trim leading `/`) into `projectFilesFromZip`. Then:

```ts
export function buildSimulationProjectFromFiles({
  files,
  namespace,
  path,
  name,
  visibility = "public",
}: {
  files: ProjectFile[];
  namespace: string;
  path: string;
  name?: string;
  visibility?: ProjectVisibility;
}): SimulationProjectWithHcFiles {
  const now = new Date().toISOString();
  const remote: RemoteSimulationProject = {
    id: path,
    name: name ?? path,
    description: "",
    image: null,
    thumbnail: null,
    createdAt: now,
    updatedAt: now,
    canUserEdit: true,
    pathWithNamespace: `${namespace}/${path}`,
    namespace,
    type: "Simulation",
    ref: "main",
    visibility,
    ownerType: "User",
    forkOf: null,
    latestRelease: null,
    license: {
      id: "5dc3da73cc0cf804dcc66a51",
      name: "MIT License",
    },
    keywords: [],
    files,
  };
  return {
    ...remote,
    config: toHcConfig(remote),
    files: toHcFiles(remote),
    ref: "main",
    access: null,
  };
}

export async function projectFromZipBuffer(
  buffer: ArrayBuffer,
  opts: { namespace: string; path: string; name?: string },
): Promise<SimulationProjectWithHcFiles> {
  const zip = await JSZip.loadAsync(buffer);
  const files = await projectFilesFromZip(zip);
  return buildSimulationProjectFromFiles({ files, ...opts });
}
```

Use the same imports as import hook: `toHcConfig`, `toHcFiles`, `fromFormatted`, types from `features/project` / `features/files`.

- [ ] **Step 4: Run test to verify it passes**

Same jest command as Step 2. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/util/exampleProjects
git commit -m "Add projectFromZip helper for example zip loading."
```

---

### Task 2: Serve `example_projects` as static `/example_projects`

**Files:**
- Modify: `packages/core/vite.config.ts`
- Create: `packages/core/src/util/exampleProjects/manifest.ts`
- Create: `packages/core/src/util/exampleProjects/fetchExampleZip.ts`

**Interfaces:**
- Consumes: none from Task 1 required for fetch
- Produces:
  - `EXAMPLE_PROJECT_SLUGS: readonly string[]` (all example zips except empty templates)
  - `TEMPLATE_ZIP_BY_KEY: { empty: "empty-project.zip"; starter: "empty-template-project.zip" }`
  - `DEFAULT_EXAMPLE_SLUG: "consensus-algorithms"`
  - `export function exampleZipUrl(fileName: string): string` → `/example_projects/${fileName}`
  - `export async function fetchExampleZip(fileName: string): Promise<ArrayBuffer>`

- [ ] **Step 1: Add manifest + fetch helper**

`manifest.ts`:

```ts
/** Zips used only for New project templates — not Example projects menu. */
export const TEMPLATE_ZIP_BY_KEY = {
  empty: "empty-project.zip",
  starter: "empty-template-project.zip",
} as const;

export type TemplateKey = keyof typeof TEMPLATE_ZIP_BY_KEY;

export const TEMPLATE_ZIP_NAMES = new Set<string>(
  Object.values(TEMPLATE_ZIP_BY_KEY),
);

/**
 * Shared example slugs (zip basename without .zip).
 * Keep in sync with repo-root example_projects/*.zip minus templates.
 */
export const EXAMPLE_PROJECT_SLUGS = [
  "ant-foraging",
  "boids-3d",
  "city-infection-model",
  "connection-example",
  "consensus-algorithms",
  "model-market",
  "published-display-behaviors",
  "rainfall",
  "rumor-mill-public-health-practices",
  "sugarscape",
  "virus-mutation-and-drug-resistance",
  "warehouse-logistics",
  "wildfires-regrowth",
] as const;

export const DEFAULT_EXAMPLE_SLUG = "consensus-algorithms" as const;

export const exampleZipUrl = (fileName: string): string =>
  `/example_projects/${fileName}`;
```

`fetchExampleZip.ts`:

```ts
import { exampleZipUrl } from "./manifest";

export async function fetchExampleZip(fileName: string): Promise<ArrayBuffer> {
  const res = await fetch(exampleZipUrl(fileName));
  if (!res.ok) {
    throw new Error(`Failed to fetch ${fileName}: ${res.status}`);
  }
  return res.arrayBuffer();
}
```

- [ ] **Step 2: Wire Vite to serve and copy example zips**

In `packages/core/vite.config.ts`, add `path` / `fs` usage and a small plugin (no new dependency):

```ts
import path from "path";
import fs from "fs";
import type { Plugin } from "vite";

const EXAMPLE_PROJECTS_DIR = path.resolve(__dirname, "../../example_projects");

function exampleProjectsStatic(): Plugin {
  const mount = "/example_projects";
  return {
    name: "example-projects-static",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith(mount + "/")) return next();
        const name = path.basename(decodeURIComponent(req.url.slice(mount.length)));
        if (!name.endsWith(".zip")) {
          res.statusCode = 404;
          res.end("Not found");
          return;
        }
        const filePath = path.join(EXAMPLE_PROJECTS_DIR, name);
        if (!filePath.startsWith(EXAMPLE_PROJECTS_DIR) || !fs.existsSync(filePath)) {
          res.statusCode = 404;
          res.end("Not found");
          return;
        }
        res.setHeader("Content-Type", "application/zip");
        fs.createReadStream(filePath).pipe(res);
      });
    },
    closeBundle() {
      const outDir = path.resolve(__dirname, "dist/example_projects");
      fs.mkdirSync(outDir, { recursive: true });
      for (const name of fs.readdirSync(EXAMPLE_PROJECTS_DIR)) {
        if (!name.endsWith(".zip")) continue;
        fs.copyFileSync(
          path.join(EXAMPLE_PROJECTS_DIR, name),
          path.join(outDir, name),
        );
      }
    },
  };
}
```

Add `exampleProjectsStatic()` to the `plugins` array. Also add `server.fs.allow` including `EXAMPLE_PROJECTS_DIR` if needed.

- [ ] **Step 3: Manually verify asset URL (optional smoke)**

With `hash-core-dev` up, open `/example_projects/empty-project.zip` and confirm a zip download (or `curl -I`). Expected: 200.

- [ ] **Step 4: Commit**

```bash
git add packages/core/vite.config.ts packages/core/src/util/exampleProjects
git commit -m "Serve example_projects zips and add fetch manifest."
```

---

### Task 3: Bootstrap seed from zips + fix my-projects filter

**Files:**
- Create: `packages/core/src/util/exampleProjects/seedExamples.ts`
- Modify: `packages/core/src/util/api/queries/bootstrapQuery.ts`
- Delete or gut: `packages/core/src/util/builtinSimulations.ts` (remove from imports)

**Interfaces:**
- Consumes: `projectFromZipBuffer`, `EXAMPLE_PROJECT_SLUGS`, `DEFAULT_EXAMPLE_SLUG`, `fetchExampleZip`, `humanizeSlug`
- Produces: `export async function seedExampleProjects(): Promise<UnpreparedPartialSimulationProject[]>`

- [ ] **Step 1: Implement `seedExamples.ts`**

```ts
export async function seedExampleProjects(): Promise<
  UnpreparedPartialSimulationProject[]
> {
  const results: UnpreparedPartialSimulationProject[] = [];

  for (const slug of EXAMPLE_PROJECT_SLUGS) {
    const pathWithNamespace = `@examples/${slug}`;
    const existing = getLocalStorageProject(pathWithNamespace, "main");
    if (existing) {
      results.push(partialFromStored(existing));
      continue;
    }
    try {
      const buffer = await fetchExampleZip(`${slug}.zip`);
      const project = await projectFromZipBuffer(buffer, {
        namespace: "@examples",
        path: slug,
        name: humanizeSlug(slug),
      });
      setLocalStorageProject({ ...project, actions: [] });
      results.push(partialFromStored(project));
    } catch (err) {
      console.error(`Skipping example ${slug}:`, err);
    }
  }

  // Prefer default slug first for specialProjects[0]
  results.sort((a, b) => {
    if (a.pathWithNamespace.endsWith(DEFAULT_EXAMPLE_SLUG)) return -1;
    if (b.pathWithNamespace.endsWith(DEFAULT_EXAMPLE_SLUG)) return 1;
    return a.name.localeCompare(b.name);
  });

  return results;
}
```

`partialFromStored` maps to the fields used in today’s `specialProjects` / `prepareExamples` input (`pathWithNamespace`, `name`, `updatedAt`, `type`, `visibility`, `latestRelease`, `forkOf`, `ref`).

- [ ] **Step 2: Update `bootstrapQuery.ts`**

- Remove `BUILTIN_SIMULATIONS` loop.
- Make `bootstrapQueryResponse` async (or move seeding into `bootstrapQuery` body):
  - `const specialProjects = await seedExampleProjects();`
  - When scanning localStorage for my projects, **skip** keys / projects whose `pathWithNamespace` starts with `@examples/`.
- Return `specialProjects` from the seed (not the mismatched hardcoded consensus/wildfires object).

- [ ] **Step 3: Remove `builtinSimulations.ts` usages**

Delete file if unused, or leave a one-line deprecation re-export only if something else imports it. Grep and clear.

- [ ] **Step 4: Smoke-check types compile**

```bash
docker compose --profile development run --rm hash-core-dev yarn workspace @hash/core test -- projectFromZip.spec.ts
```

Expected: still PASS. Fix any TS errors from bootstrap changes.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/util/exampleProjects packages/core/src/util/api/queries/bootstrapQuery.ts packages/core/src/util/builtinSimulations.ts
git commit -m "Seed shared example projects from zips at bootstrap."
```

---

### Task 4: Restore Example projects submenu

**Files:**
- Modify: `packages/core/src/components/HashCore/Header/Menu/Files/HashCoreHeaderMenuFiles.tsx`
  - Uncomment the Example projects block (~lines 221–239)
  - Change `exampleProjects: _exampleProjects` back to `exampleProjects` and use it
- Modify: `packages/core/src/components/HashCore/Header/Menu/Files/HashCoreHeaderMenuFiles.spec.tsx` only if needed

**Interfaces:**
- Consumes: `exampleProjects: PartialSimulationProject[]` already passed from `HashCoreHeaderMenu` via `selectExamples`

- [ ] **Step 1: Uncomment and wire Example projects**

Restore:

```tsx
{exampleProjects.length ? (
  <li
    className="HashCoreHeaderMenu-submenu-item"
    onMouseEnter={onMouseEnterSubmenuItem}
    onMouseLeave={onMouseLeaveSubmenuItem}
  >
    <LabeledInputRadio
      group="HashCoreHeaderMenu-submenu"
      label="Example projects"
      isChecked={(htmlFor) => htmlFor === openSubmenuItem}
      onMouseEnter={onMouseEnterSubmenuItemLabel}
    />
    <ul>
      {[...exampleProjects]
        .sort(descByUpdatedAt)
        .map(toListItem("Example"))}
    </ul>
  </li>
) : null}
```

Ensure `toListItem("Example")` still uses `urlFromProject(item)` so `@examples/...` navigates correctly.

- [ ] **Step 2: Render smoke test**

```bash
docker compose --profile development run --rm hash-core-dev yarn workspace @hash/core test -- HashCoreHeaderMenuFiles.spec.tsx
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/components/HashCore/Header/Menu/Files/HashCoreHeaderMenuFiles.tsx
git commit -m "Restore File menu Example projects submenu."
```

---

### Task 5: New project Empty/Starter from template zips

**Files:**
- Modify: `packages/core/src/components/HashRouter/Effect/templates/templates.ts` (replace blobs)
- Modify: `packages/core/src/components/HashRouter/Effect/NewProject.tsx`
- Optionally delete unused `empty.ts` / `starter.ts` if nothing imports them (grep first)

**Interfaces:**
- Consumes: `fetchExampleZip`, `TEMPLATE_ZIP_BY_KEY`, `projectFromZipBuffer`
- Produces: `export async function createNewSimulationProjectFromTemplate(...): Promise<SimulationProjectWithHcFiles>`

- [ ] **Step 1: Replace `templates.ts` implementation**

Remove `EMPTY_PROJECT_JSON` / `STARTER_PROJECT_JSON`. Implement:

```ts
export const createNewSimulationProjectFromTemplate = async (
  namespace: string,
  path: string,
  name: string,
  visibility: ProjectVisibility,
  template: string,
): Promise<SimulationProjectWithHcFiles> => {
  if (!(namespace && path && name)) {
    throw Error(
      "Namespace, path, and name must be specified when creating a project.",
    );
  }
  const zipName = TEMPLATE_ZIP_BY_KEY[template as TemplateKey];
  if (!zipName) {
    throw new Error(`Unrecognized template ${template}`);
  }
  const buffer = await fetchExampleZip(zipName);
  const fromZip = await projectFromZipBuffer(buffer, {
    namespace,
    path,
    name,
  });
  return {
    ...fromZip,
    id: path,
    name,
    pathWithNamespace: `${namespace}/${path}`,
    namespace,
    visibility,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    access: null,
  };
};
```

- [ ] **Step 2: Await in `NewProject.tsx`**

Change `onSubmit` to `await createNewSimulationProjectFromTemplate(...)` (remove `require-await` eslint disable if no longer needed). On failure, call `fatalError` or rethrow so the user sees it.

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/components/HashRouter/Effect/templates/templates.ts packages/core/src/components/HashRouter/Effect/NewProject.tsx
git commit -m "Load empty and starter templates from example zips."
```

---

### Task 6: Refactor Import to use `projectFromZip`

**Files:**
- Modify: `packages/core/src/features/files/hooks.ts` (`useImportFiles`)

**Interfaces:**
- Consumes: `projectFilesFromZip` + `buildSimulationProjectFromFiles` (or `projectFromZipBuffer` after File→ArrayBuffer)

- [ ] **Step 1: Thin `useImportFiles`**

After MIME check:

```ts
const buffer = await file.arrayBuffer();
const fileName = file.name.split(".").slice(0, -1).join(".");
const path = slugify(fileName);
const project = await projectFromZipBuffer(buffer, {
  namespace: "@imported",
  path,
  name: path,
});
// existing trackEvent, addUserProject, setProjectWithMeta, navigate, save
```

Keep the same MIME validation and empty FileList early return.

- [ ] **Step 2: Run helper + a quick related test if any**

```bash
docker compose --profile development run --rm hash-core-dev yarn workspace @hash/core test -- projectFromZip.spec.ts
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/features/files/hooks.ts
git commit -m "Reuse projectFromZip for Import project."
```

---

### Task 7: Verification pass

**Files:** none new (manual / automated verification)

- [ ] **Step 1: Unit tests**

```bash
docker compose --profile development run --rm hash-core-dev yarn workspace @hash/core test -- projectFromZip.spec.ts HashCoreHeaderMenuFiles.spec.tsx
```

Expected: PASS.

- [ ] **Step 2: Manual UI checklist (dev server)**

1. Hard-refresh app (or clear only if needed).
2. File → Example projects lists seeded examples (not empty/starter).
3. Open one example → URL under `@examples/...`; reload → same project, not duplicated.
4. Example does **not** appear under My recent projects.
5. File → New project → Empty / Starter still opens modal and creates a **new** user project whose files match the zip.
6. Import project still works with a zip.

- [ ] **Step 3: Final commit if verification fixed anything**

Only if fixes were needed; otherwise done.

---

## Spec coverage checklist

| Spec requirement | Task |
|------------------|------|
| Example projects submenu | 4 |
| Shared built-in copies / no re-import | 3 |
| Seed from zips at bootstrap | 3 |
| `@examples/<slug>` identity | 1, 3 |
| Do not overwrite existing shared copy | 3 |
| Exclude `@examples` from My recent | 3 |
| Empty/starter from zips, still create-new | 5 |
| Shared zip helper + Import reuse | 1, 6 |
| Serve zips in Vite/Docker | 2 |
| Remove hardcoded blobs | 3, 5 |
| Error: skip bad example; fail new-project template | 3, 5 |
| Tests for helper + menu smoke | 1, 4, 7 |
