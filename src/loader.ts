import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export class LoadError extends Error {
  constructor(
    message: string,
    public readonly code: "FILE_NOT_FOUND" | "PERMISSION_DENIED" | "INVALID_JSON" | "READ_ERROR",
  ) {
    super(message);
    this.name = "LoadError";
  }
}

export function loadMarketplaceFile(filePath: string): unknown {
  const resolvedPath = resolve(filePath);

  let content: string;
  try {
    content = readFileSync(resolvedPath, "utf-8");
  } catch (err: unknown) {
    const error = err as NodeJS.ErrnoException;
    if (error.code === "ENOENT") {
      throw new LoadError(`File not found: ${resolvedPath}`, "FILE_NOT_FOUND");
    }
    if (error.code === "EACCES") {
      throw new LoadError(`Permission denied: ${resolvedPath}`, "PERMISSION_DENIED");
    }
    throw new LoadError(`Failed to read file: ${resolvedPath} (${error.message})`, "READ_ERROR");
  }

  try {
    return JSON.parse(content) as unknown;
  } catch (err: unknown) {
    const error = err as SyntaxError;
    throw new LoadError(`Invalid JSON in ${resolvedPath}: ${error.message}`, "INVALID_JSON");
  }
}
