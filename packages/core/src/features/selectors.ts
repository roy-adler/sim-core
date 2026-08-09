import { createSelector } from "@reduxjs/toolkit";
import orderBy from "lodash/orderBy";

import { LinkableProject } from "./project/types";
import { selectExamples } from "./examples/selectors";
import { selectUserProjects } from "./user/selectors";

export const selectDefaultLinkableProject = createSelector(
  selectUserProjects,
  selectExamples,
  (userProjects, examples): LinkableProject | null => {
    const listToUse = userProjects.length ? userProjects : examples;
    const project = orderBy(listToUse, "updatedAt", "desc")[0];

    return project
      ? {
          pathWithNamespace: project.pathWithNamespace,
          ref: userProjects.length ? "main" : project.ref,
        }
      : null;
  },
);
