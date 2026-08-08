/**
 * Based off of redux-async-queue
 *
 * @see https://github.com/zackargyle/redux-async-queue
 */
import { Middleware } from "@reduxjs/toolkit";

import type {
  AppDispatch,
  QueueableAction,
  QueueDispatch,
  QueuedCallback,
  RootState,
} from "../types";

export type { QueueableAction, QueueDispatch, QueuedCallback };

const QUEUE_ACTION_TAG = "__QUEUED_ACTION_TYPE" as const;

const queueAction = (
  queue: string,
  handler: QueuedCallback,
): QueueableAction => ({
  [QUEUE_ACTION_TAG]: queue,
  handler,
});

const usedNames: string[] = [];

export const createActionQueue = (name: string) => {
  if (usedNames.includes(name)) {
    throw new Error(`Queue with ${name} exists`);
  }

  usedNames.push(name);

  const fullName = `QUEUE_${name}`;

  return {
    queue: (handler: QueuedCallback): QueueableAction =>
      queueAction(fullName, handler),
  };
};

const isQueueable = (action: any): action is QueueableAction =>
  QUEUE_ACTION_TAG in action;

export const queueMiddleware: Middleware<QueueDispatch, RootState> = (
  store,
) => {
  const queues: Record<string, QueuedCallback[] | undefined> = {};

  const dequeue = (key: string) => {
    const queue = queues[key];

    if (queue) {
      const action = queue[0];

      if (action) {
        action(
          () => {
            queue.shift();
            dequeue(key);
          },
          store.getState,
          store.dispatch as AppDispatch,
        );
      }
    }
  };

  return (next) => (action) => {
    if (isQueueable(action)) {
      return new Promise<void>((resolve) => {
        const key = action[QUEUE_ACTION_TAG];
        const queue = queues[key] ?? [];
        queues[key] = queue;

        queue.push((next, ...args) => {
          action.handler(
            () => {
              resolve();
              next();
            },
            ...args,
          );
        });

        if (queue.length === 1) {
          dequeue(key);
        }
      });
    } else {
      return next(action);
    }
  };
};
