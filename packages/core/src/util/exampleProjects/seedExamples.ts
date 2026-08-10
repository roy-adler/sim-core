import {
  LocalStorageProject,
  SimulationProjectWithHcFiles,
  UnpreparedPartialSimulationProject,
} from "../../features/project/types";
import { getLocalStorageProject } from "../../features/project/utils";
import { setLocalStorageProject } from "../../features/middleware/localStorage";
import {
  parseExampleProjectsIndex,
  slugsFromExampleIndex,
} from "./exampleIndex";
import { fetchExampleZip } from "./fetchExampleZip";
import { humanizeSlug } from "./humanizeSlug";
import { exampleProjectsIndexUrl } from "./manifest";
import { projectFromZipBuffer } from "./projectFromZip";

const partialFromProject = (
  project: Pick<
    SimulationProjectWithHcFiles | LocalStorageProject,
    | "pathWithNamespace"
    | "name"
    | "updatedAt"
    | "type"
    | "visibility"
    | "forkOf"
    | "latestRelease"
  >,
): UnpreparedPartialSimulationProject => ({
  pathWithNamespace: project.pathWithNamespace,
  name: project.name,
  updatedAt: project.updatedAt,
  type: project.type,
  visibility: project.visibility,
  latestRelease: project.latestRelease ?? null,
  forkOf: project.forkOf ?? null,
});

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
