# Fix AppDispatch / Redux `@ts-expect-error` Suppressions

**Date:** 2026-08-08  
**Track:** Technical debt §3 (Redux types) — approach C then B  
**Status:** Implemented (proof vertical + B sweep of redux suppressions)

## Problem

`packages/core` has dozens of `@ts-expect-error` / “redux problems” suppressions around `dispatch(...)`. Many look like local bugs; the root cause is global.

In `features/middleware/queue.ts`, a `declare module "redux"` block **replaces** Redux’s `Dispatch` with a type that only accepts `QueueableAction` and returns `Promise<void>`. That poisons `AppDispatch` (`typeof store.dispatch`) everywhere, so normal actions, thunks, and `createAsyncThunk` results fail type-checking.

The simulator store already avoids this pattern and uses RTK’s `ThunkAction` correctly (`features/simulator/types.ts`).

## Goals

1. Restore a correct `AppDispatch` that accepts plain actions, RTK thunks / async thunks, **and** queueable actions.
2. Prove the fix on a small vertical (HashRouter + project thunks) with suppressions removed.
3. Stop for review before sweeping remaining “redux problems” sites (track B).

## Non-goals (this PR)

- Sweeping all ~76 `@ts-expect-error` sites
- Fixing unrelated “Genuine type error” spots (e.g. ModalShare*) unless they fall out cleanly from the root fix
- Rewriting `save` off the queue middleware
- Simulator store changes
- Runtime behavior changes

## Design

### 1. Type foundation

**Remove** the broken module augmentation in `features/middleware/queue.ts`:

```ts
declare module "redux" {
  export type Dispatch<A extends Action = AnyAction> = (
    action: QueueableAction,
  ) => Promise<void>;
}
```

**Keep** queue support via existing middleware typing:

```ts
export const queueMiddleware: Middleware<QueueDispatch, RootState> = ...
```

RTK’s `configureStore` intersects middleware dispatch extensions onto `store.dispatch`. That is the supported way to add `dispatch(queueableAction)` without overwriting global `Dispatch`.

**Redefine** `AppThunk` in `features/types.ts` to match the simulator:

```ts
import type { Action, ThunkAction } from "@reduxjs/toolkit";

export type AppThunk<ReturnType = void> = ThunkAction<
  ReturnType,
  RootState,
  unknown,
  Action<string>
>;
```

Keep:

- `AppDispatch = StoreType["dispatch"]`
- `AsyncAppThunk` / `AppAsyncThunkArgs` for `createAppAsyncThunk`
- `createAppAsyncThunk` as-is unless typing adjustments are required after the Dispatch fix

**Add** typed hooks in `features/hooks.ts` (or equivalent):

- `useAppDispatch` → `AppDispatch`
- `useAppSelector` → `TypedUseSelectorHook<RootState>`

No runtime change; call sites in the proof vertical may switch to these hooks for consistency.

### 2. Proof vertical (in-scope files)

| File | Expected cleanup |
|------|------------------|
| `features/middleware/queue.ts` | Remove bad augmentation; clear `@ts-expect-error` on `store.dispatch` into queue callbacks |
| `features/types.ts` | `AppThunk` via `ThunkAction` |
| `features/hooks.ts` (new) | `useAppDispatch` / `useAppSelector` |
| `components/HashRouter/HashRouter.tsx` | `bootstrapApp` dispatch |
| `components/HashRouter/Effect/Fork.tsx` | `fetchProject`, `forkProject`, unwrap |
| `components/HashRouter/Effect/Project.tsx` | `fetchProject` |
| `components/HashRouter/Effect/NewProject.tsx` | `trackEvent`, `setProjectWithMeta` |
| `features/project/thunks.ts` | `forkProject` internals |
| `features/project/slice.ts` | `setProjectWithMeta` inside `fetchProject` |

Success for track C: those sites compile without `@ts-expect-error` related to redux dispatch/thunks.

### 3. Fallback if queue typing is incomplete

If after removing the augmentation `dispatch(save())` (or other queueables) no longer type-checks via middleware intersection:

- Prefer a **narrow** helper/overload on the queue API (e.g. typed `queue()` return + explicit cast at the queue boundary)
- Do **not** reintroduce a global `declare module "redux"` that replaces `Dispatch`

### 4. Verification

- Run `tsc --noEmit` for `packages/core` (Docker-first per project rules)
- Confirm proof-vertical suppressions are gone
- Report remaining “redux problems” count outside the vertical (no sweep yet)
- Manual smoke if convenient: app boot, project route load, fork modal

### 5. Risks

- Masked errors elsewhere may appear once `Dispatch` is restored; leave them for the B sweep unless they block the vertical
- Circular typing between `store` / `types` / middleware; resolve by following the simulator’s `ThunkAction` + `typeof store.dispatch` pattern
- Types-only change; rollback is revert

## Stop gate

After the proof vertical is green, pause for review. A follow-up plan covers the B sweep (remaining “redux problems” suppressions), leaving documented genuine one-offs.

## Relation to TECHNICAL_DEBT.md

Addresses **§3 Fix Redux TypeScript Errors**, prioritized action items:

- [x] Investigate root AppDispatch typing → queue module augmentation
- [ ] Fix root + middleware typing (this design)
- [ ] Remove suppressions in proof vertical
- [ ] Later: remove remaining suppressions; add regression guard if practical
