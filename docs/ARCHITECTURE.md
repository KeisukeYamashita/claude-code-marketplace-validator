# Claude Code Marketplace Validator - Technical Architecture

## 1. Project File Structure

```
marketplace-validator/
├── src/
│   ├── index.ts          # CLI entry point (bin target)
│   ├── cli.ts            # Commander.js CLI setup and option parsing
│   ├── schema.ts         # Zod schema definitions for marketplace.json
│   ├── validator.ts      # Validation engine orchestrating schema + custom rules
│   ├── reporter.ts       # Output formatting (text, JSON, GitHub Actions)
│   ├── loader.ts         # File loading, JSON parsing, and error wrapping
│   └── types.ts          # Shared TypeScript type definitions
├── tests/
│   ├── schema.test.ts    # Schema validation unit tests
│   ├── validator.test.ts # Validation engine tests
│   ├── reporter.test.ts  # Reporter output format tests
│   ├── cli.test.ts       # CLI integration tests
│   └── fixtures/         # Sample marketplace.json files for testing
│       ├── valid/
│       │   ├── minimal.json
│       │   └── full.json
│       └── invalid/
│           ├── missing-required.json
│           ├── bad-semver.json
│           ├── bad-category.json
│           ├── bad-email.json
│           └── bad-url.json
├── docs/
│   └── ARCHITECTURE.md
├── examples/
│   └── marketplace.json  # Reference example file
├── package.json
├── tsconfig.json
├── tsup.config.ts        # Build configuration
└── vitest.config.ts      # Test configuration
```

## 2. Technology Stack

| Tool          | Purpose                            | Version  |
|---------------|------------------------------------|----------|
| TypeScript    | Language                           | ~5.x     |
| Zod           | Schema definition and validation   | ^3.x     |
| Commander.js  | CLI argument and option parsing    | ^12.x    |
| chalk         | Terminal color output              | ^5.x     |
| vitest        | Unit and integration testing       | ^2.x     |
| tsup          | TypeScript bundling for CLI binary | ^8.x     |

## 3. Module Responsibilities

### `src/index.ts` - Entry Point

The bin entry point. Bootstraps the CLI.

```typescript
#!/usr/bin/env node
import { run } from "./cli.js";
run(process.argv);
```

### `src/cli.ts` - CLI Setup

Defines the Commander.js program with commands, options, and wiring.

**Public API:**

```typescript
function run(argv: string[]): void;
```

**CLI Interface:**

```
marketplace-validator <file> [options]

Arguments:
  file                   Path to marketplace.json file

Options:
  -f, --format <type>    Output format: text | json (default: "text")
  --strict               Treat warnings as errors
  -q, --quiet            Only output errors (suppress warnings)
  -v, --version          Show version number
  -h, --help             Show help
```

**Exit Codes:**
- `0` - Validation passed (no errors)
- `1` - Validation failed (errors found)
- `2` - Runtime error (file not found, invalid JSON, etc.)

### `src/schema.ts` - Zod Schema Definitions

Contains all Zod schemas that map to the marketplace.json structure.

**Public API:**

```typescript
// Schemas
const authorSchema: z.ZodObject;      // { name: string, email?: string }
const ownerSchema: z.ZodObject;       // { name: string, email: string }
const pluginSchema: z.ZodObject;      // Full plugin definition
const marketplaceSchema: z.ZodObject;  // Root marketplace.json schema

// Category enum
const VALID_CATEGORIES: readonly string[];
// ["development", "productivity", "testing", "database",
//  "deployment", "design", "learning", "monitoring", "security"]

// Inferred types
type Author = z.infer<typeof authorSchema>;
type Owner = z.infer<typeof ownerSchema>;
type Plugin = z.infer<typeof pluginSchema>;
type Marketplace = z.infer<typeof marketplaceSchema>;
```

**Schema Details:**

| Field              | Type     | Required | Validation                              |
|--------------------|----------|----------|-----------------------------------------|
| `$schema`          | string   | No       | URL format if present                   |
| `name`             | string   | Yes      | Non-empty                               |
| `description`      | string   | Yes      | Non-empty                               |
| `owner.name`       | string   | Yes      | Non-empty                               |
| `owner.email`      | string   | Yes      | Email format                            |
| `plugins`          | array    | Yes      | Min 1 item                              |
| `plugin.name`      | string   | Yes      | Non-empty                               |
| `plugin.description` | string | Yes      | Non-empty                               |
| `plugin.version`   | string   | Yes      | Semver format (x.y.z)                   |
| `plugin.author.name` | string | Yes      | Non-empty                               |
| `plugin.author.email` | string | No     | Email format if present                 |
| `plugin.source`    | string   | Yes      | Non-empty                               |
| `plugin.category`  | enum     | Yes      | One of VALID_CATEGORIES                 |
| `plugin.homepage`  | string   | No       | URL format if present                   |
| `plugin.strict`    | boolean  | No       | Boolean                                 |
| `plugin.tags`      | string[] | No       | Array of non-empty strings              |
| `plugin.lspServers`| object   | No       | Record<string, object>                  |

### `src/validator.ts` - Validation Engine

Orchestrates schema validation via Zod and applies any additional custom rules. Converts Zod errors into our `ValidationResult` format.

**Public API:**

```typescript
interface ValidateOptions {
  strict?: boolean;   // Treat warnings as errors
}

function validate(data: unknown, options?: ValidateOptions): ValidationResult;
```

**Custom Rules (beyond Zod schema):**

1. **Duplicate plugin names**: Warn if two plugins share the same name.
2. **Duplicate plugin source**: Warn if two plugins share the same source.
3. **Version format**: Error if version is not valid semver (already in Zod, but with a clearer message).

### `src/reporter.ts` - Output Formatting

Formats `ValidationResult` for terminal or machine consumption.

**Public API:**

```typescript
type OutputFormat = "text" | "json";

interface ReporterOptions {
  format: OutputFormat;
  quiet?: boolean;      // Suppress warnings in output
}

function formatResult(result: ValidationResult, options: ReporterOptions): string;
```

**Text Format Example:**

```
marketplace.json validation failed

  ERROR  plugins[0].version - Invalid semver format "1.0" (expected "x.y.z")
  ERROR  plugins[1].category - Invalid category "unknown". Valid: development, productivity, ...
  WARN   plugins[0].name - Duplicate plugin name "my-plugin"

Found 2 errors and 1 warning.
```

**JSON Format Example:**

```json
{
  "valid": false,
  "errors": [
    {
      "path": "plugins[0].version",
      "message": "Invalid semver format \"1.0\" (expected \"x.y.z\")",
      "severity": "error"
    }
  ],
  "warnings": [
    {
      "path": "plugins[0].name",
      "message": "Duplicate plugin name \"my-plugin\"",
      "severity": "warning"
    }
  ],
  "summary": {
    "errorCount": 2,
    "warningCount": 1
  }
}
```

### `src/loader.ts` - File Loading

Reads and parses the marketplace.json file from disk. Provides clear error messages for common failure modes.

**Public API:**

```typescript
function loadMarketplaceFile(filePath: string): unknown;
```

**Error Handling:**
- File not found: Throws with descriptive message including the resolved path.
- Permission denied: Throws with descriptive message.
- Invalid JSON: Throws with descriptive message including the JSON parse error position.

### `src/types.ts` - Type Definitions

Shared types used across modules.

```typescript
type Severity = "error" | "warning";

interface ValidationIssue {
  path: string;        // JSON path e.g. "plugins[0].version"
  message: string;     // Human-readable description
  severity: Severity;
}

interface ValidationResult {
  valid: boolean;             // true if no errors (warnings allowed unless strict)
  errors: ValidationIssue[];  // severity === "error"
  warnings: ValidationIssue[]; // severity === "warning"
}
```

## 4. Data Flow

```
                  ┌──────────────┐
                  │   CLI (cli)  │  Parse args, resolve file path
                  └──────┬───────┘
                         │ filePath, options
                         v
                  ┌──────────────┐
                  │ Loader       │  Read file, parse JSON
                  │ (loader)     │  Throw on file/parse errors
                  └──────┬───────┘
                         │ parsed data (unknown)
                         v
                  ┌──────────────┐
                  │ Validator    │  1. Zod schema validation
                  │ (validator)  │  2. Custom rules (duplicates)
                  └──────┬───────┘  3. Merge results
                         │ ValidationResult
                         v
                  ┌──────────────┐
                  │ Reporter     │  Format for output (text/json)
                  │ (reporter)   │
                  └──────┬───────┘
                         │ formatted string
                         v
                  ┌──────────────┐
                  │ CLI          │  Print output
                  │ (exit code)  │  Exit with 0 or 1
                  └──────────────┘
```

**Sequence:**

1. `cli.ts` parses arguments via Commander.js, extracting file path and options.
2. `loader.ts` reads the file from disk and parses JSON. On failure, the CLI catches the error, prints it, and exits with code `2`.
3. `validator.ts` receives the parsed data (typed as `unknown`), runs Zod schema validation, then applies custom rules. Returns a `ValidationResult`.
4. `reporter.ts` takes the `ValidationResult` and formats it based on the chosen format (`text` or `json`).
5. `cli.ts` writes the formatted output to stdout and exits with code `0` (valid) or `1` (errors found).

## 5. Error Handling Strategy

### Layer 1: File System Errors (loader.ts)

Loader wraps all file operations in try/catch and throws descriptive errors:

```typescript
// Errors thrown by loader:
// - "File not found: /path/to/marketplace.json"
// - "Permission denied: /path/to/marketplace.json"
// - "Invalid JSON at position 42: Unexpected token '}'"
```

### Layer 2: Schema Validation Errors (validator.ts)

Zod errors are caught and mapped to `ValidationIssue[]`. The validator never throws; it always returns a `ValidationResult`. This ensures partial results are available even if some fields fail.

```typescript
// Zod error mapping:
// ZodError.issues[] -> ValidationIssue[]
// issue.path -> dot-notation path string
// issue.message -> human-readable message
```

### Layer 3: Custom Rule Errors (validator.ts)

Custom rules run after schema validation and append to the same result. They operate on the raw data so they can report issues even when schema validation fails on other fields.

### Layer 4: CLI Error Boundary (cli.ts)

The top-level CLI wraps everything in a try/catch as the final safety net:

```typescript
try {
  const data = loadMarketplaceFile(filePath);
  const result = validate(data, options);
  const output = formatResult(result, reporterOptions);
  console.log(output);
  process.exit(result.valid ? 0 : 1);
} catch (err) {
  console.error(chalk.red(`Error: ${err.message}`));
  process.exit(2);
}
```

## 6. Build and Distribution

### tsup Configuration

```typescript
// tsup.config.ts
import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "node18",
  clean: true,
  dts: true,
});
```

### package.json bin

```json
{
  "name": "marketplace-validator",
  "bin": {
    "marketplace-validator": "./dist/index.js"
  },
  "type": "module",
  "files": ["dist"]
}
```

### Test Configuration

```typescript
// vitest.config.ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    coverage: {
      provider: "v8",
      include: ["src/**"],
    },
  },
});
```

## 7. Design Decisions

1. **Zod over Ajv/JSON Schema**: Zod provides TypeScript-first schema definitions with inferred types, eliminating type duplication. The marketplace.json schema is small enough that Zod's runtime performance is sufficient.

2. **Single-file validation (no glob)**: The CLI validates exactly one file per invocation. Glob support can be added via shell (`marketplace-validator *.json`) without complicating the core logic.

3. **ESM-only**: The project targets Node.js 18+ and uses ESM (`"type": "module"`). No CommonJS compatibility needed for a CLI tool.

4. **No config file**: The CLI is opinionated by design. All behavior is controlled via command-line flags. No `.rc` files or config objects.

5. **Warnings vs Errors**: Schema violations are errors (exit code 1). Best-practice violations (duplicates) are warnings (exit code 0 unless `--strict`). This gives users control over enforcement level.
