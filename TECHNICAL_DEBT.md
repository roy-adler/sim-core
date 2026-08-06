# Technical Debt Tracking

**Generated:** 2026-08-06  
**Total Items:** ~320+ debt markers across codebase

This document catalogs all identified "Baustellen" (construction sites) - areas with workarounds, unstable code, and technical debt that need cleanup.

---

## 🔴 High Priority / Critical

### 1. Fix Broken and Disabled Test Suites

**Impact:** Reduced test coverage, false sense of security from passing CI

#### Critical Issues

**Blocking e2e tests:**
- **File:** `packages/core/tests/e2e/globals.test.js:23`
- **Issue:** `describe.only` left in code - prevents other e2e suites from running
- **Action:** Remove `describe.only` immediately

**Completely disabled component tests** (all fail with `WEBPACK_PUBLIC_PATH is not defined`):
- `packages/core/src/components/Modal/Experiments/ExperimentModal.spec.tsx` (lines 1-22)
- `packages/core/src/components/HashCore/Files/ListItemFile/HashCoreFilesListItemFile.spec.tsx`
- `packages/core/src/components/HashCore/Files/ListItemFolder/HashCoreFilesListItemFolder.spec.tsx`

**Analysis tests for 3D plots:**
- **File:** `packages/core/src/features/analysis/analysisJsonValidation.test.ts:1241-1437`
- **Issue:** Many `test.skip.each` for contour/heatmap/line3d/scatter3d + `test.todo` for Z data points
- **Comment:** "FIXME: These tests are disabled since we still don't support them."

**Empty/stub test files:**
- `TabbedEditorPanel.spec.tsx`
- `TabbedEditorDiffPanel.spec.tsx`
- `FileBannerWrapper.spec.tsx`
- Various TODOs about mocking monaco/engine-web

#### Action Items
- [ ] Remove `describe.only` from globals.test.js
- [ ] Fix WEBPACK_PUBLIC_PATH issue for modal/file component tests
- [ ] Either implement 3D plot support or remove the disabled tests
- [ ] Complete stub test files or remove them

---

### 2. Remove Migration Shims and Feature Kill-Switches

**Impact:** Hidden/disabled features confusing users, unclear "real" behavior

#### Critical Kill-Switches

**Secondary pane always hidden:**
```typescript
// packages/core/src/components/HashCore/Aside/HashCoreAside.tsx:20
secondaryHidden={!canSave || true} // migration shim.
```
The `|| true` always hides the secondary pane regardless of `canSave`.

**GitHub commit/save disabled:**
```typescript
// packages/core/src/features/thunks.ts:100
// migration shim -- disable these API requests until they can talk to github.
```
Entire GitHub commit path is commented out.

#### Migration Shims (~19 locations)

| File | Line | Note |
|------|------|------|
| `features/project/slice.ts` | 50, 114 | Unused fn "until we get github sync back" |
| `features/project/utils.ts` | 104 | Deprecate old localStorage guards |
| `features/files/slice.ts` | 182 | Migration shim |
| `features/files/selectors.ts` | 263 | Force dependencies to act as shared behaviors |
| `features/analytics.ts` | 68 | Migration shim |
| `ToastProjectPreview.tsx` | 64 | Migration shim |
| `util/api/queries/` | various | Bootstrap loads BUILTIN_SIMULATIONS into localStorage |
| `HashRouter/Effect/templates.ts` | 7 | Migration shim |
| `HashRouter/Effect/NewProject.tsx` | 38 | Migration shim |
| `HashCore/Resources/SearchableIndex/hooks.ts` | 45 | Migration shim |

#### Action Items
- [ ] Remove `|| true` hack in HashCoreAside
- [ ] Either restore or permanently remove GitHub commit functionality
- [ ] Clean up all migration shims marked in code
- [ ] Update documentation on new architecture
- [ ] Remove deprecated localStorage guards

---

## 🟡 Medium Priority

### 3. Fix Redux TypeScript Errors (~76 @ts-expect-error suppressions)

**Impact:** Type safety completely bypassed, bugs hidden, poor developer experience

#### Problem
Systemic broken AppDispatch typing across the codebase with ~76 `@ts-expect-error` suppressions, mostly with comment "redux problems". This indicates a core typing issue, not one-off bugs.

#### Hotspots

**Components:**
- `HashRouter/Effect/{Fork,Project,NewProject}.tsx`
- Modal components: `Signin`, `NewDataset`, `ReleaseBehavior`, specs
- `ModalShareByLink` / `ModalShareEmbed` - "Genuine type error here, please fix" (lines 87, 165, 74, 135)

**Features:**
- `features/project/{slice,thunks}.ts`
- `features/middleware/{queue,tracking}.ts`
- `features/files/hooks.ts`

**Other:**
- `ExperimentModal.tsx:518, 594` - "tech debt"
- Analysis specs - "Redux types need to be repaired"
- `util/resizeObserverPromise.ts:4,9` - "Todo: Clean out this polyfill"
- `IconLoading.tsx:2` - "unclear what the issue is here"

#### Root Cause
The pattern `//@ts-expect-error redux problems` appears dozens of times, suggesting:
1. AppDispatch type is incorrectly defined or imported
2. Middleware typing is broken
3. Thunk return types don't match actual usage

#### Action Items
- [ ] Investigate and fix root AppDispatch typing
- [ ] Update middleware type definitions
- [ ] Fix thunk return types
- [ ] Remove all `@ts-expect-error` suppressions one by one
- [ ] Add tests to prevent regression

---

### 4. Clean Up Simulator Subsystem Technical Debt (~20 markers)

**Impact:** Unclear behavior, potential bugs, difficult to maintain

#### Files Affected
- `packages/core/src/features/simulator/simulate/slice.ts` (~20 markers)
- `thunks.ts`
- `queueExperiment.ts`
- `analysisMiddleware.ts`
- `provider.ts`
- `historicCloudExperimentProvider.ts`
- `web-runner.ts`
- `cloud-runner.ts`

#### Key Issues

**Uncertain Logic:**
```typescript
// slice.ts:181-182: "this should not be possible"
// slice.ts:986: "this seems wrong"
// slice.ts:1141: TODO: Don't know why errorMessage ends up being undefined
// slice.ts:1551: "look into if this is correct"
```

**Architecture Debt:**
```typescript
// thunks.ts:60: @todo reimplement this
// thunks.ts:211-322: Middleware vs thunk architecture debt
// queueExperiment.ts:227-231: Should rewrite local experimenter as event stream
// queueExperiment.ts:578: Rewrite handler to be entirely stream-based
// analysisMiddleware.ts:161-163: "leaving it as a middleware for now" / rewrite as subscriber
```

**Workarounds:**
```typescript
// cloud-runner.ts:260-265
/**
 * The websocket doesn't currently tell us when the experiment has
 * actually started calculating so we'll just lie for now and say
 * it has begun as soon as we know it exists
 */
```

**Dead Code:**
```typescript
// cloud-runner.ts:47,55,74: Dead path; subscription not closing connection
// provider.ts:36,66: Cloud & web share same runner "for now"
```

#### Action Items
- [ ] Review and fix uncertain logic sections
- [ ] Decide on middleware vs thunk architecture
- [ ] Rewrite experiment queue as event stream
- [ ] Fix websocket status reporting
- [ ] Remove dead code paths
- [ ] Clean up property reset logic (slice.ts:73)

---

### 5. Remove 2021 Release Shortcuts and Old TODOs

**Impact:** Dead/duplicate code in production, unclear what's supported

#### Critical: Duplicated Plot Component (2021-03-09)

**File:** `packages/core/src/components/PlotViewer/OutputPlotCollated.tsx:1-2`
```typescript
// @TODO: This is an UGLY duplication of OutputPlot that we had to make
// to release this. Burn this file soon (written on 2021-03-09)
```
**Age:** 5+ years old  
**Action:** Delete and consolidate with OutputPlot

#### Other 2021 Debt

**Simplified metrics function (2021-01-21):**
```typescript
// packages/core/src/components/Modal/Analysis/ModalOutputMetrics.tsx:167-169
// TODO: we simplified this function to get on time with the release,
// but leaving it here because we will update it after the board meeting (2021-01-21)
```

**Analysis features:**
- **File:** `packages/core/src/components/Modal/Analysis/OutputPlot.tsx:150-156,245`
  - Contour/heatmap commented out
  - Overlaid plots unimplemented
  - No pure-Z 3D support

**Discord widget (2024-07-02):**
```typescript
// packages/core/src/components/DiscordWidget/DiscordWidget.tsx:17-20
/**
 * On 2024-07-02 our Discord was deprecated. As a temporary patch, we're simply
 * changing the link here to point to the discussions page...
 */
```
Should properly rename/refactor component.

**ProcessChart (temp post-deploy):**
- **File:** `packages/core/src/components/ProcessChart/ProcessChart.tsx:193`
- Temporary workaround waiting for deployment.

#### Action Items
- [ ] **Priority:** Delete OutputPlotCollated and consolidate
- [ ] Review and properly implement ModalOutputMetrics
- [ ] Complete or remove commented-out plot features
- [ ] Rename DiscordWidget to DiscussionsWidget
- [ ] Remove ProcessChart temporary workaround
- [ ] Search for other 2020-2022 dated TODOs

---

### 6. Fix Analysis and Plotting Incomplete Features

**Impact:** Users can't use certain plot types, validation errors confusing

#### Incomplete Features

**Missing plot types:**
- **File:** `packages/core/src/components/Modal/Analysis/OutputPlot.tsx:150-156,245`
  - Contour plots commented out
  - Heatmap commented out
  - Overlaid plots unimplemented
  - No pure-Z 3D plots

**Disabled tests:**
- **File:** `packages/core/src/features/analysis/analysisJsonValidation.test.ts:1241-1437`
  - "FIXME: These tests are disabled since we still don't support them."
  - Many `test.skip.each` for 3D plot types

#### Type and Validation Issues

**Uncertain types:**
- `analysisJsonTypes.ts:69` - "TODO: why is this a number?"
- `analysisJsonTypes.ts:120` - Force bar charts to be arrays

**Incomplete validation:**
- `analysisJsonValidation.ts:69, 120` - Missing error types
- `analysisJsonValidation.ts:280` - Unvalidated `by` field
- `analysisJsonValidation.ts:288` - Layout units validation missing
- `analysisJsonValidation.ts:338` - `@ts-expect-error FIXME: this is a cryptic error`

**Error handling gaps:**
- `errors.ts:25` - "TODO: remove when we are no longer using this" (dead type still in use)
- `errors.ts:483-501` - Missing xName/yName; Z-data component errors

**Plot validation:**
- `plotValidations.ts:330` - `@ts-expect-error fixme`
- `plotValidations.ts:413` - Untested case
- `plotValidations.ts:421` - Validators return only first error

#### UI/UX Issues

- `AnalysisViewer.tsx:44-61` - Uses `any` type, debounce questions, collapse state
- `ModalPlots.tsx:328` - "TODO: clean this up"
- `utils.ts:17` - "TODO: fix types"

#### Action Items
- [ ] Complete or remove commented-out plot types
- [ ] Either implement 3D plot support or remove features
- [ ] Complete validation for all plot types
- [ ] Fix type errors and uncertain types
- [ ] Improve error messages and handling
- [ ] Clean up AnalysisViewer component
- [ ] Make validators return all errors, not just first

---

## 🔵 Low Priority

### 7. Address Explicit HACKs and Workarounds

**Impact:** Code quality, maintainability, future confusion

#### Code HACKs

**Agent visibility hack:**
```typescript
// packages/core/src/util/builtinSimulations.ts:265
// HACK: If uncommented, the message agents disapper from visual representation
```
Built-in sim behavior hides message agents via `position = null`.

**Safari storage workaround:**
- **File:** `packages/core/src/components/HashCore/HashCore.tsx:64-68`
- WebKit fires storage events in same tab, requires `document.hasFocus() ||` workaround.

**Mapbox import bug:**
```typescript
// packages/core/vite.config.ts:61
// mapgl bug workaround
```
Upstream mapbox-gl import bug requiring alias to `react-mapbox-gl/lib`.

**Pyodide JSDoc hack:**
```javascript
// packages/engine-web/.../pyodide.js:585
Module.version = ""; // Hack to make jsdoc behave
```

#### Uncertain/Tech Debt Patterns

**LocalStorage error swallowing:**
```typescript
// packages/core/src/hooks/useLocalStorage/utils.ts:40-56
// This catch is tech debt -- unclear why it exists.
```
Appears 3 times in `setItem` / `removeItem` / `clear` - swallows all storage errors.

**Broken query params:**
```typescript
// packages/core/src/util/getSafeQueryParams.ts:7-11
/**
 * getQueryParams in hook router is broken because it never reparses the query
 * string when the URL changes...
 */
```

**Agent scene cleanup:**
```typescript
// packages/core/src/components/AgentScene/AgentScene.tsx:99-104
/**
 * ... I'm not sure I fully understand what's going on here, so we
 * should come back to this later to clean up properly
 */
```

**Unknown prop:**
```typescript
// packages/core/src/components/AgentScene/components/Controls.tsx:52
// Not sure why the "FOV" prop doesn't exist :hmm:
```

#### Engine/Rust Workarounds

- `packages/engine/src/behaviors/collision.rs:10` - Elasticity % from globals not wired
- `packages/engine/src/behaviors/mod.rs:153,355` - Static array "fine for now"
- `packages/engine/src/behaviors/physics.rs:4` - Simple Euler "for now"
- `packages/engine-types/src/vec.rs:73` - "I'm not sure if we want truncation vs rounding..."
- `packages/engine-web/rust/behavior.rs:55-59` - `unsafe impl Send/Sync` because WASM single-threaded

#### Rust HACKs

**Schema v0.2 debt:**
```rust
// libs/deer/src/error/type.rs:32-33
// remove this hack
```
`ExpectNone` special-casing.

#### Action Items
- [ ] Investigate and properly fix message agent visibility
- [ ] Document Safari storage workaround as permanent if needed
- [ ] Check if mapbox bug is fixed upstream
- [ ] Understand localStorage error handling requirements
- [ ] Fix or document query params issue
- [ ] Clean up AgentScene uncertainty
- [ ] Review and improve Rust "for now" implementations
- [ ] Add issue references or ADRs for known limitations

---

### 8. Complete or Document libs/deer Unfinished Implementation

**Impact:** Unclear library status (WIP vs. stable), potential runtime panics

#### Unimplemented Functions

**Struct visitor tests:**
```rust
// libs/deer/tests/test_struct_visitor.rs
// Lines 137, 149, 161
unimplemented!("planned in follow up PR")

// Line 423
#[ignore = "not yet implemented"]
```

**Enum visitor tests:**
```rust
// libs/deer/tests/test_enum_visitor.rs
// Lines 494, 513, 532
unimplemented!()

// Line 188: TODO: this is wrong
```

**Value tests:**
```rust
// libs/deer/tests/test_value.rs
// Lines 232, 476-477
// deserialize/none/string not implemented
```

#### Schema Incompleteness

**libs/deer/src/schema.rs:**
- Lines 40-41, 264, 281: Temporary types until stdlib/`Describe`
- Line 436: Untyped schema
- Line 459: Binary not valid JSON-schema

**Other:**
- `helpers.rs:106` - Cannot model absence of value "for now"
- `error/mod.rs:14` - Schema types for errors planned for 0.2
- `macros.rs:275` - Cannot express OR, defaults instead
- `option.rs:42-45` - Inaccurate reflection, fallback to `T`
- `error/type.rs:32-33` - "remove this hack" for `ExpectNone` special-casing
- `deer-macros/src/lib.rs:1` - "Intentionally left blank for now!"
- `desert/src/token.rs:5-6,222-225` - Missing tests/`Copy`

#### Action Items
- [ ] Implement or remove `unimplemented!()` functions
- [ ] Fix or remove ignored tests
- [ ] Complete schema v0.2 implementation
- [ ] Document what's intentionally incomplete vs. needs work
- [ ] Decide if deer is production-ready or experimental

---

### 9. Clean Up Build Configuration Workarounds

**Impact:** Bundle size, build complexity, developer confusion

#### Vite Config Issues

**File:** `packages/core/vite.config.ts`

**Lodash aliases (lines 55-62):**
```typescript
// should investigate removing
```
Multiple lodash method aliases - should check if still needed.

**Mapbox workaround (line 61):**
```typescript
// mapgl bug workaround
```
Alias to `react-mapbox-gl/lib` for upstream import bug.

**CommonJS shims (line 8):**
```typescript
// commonJS adaptor shims
```

#### Missing Mapbox Key Handling

**File:** `packages/core/src/components/GeospatialMap/GeospatialMap.tsx:64-91`
```typescript
// If there's no Mapbox API key, we'll crash instantiating the MapComponent.
// So instead return a placeholder GeospatialMap with user instructions.
...
export const GeospatialMap: FC<GeospatialMapProps> = !MapComponent
  ? GeospatialMapPlaceholder
```
Should handle missing API key more gracefully.

#### Action Items
- [ ] Audit lodash usage and remove unnecessary aliases
- [ ] Check if mapbox bug is fixed in recent versions
- [ ] Review if CommonJS shims are still needed (ESM migration?)
- [ ] Improve Mapbox API key error handling
- [ ] Document any workarounds that must remain

---

### 10. General TODO/FIXME Cleanup Pass

**Impact:** Technical debt accumulation, forgotten improvements

#### UI Component TODOs

**Fancy components:**
- `FancyButton.tsx:15` - "massively simplify"
- `FancyAnchor.tsx:13` - Duplication issue

**Process Chart:**
- `ProcessChart.tsx:84` - Bring plugin into hCore
- `ProcessChart.tsx:193` - Remove post-deploy temp workaround

**Resource List:**
- `ResourceListItemPopup.tsx:233` - Reimplement dependencies list

**Tour:**
- `Tour/Step/util.tsx:25-27` - "Rewrite this"
- Animate-out behavior unknown

#### Feature TODOs

**Scopes incomplete:**
- **File:** `packages/core/src/features/scopes/scopes.ts`
- ~10 TODOs throughout - several "replace with scopes" comments

**Files:**
- `files/utils.ts:49,382-383` - Remove/type/clean
- `behaviorKeys.ts:237-238` - Invalid JSON handling

**Other:**
- Activity History - Duplicated context menus, delete-in-progress experiments
- `middleware/localStorage.ts:21` - Proper versioning
- `examples/slice.ts:2` - `@todo tests`

**Hookrouter migration:**
- `HashRouter/Effect/hooks.ts:18-60` - Migration TODOs
- `routes.tsx:36-45` - Migration TODOs
- `project/slice.ts:304` - Migration TODO
- `embed.tsx:21` - Migration TODO
- `bootEmbed.tsx:4` - Migration TODO

#### Test/E2E TODOs

- `tests/e2e/utils.js:1,128` - Reorganize; delete file
- `tests/e2e/sanity_checks/metadata.test.js:41` - `test.todo('Logs in and loads FullStory')`
- `tests/e2e/sanity_checks/menu.test.js:520` - `test.todo('Share Project button')`

#### Engine TODOs

- `packages/engine/src/cfg/simulation.rs:25-28` - Serial default "for now"
- `packages/engine/src/sim.rs:96` - `TODO(haze) elaborate` docs
- `packages/engine-types/src/state.rs:491,725` - Macro for BUILTIN_FIELDS; JSON feasibility
- `packages/engine-types/src/worker.rs:111` - Remove if unused
- `packages/engine-types/src/properties.rs:15,65,262` - Audit JSON values; complexity; Conway default
- `packages/engine-types/src/message.rs:268,301` - Unchecked naming; CreateAgent type hack
- `packages/engine-web/.../EvalError.ts:94` - Remove `"<exec>"` from Python errors
- `packages/engine-web/.../wrappers.ts:21` - Manual Pyodide conversion until future versions
- `kdtree-rust/.../mod.rs:200` - Too many args → struct

#### Action Items
- [ ] Review each TODO and either:
  - Fix it immediately (if < 30 min)
  - Create a specific issue for it
  - Document why it's not being done
  - Delete if no longer relevant
- [ ] Establish policy: TODOs must have issue references
- [ ] Add linting rule to prevent new TODOs without context

---

## Priority Recommendations

If remediating, tackle in this order:

1. **Test health** - Fix `describe.only` in e2e; re-enable or remove skipped suites
2. **Migration shims** - Especially `|| true` UI kill-switch and disabled GitHub commit path
3. **Redux types** - Fix AppDispatch once, unblocks dozens of sites
4. **2021 release debt** - Delete OutputPlotCollated, clean up dated shortcuts
5. **Simulator slice** - Address uncertain/wrong-feeling logic
6. **Analysis features** - Complete or remove incomplete plot types
7. **General cleanup** - HACKs, workarounds, scattered TODOs
8. **libs/deer** - More library WIP than product bug, lower user impact

---

## Statistics

- **~199** `@todo` markers
- **~115** `TODO` comments
- **~76** `@ts-expect-error` suppressions
- **~19** migration shims
- **Multiple** disabled/broken tests
- **Various** workarounds and hacks

**Total:** ~320+ items identified

---

## Next Steps

1. Enable GitHub Issues on this repository, or
2. Import this list into your project management tool (Jira, Linear, etc.), or
3. Start tackling items directly, prioritizing by impact
