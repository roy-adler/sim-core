import {
  ProjectVisibility,
  SimulationProjectWithHcFiles,
} from "../../../../features/project/types";
import { fetchExampleZip } from "../../../../util/exampleProjects/fetchExampleZip";
import {
  TEMPLATE_ZIP_BY_KEY,
  TemplateKey,
} from "../../../../util/exampleProjects/manifest";
import { projectFromZipBuffer } from "../../../../util/exampleProjects/projectFromZip";

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
