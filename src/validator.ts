import { existsSync, readdirSync } from "node:fs";
import { resolve, join, relative } from "node:path";
import type { z } from "zod";
import { marketplaceSchema, VALID_CATEGORIES, KEBAB_CASE_REGEX, SEMVER_REGEX } from "./schema.js";
import type { ValidateOptions, ValidationIssue, ValidationResult } from "./types.js";

function zodPathToString(path: PropertyKey[]): string {
  if (path.length === 0) return "root";
  return path
    .map((segment, index) => {
      if (typeof segment === "number") {
        return `[${segment}]`;
      }
      return index === 0 ? String(segment) : `.${String(segment)}`;
    })
    .join("");
}

function mapZodIssueToRule(issue: z.core.$ZodIssue, path: string): { rule: string; suggestion?: string } {
  const lastSegment = issue.path[issue.path.length - 1];

  if (issue.code === "invalid_type" && issue.input === undefined) {
    return {
      rule: "E001",
      suggestion: `Add the required "${String(lastSegment)}" field.`,
    };
  }

  if (issue.code === "invalid_type") {
    return {
      rule: "E002",
      suggestion: `Expected ${issue.expected}.`,
    };
  }

  if (issue.code === "invalid_format" && issue.format === "email") {
    return {
      rule: "E004",
      suggestion: "Provide a valid email address (e.g., user@example.com).",
    };
  }

  if (issue.code === "invalid_format" && issue.format === "url") {
    return {
      rule: "E005",
      suggestion: "Provide a valid URL (e.g., https://example.com).",
    };
  }

  if (issue.code === "invalid_value") {
    return {
      rule: "E006",
      suggestion: `Valid categories: ${VALID_CATEGORIES.join(", ")}`,
    };
  }

  if (issue.code === "invalid_format" && issue.format === "regex") {
    return {
      rule: "E003",
      suggestion: 'Expected format: MAJOR.MINOR.PATCH (e.g., "1.0.0").',
    };
  }

  if (issue.code === "too_small" && path.endsWith("plugins")) {
    return {
      rule: "E008",
    };
  }

  if (issue.code === "invalid_union") {
    if (path.includes("source")) {
      return {
        rule: "E009",
        suggestion: 'Expected a string (path or URL) or object with source "github" or "url".',
      };
    }
  }

  return { rule: "E002" };
}

function zodIssuesToValidationIssues(zodError: z.ZodError): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const issue of zodError.issues) {
    if (issue.code === "invalid_union" && issue.errors.length > 0) {
      // In Zod v4, errors is an array of arrays of issues
      const bestBranch = issue.errors
        .sort((a, b) => a.length - b.length)[0];
      if (bestBranch && bestBranch.length > 0) {
        for (const subIssue of bestBranch) {
          const fullPath = [...issue.path, ...subIssue.path];
          const path = zodPathToString(fullPath);
          const { rule, suggestion } = mapZodIssueToRule(subIssue, path);
          issues.push({
            severity: "error",
            rule,
            path,
            field: String(fullPath[fullPath.length - 1] ?? ""),
            message: subIssue.message,
            suggestion,
          });
        }
        continue;
      }
    }

    const path = zodPathToString(issue.path);
    const { rule, suggestion } = mapZodIssueToRule(issue, path);
    issues.push({
      severity: "error",
      rule,
      path,
      field: String(issue.path[issue.path.length - 1] ?? ""),
      message: issue.message,
      suggestion,
    });
  }

  return issues;
}

function checkDuplicatePluginNames(data: Record<string, unknown>): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const plugins = data.plugins;

  if (!Array.isArray(plugins)) return issues;

  const nameMap = new Map<string, number>();
  for (let i = 0; i < plugins.length; i++) {
    const plugin = plugins[i] as Record<string, unknown> | undefined;
    if (!plugin || typeof plugin.name !== "string") continue;

    const name = plugin.name;
    const firstIndex = nameMap.get(name);
    if (firstIndex !== undefined) {
      issues.push({
        severity: "error",
        rule: "E007",
        path: `plugins[${i}].name`,
        field: "name",
        value: name,
        message: `Duplicate plugin name "${name}"`,
        suggestion: `First occurrence at plugins[${firstIndex}]. Each plugin must have a unique name.`,
      });
    } else {
      nameMap.set(name, i);
    }
  }

  return issues;
}

/**
 * Resolve the effective source path for a plugin, considering metadata.pluginRoot
 */
function resolvePluginSourcePath(
  source: string,
  basePath: string,
  pluginRoot?: string,
): string {
  if (pluginRoot) {
    return resolve(basePath, pluginRoot, source);
  }
  return resolve(basePath, source);
}

/**
 * Check if a source string is a relative path (not URL, not absolute)
 */
function isRelativePath(source: string): boolean {
  return source.startsWith("./") || source.startsWith("../");
}

/**
 * E010: Check that relative source paths actually point to existing directories
 * E011: Check that each plugin directory has .claude-plugin/plugin.json (when strict != false)
 */
function checkPluginDirectories(
  data: Record<string, unknown>,
  basePath: string | undefined,
): { errors: ValidationIssue[]; warnings: ValidationIssue[] } {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const plugins = data.plugins;

  if (!Array.isArray(plugins) || !basePath) return { errors, warnings };

  const metadata = data.metadata as Record<string, unknown> | undefined;
  const pluginRoot = typeof metadata?.pluginRoot === "string" ? metadata.pluginRoot : undefined;

  for (let i = 0; i < plugins.length; i++) {
    const plugin = plugins[i] as Record<string, unknown> | undefined;
    if (!plugin) continue;

    const source = plugin.source;
    let resolvedPath: string | undefined;

    // Determine the resolved source path for relative paths
    if (typeof source === "string" && isRelativePath(source)) {
      resolvedPath = resolvePluginSourcePath(source, basePath, pluginRoot);
    } else if (
      source &&
      typeof source === "object" &&
      !Array.isArray(source)
    ) {
      // Not a relative path for object sources - skip directory checks
      continue;
    } else if (typeof source === "string") {
      // Absolute path or URL - skip for non-relative strings
      // Check if it looks like a URL
      try {
        new URL(source);
        continue; // It's a URL, skip directory check
      } catch {
        // Not a URL, could be an absolute path
        resolvedPath = resolve(basePath, source);
      }
    } else {
      continue;
    }

    if (!resolvedPath) continue;

    // E010: Check if plugin directory exists
    if (!existsSync(resolvedPath)) {
      errors.push({
        severity: "error",
        rule: "E010",
        path: `plugins[${i}].source`,
        field: "source",
        value: typeof source === "string" ? source : JSON.stringify(source),
        message: `Plugin directory not found: ${resolvedPath}`,
        suggestion: `Ensure the directory exists at the specified source path. Relative paths are resolved from the marketplace.json location.`,
      });
      continue; // Skip plugin.json check if dir doesn't exist
    }

    // Check for path traversal
    if (typeof source === "string" && source.includes("..")) {
      errors.push({
        severity: "error",
        rule: "E012",
        path: `plugins[${i}].source`,
        field: "source",
        value: source,
        message: `Path traversal not allowed in source: "${source}"`,
        suggestion: `Use paths relative to the marketplace root without "..". Move the plugin inside the marketplace directory.`,
      });
    }

    // E011: Check for .claude-plugin/plugin.json
    const pluginStrict = plugin.strict;
    const isStrict = pluginStrict === undefined || pluginStrict === true;
    const pluginJsonPath = join(resolvedPath, ".claude-plugin", "plugin.json");

    if (isStrict && !existsSync(pluginJsonPath)) {
      errors.push({
        severity: "error",
        rule: "E011",
        path: `plugins[${i}]`,
        field: "plugin.json",
        value: pluginJsonPath,
        message: `Missing .claude-plugin/plugin.json in plugin directory "${typeof source === "string" ? source : ""}"`,
        suggestion: `Create a .claude-plugin/plugin.json manifest in the plugin directory, or set "strict": false in the marketplace entry to define the plugin entirely in marketplace.json.`,
      });
    }

    if (!isStrict) {
      // When strict: false, check that plugin.json does NOT declare components
      // (marketplace entry defines everything)
      if (existsSync(pluginJsonPath)) {
        warnings.push({
          severity: "warning",
          rule: "W005",
          path: `plugins[${i}]`,
          field: "strict",
          message: `Plugin "${plugin.name}" has strict: false but .claude-plugin/plugin.json exists`,
          suggestion: `When strict is false, the marketplace entry defines the plugin entirely. The plugin.json should not declare components (commands, agents, hooks, mcpServers, lspServers).`,
        });
      }
    }
  }

  return { errors, warnings };
}

const SCAN_EXCLUDED_DIRS = new Set(["node_modules", ".git"]);

/**
 * W007: Detect plugin directories on disk that are not registered in marketplace.json
 */
function checkUnregisteredPlugins(
  data: Record<string, unknown>,
  basePath: string | undefined,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const plugins = data.plugins;

  if (!Array.isArray(plugins) || !basePath) return issues;

  const metadata = data.metadata as Record<string, unknown> | undefined;
  const pluginRoot = typeof metadata?.pluginRoot === "string" ? metadata.pluginRoot : undefined;
  const scanRoot = pluginRoot ? resolve(basePath, pluginRoot) : basePath;

  if (!existsSync(scanRoot)) return issues;

  // Collect registered relative source paths (normalized)
  const registeredPaths = new Set<string>();
  for (const plugin of plugins) {
    const p = plugin as Record<string, unknown> | undefined;
    if (!p) continue;
    const source = p.source;
    if (typeof source !== "string" || !isRelativePath(source)) continue;
    const resolved = resolvePluginSourcePath(source, basePath, pluginRoot);
    registeredPaths.add(resolved);
  }

  let entries: string[];
  try {
    entries = readdirSync(scanRoot, { withFileTypes: true })
      .filter((e) => e.isDirectory() && !e.name.startsWith(".") && !SCAN_EXCLUDED_DIRS.has(e.name))
      .map((e) => e.name);
  } catch {
    return issues;
  }

  for (const dirName of entries) {
    const dirPath = resolve(scanRoot, dirName);
    const pluginJsonPath = join(dirPath, ".claude-plugin", "plugin.json");

    if (!existsSync(pluginJsonPath)) continue;
    if (registeredPaths.has(dirPath)) continue;

    const relativePath = `./${relative(pluginRoot ? resolve(basePath, pluginRoot) : basePath, dirPath)}`;
    issues.push({
      severity: "warning",
      rule: "W007",
      path: relativePath,
      field: "source",
      message: `Plugin directory "${dirName}" contains .claude-plugin/plugin.json but is not registered in marketplace.json`,
      suggestion: `Add an entry to the "plugins" array in marketplace.json with source "${relativePath}".`,
    });
  }

  return issues;
}

/**
 * Check source object format validity beyond what Zod catches
 */
function checkSourceFormat(data: Record<string, unknown>): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const plugins = data.plugins;

  if (!Array.isArray(plugins)) return issues;

  for (let i = 0; i < plugins.length; i++) {
    const plugin = plugins[i] as Record<string, unknown> | undefined;
    if (!plugin) continue;

    const source = plugin.source;
    if (!source || typeof source !== "object" || Array.isArray(source)) continue;

    const sourceObj = source as Record<string, unknown>;
    const sourceType = sourceObj.source;

    // Validate that source object has a valid "source" discriminator
    if (typeof sourceType !== "string") {
      issues.push({
        severity: "error",
        rule: "E009",
        path: `plugins[${i}].source`,
        field: "source",
        message: `Invalid source object: missing "source" field`,
        suggestion: `Source objects must have a "source" field set to "github" or "url".`,
      });
      continue;
    }

    if (sourceType !== "github" && sourceType !== "url") {
      issues.push({
        severity: "error",
        rule: "E009",
        path: `plugins[${i}].source.source`,
        field: "source",
        value: sourceType,
        message: `Invalid source type "${sourceType}"`,
        suggestion: `Valid source types are "github" and "url".`,
      });
      continue;
    }

    // E010: Check github source has valid repo format (owner/repo)
    if (sourceType === "github") {
      const repo = sourceObj.repo;
      if (typeof repo === "string" && !repo.includes("/")) {
        issues.push({
          severity: "error",
          rule: "E009",
          path: `plugins[${i}].source.repo`,
          field: "repo",
          value: repo,
          message: `Invalid GitHub repo format "${repo}"`,
          suggestion: `Use "owner/repo" format (e.g., "anthropics/claude-plugins-official").`,
        });
      }
    }
  }

  return issues;
}

function checkWarnings(data: Record<string, unknown>): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // W001: Missing marketplace description (in metadata)
  const metadata = data.metadata as Record<string, unknown> | undefined;
  if (!metadata?.description) {
    issues.push({
      severity: "warning",
      rule: "W001",
      path: "metadata.description",
      field: "description",
      message: "No marketplace description provided",
      suggestion: "Add a metadata.description to help users understand what this marketplace offers.",
    });
  }

  const plugins = data.plugins;
  if (!Array.isArray(plugins)) return issues;

  // Check names are kebab-case
  if (typeof data.name === "string" && !KEBAB_CASE_REGEX.test(data.name)) {
    issues.push({
      severity: "warning",
      rule: "W006",
      path: "name",
      field: "name",
      value: data.name,
      message: `Marketplace name "${data.name}" is not kebab-case`,
      suggestion: `Use kebab-case (lowercase with hyphens) for the marketplace name (e.g., "my-marketplace").`,
    });
  }

  for (let i = 0; i < plugins.length; i++) {
    const plugin = plugins[i] as Record<string, unknown> | undefined;
    if (!plugin) continue;

    // W006: Plugin name not kebab-case
    if (typeof plugin.name === "string" && !KEBAB_CASE_REGEX.test(plugin.name)) {
      issues.push({
        severity: "warning",
        rule: "W006",
        path: `plugins[${i}].name`,
        field: "name",
        value: plugin.name,
        message: `Plugin name "${plugin.name}" is not kebab-case`,
        suggestion: `Use kebab-case (lowercase with hyphens) for plugin names (e.g., "my-plugin").`,
      });
    }

    // W002: Missing description
    if (!plugin.description) {
      issues.push({
        severity: "warning",
        rule: "W002",
        path: `plugins[${i}]`,
        field: "description",
        message: `Missing "description" at plugins[${i}]`,
        suggestion: "A description helps users understand what the plugin does.",
      });
    }

    // W003: Missing tags/keywords
    if (!plugin.tags && !plugin.keywords) {
      issues.push({
        severity: "warning",
        rule: "W003",
        path: `plugins[${i}]`,
        field: "tags",
        message: `Missing "tags" or "keywords" at plugins[${i}]`,
        suggestion: "Tags improve plugin discoverability in search.",
      });
    }

    // W004: Empty description
    if (typeof plugin.description === "string" && plugin.description.trim() === "") {
      issues.push({
        severity: "warning",
        rule: "W004",
        path: `plugins[${i}].description`,
        field: "description",
        message: `Empty "description" at plugins[${i}]`,
        suggestion: "A meaningful description helps users understand what the plugin does.",
      });
    }
  }

  return issues;
}

function checkInfos(data: Record<string, unknown>): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const plugins = data.plugins;
  if (!Array.isArray(plugins)) return issues;

  for (let i = 0; i < plugins.length; i++) {
    const plugin = plugins[i] as Record<string, unknown> | undefined;
    if (!plugin) continue;

    // I001: Pre-release version
    if (typeof plugin.version === "string" && SEMVER_REGEX.test(plugin.version)) {
      const preReleaseMatch = plugin.version.match(
        /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)-(.+)/,
      );
      if (preReleaseMatch) {
        issues.push({
          severity: "info",
          rule: "I001",
          path: `plugins[${i}].version`,
          field: "version",
          value: plugin.version,
          message: `Version "${plugin.version}" is a pre-release version`,
        });
      }
    }

    // I002: Too many tags
    const tags = plugin.tags ?? plugin.keywords;
    if (Array.isArray(tags) && tags.length > 10) {
      issues.push({
        severity: "info",
        rule: "I002",
        path: `plugins[${i}].tags`,
        field: "tags",
        value: tags.length,
        message: `plugins[${i}] has ${tags.length} tags. Consider using fewer than 10 tags for better discoverability`,
      });
    }
  }

  return issues;
}

export function validate(data: unknown, options?: ValidateOptions): ValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const infos: ValidationIssue[] = [];

  // Schema validation with Zod
  const result = marketplaceSchema.safeParse(data);

  if (!result.success) {
    errors.push(...zodIssuesToValidationIssues(result.error));
  }

  // Custom rules (run on raw data to catch issues even when schema fails)
  if (data && typeof data === "object") {
    const rawData = data as Record<string, unknown>;

    errors.push(...checkDuplicatePluginNames(rawData));
    errors.push(...checkSourceFormat(rawData));

    // Filesystem checks (only when basePath is provided)
    const dirChecks = checkPluginDirectories(rawData, options?.basePath);
    errors.push(...dirChecks.errors);
    warnings.push(...dirChecks.warnings);

    // W007: Unregistered plugin detection
    warnings.push(...checkUnregisteredPlugins(rawData, options?.basePath));

    warnings.push(...checkWarnings(rawData));
    infos.push(...checkInfos(rawData));
  }

  const isValid = options?.strict
    ? errors.length === 0 && warnings.length === 0
    : errors.length === 0;

  return {
    valid: isValid,
    errors,
    warnings,
    infos,
  };
}
