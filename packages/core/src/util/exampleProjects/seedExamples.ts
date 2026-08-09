import {
  LocalStorageProject,
  SimulationProjectWithHcFiles,
  UnpreparedPartialSimulationProject,
} from "../../features/project/types";
import { getLocalStorageProject } from "../../features/project/utils";
import { setLocalStorageProject } from "../../features/middleware/localStorage";
import { fetchExampleZip } from "./fetchExampleZip";
import { humanizeSlug } from "./humanizeSlug";
import {
  DEFAULT_EXAMPLE_SLUG,
  EXAMPLE_PROJECT_SLUGS,
} from "./manifest";
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

  for (const slug of EXAMPLE_PROJECT_SLUGS) {
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

  results.sort((a, b) => {
    if (a.pathWithNamespace.endsWith(`/${DEFAULT_EXAMPLE_SLUG}`)) {
      return -1;
    }
    if (b.pathWithNamespace.endsWith(`/${DEFAULT_EXAMPLE_SLUG}`)) {
      return 1;
    }
    return a.name.localeCompare(b.name);
  });

  return results;
}
