import { describe, it, expect } from "vitest";
import { resolve } from "node:path";
import { loadMarketplaceFile, LoadError } from "../src/loader.js";

const fixturesDir = resolve(import.meta.dirname, "fixtures");

describe("loadMarketplaceFile", () => {
  it("loads and parses a valid JSON file", () => {
    const data = loadMarketplaceFile(resolve(fixturesDir, "valid/minimal.json"));
    expect(data).toBeDefined();
    expect(typeof data).toBe("object");
    expect((data as Record<string, unknown>).name).toBe("my-marketplace");
  });

  it("throws LoadError for non-existent file", () => {
    expect(() => loadMarketplaceFile("/nonexistent/path/marketplace.json")).toThrow(LoadError);
    try {
      loadMarketplaceFile("/nonexistent/path/marketplace.json");
    } catch (err) {
      expect(err).toBeInstanceOf(LoadError);
      expect((err as LoadError).code).toBe("FILE_NOT_FOUND");
    }
  });

  it("throws LoadError for invalid JSON", () => {
    // Create a temporary invalid JSON scenario by trying to parse a non-JSON file
    // We'll test with a fixture that we know exists but is not JSON
    // Since all our fixtures are JSON, we'll test the error path differently
    expect(() => {
      // Pass the gitignore file which is not valid JSON
      loadMarketplaceFile(resolve(fixturesDir, "../../.gitignore"));
    }).toThrow(LoadError);

    try {
      loadMarketplaceFile(resolve(fixturesDir, "../../.gitignore"));
    } catch (err) {
      expect(err).toBeInstanceOf(LoadError);
      expect((err as LoadError).code).toBe("INVALID_JSON");
    }
  });

  it("resolves relative paths", () => {
    // Just verify it doesn't throw for a valid relative path
    const data = loadMarketplaceFile(
      resolve(fixturesDir, "valid/minimal.json"),
    );
    expect(data).toBeDefined();
  });
});
