import { describe, it, expect } from "vitest";
import { execSync } from "node:child_process";
import { resolve } from "node:path";

const cliPath = resolve(import.meta.dirname, "../dist/index.js");
const fixturesDir = resolve(import.meta.dirname, "fixtures");

function runCLI(args: string): { stdout: string; stderr: string; exitCode: number } {
  try {
    const stdout = execSync(`node ${cliPath} ${args}`, {
      encoding: "utf-8",
      timeout: 10000,
    });
    return { stdout, stderr: "", exitCode: 0 };
  } catch (err: unknown) {
    const error = err as { stdout: string; stderr: string; status: number };
    return {
      stdout: error.stdout ?? "",
      stderr: error.stderr ?? "",
      exitCode: error.status ?? 1,
    };
  }
}

describe("CLI", () => {
  describe("valid file", () => {
    // full.json uses github/url source objects, so no filesystem checks apply
    it("exits with 0 for valid full file (non-relative sources)", () => {
      const result = runCLI(`validate ${resolve(fixturesDir, "valid/full.json")} --no-color`);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Validation passed");
    });

    // minimal.json uses relative paths that don't exist - CLI detects E010
    it("exits with 1 for minimal file with non-existent relative source", () => {
      const result = runCLI(`validate ${resolve(fixturesDir, "valid/minimal.json")} --no-color`);
      expect(result.exitCode).toBe(1);
      expect(result.stdout).toContain("E010");
    });
  });

  describe("invalid file", () => {
    it("exits with 1 for invalid file", () => {
      const result = runCLI(`validate ${resolve(fixturesDir, "invalid/bad-semver.json")} --no-color`);
      expect(result.exitCode).toBe(1);
      expect(result.stdout).toContain("Validation failed");
    });

    it("exits with 1 for bad category", () => {
      const result = runCLI(`validate ${resolve(fixturesDir, "invalid/bad-category.json")} --no-color`);
      expect(result.exitCode).toBe(1);
    });

    it("exits with 1 for duplicate names", () => {
      const result = runCLI(`validate ${resolve(fixturesDir, "invalid/duplicate-names.json")} --no-color`);
      expect(result.exitCode).toBe(1);
      expect(result.stdout).toContain("Duplicate plugin name");
    });
  });

  describe("file not found", () => {
    it("exits with 2 for non-existent file", () => {
      const result = runCLI("validate /nonexistent/marketplace.json --no-color");
      expect(result.exitCode).toBe(2);
    });
  });

  describe("output formats", () => {
    it("outputs JSON with --format json", () => {
      const result = runCLI(`validate ${resolve(fixturesDir, "valid/full.json")} --format json`);
      const parsed = JSON.parse(result.stdout);
      expect(parsed.valid).toBe(true);
      expect(parsed.summary).toBeDefined();
    });

    it("outputs compact with --format compact", () => {
      const result = runCLI(`validate ${resolve(fixturesDir, "invalid/bad-semver.json")} --format compact`);
      expect(result.stdout).toContain("error[E003]");
    });
  });

  describe("strict mode", () => {
    it("fails with warnings in strict mode", () => {
      // minimal.json has warnings (missing description, tags, etc.) + E010 errors
      const result = runCLI(`validate ${resolve(fixturesDir, "valid/minimal.json")} --strict --no-color`);
      expect(result.exitCode).toBe(1);
    });
  });

  describe("quiet mode", () => {
    it("suppresses warnings in quiet mode", () => {
      const result = runCLI(`validate ${resolve(fixturesDir, "valid/full.json")} --quiet --no-color`);
      expect(result.stdout).not.toContain("WARN");
    });
  });

  describe("filesystem checks via CLI", () => {
    it("detects missing plugin directory (E010)", () => {
      const result = runCLI(`validate ${resolve(fixturesDir, "fs-check/marketplace.json")} --no-color`);
      expect(result.exitCode).toBe(1);
      expect(result.stdout).toContain("E010");
    });

    it("detects missing plugin.json (E011)", () => {
      const result = runCLI(`validate ${resolve(fixturesDir, "fs-check/marketplace.json")} --format compact`);
      expect(result.stdout).toContain("E011");
    });
  });

  describe("version", () => {
    it("shows version", () => {
      const result = runCLI("--version");
      expect(result.stdout.trim()).toBe("1.0.0");
    });
  });
});
