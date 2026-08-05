import { defineConfig } from "vite";
import monacoEditorPluginCJS from "vite-plugin-monaco-editor";
import react from "@vitejs/plugin-react";
import timestampCJS from "time-stamp";
import wasm from "vite-plugin-wasm";
import topLevelAwait from "vite-plugin-top-level-await";

//commonJS adaptor shims
const monacoEditorPlugin = (monacoEditorPluginCJS as any).default;
const utc = (timestampCJS as any).utc;

/**
 * Lazy/route deps that Vite would otherwise discover mid-session. That rewrites
 * `.vite/deps` and breaks already-loaded chunks (ErrorBoundary). Extend this
 * when Docker logs show "new dependencies optimized".
 */
const PREBUNDLE_DEPS = [
  "acorn",
  "bowser",
  "classnames",
  "clipboard-polyfill",
  "date-fns/format",
  "escape-string-regexp",
  "file-saver",
  "fp-ts/es6/Option",
  "fp-ts/es6/Record",
  "fp-ts/es6/function",
  "fp-ts/es6/pipeable",
  "hookrouter",
  "idb-keyval",
  "immer",
  "js-levenshtein",
  "json-stringify-pretty-compact",
  "jstat",
  "jszip",
  "line-column",
  "lodash-es",
  "lodash-es/findLastIndex",
  "lodash-es/omit",
  "lodash-es/orderBy",
  "monaco-editor",
  "monocle-ts",
  "nanoid",
  "neverthrow",
  "papaparse",
  "promise-worker-transferable",
  "promise-worker-transferable/register",
  "react-dropzone",
  "react-hook-form",
  "react-mapbox-gl",
  "react-markdown",
  "react-modal-hook",
  "react-plotly.js",
  "react-promise-suspense",
  "react-redux",
  "react-select",
  "react-select/creatable",
  "react-shepherd",
  "react-splitter-layout",
  "react-svg",
  "react-tabs",
  "react-three-fiber",
  "react-timeago",
  "react-tiny-popover",
  "react-transition-group",
  "react-window",
  "recoil",
  "reselect",
  "rxjs",
  "rxjs/operators",
  "simplebar-react",
  "slugify",
  "three",
  "three/examples/jsm/loaders/MTLLoader",
  "three/examples/jsm/loaders/OBJLoader",
  "three/examples/jsm/utils/BufferGeometryUtils",
  "url-join",
  "uuid",
  "@react-three/drei",
  "@reduxjs/toolkit",
];

export default defineConfig(({ mode }) => {
  const isProduction = mode === "production";

  const BUILD_STAMP = [
    "hash",
    isProduction ? "prod" : "dev",
    utc("YYYY-MM-DD-THHmm_ssms"),
  ].join("-");

  return {
    root: "src",
    build: {
      // Relative to the root
      outDir: "../dist",
      emptyOutDir: true,
      rollupOptions: {
        input: {
          main: "./src/index.html",
          embed: "./src/embed.html",
        },
      },
      reportCompressedSize: false,
      minify: true,
      sourcemap: false,
    },
    define: {
      BUILD_STAMP: JSON.stringify(BUILD_STAMP),
    },
    server: {
      port: 8080,
      allowedHosts: [
        "localhost",
        ...(process.env.VITE_ALLOWED_HOST
          ? process.env.VITE_ALLOWED_HOST.split(",")
              .map((host) => host.trim())
              .filter(Boolean)
          : []),
      ],
      warmup: {
        clientFiles: [
          "./index.html",
          "./embed.html",
          "./index.tsx",
          "./components/App/**/*.{ts,tsx}",
          "./features/**/*.{ts,tsx}",
        ],
      },
    },
    preview: {
      port: 8080,
      open: true,
    },
    resolve: {
      alias: {
        // Aliases preserved from old webpack config for migration, should investigate removing.
        lodash: "lodash-es",
        "lodash.omit": "lodash-es/omit",
        "lodash.pick": "lodash-es/pick",
        "@juggle/resize-observer$": "empty-module",

        // mapgl bug workaround https://github.com/alex3165/react-mapbox-gl/issues/822#issuecomment-835781698
        "react-mapbox-gl": "react-mapbox-gl/lib",
      },
    },
    worker: {
      plugins: () => [wasm(), topLevelAwait()],
      format: "es",
    },
    optimizeDeps: {
      include: PREBUNDLE_DEPS,
      entries: ["./index.html", "./embed.html", "./index.tsx"],
    },
    plugins: [wasm(), topLevelAwait(), react(), monacoEditorPlugin({})],
  };
});
