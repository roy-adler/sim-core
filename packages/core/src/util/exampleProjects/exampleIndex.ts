export interface ExampleProjectsIndex {
  zips: string[];
}

export function parseExampleProjectsIndex(data: unknown): ExampleProjectsIndex {
  if (!data || typeof data !== "object") {
    throw new Error("example projects index must be an object");
  }
  const zips = (data as { zips?: unknown }).zips;
  if (!Array.isArray(zips) || !zips.every((z) => typeof z === "string")) {
    throw new Error("example projects index.zips must be string[]");
  }
  for (const name of zips) {
    if (!name.endsWith(".zip") || name.includes("/") || name.includes("\\")) {
      throw new Error(`invalid example zip name: ${name}`);
    }
  }
  return { zips: [...zips] };
}

export function slugsFromExampleIndex(index: ExampleProjectsIndex): string[] {
  return index.zips.map((name) => name.replace(/\.zip$/i, ""));
}
