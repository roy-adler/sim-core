import type { Action, ThunkAction, ThunkDispatch } from "@reduxjs/toolkit";
import type { AnyAction } from "redux";

import type { RootReducerType } from "./rootReducer";

export type RootState = ReturnType<RootReducerType>;

/**
 * Queueable actions are handled by queueMiddleware and never reach reducers.
 */
export type QueuedCallback = (
  next: VoidFunction,
  getState: () => RootState,
  dispatch: AppDispatch,
) => void;

export interface QueueableAction {
  __QUEUED_ACTION_TYPE: string;
  handler: QueuedCallback;
}

export type QueueDispatch = (queueableAction: QueueableAction) => Promise<void>;

/**
 * Explicit AppDispatch so call sites do not depend on brittle
 * `typeof store.dispatch` inference through the middleware stack.
 * Queue actions are typed via the QueueDispatch intersection; `save()` wraps
 * queueables in an AppThunk at the queue boundary.
 */
export type AppDispatch = ThunkDispatch<RootState, unknown, AnyAction> &
  QueueDispatch;

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
