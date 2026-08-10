import fs from "fs";
import path from "path";
import { defineConfig, type Plugin } from "vite";
import monacoEditorPluginCJS from "vite-plugin-monaco-editor";
import react from "@vitejs/plugin-react";
import timestampCJS from "time-stamp";
import wasm from "vite-plugin-wasm";
import topLevelAwait from "vite-plugin-top-level-await";

//commonJS adaptor shims
const monacoEditorPlugin = (monacoEditorPluginCJS as any).default;
const utc = (timestampCJS as any).utc;

const REPO_ROOT = path.resolve(process.cwd(), "../..");
const EXAMPLE_PROJECTS_DIR = path.join(REPO_ROOT, "example_projects");
const PROJECT_TEMPLATES_DIR = path.join(REPO_ROOT, "project_templates");

function listZipNames(dir: string): string[] {
  if (!fs.existsSync(dir)) {
    return [];
  }
  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith(".zip") && !name.startsWith("."))
    .sort((a, b) => a.localeCompare(b));
}

function sendZip(
  dir: string,
  name: string,
  res: import("http").ServerResponse,
) {
  const filePath = path.join(dir, name);
  if (!filePath.startsWith(dir) || !fs.existsSync(filePath)) {
    res.statusCode = 404;
    res.end("Not found");
    return;
  }
  res.setHeader("Content-Type", "application/zip");
  fs.createReadStream(filePath).pipe(res);
}

function projectZipsStatic(): Plugin {
  return {
    name: "project-zips-static",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url?.split("?")[0] ?? "";

        if (url === "/example_projects/index.json") {
          const body = JSON.stringify({ zips: listZipNames(EXAMPLE_PROJECTS_DIR) });
          res.setHeader("Content-Type", "application/json");
          res.end(body);
          return;
        }

        if (url.startsWith("/example_projects/")) {
          const name = path.basename(
            decodeURIComponent(url.slice("/example_projects/".length)),
          );
          if (!name.endsWith(".zip")) {
            res.statusCode = 404;
            res.end("Not found");
            return;
          }
          sendZip(EXAMPLE_PROJECTS_DIR, name, res);
          return;
        }

        if (url.startsWith("/project_templates/")) {
          const name = path.basename(
            decodeURIComponent(url.slice("/project_templates/".length)),
          );
          if (!name.endsWith(".zip")) {
            res.statusCode = 404;
            res.end("Not found");
            return;
          }
          sendZip(PROJECT_TEMPLATES_DIR, name, res);
          return;
        }

        next();
      });
    },
    closeBundle() {
      const examplesOut = path.resolve(process.cwd(), "dist/example_projects");
      const templatesOut = path.resolve(process.cwd(), "dist/project_templates");
      fs.mkdirSync(examplesOut, { recursive: true });
      fs.mkdirSync(templatesOut, { recursive: true });

      const exampleZips = listZipNames(EXAMPLE_PROJECTS_DIR);
      fs.writeFileSync(
        path.join(examplesOut, "index.json"),
        JSON.stringify({ zips: exampleZips }),
      );
      for (const name of exampleZips) {
        fs.copyFileSync(
          path.join(EXAMPLE_PROJECTS_DIR, name),
          path.join(examplesOut, name),
        );
      }
      for (const name of listZipNames(PROJECT_TEMPLATES_DIR)) {
        fs.copyFileSync(
          path.join(PROJECT_TEMPLATES_DIR, name),
          path.join(templatesOut, name),
        );
      }
    },
  };
}

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
      fs: {
        allow: [REPO_ROOT, EXAMPLE_PROJECTS_DIR, PROJECT_TEMPLATES_DIR],
      },
      // Prefetch transforms for the always-on shell; optimizeDeps.entries
      // already crawls lazy viewers for dependency discovery.
      warmup: {
        clientFiles: ["./index.html", "./embed.html", "./index.tsx"],
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
      // Crawl the whole app so lazy viewers (map / 3D / analysis) are scanned
      // at cold start instead of mid-session (which rewrites `.vite/deps` and
      // breaks already-loaded chunks).
      entries: [
        "./index.html",
        "./embed.html",
        "./**/*.{js,jsx,ts,tsx}",
        "!**/*.{test,spec}.{js,jsx,ts,tsx}",
        "!**/__tests__/**",
        "!**/tests/**",
      ],
      // Escape hatch for scanner blind spots (conditional / built dynamic
      // imports). Add a package only when Docker logs show
      // "new dependencies optimized" after a cold start + navigation.
      include: [
        "clipboard-polyfill", // only imported when navigator.clipboard is missing
      ],
    },
    plugins: [
      wasm(),
      topLevelAwait(),
      react(),
      monacoEditorPlugin({}),
      projectZipsStatic(),
    ],
  };
});
