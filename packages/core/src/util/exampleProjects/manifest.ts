/** Zips used only for New project templates — served from /project_templates. */
export const TEMPLATE_ZIP_BY_KEY = {
  empty: "empty-project.zip",
  starter: "empty-template-project.zip",
} as const;

export type TemplateKey = keyof typeof TEMPLATE_ZIP_BY_KEY;

/** Empty-state default when no user projects exist. */
export const DEFAULT_EXAMPLE_SLUG = "consensus-algorithms" as const;

/** @deprecated Task 5 replaces this with /example_projects/index.json */
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

export const exampleZipUrl = (fileName: string): string =>
  `/example_projects/${fileName}`;

export const templateZipUrl = (fileName: string): string =>
  `/project_templates/${fileName}`;
