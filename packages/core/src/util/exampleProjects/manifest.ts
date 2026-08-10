/** Zips used only for New project templates — served from /project_templates. */
export const TEMPLATE_ZIP_BY_KEY = {
  empty: "empty-project.zip",
  starter: "empty-template-project.zip",
} as const;

export type TemplateKey = keyof typeof TEMPLATE_ZIP_BY_KEY;

/** Empty-state default when no user projects exist. */
export const DEFAULT_EXAMPLE_SLUG = "consensus-algorithms" as const;

export const exampleZipUrl = (fileName: string): string =>
  `/example_projects/${fileName}`;

export const exampleProjectsIndexUrl = (): string =>
  "/example_projects/index.json";

export const templateZipUrl = (fileName: string): string =>
  `/project_templates/${fileName}`;
