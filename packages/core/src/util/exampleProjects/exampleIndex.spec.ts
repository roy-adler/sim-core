import {
  parseExampleProjectsIndex,
  slugsFromExampleIndex,
} from "./exampleIndex";

describe("parseExampleProjectsIndex", () => {
  it("accepts a zips array of *.zip names", () => {
    expect(
      parseExampleProjectsIndex({
        zips: ["consensus-algorithms.zip", "boids-3d.zip"],
      }),
    ).toEqual({ zips: ["consensus-algorithms.zip", "boids-3d.zip"] });
  });

  it("rejects non-zip entries and non-objects", () => {
    expect(() => parseExampleProjectsIndex(null)).toThrow();
    expect(() => parseExampleProjectsIndex({ zips: ["readme.md"] })).toThrow();
  });
});

describe("slugsFromExampleIndex", () => {
  it("strips .zip and preserves order", () => {
    expect(
      slugsFromExampleIndex({
        zips: ["consensus-algorithms.zip", "wildfires-regrowth.zip"],
      }),
    ).toEqual(["consensus-algorithms", "wildfires-regrowth"]);
  });
});
