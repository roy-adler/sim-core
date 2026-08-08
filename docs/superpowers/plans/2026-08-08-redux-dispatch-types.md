# Redux AppDispatch Types Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore correct `AppDispatch` typing and remove `@ts-expect-error` suppressions in the HashRouter + project thunks proof vertical.

**Architecture:** Remove the broken `declare module "redux"` that replaces `Dispatch` with queue-only typing. Keep `Middleware<QueueDispatch>` for queue support. Align `AppThunk` with RTK `ThunkAction`. Add typed hooks. Clear suppressions in the proof vertical only.

**Tech Stack:** TypeScript, Redux Toolkit 1.9.7, react-redux 7.2.4, Docker for `tsc`

## Global Constraints

- Types-only — no runtime behavior changes
- Do not reintroduce global `Dispatch` module augmentation that replaces the type
- Proof vertical only — no full B sweep
- Prefer Docker for yarn/tsc (per workspace Docker build rule)
- Spec: `docs/superpowers/specs/2026-08-08-redux-dispatch-types-design.md`

---

### Task 1: Fix core dispatch / thunk types

**Files:**
- Modify: `packages/core/src/features/middleware/queue.ts`
- Modify: `packages/core/src/features/types.ts`
- Create: `packages/core/src/features/hooks.ts`

**Interfaces:**
- Produces: `AppThunk` via `ThunkAction`; `useAppDispatch`; `useAppSelector`
- Consumes: `RootState`, `AppDispatch`, `StoreType` from existing store typing

- [ ] **Step 1: Update `types.ts`**

Replace hand-rolled `AppThunk` with:

```ts
import type { Action, ThunkAction } from "@reduxjs/toolkit";
import type { RootReducerType } from "./rootReducer";
import type { StoreType } from "./store";

export type RootState = ReturnType<RootReducerType>;
export type AppDispatch = StoreType["dispatch"];

export type AppThunk<ReturnType = void> = ThunkAction<
  ReturnType,
  RootState,
  unknown,
  Action<string>
>;

export type AsyncAppThunk<ReturnValueType = void> = AppThunk<
  Promise<ReturnValueType>
>;

export interface AppAsyncThunkArgs {
  state: RootState;
  dispatch: AppDispatch;
}
```

- [ ] **Step 2: Fix `queue.ts`**

Delete the entire `declare module "redux" { ... }` block (lines ~49–58). Remove `@ts-expect-error` on `store.dispatch` passed into queue callbacks. Keep `Middleware<QueueDispatch, RootState>`.

- [ ] **Step 3: Add `features/hooks.ts`**

```ts
import { TypedUseSelectorHook, useDispatch, useSelector } from "react-redux";

import type { AppDispatch, RootState } from "./types";

export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
```

- [ ] **Step 4: Typecheck sanity**

Run (Docker): `docker compose --profile development exec hash-core-dev yarn workspace @hashintel/core exec tsc --noEmit`  
(or equivalent once container is up). Expect fewer / different errors than before; queue/types should not introduce new `Dispatch` replacement errors.

---

### Task 2: Clear proof-vertical suppressions

**Files:**
- Modify: `packages/core/src/components/HashRouter/HashRouter.tsx`
- Modify: `packages/core/src/components/HashRouter/Effect/Fork.tsx`
- Modify: `packages/core/src/components/HashRouter/Effect/Project.tsx`
- Modify: `packages/core/src/components/HashRouter/Effect/NewProject.tsx`
- Modify: `packages/core/src/features/project/thunks.ts`
- Modify: `packages/core/src/features/project/slice.ts`

**Interfaces:**
- Consumes: `useAppDispatch` from `features/hooks.ts`; existing thunks unchanged at runtime

- [ ] **Step 1: Switch effects to `useAppDispatch` where they use `useDispatch<AppDispatch>`**

- [ ] **Step 2: Remove `@ts-expect-error` / `@ts-expect-error redux problems` on dispatch sites in the files above**

- [ ] **Step 3: If a site still errors**

Fix the local type (wrong return / argument), or apply the spec fallback (narrow queue helper) — never restore global `Dispatch` overwrite.

- [ ] **Step 4: Full `tsc --noEmit` for packages/core**

- [ ] **Step 5: Report remaining `@ts-expect-error` / “redux problems” count outside this vertical**

---

### Task 3: Stop gate

- [ ] Summarize for user: files changed, suppressions removed, remaining count, any surprises
- [ ] Do not start B sweep until user approves
