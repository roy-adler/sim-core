import { useCallback } from "react";
import { useDispatch, useSelector, useStore } from "react-redux";
import JSZip from "jszip";
import { navigate } from "hookrouter";
import { saveAs } from "file-saver";

import { AppDispatch, RootState } from "../types";
import { HcFile } from "./types";
import { HcFileKind } from "./enums";
import { SimulationProjectWithHcFiles } from "../project/types";
import { addUserProject } from "../user/slice";
import { preparePartialSimulationProject } from "../project/utils";
import { save } from "../thunks";
import {
  selectAllFiles,
  selectCurrentFileId,
  selectFileEntities,
} from "./selectors";
import { selectCurrentProject } from "../project/selectors";
import { setProjectWithMeta } from "../actions";
import { slugify, urlFromProject } from "../../routes";
import { stringifyBehaviorKeys } from "./utils";
import { trackEvent } from "../analytics";
import { projectFromZipBuffer } from "../../util/exampleProjects/projectFromZip";

export const useSelectFileById = (fileId: string): HcFile => {
  try {
    return useSelector(
      useCallback(
        (state: RootState) => {
          const entity = selectFileEntities(state)[fileId];

          if (!entity) {
            throw new Error("Cannot render file that does not exist");
          }

          return entity;
        },
        [fileId],
      ),
    );
  } catch (err) {
    /**
     * We have to do this console log outside of useSelector because of the
     * potential for the Redux "zombie children" issue…
     *
     * @see https://react-redux.js.org/api/hooks#stale-props-and-zombie-children
     */
    console.error("Cannot find file", fileId);
    throw err;
  }
};

export const useFileIsCurrent = (fileId: string) =>
  useSelector(
    useCallback(
      (state: RootState) => selectCurrentFileId(state) === fileId,
      [fileId],
    ),
  );

export const useExportFiles = () => {
  const store = useStore();

  const exportFiles = async () => {
    const state = store.getState();
    const allFiles = selectAllFiles(state);
    const currentProject = selectCurrentProject(state);

    const zip = new JSZip();

    for (const file of allFiles) {
      let path = "";

      if ("pathWithNamespace" in file && file.ref) {
        path = `dependencies/${file.pathWithNamespace}/`;
      }

      // the repo path for datasets points to a .json file containing metadata.
      // we drop the final .json when naming the file with the actual contents.
      path +=
        file.kind === HcFileKind.Dataset
          ? file.repoPath.replace(/\.json$/i, "")
          : file.repoPath;

      zip.file(path, file.contents);

      if (
        file.kind === HcFileKind.Behavior ||
        file.kind === HcFileKind.SharedBehavior
      ) {
        const behaviorKeysJson = stringifyBehaviorKeys(file);
        zip.file(`${path}.json`, behaviorKeysJson);
      }
    }

    const hashJson = currentProject?.config;
    if (hashJson) {
      zip.file("hash.json", JSON.stringify(hashJson, null, 2));
    }

    const fileZip = await zip.generateAsync({ type: "blob" });
    saveAs(
      fileZip,
      `${currentProject?.pathWithNamespace.split("/").pop()}.zip`,
    );
  };

  return exportFiles;
};

export const useImportFiles = () => {
  const dispatch = useDispatch<AppDispatch>();

  const importFiles = async (files: FileList) => {
    if (files.length === 0) {
      // They pushed 'cancel' on the dialog.
      return;
    }
    const file = files[0];

    const zipMimeTypes = [
      "application/zip",
      "application/zip-compressed",
      "application/x-zip-compressed",
    ];
    if (!zipMimeTypes.includes(file.type)) {
      throw "Please upload a .zip file";
    }

    const fileName = file.name.split(".").slice(0, -1).join(".");
    const path = slugify(fileName);

    let project: SimulationProjectWithHcFiles;
    try {
      const buffer = await file.arrayBuffer();
      project = await projectFromZipBuffer(buffer, {
        namespace: "@imported",
        path,
        name: path,
      });
    } catch (err: any) {
      throw "Error unzipping " + file.name + ": " + (err?.message ?? err);
    }

    dispatch(
      trackEvent({
        action: "Import Project: Core",
        label: project.pathWithNamespace,
      }),
    );

    dispatch(addUserProject(preparePartialSimulationProject(project)));
    dispatch(setProjectWithMeta(project));
    navigate(urlFromProject(project), false, {}, true);
    await dispatch(save());
  };

  return importFiles;
};
