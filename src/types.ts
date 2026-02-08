export type Severity = "error" | "warning" | "info";

export interface ValidationIssue {
  severity: Severity;
  rule: string;
  path: string;
  field?: string;
  value?: unknown;
  message: string;
  suggestion?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  infos: ValidationIssue[];
}

export interface ValidateOptions {
  strict?: boolean;
  /** Base directory for resolving relative plugin source paths */
  basePath?: string;
}

export type OutputFormat = "text" | "json" | "compact";

export interface ReporterOptions {
  format: OutputFormat;
  quiet?: boolean;
  noColor?: boolean;
}

export interface CLIOptions {
  format: OutputFormat;
  strict: boolean;
  quiet: boolean;
  color: boolean;
}
