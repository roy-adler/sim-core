# Folder-Driven Example Projects Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Drive File → Example projects from `example_projects/*.zip` via a generated `index.json`, move Empty/Starter zips to `project_templates/`, and open Consensus Algorithms on `/` only when the user has no user projects.

**Architecture:** Extend the Vite static plugin to scan `example_projects/` (serve zips + `index.json`) and `project_templates/` (serve zips). Bootstrap fetches the index, seeds `@examples/<slug>` if missing, and fills Redux examples from that list. Default route keeps “most recent user project” when any exist; otherwise prefers `DEFAULT_EXAMPLE_SLUG` (`consensus-algorithms`).

**Tech Stack:** TypeScript, React, Redux Toolkit, Vite middleware, Jest (ts-jest), Docker Compose (`hash-core-dev` / `hash-core-prod`)

## Global Constraints

- Example menu source of truth: top-level `example_projects/*.zip` only (via `/example_projects/index.json`).
- Templates live in repo-root `project_templates/` and are served at `/project_templates/<file>.zip`.
- Do not overwrite existing `project/@examples/<slug>/main` on bootstrap.
- Exclude `@examples/*` from My recent projects.
- Default route: user projects win when present; else Consensus if present in examples; else first example.
- Prefer Docker for yarn/jest: `docker compose --profile development run --rm hash-core-dev yarn ws:core test …` (or exec into a running container). Host Node only if Docker is unavailable.
- Do not reintroduce hardcoded `EXAMPLE_PROJECT_SLUGS` or hardcoded Empty/Starter project JSON blobs.

## File structure

| File | Responsibility |
|------|----------------|
| `example_projects/*.zip` | Shared demo zips only (no empty/starter) |
| `project_templates/empty-project.zip` | New project → Empty |
| `project_templates/empty-template-project.zip` | New project → Starter |
| `packages/core/vite.config.ts` | Serve both dirs; emit `/example_projects/index.json` |
| `packages/core/src/util/exampleProjects/manifest.ts` | `DEFAULT_EXAMPLE_SLUG`, template key→filename, URL helpers |
| `packages/core/src/util/exampleProjects/exampleIndex.ts` | Parse/normalize `index.json` → slugs |
| `packages/core/src/util/exampleProjects/exampleIndex.spec.ts` | Unit tests for index parsing |
| `packages/core/src/util/exampleProjects/fetchExampleZip.ts` | Fetch example zip bytes |
| `packages/core/src/util/exampleProjects/fetchTemplateZip.ts` | Fetch template zip bytes |
| `packages/core/src/util/exampleProjects/seedExamples.ts` | Fetch index → seed each slug |
| `packages/core/src/features/selectors.ts` | Default project selection |
| `packages/core/src/features/selectors.spec.ts` | Default project unit tests |
| `packages/core/src/components/HashCore/Header/Menu/Files/HashCoreHeaderMenuFiles.tsx` | Menu gate + sort |
| `packages/core/src/components/HashRouter/Effect/templates/templates.ts` | Load templates from `/project_templates/` |
| `docker-compose.yml` | Dev bind-mount for `project_templates` |
| `README.md` | Point users at File → Example projects / template folder |

---

### Task 1: Move template zips + compose mount

**Files:**
- Move: `example_projects/empty-project.zip` → `project_templates/empty-project.zip`
- Move: `example_projects/empty-template-project.zip` → `project_templates/empty-template-project.zip`
- Modify: `docker-compose.yml`

**Interfaces:**
- Produces: repo-root `project_templates/` containing exactly the two template zips (for now).
- Consumes: none.

- [ ] **Step 1: Create folder and move zips**

```bash
mkdir -p project_templates
git mv example_projects/empty-project.zip project_templates/empty-project.zip
git mv example_projects/empty-template-project.zip project_templates/empty-template-project.zip
ls example_projects/*.zip
ls project_templates/*.zip
```

Expected: `example_projects/` has no `empty-*.zip`; `project_templates/` has both template zips; `consensus-algorithms.zip` remains under `example_projects/`.

- [ ] **Step 2: Mount templates in compose (dev)**

In `docker-compose.yml`, under `hash-core-dev.volumes`, add:

```yaml
      - ./project_templates:/app/project_templates:ro
```

Keep the existing `./example_projects:/app/example_projects:ro` mount.

- [ ] **Step 3: Commit**

```bash
git add example_projects project_templates docker-compose.yml
git commit -m "$(cat <<'EOF'
Move Empty/Starter zips to project_templates and mount in compose.

EOF
)"
```

---

### Task 2: Parse `index.json` + unit tests

**Files:**
- Create: `packages/core/src/util/exampleProjects/exampleIndex.ts`
- Create: `packages/core/src/util/exampleProjects/exampleIndex.spec.ts`

**Interfaces:**
- Produces:
  - `export type ExampleProjectsIndex = { zips: string[] }`
  - `export function parseExampleProjectsIndex(data: unknown): ExampleProjectsIndex`
  - `export function slugsFromExampleIndex(index: ExampleProjectsIndex): string[]`
- Consumes: none.

- [ ] **Step 1: Write the failing tests**

Create `exampleIndex.spec.ts`:

```ts
import {
  parseExampleProjectsIndex,
  slugsFromExampleIndex,
} from "./exampleIndex";

describe("parseExampleProjectsIndex", () => {
  it("accepts a zips array of *.zip names", () => {
    expect(
      parseExampleProjectsIndex({
        zips: ["consensus-algorithms.zip", "boids-3d.zip"],
      }),
    ).toEqual({ zips: ["consensus-algorithms.zip", "boids-3d.zip"] });
  });

  it("rejects non-zip entries and non-objects", () => {
    expect(() => parseExampleProjectsIndex(null)).toThrow();
    expect(() =>
      parseExampleProjectsIndex({ zips: ["readme.md"] }),
    ).toThrow();
  });
});

describe("slugsFromExampleIndex", () => {
  it("strips .zip and preserves order", () => {
    expect(
      slugsFromExampleIndex({
        zips: ["consensus-algorithms.zip", "wildfires-regrowth.zip"],
      }),
    ).toEqual(["consensus-algorithms", "wildfires-regrowth"]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
docker compose --profile development run --rm hash-core-dev \
  yarn ws:core test src/util/exampleProjects/exampleIndex.spec.ts --forceExit
```

Expected: FAIL (module or exports missing).

- [ ] **Step 3: Implement `exampleIndex.ts`**

```ts
export type ExampleProjectsIndex = { zips: string[] };

export function parseExampleProjectsIndex(data: unknown): ExampleProjectsIndex {
  if (!data || typeof data !== "object") {
    throw new Error("example projects index must be an object");
  }
  const zips = (data as { zips?: unknown }).zips;
  if (!Array.isArray(zips) || !zips.every((z) => typeof z === "string")) {
    throw new Error("example projects index.zips must be string[]");
  }
  for (const name of zips) {
    if (!name.endsWith(".zip") || name.includes("/") || name.includes("\\")) {
      throw new Error(`invalid example zip name: ${name}`);
    }
  }
  return { zips: [...zips] };
}

export function slugsFromExampleIndex(index: ExampleProjectsIndex): string[] {
  return index.zips.map((name) => name.replace(/\.zip$/i, ""));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Same command as Step 2. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/util/exampleProjects/exampleIndex.ts \
  packages/core/src/util/exampleProjects/exampleIndex.spec.ts
git commit -m "$(cat <<'EOF'
Add parser for example_projects index.json.

EOF
)"
```

---

### Task 3: Vite plugin — index.json + project_templates

**Files:**
- Modify: `packages/core/vite.config.ts`

**Interfaces:**
- Produces HTTP:
  - `GET /example_projects/index.json` → `{ "zips": ["ant-foraging.zip", …] }` sorted alphabetically
  - `GET /example_projects/<name>.zip` (unchanged)
  - `GET /project_templates/<name>.zip`
- Consumes: filesystem dirs `../../example_projects`, `../../project_templates` relative to `packages/core`.

- [ ] **Step 1: Replace `exampleProjectsStatic` with dual-dir support**

In `packages/core/vite.config.ts`, replace the existing constants/plugin with:

```ts
const REPO_ROOT = path.resolve(process.cwd(), "../..");
const EXAMPLE_PROJECTS_DIR = path.join(REPO_ROOT, "example_projects");
const PROJECT_TEMPLATES_DIR = path.join(REPO_ROOT, "project_templates");

function listZipNames(dir: string): string[] {
  if (!fs.existsSync(dir)) {
    return [];
  }
  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith(".zip") && !name.startsWith("."))
    .sort((a, b) => a.localeCompare(b));
}

function sendZip(dir: string, name: string, res: import("http").ServerResponse) {
  const filePath = path.join(dir, name);
  if (!filePath.startsWith(dir) || !fs.existsSync(filePath)) {
    res.statusCode = 404;
    res.end("Not found");
    return;
  }
  res.setHeader("Content-Type", "application/zip");
  fs.createReadStream(filePath).pipe(res);
}

function projectZipsStatic(): Plugin {
  return {
    name: "project-zips-static",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url?.split("?")[0] ?? "";

        if (url === "/example_projects/index.json") {
          const body = JSON.stringify({ zips: listZipNames(EXAMPLE_PROJECTS_DIR) });
          res.setHeader("Content-Type", "application/json");
          res.end(body);
          return;
        }

        if (url.startsWith("/example_projects/")) {
          const name = path.basename(decodeURIComponent(url.slice("/example_projects/".length)));
          if (!name.endsWith(".zip")) {
            res.statusCode = 404;
            res.end("Not found");
            return;
          }
          sendZip(EXAMPLE_PROJECTS_DIR, name, res);
          return;
        }

        if (url.startsWith("/project_templates/")) {
          const name = path.basename(decodeURIComponent(url.slice("/project_templates/".length)));
          if (!name.endsWith(".zip")) {
            res.statusCode = 404;
            res.end("Not found");
            return;
          }
          sendZip(PROJECT_TEMPLATES_DIR, name, res);
          return;
        }

        next();
      });
    },
    closeBundle() {
      const examplesOut = path.resolve(process.cwd(), "dist/example_projects");
      const templatesOut = path.resolve(process.cwd(), "dist/project_templates");
      fs.mkdirSync(examplesOut, { recursive: true });
      fs.mkdirSync(templatesOut, { recursive: true });

      const exampleZips = listZipNames(EXAMPLE_PROJECTS_DIR);
      fs.writeFileSync(
        path.join(examplesOut, "index.json"),
        JSON.stringify({ zips: exampleZips }),
      );
      for (const name of exampleZips) {
        fs.copyFileSync(
          path.join(EXAMPLE_PROJECTS_DIR, name),
          path.join(examplesOut, name),
        );
      }
      for (const name of listZipNames(PROJECT_TEMPLATES_DIR)) {
        fs.copyFileSync(
          path.join(PROJECT_TEMPLATES_DIR, name),
          path.join(templatesOut, name),
        );
      }
    },
  };
}
```

Update `plugins` to call `projectZipsStatic()` instead of `exampleProjectsStatic()`.

Update `server.fs.allow` to include both dirs:

```ts
allow: [REPO_ROOT, EXAMPLE_PROJECTS_DIR, PROJECT_TEMPLATES_DIR],
```

- [ ] **Step 2: Smoke-check with running server**

Restart/rebuild so the updated `vite.config.ts` is picked up (dev bind-mounts the config file). Then:

```bash
curl -s http://localhost:8080/example_projects/index.json
curl -sI http://localhost:8080/example_projects/consensus-algorithms.zip | head -5
curl -sI http://localhost:8080/project_templates/empty-project.zip | head -5
```

Expected:
- index JSON includes `consensus-algorithms.zip` and does **not** include `empty-project.zip`
- both zip URLs return `200` and `Content-Type: application/zip`

If only the production compose profile is up, use port `8080`. For the development profile, use port `3000` (mapped to container `8080`).

- [ ] **Step 3: Commit**

```bash
git add packages/core/vite.config.ts
git commit -m "$(cat <<'EOF'
Serve example index.json and project_templates zips from Vite.

EOF
)"
```

---

### Task 4: Manifest + fetch helpers for split URLs

**Files:**
- Modify: `packages/core/src/util/exampleProjects/manifest.ts`
- Modify: `packages/core/src/util/exampleProjects/fetchExampleZip.ts`
- Create: `packages/core/src/util/exampleProjects/fetchTemplateZip.ts`
- Modify: `packages/core/src/components/HashRouter/Effect/templates/templates.ts`

**Interfaces:**
- Produces:
  - `export const DEFAULT_EXAMPLE_SLUG = "consensus-algorithms"`
  - `export const TEMPLATE_ZIP_BY_KEY = { empty: "empty-project.zip", starter: "empty-template-project.zip" }`
  - `export const exampleZipUrl = (fileName: string) => \`/example_projects/${fileName}\``
  - `export const templateZipUrl = (fileName: string) => \`/project_templates/${fileName}\``
  - `export async function fetchExampleZip(fileName: string): Promise<ArrayBuffer>`
  - `export async function fetchTemplateZip(fileName: string): Promise<ArrayBuffer>`
- Removes: `TEMPLATE_ZIP_NAMES` (unused). Leaves `EXAMPLE_PROJECT_SLUGS` until Task 5 deletes it so intermediate builds stay green.

- [ ] **Step 1: Update `manifest.ts` URLs (keep slugs list temporarily)**

```ts
/** Zips used only for New project templates — served from /project_templates. */
export const TEMPLATE_ZIP_BY_KEY = {
  empty: "empty-project.zip",
  starter: "empty-template-project.zip",
} as const;

export type TemplateKey = keyof typeof TEMPLATE_ZIP_BY_KEY;

/** Empty-state default when no user projects exist. */
export const DEFAULT_EXAMPLE_SLUG = "consensus-algorithms" as const;

/** @deprecated Task 5 replaces this with /example_projects/index.json */
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

export const exampleZipUrl = (fileName: string): string =>
  `/example_projects/${fileName}`;

export const templateZipUrl = (fileName: string): string =>
  `/project_templates/${fileName}`;
```

- [ ] **Step 2: Keep `fetchExampleZip`; add `fetchTemplateZip`**

`fetchExampleZip.ts` stays pointed at `exampleZipUrl`.

Create `fetchTemplateZip.ts`:

```ts
import { templateZipUrl } from "./manifest";

export async function fetchTemplateZip(fileName: string): Promise<ArrayBuffer> {
  const res = await fetch(templateZipUrl(fileName));
  if (!res.ok) {
    throw new Error(`Failed to fetch template ${fileName}: ${res.status}`);
  }
  return res.arrayBuffer();
}
```

- [ ] **Step 3: Point New project templates at `fetchTemplateZip`**

In `templates.ts`, replace `fetchExampleZip` with `fetchTemplateZip`:

```ts
import { fetchTemplateZip } from "../../../../util/exampleProjects/fetchTemplateZip";
// ...
const buffer = await fetchTemplateZip(zipName);
```

- [ ] **Step 4: Typecheck / unit smoke**

Run:

```bash
docker compose --profile development run --rm hash-core-dev \
  yarn ws:core test src/util/exampleProjects/exampleIndex.spec.ts src/util/exampleProjects/projectFromZip.spec.ts --forceExit
```

Expected: PASS. Fix any import errors from removed `EXAMPLE_PROJECT_SLUGS` / `TEMPLATE_ZIP_NAMES` if the compiler surfaces them in this step (seedExamples is Task 5).

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/util/exampleProjects/manifest.ts \
  packages/core/src/util/exampleProjects/fetchExampleZip.ts \
  packages/core/src/util/exampleProjects/fetchTemplateZip.ts \
  packages/core/src/components/HashRouter/Effect/templates/templates.ts
git commit -m "$(cat <<'EOF'
Split example vs template zip URL helpers.

EOF
)"
```

---

### Task 5: Seed examples from `index.json`

**Files:**
- Modify: `packages/core/src/util/exampleProjects/seedExamples.ts`

**Interfaces:**
- Consumes: `GET /example_projects/index.json`, `parseExampleProjectsIndex`, `slugsFromExampleIndex`, `fetchExampleZip`, `projectFromZipBuffer`, `humanizeSlug`, `DEFAULT_EXAMPLE_SLUG` (optional sort helper unused for menu)
- Produces: `seedExampleProjects(): Promise<UnpreparedPartialSimulationProject[]>` — one entry per successfully seeded/loaded slug from the index (alphabetical by `name`)

- [ ] **Step 1: Add index URL to `manifest.ts`**

```ts
export const exampleProjectsIndexUrl = (): string =>
  "/example_projects/index.json";
```

- [ ] **Step 2: Rewrite `seedExampleProjects` to fetch the index**

Remove `EXAMPLE_PROJECT_SLUGS` / `DEFAULT_EXAMPLE_SLUG` imports from `seedExamples.ts`. Use:

```ts
import {
  parseExampleProjectsIndex,
  slugsFromExampleIndex,
} from "./exampleIndex";
import { exampleProjectsIndexUrl } from "./manifest";

export async function seedExampleProjects(): Promise<
  UnpreparedPartialSimulationProject[]
> {
  const results: UnpreparedPartialSimulationProject[] = [];

  let slugs: string[] = [];
  try {
    const indexRes = await fetch(exampleProjectsIndexUrl());
    if (!indexRes.ok) {
      throw new Error(`index.json ${indexRes.status}`);
    }
    const index = parseExampleProjectsIndex(await indexRes.json());
    slugs = slugsFromExampleIndex(index);
  } catch (err) {
    console.error("Failed to load example projects index:", err);
    return [];
  }

  for (const slug of slugs) {
    const pathWithNamespace = `@examples/${slug}`;
    const existing = getLocalStorageProject(pathWithNamespace, "main");
    if (existing) {
      results.push(partialFromProject(existing));
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
      results.push(partialFromProject(project));
    } catch (err) {
      console.error(`Skipping example ${slug}:`, err);
    }
  }

  results.sort((a, b) => a.name.localeCompare(b.name));
  return results;
}
```

Keep the existing `partialFromProject` helper and other imports (`fetchExampleZip`, `projectFromZipBuffer`, `humanizeSlug`, localStorage helpers).

- [ ] **Step 3: Confirm TypeScript build of seed path**

Run:

```bash
docker compose --profile development run --rm hash-core-dev \
  yarn ws:core test src/util/exampleProjects --forceExit
```

Expected: PASS (existing + new specs).

- [ ] **Step 4: Manual browser/console check (optional but recommended)**

With the app open on a clean profile (or cleared `project/@examples/*` keys), reload and confirm Network shows:
- `/example_projects/index.json` → 200
- `/example_projects/consensus-algorithms.zip` → 200
- no request for `/example_projects/empty-project.zip`

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/util/exampleProjects/seedExamples.ts \
  packages/core/src/util/exampleProjects/manifest.ts
git commit -m "$(cat <<'EOF'
Seed example projects from folder index.json.

EOF
)"
```

---

### Task 6: Fix Example projects menu gate + sort

**Files:**
- Modify: `packages/core/src/components/HashCore/Header/Menu/Files/HashCoreHeaderMenuFiles.tsx`

**Interfaces:**
- Consumes: `exampleProjects: PartialSimulationProject[]`
- Produces: submenu rendered iff `exampleProjects.length > 0`; items sorted by `name` ascending

- [ ] **Step 1: Fix the Example projects block**

Replace the Example projects gate/sort (currently incorrectly using `userProjects.length` and `descByUpdatedAt`) with:

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
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(toListItem("Example"))}
    </ul>
  </li>
) : null}
```

Leave **My recent projects** gated on `userProjects.length` and sorted by `descByUpdatedAt`.

- [ ] **Step 2: Keep the smoke render test green**

Run:

```bash
docker compose --profile development run --rm hash-core-dev \
  yarn ws:core test src/components/HashCore/Header/Menu/Files/HashCoreHeaderMenuFiles.spec.tsx --forceExit
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/components/HashCore/Header/Menu/Files/HashCoreHeaderMenuFiles.tsx
git commit -m "$(cat <<'EOF'
Show Example projects from seeded list, sorted by name.

EOF
)"
```

---

### Task 7: Default route prefers Consensus when no user projects

**Files:**
- Modify: `packages/core/src/features/selectors.ts`
- Create: `packages/core/src/features/selectors.spec.ts`

**Interfaces:**
- Consumes: `selectUserProjects`, `selectExamples`, `DEFAULT_EXAMPLE_SLUG`
- Produces: `selectDefaultLinkableProject` behavior per spec

- [ ] **Step 1: Write failing unit tests**

Create `selectors.spec.ts` that exercises the selection logic. Prefer extracting a pure helper to avoid spinning up the full store:

In `selectors.ts`:

```ts
import { DEFAULT_EXAMPLE_SLUG } from "../util/exampleProjects/manifest";
import { LinkableProject, PartialSimulationProject } from "./project/types";

export function pickDefaultLinkableProject(
  userProjects: PartialSimulationProject[],
  examples: PartialSimulationProject[],
): LinkableProject | null {
  if (userProjects.length) {
    const project = orderBy(userProjects, "updatedAt", "desc")[0];
    return {
      pathWithNamespace: project.pathWithNamespace,
      ref: "main",
    };
  }

  if (!examples.length) {
    return null;
  }

  const preferred =
    examples.find((p) =>
      p.pathWithNamespace.endsWith(`/${DEFAULT_EXAMPLE_SLUG}`),
    ) ?? examples[0];

  return {
    pathWithNamespace: preferred.pathWithNamespace,
    ref: preferred.ref,
  };
}

export const selectDefaultLinkableProject = createSelector(
  selectUserProjects,
  selectExamples,
  pickDefaultLinkableProject,
);
```

Test file:

```ts
import { pickDefaultLinkableProject } from "./selectors";
import { PartialSimulationProject } from "./project/types";

const example = (
  path: string,
  updatedAt: string,
): PartialSimulationProject =>
  ({
    pathWithNamespace: path,
    name: path,
    updatedAt,
    ref: "main",
    type: "Simulation",
    visibility: "public",
    latestRelease: null,
    forkOf: null,
  } as PartialSimulationProject);

describe("pickDefaultLinkableProject", () => {
  it("prefers most recent user project when any exist", () => {
    const result = pickDefaultLinkableProject(
      [
        example("@user/a", "2020-01-01T00:00:00.000Z"),
        example("@user/b", "2024-01-01T00:00:00.000Z"),
      ],
      [example("@examples/consensus-algorithms", "2025-01-01T00:00:00.000Z")],
    );
    expect(result?.pathWithNamespace).toBe("@user/b");
  });

  it("prefers consensus when no user projects", () => {
    const result = pickDefaultLinkableProject(
      [],
      [
        example("@examples/wildfires-regrowth", "2025-01-02T00:00:00.000Z"),
        example("@examples/consensus-algorithms", "2025-01-01T00:00:00.000Z"),
      ],
    );
    expect(result?.pathWithNamespace).toBe(
      "@examples/consensus-algorithms",
    );
  });

  it("falls back to first example if consensus missing", () => {
    const result = pickDefaultLinkableProject(
      [],
      [example("@examples/boids-3d", "2025-01-01T00:00:00.000Z")],
    );
    expect(result?.pathWithNamespace).toBe("@examples/boids-3d");
  });
});
```

- [ ] **Step 2: Run tests to verify failure before implementation (if helper not yet wired)**

Run:

```bash
docker compose --profile development run --rm hash-core-dev \
  yarn ws:core test src/features/selectors.spec.ts --forceExit
```

Expected: FAIL until Step 3 is applied.

- [ ] **Step 3: Implement `pickDefaultLinkableProject` and wire the selector**

Apply the implementation shown in Step 1.

- [ ] **Step 4: Run tests to verify they pass**

Same command as Step 2. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/features/selectors.ts \
  packages/core/src/features/selectors.spec.ts
git commit -m "$(cat <<'EOF'
Prefer Consensus Algorithms as empty-state default project.

EOF
)"
```

---

### Task 8: README + end-to-end smoke

**Files:**
- Modify: `README.md`

**Interfaces:**
- Docs only + manual verification against running compose service.

- [ ] **Step 1: Update Limitations / usage bullets**

Replace the “import an example project .zip” guidance with File menu guidance, e.g.:

```markdown
1. To open a built-in demo, use **File → Example projects** (seeded from the `example_projects/` folder). Empty/Starter new-project templates come from `project_templates/`.
```

Also mark the checklist item “Re-introduce Example projects…” as done if it is still unchecked:

```markdown
- [x] Re-introduce "Example projects" accessible via the menus
```

- [ ] **Step 2: Full smoke against production compose (or dev)**

```bash
# index driven by folder
curl -s http://localhost:8080/example_projects/index.json | tee /tmp/ex-index.json
# must include consensus, must not include empty-project
python3 - <<'PY'
import json
z=set(json.load(open("/tmp/ex-index.json"))["zips"])
assert "consensus-algorithms.zip" in z
assert "empty-project.zip" not in z
print("index ok", len(z), "zips")
PY

curl -sI http://localhost:8080/project_templates/empty-template-project.zip | head -3
```

In the browser (clean site data recommended once):
1. Open `/` with no user projects → lands on Consensus Algorithms.
2. File → Example projects lists Consensus among the demos.
3. File → New project → Empty / From starter template still works.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "$(cat <<'EOF'
Document folder-driven examples and project_templates.

EOF
)"
```

---

## Spec coverage checklist

| Spec requirement | Task |
|------------------|------|
| Menu driven by `example_projects/*.zip` via index | 3, 5, 6 |
| Move templates to `project_templates/` | 1, 4 |
| Templates still zip-backed | 4 |
| Dev compose mounts both folders | 1 |
| Default route: user projects win; else Consensus | 7 |
| Menu visible without user projects | 6 |
| Remove hardcoded `EXAMPLE_PROJECT_SLUGS` | 4, 5 |
| Skip failed example; empty index → empty list | 5 |
| README / smoke | 8 |
