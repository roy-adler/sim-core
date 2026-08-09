# Collapsible Files Sidebar + Editor Pane

**Date:** 2026-08-09  
**Status:** Approved design  
**Components:** `HashCoreAside` (files), `HashCoreEditor` / `HashCoreSection`, `HashCoreMain`

## Problem

The left file tree and the code editor (tabs + Monaco) take horizontal space next to the viewer. View → Hide Editor currently hides only the left aside; the editor pane remains. There is no in-chrome collapse control or left-edge reopen tab matching the Agent Inspector pattern. Users also want both panes collapsed by default on boot.

## Goals

1. Collapse the left file tree **and** the code editor together with one action so the viewer can go full width.
2. Provide ›› collapse controls on both the files actions row and the editor tab bar.
3. Provide a slim left-edge ‹ tab to reopen when collapsed.
4. Keep View → Hide/Show Editor and its keyboard shortcut in sync with the same flag.
5. Auto-expand when the user opens/selects a file.
6. Start collapsed on a normal application boot.
7. Raise the existing Inspector edge tab so it sits in the inspector header band (not vertically centered).

## Non-goals

- Separating file-tree visibility from editor visibility
- Renaming View menu “Editor” labels
- Persisting open/collapsed state in localStorage beyond Redux boot defaults / URL params
- Redesigning the files tree or Monaco chrome beyond the collapse controls

## Approach

Reuse existing Redux `viewer.editor` (`selectEditorVisible`, `toggleEditor`). Add `hideEditor` / `showEditor` mirroring activity. Do **not** introduce a parallel visibility flag.

## Behavior

| Action | Result |
|--------|--------|
| Click ›› on files actions or editor tab bar | `hideEditor` — aside + editor pane hidden |
| Click left-edge ‹ tab | `showEditor` — both restored |
| View → Hide/Show Editor or shortcut | Existing `toggleEditor` (unchanged semantics, now hides both) |
| Open / select a file while collapsed | `showEditor` |
| App boot (no URL override) | Both panes start collapsed |

URL param: default collapsed. Explicit `?editor=true` (and share links that set editor) still open the panes.

When collapsed, `HashCoreMain` keeps `secondaryHidden={!editorVisible}` for the aside. `HashCoreSection` must hide the editor pane as well (`primaryHidden={!editorVisible}` or an equivalent tightening of `selectDisplayEditorSection` so globals/alerts do not keep the editor strip open during a normal collapse). Prefer: **visibility of the combined files+editor UI follows `editorVisible` strictly** for this feature; if product later needs alert-forced editor chrome, that can be a follow-up.

## UI (match inspector option C)

**Collapse controls**

- Small ›› button (two `codicon-chevron-right`, same styling language as `AgentInspector__Collapse`).
- Placed in `HashCoreFiles__Actions` (right) and on the editor `TabActionBar` (right).
- Both dispatch `hideEditor`.
- Include `:focus-visible` styles.

**Left edge tab**

- Slim unlabeled ‹ handle when `!editorVisible`.
- Dispatches `showEditor`.
- Position: top-aligned with the editor/files header band (consistent with the raised inspector tab), not vertically centered.
- Hosted where it remains visible when both panes are hidden (e.g. `HashCoreMain` or `HashCoreSection` chrome around the viewer).

**Inspector edge tab (existing)**

- Change `.HashCoreViewer__InspectorEdgeTab` from `top: 50%; transform: translateY(-50%)` to a top offset aligned with the Inspector header (~same band as `AgentInspector__Collapse`).

## Implementation touchpoints

| Area | Change |
|------|--------|
| `features/viewer/slice.ts` | Initial `editor: false`; add `hideEditor` / `showEditor` |
| `hooks/useParameterisedUi.ts` | Query default: editor on only if `editor=true` |
| `hooks/useParameterisedUi.spec.ts` | Cover editor default like activity |
| `HashCore/Main/HashCoreMain.tsx` (+ CSS) | Edge tab when collapsed; keep aside `secondaryHidden` |
| `HashCore/Section/HashCoreSection.tsx` | Hide editor pane when `!editorVisible` |
| `HashCore/Files/HashCoreFiles.tsx` (+ styles) | ›› collapse in actions row |
| `HashCore/Editor/HashCoreEditor.tsx` (+ styles) or `TabActionBar` | ›› collapse on tab bar |
| `features/files/slice.ts` or call sites of `setCurrentFileId` | `showEditor` on file open/select |
| `Modal/Share/ModalShareByLink.tsx` | `defaultParams.editor: false` if needed for share diffs |
| `HashCore/Viewer/HashCoreViewer.css` | Raise inspector edge tab |

## Testing

Manual:

1. Cold load → files + editor collapsed; left edge tab visible; inspector edge tab top-aligned.
2. Left edge tab / View → Show Editor → both panes open; either ›› collapses both.
3. Shortcut still toggles the same state.
4. Open a file while collapsed → panes open on that file.
5. `?editor=true` → starts expanded.
6. Inspector ›› / edge tab still work; edge tab is higher.

## Out of scope follow-ups

- Persist last editor width / open state in localStorage
- Relabel View menu “Editor” → “Files & Editor”
