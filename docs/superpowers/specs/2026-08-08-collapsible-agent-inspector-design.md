# Collapsible Agent Inspector Pane

**Date:** 2026-08-08  
**Status:** Approved design  
**Component:** `AgentInspector` (viewer right pane)

## Problem

The Agent Inspector occupies the viewer’s right splitter pane and cannot be dismissed from the inspector UI itself. Users who want a wider 3D view must use View → Hide Activity (or the keyboard shortcut). There is also no in-viewer control to reopen the pane once hidden.

## Goals

1. Collapse the entire right pane so the 3D viewer uses full width.
2. Provide an Inspector header control to collapse.
3. Provide a slim right-edge tab to reopen when collapsed.
4. Keep View menu / ⌘⇧A (Hide/Show Activity) in sync with the same visibility flag.
5. Auto-expand the pane when an agent is newly selected.
6. Start collapsed on a normal application boot.

## Non-goals

- Accordion-only collapse of inspector body while keeping pane width
- Persisting collapsed/expanded state across browser sessions beyond current Redux boot defaults / URL params
- Restoring or redesigning Activity History (still commented out in `HashCoreViewer`)
- Renaming “Activity” in the View menu (inspector reuses that visibility flag)

## Approach

Reuse existing Redux `viewer.activity` (selectors `selectActivityVisible`, actions `hideActivity` / `showActivity` / `toggleActivity`). Do not introduce a parallel `inspectorVisible` flag.

## Behavior

| Action | Result |
|--------|--------|
| Click header ›› collapse button | `hideActivity` — secondary pane hidden |
| Click slim ‹ edge tab | `showActivity` — secondary pane restored at prior splitter size |
| View → Hide/Show Activity or shortcut | Existing `toggleActivity` (unchanged) |
| Newly select an agent while collapsed | `showActivity` |
| Deselect agent(s) | Does **not** auto-collapse |
| App boot (no URL override) | Pane starts collapsed |

URL param: default becomes collapsed. Explicit `?activity=true` (and share links that set activity) still open the pane.

## UI (option C)

**Expanded header**

- Small ›› icon button on the right of the Inspector header (alongside Clear when agents are selected).
- Present in both empty and selected states.
- Dispatches `hideActivity`.

**Collapsed edge tab**

- Slim mid-height unlabeled ‹ handle on the right edge of the viewer area.
- Visible only when the activity/inspector pane is hidden (and the viewer itself is visible).
- Dispatches `showActivity`.
- Dark-theme styling consistent with existing splitter/chrome (no floating pill, no rotated label).

## Implementation touchpoints

| Area | Change |
|------|--------|
| `features/viewer/slice.ts` | Initial `activity: false` |
| `hooks/useParameterisedUi.ts` | Query default: activity off unless `activity=true` |
| `ActivityHistory/Inspector/Inspector.tsx` + CSS | Header ›› collapse control |
| `HashCore/Viewer/HashCoreViewer.tsx` + CSS | Render edge tab when `!activityVisible` |
| `AgentScene/components/AgentMesh.tsx` | On newly selecting an agent, `dispatch(showActivity)` |

Other selection entry points that set `SelectedAgentIds` should also call `showActivity` if they can select while the pane is collapsed (keep behavior consistent).

ProcessChart’s existing hide-on-mount / restore-on-unmount of activity remains as-is.

## Testing

Manual:

1. Cold load → inspector pane collapsed; edge tab visible.
2. Edge tab / View → Show Activity → pane opens; ›› collapses it again.
3. Shortcut still toggles the same state.
4. Select an agent while collapsed → pane opens with that agent.
5. Clear selection with pane open → pane stays open.
6. `?activity=true` → starts expanded.

## Out of scope follow-ups

- Persist last size / open state in localStorage
- Relabel View menu “Activity” → “Inspector”
