import React, { FC, lazy, Suspense, useEffect, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useRecoilValue } from "recoil";

import * as sceneState from "../../AgentScene/state/SceneState";
import { Scope, useScope } from "../../../features/scopes";
import { SimulationRunner } from "../../SimulationRunner/SimulationRunner";
import { SimulationViewer } from "../../SimulationViewer";
import { WrappedSplitterLayout } from "../../WrappedSplitterLayout/WrappedSplitterLayout";
import {
  getViewer,
  selectActivityVisible,
} from "../../../features/viewer/selectors";
import { showActivity } from "../../../features/viewer/slice";
import { useInstructionReceiver } from "../useInstructionReceiver";
import { useResizeObserver } from "../../../hooks/useResizeObserver/useResizeObserver";

import "./HashCoreViewer.css";
import { ActivityHistory } from "../../ActivityHistory";

const LazyOpenInCore = lazy(() =>
  import(
    /* webpackChunkName: "OpenInCore" */ "../../OpenInCore/OpenInCore"
  ).then((module) => ({
    default: module.OpenInCore,
  })),
);

export const HashCoreViewer: FC = () => {
  const dispatch = useDispatch();
  const activityVisible = useSelector(selectActivityVisible);
  const { activity, viewer: viewerVisible } = useSelector(getViewer);
  const showInspectorEdgeTab = viewerVisible && !activity;
  const canShowOpenInCore = useScope(Scope.showOpenInCore);

  const onSecondaryPaneSizeChange = (size: number) => {
    document.documentElement.style.setProperty("--activity-width", `${size}px`);
  };

  useInstructionReceiver();

  // Open the inspector when an agent is newly selected in the 3D viewer.
  // AgentMesh lives inside the react-three-fiber Canvas, a separate React
  // root where the redux context isn't bridged (only Recoil is), so we
  // watch the shared Recoil selection state from here instead of
  // dispatching from within the Canvas.
  const selectedAgentIds = useRecoilValue(sceneState.SelectedAgentIds);
  const prevSelectedAgentIdsRef = useRef<Record<string, true>>({});
  useEffect(() => {
    const prevSelectedAgentIds = prevSelectedAgentIdsRef.current;
    const newlySelected = Object.keys(selectedAgentIds).some(
      (id) => !prevSelectedAgentIds[id],
    );
    prevSelectedAgentIdsRef.current = selectedAgentIds;

    if (newlySelected) {
      dispatch(showActivity());
    }
  }, [selectedAgentIds, dispatch]);

  const viewerRef = useResizeObserver(
    ({ width }) => {
      document.documentElement.style.setProperty(
        "--viewer-width",
        `${Math.round(width)}px`,
      );
    },
    { onObserve: null },
  );

  return (
    <div className="HashCoreViewer">
      <WrappedSplitterLayout
        percentage={false}
        primaryMinSize={180}
        secondaryMinSize={200}
        secondaryInitialSize={266}
        secondaryHidden={!activityVisible}
        onSecondaryPaneSizeChange={onSecondaryPaneSizeChange}
      >
        <div className="SimulationViewerMain" ref={viewerRef}>
          <SimulationViewer />
          <SimulationRunner />
          {canShowOpenInCore ? (
            <Suspense fallback={null}>
              <LazyOpenInCore />
            </Suspense>
          ) : null}
        </div>
        <ActivityHistory visible={activityVisible} />
      </WrappedSplitterLayout>
      {showInspectorEdgeTab ? (
        <button
          type="button"
          aria-label="Show inspector"
          className="HashCoreViewer__InspectorEdgeTab"
          onClick={() => dispatch(showActivity())}
        >
          <span className="codicon codicon-chevron-left" />
        </button>
      ) : null}
    </div>
  );
};
