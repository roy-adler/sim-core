import JSZip from "jszip";

import {
  ProjectFile,
  ProjectVisibility,
  RemoteSimulationProject,
  SimulationProjectWithHcFiles,
} from "../../features/project/types";
import { toHcConfig } from "../../features/project/utils";
import { toHcFiles } from "../../features/files/utils";
import { FilePathParts } from "../files/types";
import { fromFormatted } from "../files/parse";

const PERMITTED_DIRS = ["src", "data", "views", "dependencies"];

export async function projectFilesFromZip(zip: JSZip): Promise<ProjectFile[]> {
  const zipFiles: {
    name: string;
    contentPromise: Promise<string>;
  }[] = [];

  zip.forEach((_relativePath, zipEntry) => {
    if (zipEntry.dir) {
      return;
    }

    while (zipEntry.name.startsWith("/")) {
      zipEntry.name = zipEntry.name.slice(1);
    }

    if (zipEntry.name.startsWith(".")) {
      return;
    }

    let parsed: FilePathParts | null = null;
    try {
      parsed = fromFormatted(zipEntry.name);
    } catch (err) {
      console.warn("Skipping file in import:", zipEntry.name, err);
      return;
    }

    if (parsed.dir) {
      const candidateDir = parsed.dir.split("/")[0];
      if (!PERMITTED_DIRS.includes(candidateDir)) {
        console.warn("Skipping directory in import", parsed.dir);
        return;
      }
    }

    zipFiles.push({
      name: zipEntry.name,
      contentPromise: zipEntry.async("text"),
    });
  });

  const projectFiles: ProjectFile[] = [];
  for (const zipFile of zipFiles) {
    const contents = await zipFile.contentPromise;
    projectFiles.push({
      name: zipFile.name.replace(/^.*[\\/]/, ""),
      path: zipFile.name,
      contents,
      ref: "1.0",
    });
  }

  return projectFiles;
}

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
