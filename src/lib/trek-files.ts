import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { parse } from "yaml";
import { trekSchema, type Trek } from "./trek-schema";

export const TREKS_DIR = path.join(process.cwd(), "data", "treks");

export interface TrekFileResult {
  file: string;
  trek?: Trek;
  errors: string[];
}

export function validateTrekDocument(file: string, raw: unknown): TrekFileResult {
  const result = trekSchema.safeParse(raw);
  if (!result.success) {
    return {
      file,
      errors: result.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`),
    };
  }
  const expected = path.basename(file, ".yaml");
  if (result.data.slug !== expected) {
    return { file, errors: [`slug "${result.data.slug}" does not match the file name "${expected}.yaml"`] };
  }
  return { file, trek: result.data, errors: [] };
}

export function readTrekFiles(dir = TREKS_DIR): TrekFileResult[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith(".yaml"))
    .sort()
    .map((f) => {
      try {
        return validateTrekDocument(f, parse(readFileSync(path.join(dir, f), "utf8")));
      } catch (e) {
        return { file: f, errors: [`not valid YAML: ${(e as Error).message.split("\n")[0]}`] };
      }
    });
}
