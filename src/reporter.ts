import chalk from "chalk";
import type { ReporterOptions, ValidationIssue, ValidationResult } from "./types.js";

function severityIcon(severity: string, noColor: boolean): string {
  if (noColor) {
    switch (severity) {
      case "error":
        return "ERROR";
      case "warning":
        return "WARN ";
      case "info":
        return "INFO ";
      default:
        return "     ";
    }
  }

  switch (severity) {
    case "error":
      return chalk.red.bold("ERROR");
    case "warning":
      return chalk.yellow.bold("WARN ");
    case "info":
      return chalk.blue.bold("INFO ");
    default:
      return "     ";
  }
}

function formatIssueText(issue: ValidationIssue, noColor: boolean): string {
  const icon = severityIcon(issue.severity, noColor);
  const ruleId = noColor ? issue.rule : chalk.dim(issue.rule);
  const lines = [`  ${icon}  ${ruleId}  ${issue.message}`];

  if (issue.suggestion) {
    const indent = "               ";
    lines.push(`${indent}${noColor ? issue.suggestion : chalk.dim(issue.suggestion)}`);
  }

  return lines.join("\n");
}

function formatText(result: ValidationResult, options: ReporterOptions): string {
  const noColor = options.noColor ?? false;
  const lines: string[] = [];

  const allIssues: ValidationIssue[] = [
    ...result.errors,
    ...result.warnings,
    ...(options.quiet ? [] : result.infos),
  ];

  if (options.quiet) {
    allIssues.length = 0;
    allIssues.push(...result.errors);
  }

  for (const issue of allIssues) {
    lines.push(formatIssueText(issue, noColor));
  }

  if (lines.length > 0) {
    lines.push("");
  }

  // Summary
  const parts: string[] = [];
  if (result.errors.length > 0) {
    const msg = `${result.errors.length} error${result.errors.length === 1 ? "" : "s"}`;
    parts.push(noColor ? msg : chalk.red(msg));
  }
  if (!options.quiet && result.warnings.length > 0) {
    const msg = `${result.warnings.length} warning${result.warnings.length === 1 ? "" : "s"}`;
    parts.push(noColor ? msg : chalk.yellow(msg));
  }
  if (!options.quiet && result.infos.length > 0) {
    const msg = `${result.infos.length} info`;
    parts.push(noColor ? msg : chalk.blue(msg));
  }

  if (parts.length > 0) {
    lines.push(`  ${parts.join(", ")}`);
    lines.push("");
  }

  if (result.valid) {
    if (allIssues.length === 0 && parts.length === 0) {
      const msg = "Validation passed. No issues found.";
      lines.push(`  ${noColor ? msg : chalk.green(msg)}`);
    } else {
      const msg = "Validation passed.";
      lines.push(`  ${noColor ? msg : chalk.green(msg)}`);
    }
  } else {
    const msg = "Validation failed.";
    lines.push(`  ${noColor ? msg : chalk.red(msg)}`);
  }

  return lines.join("\n");
}

function formatJSON(result: ValidationResult, options: ReporterOptions): string {
  const allIssues: ValidationIssue[] = [
    ...result.errors,
    ...(options.quiet ? [] : result.warnings),
    ...(options.quiet ? [] : result.infos),
  ];

  const output = {
    valid: result.valid,
    summary: {
      errors: result.errors.length,
      warnings: result.warnings.length,
      info: result.infos.length,
    },
    issues: allIssues.map((issue) => ({
      severity: issue.severity,
      rule: issue.rule,
      path: issue.path,
      field: issue.field ?? null,
      value: issue.value ?? null,
      message: issue.message,
      suggestion: issue.suggestion ?? null,
    })),
  };

  return JSON.stringify(output, null, 2);
}

function formatCompact(result: ValidationResult, options: ReporterOptions): string {
  const allIssues: ValidationIssue[] = [
    ...result.errors,
    ...(options.quiet ? [] : result.warnings),
    ...(options.quiet ? [] : result.infos),
  ];

  return allIssues
    .map((issue) => `${issue.severity}[${issue.rule}] ${issue.path}: ${issue.message}`)
    .join("\n");
}

export function formatResult(result: ValidationResult, options: ReporterOptions): string {
  switch (options.format) {
    case "json":
      return formatJSON(result, options);
    case "compact":
      return formatCompact(result, options);
    case "text":
    default:
      return formatText(result, options);
  }
}
