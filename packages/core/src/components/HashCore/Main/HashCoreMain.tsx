import React, { FC, useEffect, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";

import { HashCoreAside, HashCoreSection } from "..";
import { WrappedSplitterLayout } from "../../WrappedSplitterLayout/WrappedSplitterLayout";
import { selectFilesSlice } from "../../../features/files/selectors";
import { selectEditorVisible } from "../../../features/viewer/selectors";
import { showEditor } from "../../../features/viewer/slice";
import { useAddClassOnClick } from "./util";

import "./HashCoreMain.css";

const SIDEBAR_SIZE = 180;

export const HashCoreMain: FC = () => {
  // Necessary to prevent the transition delay delaying the seperator
  // colour changing back on mouseup
  const [setContainerRef] = useAddClassOnClick(
    "layout-splitter",
    "layout-splitter-no-transition-delay",
  );

  // Some floating elements need to be offseted so as not to cover the
  // files panel. This creates a CSS variable to allow them to do that.
  const onSecondaryPaneSizeChange = (size: number) => {
    document.documentElement.style.setProperty(
      "--left-pane-width",
      `${size}px`,
    );
  };

  const dispatch = useDispatch();
  const editorVisible = useSelector(selectEditorVisible);
  const currentFileId = useSelector(
    (state) => selectFilesSlice(state).currentFileId,
  );
  const prevFileIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    if (prevFileIdRef.current === undefined) {
      prevFileIdRef.current = currentFileId;
      return;
    }
    const prev = prevFileIdRef.current;
    prevFileIdRef.current = currentFileId;
    if (currentFileId && currentFileId !== prev) {
      dispatch(showEditor());
    }
  }, [currentFileId, dispatch]);

  return (
    <main className="HashCoreMain" ref={setContainerRef}>
      <WrappedSplitterLayout
        secondaryHidden={!editorVisible}
        primaryIndex={1}
        primaryMinSize={844}
        secondaryMinSize={SIDEBAR_SIZE}
        secondaryInitialSize={SIDEBAR_SIZE}
        onSecondaryPaneSizeChange={onSecondaryPaneSizeChange}
      >
        <HashCoreAside />
        <HashCoreSection />
      </WrappedSplitterLayout>
      {!editorVisible ? (
        <button
          type="button"
          aria-label="Show files and editor"
          className="HashCoreMain__EditorEdgeTab"
          onClick={() => dispatch(showEditor())}
        >
          <span className="codicon codicon-chevron-right" />
        </button>
      ) : null}
    </main>
  );
};
