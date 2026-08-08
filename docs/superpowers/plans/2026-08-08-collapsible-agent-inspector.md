# Collapsible Agent Inspector Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Agent Inspector right pane collapsible via a header ›› control and a slim edge ‹ tab, defaulting collapsed on boot, synced with `viewer.activity`, and auto-expanding on agent selection.

**Architecture:** Reuse Redux `viewer.activity` (`hideActivity` / `showActivity` / `toggleActivity` / `selectActivityVisible`). Flip boot defaults so activity starts off. Add Inspector header collapse + HashCoreViewer edge reopen tab. Dispatch `showActivity` when AgentMesh newly selects an agent.

**Tech Stack:** React 16, Redux Toolkit, react-redux, Recoil (selection), existing `codicon` icons, Docker for yarn/tests per workspace rules.

## Global Constraints

- Reuse `viewer.activity` — do **not** add `inspectorVisible`
- UI option C: header ›› button; slim unlabeled mid-height ‹ edge tab
- Deselect must **not** auto-collapse
- Prefer Docker for yarn/jest (`docker compose --profile development`)
- Spec: `docs/superpowers/specs/2026-08-08-collapsible-agent-inspector-design.md`
- Do not rename View menu “Activity” / “Viewer” labels in this work

## File map

| File | Responsibility |
|------|----------------|
| `packages/core/src/features/viewer/slice.ts` | Initial `activity: false` |
| `packages/core/src/hooks/useParameterisedUi.ts` | URL default: activity on only if `?activity=true` |
| `packages/core/src/hooks/useParameterisedUi.spec.ts` | Unit tests for activity query parsing |
| `packages/core/src/components/ActivityHistory/Inspector/Inspector.tsx` | Header ›› collapse → `hideActivity` |
| `packages/core/src/components/ActivityHistory/Inspector/Inspector.css` | Collapse button styles |
| `packages/core/src/components/HashCore/Viewer/HashCoreViewer.tsx` | Edge ‹ tab when viewer on & activity off |
| `packages/core/src/components/HashCore/Viewer/HashCoreViewer.css` | Edge tab styles |
| `packages/core/src/components/AgentScene/components/AgentMesh.tsx` | `showActivity` on new selection |

---

### Task 1: Default collapsed on boot

**Files:**
- Modify: `packages/core/src/features/viewer/slice.ts` (`viewerInitialState.activity`)
- Modify: `packages/core/src/hooks/useParameterisedUi.ts`
- Create: `packages/core/src/hooks/useParameterisedUi.spec.ts`

**Interfaces:**
- Produces: `getUiQueryParams().activity` is `false` when param absent; `true` only when `activity=true`
- Consumes: `getSafeQueryParams()`, `initialiseView`

- [ ] **Step 1: Write the failing tests**

Create `packages/core/src/hooks/useParameterisedUi.spec.ts`:

```ts
import { getUiQueryParams } from "./useParameterisedUi";

const setSearch = (search: string) => {
  window.history.replaceState({}, "", search ? `?${search}` : "/");
};

describe("getUiQueryParams activity default", () => {
  afterEach(() => {
    setSearch("");
  });

  it("defaults activity to false when param is absent", () => {
    setSearch("");
    expect(getUiQueryParams().activity).toBe(false);
  });

  it("enables activity when activity=true", () => {
    setSearch("activity=true");
    expect(getUiQueryParams().activity).toBe(true);
  });

  it("keeps activity false when activity=false", () => {
    setSearch("activity=false");
    expect(getUiQueryParams().activity).toBe(false);
  });
});
```

Note: `getSafeQueryParams` memoizes on `window.location.search`. Changing search via `history.replaceState` updates `window.location.search` so each distinct search string is a new memo key. If tests flake on memoization, clear by using unique searches only (as above).

- [ ] **Step 2: Run tests — expect failure**

```bash
docker compose --profile development exec hash-core-dev yarn workspace @hashintel/core test useParameterisedUi.spec.ts --watchAll=false
```

Expected: FAIL — `activity` still defaults to `true` (or first assertion fails).

If the container is not running, build/start first:

```bash
docker compose --profile development up -d hash-core-dev
```

- [ ] **Step 3: Flip Redux initial state**

In `packages/core/src/features/viewer/slice.ts`, change:

```ts
activity: true,
```

to:

```ts
activity: false,
```

inside `viewerInitialState`.

- [ ] **Step 4: Flip URL param default**

In `packages/core/src/hooks/useParameterisedUi.ts`, replace the activity destructuring default and coercion so activity is opt-in via `true`:

```ts
export const getUiQueryParams = () => {
  const {
    view = TabKind.ThreeD,
    editor = true,
    activity,
    viewer = true,
    tabs = null,
  } = getSafeQueryParams();

  return {
    view: view === "plots" ? TabKind.Analysis : view,
    editor: editor !== "false",
    activity: activity === "true",
    viewer: viewer !== "false",
    tabs: typeof tabs === "string" ? tabs.split(",") : null,
  };
};
```

Leave `ModalShareByLink` `defaultParams.activity: true` alone — share links that emit `activity=true` still open the pane; boot without the param stays collapsed.

- [ ] **Step 5: Re-run tests — expect pass**

Same test command as Step 2. Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/features/viewer/slice.ts packages/core/src/hooks/useParameterisedUi.ts packages/core/src/hooks/useParameterisedUi.spec.ts
git commit -m "Default inspector/activity pane collapsed on boot."
```

---

### Task 2: Inspector header ›› collapse control

**Files:**
- Modify: `packages/core/src/components/ActivityHistory/Inspector/Inspector.tsx`
- Modify: `packages/core/src/components/ActivityHistory/Inspector/Inspector.css`

**Interfaces:**
- Consumes: `hideActivity` from `features/viewer/slice`, `useDispatch` / `useAppDispatch`
- Produces: Collapse button in empty and selected Inspector headers

- [ ] **Step 1: Add collapse button to both header layouts**

Update `AgentInspector` in `Inspector.tsx`:

1. Import `useDispatch` from `react-redux` (or `useAppDispatch` from `features/hooks`) and `hideActivity` from `features/viewer/slice`.
2. Call `const dispatch = useDispatch();` at the top of `AgentInspector`.
3. Extract a small header actions fragment used in **both** the empty and selected branches so the ›› control always appears.

Replace the empty-state return and the selected header so they share this structure:

```tsx
export const AgentInspector: FC = () => {
  const dispatch = useDispatch();
  const [selectedAgentIds, setSelectedAgents] = useRecoilState(
    sceneState.SelectedAgentIds,
  );
  const agentIds = Object.keys(selectedAgentIds).reverse();

  const collapseButton = (
    <button
      type="button"
      aria-label="Collapse inspector"
      className="AgentInspector__Collapse"
      onClick={(evt) => {
        evt.preventDefault();
        dispatch(hideActivity());
      }}
    >
      <span className="codicon codicon-chevron-right" />
      <span className="codicon codicon-chevron-right" />
    </button>
  );

  if (agentIds.length === 0) {
    return (
      <div className="AgentInspector">
        <div className="AgentInspector__Header">
          <h2>Inspector</h2>
          <div className="AgentInspector__HeaderActions">{collapseButton}</div>
        </div>
        <ActivityEmpty>No agent or analysis has been selected.</ActivityEmpty>
      </div>
    );
  }

  const agentData = agentIds.map((id) => <AgentInfo id={id} key={id} />);

  return (
    <div className="AgentInspector">
      <div className="AgentInspector__Header">
        <h2>Inspector</h2>
        <div className="AgentInspector__HeaderActions">
          <button
            type="button"
            onClick={(evt) => {
              evt.preventDefault();
              setSelectedAgents({});
            }}
            className="AgentInspector__ClearSelection"
          >
            Clear
          </button>
          {collapseButton}
        </div>
      </div>
      <div className="AgentInspector__List">{agentData}</div>
    </div>
  );
};
```

- [ ] **Step 2: Style the collapse control**

Append to `Inspector.css`:

```css
.AgentInspector__HeaderActions {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  margin-right: 0.6rem;
}

.AgentInspector__Collapse {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: var(--theme-grey);
  cursor: pointer;
  padding: 0.2rem;
  border-radius: 0.25rem;
}

.AgentInspector__Collapse .codicon {
  font-size: 12px;
  margin: 0;
}

.AgentInspector__Collapse .codicon + .codicon {
  margin-left: -6px;
}

.AgentInspector__Collapse:hover {
  background-color: var(--selected-background-color);
  color: var(--theme-white);
}

/* Clear button margin moved to HeaderActions */
.AgentInspector__ClearSelection {
  margin-right: 0;
}
```

Keep existing `.AgentInspector__ClearSelection` hover/border rules; only override `margin-right` if the old rule still sets `0.6rem` (HeaderActions now owns outer spacing).

- [ ] **Step 3: Manual check (dev server)**

With activity shown (`?activity=true` or View → Show Activity):

1. Empty inspector shows ›› on the right.
2. Click ›› → right pane hides (same as Hide Activity).
3. With agents selected, Clear and ›› both appear; ›› still hides the pane.

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/components/ActivityHistory/Inspector/Inspector.tsx packages/core/src/components/ActivityHistory/Inspector/Inspector.css
git commit -m "Add Inspector header control to collapse the activity pane."
```

---

### Task 3: Slim ‹ edge tab to reopen

**Files:**
- Modify: `packages/core/src/components/HashCore/Viewer/HashCoreViewer.tsx`
- Modify: `packages/core/src/components/HashCore/Viewer/HashCoreViewer.css`

**Interfaces:**
- Consumes: `selectViewerVisible`, raw `viewer.activity` (or equivalent), `showActivity`
- Produces: Edge tab visible iff `viewer === true && activity === false`

- [ ] **Step 1: Render the edge tab**

In `HashCoreViewer.tsx`:

1. Import `useDispatch` (or `useAppDispatch`), `showActivity` from `features/viewer/slice`, and `getViewer` from `features/viewer/selectors` (already exports `getViewer`).
2. Keep using `selectActivityVisible` for `secondaryHidden={!activityVisible}`.
3. Derive edge-tab visibility from viewer slice fields so a fully hidden viewer does not show the tab:

```tsx
import { useDispatch, useSelector } from "react-redux";
import {
  getViewer,
  selectActivityVisible,
} from "../../../features/viewer/selectors";
import { showActivity } from "../../../features/viewer/slice";

// inside HashCoreViewer:
const dispatch = useDispatch();
const activityVisible = useSelector(selectActivityVisible);
const { activity, viewer: viewerVisible } = useSelector(getViewer);
const showInspectorEdgeTab = viewerVisible && !activity;
```

4. Wrap the existing tree so the edge tab can position against the viewer chrome. Make `.HashCoreViewer` the positioning context (CSS in Step 2) and add the button as a sibling of the splitter:

```tsx
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
      <AgentInspectorSplitterLayout />
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
```

- [ ] **Step 2: Style the edge tab**

Append to `HashCoreViewer.css`:

```css
.HashCoreViewer {
  position: relative;
}

.HashCoreViewer__InspectorEdgeTab {
  position: absolute;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  z-index: 5;
  width: 18px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 1px solid var(--theme-border);
  border-right: none;
  border-radius: 4px 0 0 4px;
  background: var(--theme-dark);
  color: var(--theme-grey);
  cursor: pointer;
}

.HashCoreViewer__InspectorEdgeTab:hover {
  background: var(--selected-background-color);
  color: var(--theme-white);
}

.HashCoreViewer__InspectorEdgeTab .codicon {
  font-size: 12px;
}
```

If `.HashCoreViewer` already has rules, merge `position: relative` into the existing block instead of duplicating the selector.

- [ ] **Step 3: Manual check**

1. Cold load (no `activity` query) → pane collapsed, slim ‹ tab mid-right.
2. Click tab → pane opens; tab disappears; ›› visible in header.
3. View → Hide Activity / shortcut → tab returns.
4. With viewer fully hidden (View → Hide Viewer), edge tab must **not** appear.

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/components/HashCore/Viewer/HashCoreViewer.tsx packages/core/src/components/HashCore/Viewer/HashCoreViewer.css
git commit -m "Add slim edge tab to reopen the inspector pane."
```

---

### Task 4: Auto-expand on agent selection

**Files:**
- Modify: `packages/core/src/components/AgentScene/components/AgentMesh.tsx`

**Interfaces:**
- Consumes: `showActivity`
- Produces: Selecting an agent (add path only) dispatches `showActivity`

- [ ] **Step 1: Dispatch showActivity when newly selecting**

In `AgentMesh.tsx`:

1. Import `useDispatch` from `react-redux` and `showActivity` from `features/viewer/slice`.
2. Add `const dispatch = useDispatch();` in the component.
3. In `onPointerDown`, only when **adding** an agent to the selection, dispatch `showActivity` before/after updating Recoil state:

```tsx
onPointerDown={(evt) => {
  const id = evt.instanceId;
  if (id !== undefined && !evt.ctrlKey && evt.button === 0) {
    const [agentId] = renderAgents[id];
    const temp = { ...selectedAgentIds };

    if (Object.prototype.hasOwnProperty.call(selectedAgentIds, agentId)) {
      delete temp[agentId];
      setSelectedAgentIds(temp);
    } else {
      temp[agentId] = true;
      setSelectedAgentIds(temp);
      dispatch(showActivity());
    }
  }
}}
```

Do **not** dispatch on deselect. No other `SelectedAgentIds` writers need changes for click-select (Inspector clear / AgentInfo delete only remove; `resetViewer` resets selection without requiring expand).

- [ ] **Step 2: Manual check**

1. Collapse the pane.
2. Click an agent in the 3D view → pane opens with that agent.
3. Collapse again; click the same agent to deselect (if it was selected while open, collapse, then… use another agent): select agent A while collapsed → opens; collapse; click agent A again to deselect → pane stays collapsed (deselect does not expand or collapse).
4. Clear selection with pane open → pane stays open.

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/components/AgentScene/components/AgentMesh.tsx
git commit -m "Show inspector pane when an agent is newly selected."
```

---

### Task 5: End-to-end verification checklist

**Files:** none (verification only)

- [ ] **Step 1: Run the unit tests from Task 1 again**

```bash
docker compose --profile development exec hash-core-dev yarn workspace @hashintel/core test useParameterisedUi.spec.ts --watchAll=false
```

Expected: PASS.

- [ ] **Step 2: Manual checklist (spec)**

| # | Check | Pass? |
|---|--------|-------|
| 1 | Cold load → inspector collapsed; edge tab visible | |
| 2 | Edge tab opens pane; ›› collapses it | |
| 3 | View menu / ⌘⇧A toggles same state | |
| 4 | Select agent while collapsed → pane opens | |
| 5 | Clear selection with pane open → stays open | |
| 6 | `?activity=true` → starts expanded | |

- [ ] **Step 3: Final commit only if verification found fixes**

If fixes were needed, commit them with a message describing the fix. Otherwise no empty commit.

---

## Spec coverage (self-review)

| Spec requirement | Task |
|------------------|------|
| Collapse whole right pane | 2, 3 (via `hideActivity` / splitter) |
| Header ›› control | 2 |
| Slim edge ‹ tab | 3 |
| Sync with View menu / shortcut | 1–4 (same `viewer.activity`) |
| Auto-expand on new agent select | 4 |
| Start collapsed on boot | 1 |
| `?activity=true` still expands | 1 |
| Deselect does not collapse | 4 (explicit non-dispatch) |
| No new visibility flag | All tasks |
| Option C visuals | 2, 3 |

No placeholders remaining. Types/action names (`hideActivity`, `showActivity`, `getViewer`, `selectActivityVisible`) match existing exports.
