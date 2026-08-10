import { PartialSimulationProject } from "./project/types";
import { pickDefaultLinkableProject } from "./selectors";

const example = (
  path: string,
  updatedAt: string,
): PartialSimulationProject =>
  ({
    pathWithNamespace: path,
    name: path,
    updatedAt,
    ref: "main",
    type: "Simulation",
    visibility: "public",
    latestRelease: null,
    forkOf: null,
  } as PartialSimulationProject);

describe("pickDefaultLinkableProject", () => {
  it("prefers most recent user project when any exist", () => {
    const result = pickDefaultLinkableProject(
      [
        example("@user/a", "2020-01-01T00:00:00.000Z"),
        example("@user/b", "2024-01-01T00:00:00.000Z"),
      ],
      [example("@examples/consensus-algorithms", "2025-01-01T00:00:00.000Z")],
    );

    expect(result?.pathWithNamespace).toBe("@user/b");
  });

  it("prefers consensus when no user projects exist", () => {
    const result = pickDefaultLinkableProject(
      [],
      [
        example("@examples/wildfires-regrowth", "2025-01-02T00:00:00.000Z"),
        example("@examples/consensus-algorithms", "2025-01-01T00:00:00.000Z"),
      ],
    );

    expect(result?.pathWithNamespace).toBe("@examples/consensus-algorithms");
  });

  it("falls back to first example if consensus missing", () => {
    const result = pickDefaultLinkableProject(
      [],
      [example("@examples/boids-3d", "2025-01-01T00:00:00.000Z")],
    );

    expect(result?.pathWithNamespace).toBe("@examples/boids-3d");
  });
});
