import { exampleZipUrl } from "./manifest";

export async function fetchExampleZip(fileName: string): Promise<ArrayBuffer> {
  const res = await fetch(exampleZipUrl(fileName));
  if (!res.ok) {
    throw new Error(`Failed to fetch ${fileName}: ${res.status}`);
  }
  return res.arrayBuffer();
}
