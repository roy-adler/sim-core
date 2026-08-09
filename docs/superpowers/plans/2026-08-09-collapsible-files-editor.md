# Collapsible Files Sidebar + Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Collapse the left file tree and code editor together via ›› controls and a left-edge ‹ tab, default collapsed on boot, synced with `viewer.editor`, auto-expanding on file open; also raise the Inspector edge tab to the header band.

**Architecture:** Reuse Redux `viewer.editor` (`selectEditorVisible`, `toggleEditor`). Add `hideEditor` / `showEditor`. Hide both `HashCoreAside` (existing) and the editor pane in `HashCoreSection` when `!editorVisible`. Match Inspector option-C UI. Watch `currentFileId` from the DOM tree to dispatch `showEditor` after user-driven selection (skip initial mount).

**Tech Stack:** React 16, Redux Toolkit, react-redux, existing `codicon` icons, Docker for yarn/tests per workspace rules.

## Global Constraints

- Reuse `viewer.editor` — do **not** add a parallel visibility flag
- Combined files+editor visibility follows `editorVisible` strictly for pane hide/show
- UI option C: ›› collapse buttons; slim unlabeled left-edge ‹ tab (top-aligned)
- Prefer Docker for yarn/jest (`docker compose --profile development`)
- Spec: `docs/superpowers/specs/2026-08-09-collapsible-files-editor-design.md`
- Do not rename View menu “Editor” labels
- Mirror Inspector control styling (`AgentInspector__Collapse` language)

## File map

| File | Responsibility |
|------|----------------|
| `packages/core/src/features/viewer/slice.ts` | `editor: false`; `hideEditor` / `showEditor` |
| `packages/core/src/hooks/useParameterisedUi.ts` | URL default: editor on only if `editor=true` |
| `packages/core/src/hooks/useParameterisedUi.spec.ts` | Editor query-param tests |
| `packages/core/src/components/Modal/Share/ModalShareByLink.tsx` | `defaultParams.editor: false` |
| `packages/core/src/components/HashCore/Section/HashCoreSection.tsx` | `primaryHidden={!editorVisible}` |
| `packages/core/src/components/HashCore/Files/HashCoreFiles.tsx` (+ scss) | ›› in actions row |
| `packages/core/src/components/HashCore/Editor/HashCoreEditor.tsx` (+ css if needed) | ›› in TabActionBar actions |
| `packages/core/src/components/HashCore/Main/HashCoreMain.tsx` (+ css) | Left edge tab + auto-expand on file id change |
| `packages/core/src/components/HashCore/Viewer/HashCoreViewer.css` | Raise Inspector edge tab |

---

### Task 1: Default collapsed + hide/showEditor + URL + share

**Files:**
- Modify: `packages/core/src/features/viewer/slice.ts`
- Modify: `packages/core/src/hooks/useParameterisedUi.ts`
- Modify: `packages/core/src/hooks/useParameterisedUi.spec.ts`
- Modify: `packages/core/src/components/Modal/Share/ModalShareByLink.tsx`

**Interfaces:**
- Produces: `hideEditor`, `showEditor` actions; `getUiQueryParams().editor` false when param absent, true only when `editor=true`
- Consumes: existing `toggleEditor`, `initialiseView`

- [ ] **Step 1: Extend failing tests for editor default**

Append to `useParameterisedUi.spec.ts` (keep existing activity tests):

```ts
describe("getUiQueryParams editor default", () => {
  afterEach(() => {
    setSearch("");
  });

  it("defaults editor to false when param is absent", () => {
    setSearch("");
    expect(getUiQueryParams().editor).toBe(false);
  });

  it("enables editor when editor=true", () => {
    setSearch("editor=true");
    expect(getUiQueryParams().editor).toBe(true);
  });

  it("keeps editor false when editor=false", () => {
    setSearch("editor=false");
    expect(getUiQueryParams().editor).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests — expect editor cases to fail**

Use the durable isolated Jest harness from prior work if the standard Docker jest command hits the Babel mismatch:

```bash
docker compose --profile development cp ".superpowers/sdd/jest.parameterised-ui.config.cjs" "hash-core-dev:/tmp/jest.parameterised-ui.config.cjs"
docker compose --profile development exec -T -w /app/packages/core hash-core-dev yarn jest src/hooks/useParameterisedUi.spec.ts --config /tmp/jest.parameterised-ui.config.cjs --runInBand --watchAll=false
```

If the config file is missing, recreate it under `.superpowers/sdd/` matching Task 5 of the inspector plan (ts-jest, `babelConfig: false`, mock `../features/viewer/slice`). Expected: activity tests still pass; editor “absent ⇒ false” fails (still defaults true).

- [ ] **Step 3: Flip Redux initial `editor` and add hide/show**

In `viewerInitialState`, set `editor: false`.

Add reducers next to `toggleEditor`:

```ts
hideEditor(state) {
  if (state.editor) {
    state.editor = false;
  }
},

showEditor(state) {
  if (!state.editor) {
    state.editor = true;
  }
},
```

Export `hideEditor` and `showEditor` in the `actions` destructuring alongside `toggleEditor`.

- [ ] **Step 4: Flip URL param default**

In `getUiQueryParams`, change editor to opt-in (same pattern as activity):

```ts
export const getUiQueryParams = () => {
  const {
    view = TabKind.ThreeD,
    editor,
    activity,
    viewer = true,
    tabs = null,
  } = getSafeQueryParams();

  return {
    view: view === "plots" ? TabKind.Analysis : view,
    editor: editor === "true",
    activity: activity === "true",
    viewer: viewer !== "false",
    tabs: typeof tabs === "string" ? tabs.split(",") : null,
  };
};
```

- [ ] **Step 5: Share modal default**

In `ModalShareByLink.tsx`, set `defaultParams.editor` from `true` to `false` so “show editor” can emit `editor=true` in share URLs.

- [ ] **Step 6: Re-run tests — expect pass**

Same jest command as Step 2. Expected: all 6 tests PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/features/viewer/slice.ts packages/core/src/hooks/useParameterisedUi.ts packages/core/src/hooks/useParameterisedUi.spec.ts packages/core/src/components/Modal/Share/ModalShareByLink.tsx
git commit -m "Default files/editor panes collapsed; add hideEditor/showEditor."
```

---

### Task 2: Hide editor pane when editor is collapsed

**Files:**
- Modify: `packages/core/src/components/HashCore/Section/HashCoreSection.tsx`

**Interfaces:**
- Consumes: `selectEditorVisible`
- Produces: editor pane hidden iff `!editorVisible` (strict)

- [ ] **Step 1: Drive `primaryHidden` from `editorVisible`**

In `HashCoreSection.tsx`:

1. Remove `selectDisplayEditorSection` import and usage (only used here).
2. Keep `editorVisible` from `selectEditorVisible`.
3. Change:

```tsx
primaryHidden={!displayEditorSection}
```

to:

```tsx
primaryHidden={!editorVisible}
```

Leave `secondaryInitialSize={editorVisible ? 58 : vertical ? 65 : 75}` as-is (or simplify later; not required).

- [ ] **Step 2: Manual check**

With `?editor=false` or after Hide Editor: left aside **and** editor tabs/Monaco gone; viewer fills the section. With Show Editor: both return.

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/components/HashCore/Section/HashCoreSection.tsx
git commit -m "Hide editor pane when viewer.editor is false."
```

---

### Task 3: ›› collapse controls on files row and editor tab bar

**Files:**
- Modify: `packages/core/src/components/HashCore/Files/HashCoreFiles.tsx`
- Modify: `packages/core/src/components/HashCore/Files/HashCoreFiles.scss` (or a small adjacent css import)
- Modify: `packages/core/src/components/HashCore/Editor/HashCoreEditor.tsx`
- Optionally add styles to existing editor CSS / reuse shared class names

**Interfaces:**
- Consumes: `hideEditor`
- Produces: identical ›› affordances in both places

- [ ] **Step 1: Add collapse button to `HashCoreFiles` actions**

Import `hideEditor` from `features/viewer/slice`. After the existing action items in `<ul className="HashCoreFiles__Actions">`, append a right-aligned control (use `HashCoreFilesHeaderAction` with `position="right"` if that API fits, or a plain button):

```tsx
<button
  type="button"
  aria-label="Collapse files and editor"
  className="HashCoreFiles__Collapse"
  onClick={(evt) => {
    evt.preventDefault();
    dispatch(hideEditor());
  }}
>
  <span className="codicon codicon-chevron-right" />
  <span className="codicon codicon-chevron-right" />
</button>
```

Ensure `dispatch` is already available in the component (it is).

Style `.HashCoreFiles__Collapse` like `.AgentInspector__Collapse` (transparent button, stacked chevrons with negative margin, hover + `:focus-visible`).

Make `.HashCoreFiles__Actions` a flex row with `justify-content: space-between` or margin-left auto on the collapse button so it sits on the right.

- [ ] **Step 2: Add collapse action to editor `TabActionBar`**

In `HashCoreEditor.tsx`, import `hideEditor`. Push an extra entry onto the `actions={[...]}` array:

```tsx
<button
  type="button"
  aria-label="Collapse files and editor"
  className="HashCoreEditor__Collapse tab-button"
  onClick={(evt) => {
    evt.preventDefault();
    dispatch(hideEditor());
  }}
  key="collapse-editor"
>
  <span className="codicon codicon-chevron-right" />
  <span className="codicon codicon-chevron-right" />
</button>
```

Reuse the same stacked-chevron CSS (shared class or duplicate minimal rules under `.HashCoreEditor__Collapse`).

- [ ] **Step 3: Manual check**

With panes open (`?editor=true`): both ›› controls visible; either hides aside + editor.

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/components/HashCore/Files/HashCoreFiles.tsx packages/core/src/components/HashCore/Files/HashCoreFiles.scss packages/core/src/components/HashCore/Editor/HashCoreEditor.tsx
git commit -m "Add collapse controls to files sidebar and editor tab bar."
```

(Include any new/edited CSS files in the commit.)

---

### Task 4: Left edge tab to reopen

**Files:**
- Modify: `packages/core/src/components/HashCore/Main/HashCoreMain.tsx`
- Modify: `packages/core/src/components/HashCore/Main/HashCoreMain.css`

**Interfaces:**
- Consumes: `selectEditorVisible`, `showEditor`
- Produces: edge tab visible iff `!editorVisible`

- [ ] **Step 1: Render the edge tab**

`HashCoreMain` already has `position: relative`. Add:

```tsx
import { useDispatch, useSelector } from "react-redux";
import { showEditor } from "../../../features/viewer/slice";
// selectEditorVisible already imported

const dispatch = useDispatch();
const editorVisible = useSelector(selectEditorVisible);

// in JSX, sibling of WrappedSplitterLayout inside <main>:
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
```

Use `codicon-chevron-right` (pointing into the content from the left edge) or `codicon-chevron-left` if the tab sits on the left border facing inward — match visual sense: tab on the **left** edge of the main area, chevron indicating expand. Prefer chevron-right (expand toward the right into the layout).

Keep existing `secondaryHidden={!editorVisible}` on the splitter.

- [ ] **Step 2: Style top-aligned left edge tab**

```css
.HashCoreMain__EditorEdgeTab {
  position: absolute;
  left: 0;
  top: 2.2rem; /* align with files/editor header band */
  z-index: 5;
  width: 18px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 1px solid var(--theme-border);
  border-left: none;
  border-radius: 0 4px 4px 0;
  background: var(--theme-dark);
  color: var(--theme-grey);
  cursor: pointer;
}

.HashCoreMain__EditorEdgeTab:hover,
.HashCoreMain__EditorEdgeTab:focus-visible {
  background: var(--selected-background-color);
  color: var(--theme-white);
}

.HashCoreMain__EditorEdgeTab .codicon {
  font-size: 12px;
}
```

Tune `top` if needed so it lines up with the files actions / tab bar height (~34px row).

- [ ] **Step 3: Manual check**

Cold load / Hide Editor → left tab visible; click → both panes open; tab disappears.

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/components/HashCore/Main/HashCoreMain.tsx packages/core/src/components/HashCore/Main/HashCoreMain.css
git commit -m "Add left edge tab to reopen files and editor panes."
```

---

### Task 5: Auto-expand when a file is opened/selected

**Files:**
- Modify: `packages/core/src/components/HashCore/Main/HashCoreMain.tsx`

**Interfaces:**
- Consumes: `selectCurrentFileId` (or equivalent from `features/files/selectors`), `showEditor`
- Produces: after mount, any change of `currentFileId` to a new truthy id dispatches `showEditor`

- [ ] **Step 1: Watch current file id**

Import `useEffect`, `useRef`, `selectCurrentFileId` (confirm export name in `features/files/selectors` — use the existing selector that powers the editor tabs).

```tsx
const currentFileId = useSelector(selectCurrentFileId);
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
```

Skip the first effect run so boot with a default open file does **not** expand. Subsequent user-driven `setCurrentFileId` changes expand.

- [ ] **Step 2: Manual check**

1. Boot collapsed with a default file already “current” → stay collapsed.
2. Click a different file in the tree after expanding once, collapse again, then… (with panes collapsed the tree is hidden — use View → Show Editor, open file A, collapse, then use any remaining entry point that sets current file, **or** expand via edge tab, open file, collapse, and verify programmatic paths). Practical path: while collapsed, use a command/palette/search that opens a file if available; otherwise expand, note id, collapse, and trigger `setCurrentFileId` via clicking a file after briefly showing editor is not ideal.

   Minimum bar: with panes open, select file B (id changes) while already open should call `showEditor` harmlessly. With panes collapsed, use View menu to confirm tree works after expand. Prefer also: collapse, then from viewer-only state use keyboard/search “open file” if the app has one that dispatches `setCurrentFileId`.

   If no collapsed-state open path exists besides the tree, document that auto-expand is verified by dispatching through the effect when `currentFileId` changes after mount (unit-style reasoning) and manually by: Show Editor → open file → Hide Editor → Show Editor again is insufficient. Better: temporarily use React DevTools or a one-line console — **do not leave debug code**. Acceptable verification: open project, stay collapsed on boot (file id set once, skipped); then Show Editor, click another file (effect fires `showEditor` while already visible — no throw); collapse; use edge tab. Auto-expand on open while collapsed is covered when any UI that works while collapsed sets the file id (e.g. future deep links). If `HashCoreFilesListItemFile` is only reachable when expanded, note that in the report as acceptable given chrome constraints.

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/components/HashCore/Main/HashCoreMain.tsx
git commit -m "Show files and editor when the current file selection changes."
```

---

### Task 6: Raise Inspector edge tab

**Files:**
- Modify: `packages/core/src/components/HashCore/Viewer/HashCoreViewer.css`

**Interfaces:**
- Visual only

- [ ] **Step 1: Top-align the inspector edge tab**

Replace:

```css
.HashCoreViewer__InspectorEdgeTab {
  ...
  top: 50%;
  transform: translateY(-50%);
  ...
}
```

with:

```css
.HashCoreViewer__InspectorEdgeTab {
  ...
  top: 2.2rem; /* align with AgentInspector header / collapse control */
  transform: none;
  ...
}
```

Match the left editor edge tab’s `top` if both should share the same band.

- [ ] **Step 2: Manual check**

Collapse inspector → edge tab sits near the top of the viewer, roughly level with where the Inspector ›› control was.

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/components/HashCore/Viewer/HashCoreViewer.css
git commit -m "Raise inspector edge tab to the header band."
```

---

### Task 7: End-to-end verification

**Files:** none (verification only)

- [ ] **Step 1: Re-run focused unit tests**

Same isolated jest command as Task 1. Expected: 6/6 PASS.

- [ ] **Step 2: Manual checklist (spec)**

| # | Check | Pass? |
|---|--------|-------|
| 1 | Cold load → files+editor collapsed; left edge tab visible; inspector edge tab top-aligned | |
| 2 | Left edge tab / View → Show Editor opens both; either ›› collapses both | |
| 3 | View shortcut still toggles same state | |
| 4 | Changing current file after mount dispatches showEditor (no canvas/redux errors) | |
| 5 | `?editor=true` starts expanded | |
| 6 | Inspector collapse / edge tab still work; edge tab higher | |

- [ ] **Step 3: Commit only if fixes were needed**

No empty commit.

---

## Spec coverage (self-review)

| Spec requirement | Task |
|------------------|------|
| Collapse tree + editor together | 2, 3, 4 |
| ›› on files + editor tab bar | 3 |
| Left edge ‹ tab | 4 |
| Sync View menu / shortcut | 1–4 (`viewer.editor`) |
| Auto-expand on file open/select | 5 |
| Start collapsed on boot | 1 |
| `?editor=true` expands | 1 |
| Raise inspector edge tab | 6 |
| Share link editor default | 1 |
| No new visibility flag | All |

No placeholders remaining. Action names (`hideEditor`, `showEditor`, `selectEditorVisible`) match the intended slice exports.
