import { templateZipUrl } from "./manifest";

export async function fetchTemplateZip(fileName: string): Promise<ArrayBuffer> {
  const res = await fetch(templateZipUrl(fileName));
  if (!res.ok) {
    throw new Error(`Failed to fetch template ${fileName}: ${res.status}`);
  }
  return res.arrayBuffer();
}
