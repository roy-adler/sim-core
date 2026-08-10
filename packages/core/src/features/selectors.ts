import { createSelector } from "@reduxjs/toolkit";
import orderBy from "lodash/orderBy";

import { DEFAULT_EXAMPLE_SLUG } from "../util/exampleProjects/manifest";
import { LinkableProject, PartialSimulationProject } from "./project/types";
import { selectExamples } from "./examples/selectors";
import { selectUserProjects } from "./user/selectors";

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
    examples.find((project) =>
      project.pathWithNamespace.endsWith(`/${DEFAULT_EXAMPLE_SLUG}`),
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
