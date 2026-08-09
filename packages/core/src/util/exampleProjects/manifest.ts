/** Zips used only for New project templates — not Example projects menu. */
export const TEMPLATE_ZIP_BY_KEY = {
  empty: "empty-project.zip",
  starter: "empty-template-project.zip",
} as const;

export type TemplateKey = keyof typeof TEMPLATE_ZIP_BY_KEY;

export const TEMPLATE_ZIP_NAMES = new Set<string>(
  Object.values(TEMPLATE_ZIP_BY_KEY),
);

/**
 * Shared example slugs (zip basename without .zip).
 * Keep in sync with repo-root example_projects/*.zip minus templates.
 */
export const EXAMPLE_PROJECT_SLUGS = [
  "ant-foraging",
  "boids-3d",
  "city-infection-model",
  "connection-example",
  "consensus-algorithms",
  "model-market",
  "published-display-behaviors",
  "rainfall",
  "rumor-mill-public-health-practices",
  "sugarscape",
  "virus-mutation-and-drug-resistance",
  "warehouse-logistics",
  "wildfires-regrowth",
] as const;

export const DEFAULT_EXAMPLE_SLUG = "consensus-algorithms" as const;

export const exampleZipUrl = (fileName: string): string =>
  `/example_projects/${fileName}`;
