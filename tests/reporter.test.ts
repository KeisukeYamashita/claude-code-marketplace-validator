import { describe, it, expect } from "vitest";
import { formatResult } from "../src/reporter.js";
import type { ValidationResult } from "../src/types.js";

const emptyResult: ValidationResult = {
  valid: true,
  errors: [],
  warnings: [],
  infos: [],
};

const resultWithIssues: ValidationResult = {
  valid: false,
  errors: [
    {
      severity: "error",
      rule: "E003",
      path: "plugins[0].version",
      field: "version",
      value: "1.0",
      message: 'Invalid semver "1.0"',
      suggestion: 'Expected format: MAJOR.MINOR.PATCH (e.g., "1.0.0").',
    },
    {
      severity: "error",
      rule: "E006",
      path: "plugins[1].category",
      field: "category",
      value: "unknown",
      message: 'Invalid category "unknown"',
      suggestion: "Valid categories: development, productivity, testing, database, deployment, design, learning, monitoring, security",
    },
  ],
  warnings: [
    {
      severity: "warning",
      rule: "W002",
      path: "plugins[0]",
      field: "homepage",
      message: 'Missing "homepage" at plugins[0]',
      suggestion: "A homepage URL helps users find documentation.",
    },
  ],
  infos: [
    {
      severity: "info",
      rule: "I001",
      path: "plugins[2].version",
      field: "version",
      value: "1.0.0-beta.1",
      message: 'Version "1.0.0-beta.1" is a pre-release version',
    },
  ],
};

describe("formatResult", () => {
  describe("text format", () => {
    it("shows success for valid result with no issues", () => {
      const output = formatResult(emptyResult, { format: "text", noColor: true });
      expect(output).toContain("Validation passed. No issues found.");
    });

    it("shows errors and summary for invalid result", () => {
      const output = formatResult(resultWithIssues, { format: "text", noColor: true });
      expect(output).toContain("ERROR");
      expect(output).toContain("E003");
      expect(output).toContain("Invalid semver");
      expect(output).toContain("2 errors");
      expect(output).toContain("1 warning");
      expect(output).toContain("Validation failed.");
    });

    it("shows warnings in normal mode", () => {
      const output = formatResult(resultWithIssues, { format: "text", noColor: true });
      expect(output).toContain("WARN");
      expect(output).toContain("W002");
    });

    it("suppresses warnings and info in quiet mode", () => {
      const output = formatResult(resultWithIssues, { format: "text", quiet: true, noColor: true });
      expect(output).not.toContain("WARN");
      expect(output).not.toContain("INFO");
      expect(output).toContain("ERROR");
    });

    it("includes suggestions", () => {
      const output = formatResult(resultWithIssues, { format: "text", noColor: true });
      expect(output).toContain("MAJOR.MINOR.PATCH");
    });
  });

  describe("json format", () => {
    it("produces valid JSON for valid result", () => {
      const output = formatResult(emptyResult, { format: "json" });
      const parsed = JSON.parse(output);
      expect(parsed.valid).toBe(true);
      expect(parsed.issues).toHaveLength(0);
      expect(parsed.summary.errors).toBe(0);
    });

    it("produces valid JSON for invalid result", () => {
      const output = formatResult(resultWithIssues, { format: "json" });
      const parsed = JSON.parse(output);
      expect(parsed.valid).toBe(false);
      expect(parsed.summary.errors).toBe(2);
      expect(parsed.summary.warnings).toBe(1);
      expect(parsed.summary.info).toBe(1);
      expect(parsed.issues).toHaveLength(4);
    });

    it("includes all issue fields", () => {
      const output = formatResult(resultWithIssues, { format: "json" });
      const parsed = JSON.parse(output);
      const firstIssue = parsed.issues[0];
      expect(firstIssue.severity).toBe("error");
      expect(firstIssue.rule).toBe("E003");
      expect(firstIssue.path).toBe("plugins[0].version");
      expect(firstIssue.message).toContain("Invalid semver");
      expect(firstIssue.suggestion).toBeTruthy();
    });

    it("suppresses warnings and info in quiet mode", () => {
      const output = formatResult(resultWithIssues, { format: "json", quiet: true });
      const parsed = JSON.parse(output);
      expect(parsed.issues.every((i: { severity: string }) => i.severity === "error")).toBe(true);
    });
  });

  describe("compact format", () => {
    it("produces empty string for valid result", () => {
      const output = formatResult(emptyResult, { format: "compact" });
      expect(output).toBe("");
    });

    it("produces one line per issue", () => {
      const output = formatResult(resultWithIssues, { format: "compact" });
      const lines = output.split("\n").filter(Boolean);
      expect(lines).toHaveLength(4); // 2 errors + 1 warning + 1 info
    });

    it("uses correct compact format", () => {
      const output = formatResult(resultWithIssues, { format: "compact" });
      expect(output).toContain('error[E003] plugins[0].version: Invalid semver "1.0"');
      expect(output).toContain("warning[W002] plugins[0]:");
      expect(output).toContain("info[I001] plugins[2].version:");
    });

    it("suppresses warnings and info in quiet mode", () => {
      const output = formatResult(resultWithIssues, { format: "compact", quiet: true });
      const lines = output.split("\n").filter(Boolean);
      expect(lines).toHaveLength(2); // only errors
      expect(output).not.toContain("warning[");
      expect(output).not.toContain("info[");
    });
  });
});
