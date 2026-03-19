import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { validate } from "../src/validator.js";

function loadFixture(name: string): unknown {
  const filePath = resolve(import.meta.dirname, "fixtures", name);
  return JSON.parse(readFileSync(filePath, "utf-8"));
}

function fixtureBasePath(name: string): string {
  return dirname(resolve(import.meta.dirname, "fixtures", name));
}

describe("validate", () => {
  describe("valid files", () => {
    it("passes for minimal valid marketplace", () => {
      const data = loadFixture("valid/minimal.json");
      const result = validate(data);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("passes for full valid marketplace", () => {
      const data = loadFixture("valid/full.json");
      const result = validate(data);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("returns warnings for missing optional best-practice fields", () => {
      const data = loadFixture("valid/minimal.json");
      const result = validate(data);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some((w) => w.rule === "W001")).toBe(true); // missing metadata.description
      expect(result.warnings.some((w) => w.rule === "W003")).toBe(true); // missing tags
    });

    it("returns no W001 warning when metadata.description provided", () => {
      const data = loadFixture("valid/full.json");
      const result = validate(data);
      expect(result.warnings.some((w) => w.rule === "W001")).toBe(false);
    });

    it("returns info for pre-release versions", () => {
      const data = loadFixture("valid/full.json");
      const result = validate(data);
      expect(result.infos.some((i) => i.rule === "I001")).toBe(true);
    });
  });

  describe("invalid files", () => {
    it("detects missing required fields", () => {
      const data = loadFixture("invalid/missing-required.json");
      const result = validate(data);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.rule === "E001")).toBe(true);
    });

    it("detects invalid semver", () => {
      const data = loadFixture("invalid/bad-semver.json");
      const result = validate(data);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.rule === "E003")).toBe(true);
    });

    it("detects invalid category", () => {
      const data = loadFixture("invalid/bad-category.json");
      const result = validate(data);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.rule === "E006")).toBe(true);
    });

    it("detects invalid email", () => {
      const data = loadFixture("invalid/bad-email.json");
      const result = validate(data);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.rule === "E004")).toBe(true);
    });

    it("detects invalid URL", () => {
      const data = loadFixture("invalid/bad-url.json");
      const result = validate(data);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.rule === "E005")).toBe(true);
    });

    it("detects duplicate plugin names", () => {
      const data = loadFixture("invalid/duplicate-names.json");
      const result = validate(data);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.rule === "E007")).toBe(true);
    });

    it("detects empty plugins array", () => {
      const data = {
        name: "test",
        owner: { name: "Owner" },
        plugins: [],
      };
      const result = validate(data);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.rule === "E008")).toBe(true);
    });

    it("detects invalid source object type", () => {
      const data = loadFixture("invalid/bad-source.json");
      const result = validate(data);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.rule === "E009")).toBe(true);
    });
  });

  describe("filesystem checks (E010, E011)", () => {
    const fsBasePath = resolve(import.meta.dirname, "fixtures/fs-check");

    it("E010: detects non-existent plugin directory", () => {
      const data = loadFixture("fs-check/marketplace.json");
      const result = validate(data, { basePath: fsBasePath });
      const e010 = result.errors.filter((e) => e.rule === "E010");
      expect(e010.length).toBeGreaterThan(0);
      expect(e010.some((e) => e.message.includes("does-not-exist"))).toBe(true);
    });

    it("E011: detects missing .claude-plugin/plugin.json when strict is true (default)", () => {
      const data = loadFixture("fs-check/marketplace.json");
      const result = validate(data, { basePath: fsBasePath });
      const e011 = result.errors.filter((e) => e.rule === "E011");
      expect(e011.length).toBeGreaterThan(0);
      expect(e011.some((e) => e.message.includes("without-manifest"))).toBe(true);
    });

    it("no E011 for plugin with .claude-plugin/plugin.json", () => {
      const data = {
        name: "test",
        owner: { name: "Owner" },
        plugins: [
          { name: "with-manifest", source: "./plugins/with-manifest" },
        ],
      };
      const result = validate(data, { basePath: fsBasePath });
      expect(result.errors.filter((e) => e.rule === "E011")).toHaveLength(0);
    });

    it("no E011 when strict: false (plugin.json not required)", () => {
      const data = {
        name: "test",
        owner: { name: "Owner" },
        plugins: [
          { name: "without-manifest", source: "./plugins/without-manifest", strict: false },
        ],
      };
      const result = validate(data, { basePath: fsBasePath });
      expect(result.errors.filter((e) => e.rule === "E011")).toHaveLength(0);
    });

    it("W005: warns when strict: false but plugin.json exists", () => {
      const data = {
        name: "test",
        owner: { name: "Owner" },
        plugins: [
          { name: "strict-false-with-manifest", source: "./plugins/strict-false-with-manifest", strict: false },
        ],
      };
      const result = validate(data, { basePath: fsBasePath });
      expect(result.warnings.some((w) => w.rule === "W005")).toBe(true);
    });

    it("skips filesystem checks for github source objects", () => {
      const data = {
        name: "test",
        owner: { name: "Owner" },
        plugins: [
          { name: "github-plugin", source: { source: "github", repo: "owner/repo" } },
        ],
      };
      const result = validate(data, { basePath: fsBasePath });
      expect(result.errors.filter((e) => e.rule === "E010")).toHaveLength(0);
      expect(result.errors.filter((e) => e.rule === "E011")).toHaveLength(0);
    });

    it("skips filesystem checks when basePath not provided", () => {
      const data = {
        name: "test",
        owner: { name: "Owner" },
        plugins: [
          { name: "nonexistent", source: "./does-not-exist" },
        ],
      };
      const result = validate(data); // no basePath
      expect(result.errors.filter((e) => e.rule === "E010")).toHaveLength(0);
    });
  });

  describe("unregistered plugin detection (W007)", () => {
    const fsBasePath = resolve(import.meta.dirname, "fixtures/fs-check");

    it("W007: detects plugin directory with plugin.json not registered in marketplace.json", () => {
      const data = {
        name: "test",
        owner: { name: "Owner" },
        metadata: { pluginRoot: "plugins" },
        plugins: [
          { name: "with-manifest", source: "./with-manifest" },
        ],
      };
      const result = validate(data, { basePath: fsBasePath });
      const w007 = result.warnings.filter((w) => w.rule === "W007");
      expect(w007.length).toBeGreaterThan(0);
      expect(w007.some((w) => w.message.includes("unregistered-plugin"))).toBe(true);
    });

    it("no W007 for registered plugins", () => {
      const data = {
        name: "test",
        owner: { name: "Owner" },
        metadata: { pluginRoot: "plugins" },
        plugins: [
          { name: "with-manifest", source: "./with-manifest" },
          { name: "unregistered-plugin", source: "./unregistered-plugin" },
          { name: "strict-false-with-manifest", source: "./strict-false-with-manifest" },
        ],
      };
      const result = validate(data, { basePath: fsBasePath });
      const w007 = result.warnings.filter((w) => w.rule === "W007");
      expect(w007).toHaveLength(0);
    });

    it("skips W007 when basePath not provided", () => {
      const data = loadFixture("fs-check/marketplace.json");
      const result = validate(data);
      const w007 = result.warnings.filter((w) => w.rule === "W007");
      expect(w007).toHaveLength(0);
    });

    it("W007 respects metadata.pluginRoot for scan scope", () => {
      const data = {
        name: "test",
        owner: { name: "Owner" },
        metadata: { pluginRoot: "plugins" },
        plugins: [
          { name: "with-manifest", source: "./with-manifest" },
        ],
      };
      const result = validate(data, { basePath: fsBasePath });
      const w007 = result.warnings.filter((w) => w.rule === "W007");
      expect(w007.some((w) => w.message.includes("unregistered-plugin"))).toBe(true);
    });

    it("W007 does not flag directories without .claude-plugin/plugin.json", () => {
      const data = {
        name: "test",
        owner: { name: "Owner" },
        metadata: { pluginRoot: "plugins" },
        plugins: [],
      };
      const result = validate(data, { basePath: fsBasePath });
      const w007 = result.warnings.filter((w) => w.rule === "W007");
      // without-manifest has no .claude-plugin/plugin.json, should not be flagged
      expect(w007.every((w) => !w.message.includes("without-manifest"))).toBe(true);
    });
  });

  describe("source format checks", () => {
    it("detects invalid github repo format (missing slash)", () => {
      const data = {
        name: "test",
        owner: { name: "Owner" },
        plugins: [
          { name: "plugin", source: { source: "github", repo: "just-repo-name" } },
        ],
      };
      const result = validate(data);
      expect(result.errors.some((e) => e.rule === "E009" && e.path.includes("repo"))).toBe(true);
    });

    it("accepts valid github repo format", () => {
      const data = {
        name: "test",
        owner: { name: "Owner" },
        plugins: [
          { name: "plugin", source: { source: "github", repo: "owner/repo" } },
        ],
      };
      const result = validate(data);
      expect(result.errors.filter((e) => e.path.includes("repo"))).toHaveLength(0);
    });
  });

  describe("kebab-case warnings (W006)", () => {
    it("warns for non-kebab-case marketplace name", () => {
      const data = {
        name: "My Marketplace",
        owner: { name: "Owner" },
        plugins: [{ name: "plugin", source: "./test" }],
      };
      const result = validate(data);
      expect(result.warnings.some((w) => w.rule === "W006" && w.path === "name")).toBe(true);
    });

    it("warns for non-kebab-case plugin name", () => {
      const data = {
        name: "test",
        owner: { name: "Owner" },
        plugins: [{ name: "MyPlugin", source: "./test" }],
      };
      const result = validate(data);
      expect(result.warnings.some((w) => w.rule === "W006" && w.path.includes("plugins"))).toBe(true);
    });

    it("no W006 for kebab-case names", () => {
      const data = {
        name: "my-marketplace",
        owner: { name: "Owner" },
        plugins: [{ name: "my-plugin", source: "./test" }],
      };
      const result = validate(data);
      expect(result.warnings.filter((w) => w.rule === "W006")).toHaveLength(0);
    });
  });

  describe("strict mode", () => {
    it("fails when warnings exist in strict mode", () => {
      const data = loadFixture("valid/minimal.json");
      const result = validate(data, { strict: true });
      expect(result.valid).toBe(false);
    });
  });

  describe("info rules", () => {
    it("reports pre-release versions (I001)", () => {
      const data = {
        name: "test",
        owner: { name: "Owner" },
        plugins: [
          { name: "plugin", source: "./test", version: "1.0.0-beta.1" },
        ],
      };
      const result = validate(data);
      expect(result.infos.some((i) => i.rule === "I001")).toBe(true);
    });

    it("reports too many tags (I002)", () => {
      const data = {
        name: "test",
        owner: { name: "Owner" },
        plugins: [
          {
            name: "plugin",
            source: "./test",
            tags: Array.from({ length: 15 }, (_, i) => `tag-${i}`),
          },
        ],
      };
      const result = validate(data);
      expect(result.infos.some((i) => i.rule === "I002")).toBe(true);
    });
  });

  describe("edge cases", () => {
    it("handles non-object input", () => {
      const result = validate("string");
      expect(result.valid).toBe(false);
    });

    it("handles null input", () => {
      const result = validate(null);
      expect(result.valid).toBe(false);
    });

    it("handles empty object", () => {
      const result = validate({});
      expect(result.valid).toBe(false);
    });
  });
});
