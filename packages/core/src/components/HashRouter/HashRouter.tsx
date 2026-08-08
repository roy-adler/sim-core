import React, { FC, memo, useEffect } from "react";

import { HashCore } from "../HashCore";
import { LoadingIcon } from "../LoadingIcon";
import { bootstrapApp } from "../../features/thunks";
import { selectBootstrapped } from "../../features/user/selectors";
import { useAppDispatch, useAppSelector } from "../../features/hooks";
import { useHandlePromiseRejection } from "../ErrorBoundary";
import { useRouteEffect } from "./Effect";

export const HashRouter: FC = memo(function HashApp() {
  const dispatch = useAppDispatch();
  const bootstrapped = useAppSelector(selectBootstrapped);
  const handlePromiseRejection = useHandlePromiseRejection();
  const routeEffect = useRouteEffect();

  useEffect(() => {
    handlePromiseRejection(dispatch(bootstrapApp()));
  }, [handlePromiseRejection, dispatch]);

  if (!(bootstrapped && routeEffect)) {
    return <LoadingIcon fullScreen={true} />;
  }

  return (
    <>
      <HashCore />
      {routeEffect}
    </>
  );
});

// // @ts-expect-error
// HashApp.whyDidYouRender = {
//   customName: "HashApp"
// };
