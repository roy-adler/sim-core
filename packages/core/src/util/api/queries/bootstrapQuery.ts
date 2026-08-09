import { LocalStorageProject } from "../../../features/project/types";
import { getItem } from "../../../hooks/useLocalStorage";
import { prepareExamples } from "./exampleSimulations";
import { prepareUserProjects } from "./myProjects";
import { seedExampleProjects } from "../../exampleProjects/seedExamples";

export const bootstrapQuery = async () => {
  try {
    const specialProjects = await seedExampleProjects();
    const examples = prepareExamples(specialProjects);

    const myProjects = [];
    for (const key in localStorage) {
      if (
        !Object.prototype.hasOwnProperty.call(localStorage, key) ||
        !key.startsWith(`project/`) ||
        !key.endsWith("/main")
      ) {
        continue;
      }
      const project = getItem<LocalStorageProject>(key);
      if (!project) {
        continue;
      }
      if (project.pathWithNamespace.startsWith("@examples/")) {
        continue;
      }
      myProjects.push({
        pathWithNamespace: project.pathWithNamespace,
        name: project.name,
        updatedAt: project.updatedAt,
        type: project.type,
        visibility: project.visibility,
        latestRelease: project.latestRelease,
        forkOf: project.forkOf,
      });
    }

    return {
      examples,
      user: {
        id: "5d24ba78dc27ed00b3137d91",
        email: "user@hash.ai",
        fullName: "User",
        shortname: "user",
        staffMember: false,
        image:
          "https://s3.amazonaws.com/cdn-us1.hash.ai/assets/avatars/user-default.svg",
        tourProgress: {
          completed: true,
          version: "1.1",
          lastStepViewed: "done",
        },
        memberOf: [],
        role: {
          id: "5d24ba74dc27ed00b3137d81",
          name: "User",
        },
      },
      projects: prepareUserProjects(myProjects),
    };
  } catch {
    return { examples: [] };
  }
};
