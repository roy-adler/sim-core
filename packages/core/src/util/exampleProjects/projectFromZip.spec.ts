import JSZip from "jszip";

import {
  projectFilesFromZip,
  buildSimulationProjectFromFiles,
} from "./projectFromZip";
import { humanizeSlug } from "./humanizeSlug";

describe("humanizeSlug", () => {
  it("title-cases hyphenated slugs", () => {
    expect(humanizeSlug("wildfires-regrowth")).toBe("Wildfires Regrowth");
  });
});

describe("projectFilesFromZip", () => {
  it("extracts permitted files and skips hidden/disallowed dirs", async () => {
    const zip = new JSZip();
    zip.file("README.md", "# Hi");
    zip.file("src/globals.json", "{}");
    zip.file(".DS_Store", "x");
    zip.file("secrets/key.txt", "nope");
    zip.folder("src")?.file("init.json", "[]");

    const files = await projectFilesFromZip(zip);
    const paths = files.map((f) => f.path).sort();
    expect(paths).toEqual(["README.md", "src/globals.json", "src/init.json"]);
  });
});

describe("buildSimulationProjectFromFiles", () => {
  it("builds @examples pathWithNamespace", () => {
    const project = buildSimulationProjectFromFiles({
      files: [
        {
          name: "README.md",
          path: "README.md",
          contents: "hi",
          ref: "1.0",
        },
        {
          name: "globals.json",
          path: "src/globals.json",
          contents: "{}",
          ref: "1.0",
        },
        {
          name: "analysis.json",
          path: "views/analysis.json",
          contents: '{"outputs":{},"plots":[]}',
          ref: "1.0",
        },
        {
          name: "dependencies.json",
          path: "dependencies.json",
          contents: "{}",
          ref: "1.0",
        },
        {
          name: "experiments.json",
          path: "experiments.json",
          contents: "{}",
          ref: "1.0",
        },
        {
          name: "init.json",
          path: "src/init.json",
          contents: "[]",
          ref: "1.0",
        },
      ],
      namespace: "@examples",
      path: "wildfires-regrowth",
      name: "Wildfires Regrowth",
    });
    expect(project.pathWithNamespace).toBe("@examples/wildfires-regrowth");
    expect(project.namespace).toBe("@examples");
    expect(project.ref).toBe("main");
    expect(project.files.length).toBeGreaterThan(0);
  });
});
