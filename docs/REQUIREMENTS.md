# Claude Code Marketplace Validator - Product Requirements

## 1. Overview

The **marketplace-validator** CLI validates `marketplace.json` configuration files used by the Claude Code Marketplace. It ensures plugin definitions are correct, complete, and follow best practices before publishing.

## 2. Target Users

| User | Use Case |
|------|----------|
| **Plugin Developers** | Validate `marketplace.json` locally before submitting plugins to the marketplace |
| **Marketplace Maintainers** | Review and validate incoming plugin submissions programmatically |
| **CI/CD Pipelines** | Automated validation as a gate in pull requests and release workflows |

## 3. marketplace.json Schema

### Root-Level Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `$schema` | `string` | No (recommended) | JSON Schema URL for editor support |
| `name` | `string` | Yes | Marketplace package name |
| `description` | `string` | Yes | Human-readable description of the package |
| `owner` | `object` | Yes | Package owner information |
| `owner.name` | `string` | Yes | Owner's name |
| `owner.email` | `string` | Yes | Owner's email (must be valid email format) |
| `plugins` | `array` | Yes | Array of plugin definitions (min 1 item) |

### Plugin Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | `string` | Yes | Unique plugin name within the package |
| `description` | `string` | Yes | Plugin description (non-empty) |
| `version` | `string` | Yes | Semantic version (e.g., `1.0.0`, `0.2.1-beta.1`) |
| `author` | `object` | Yes | Plugin author |
| `author.name` | `string` | Yes | Author's name |
| `author.email` | `string` | No | Author's email (must be valid if provided) |
| `source` | `string \| object` | Yes | Plugin source location (see Source Formats) |
| `category` | `string` | Yes | One of the valid category values |
| `homepage` | `string` | No (recommended) | URL to plugin homepage or docs |
| `strict` | `boolean` | No | Whether to enable strict mode for the plugin |
| `tags` | `string[]` | No (recommended) | Searchable tags for the plugin |
| `lspServers` | `object` | No | LSP server configuration |

### Valid Categories

```
development | productivity | testing | database | deployment | design | learning | monitoring | security
```

### Source Formats

A plugin source can be specified in three ways:

1. **String (relative path):** `"./plugins/my-plugin"`
2. **String (URL):** `"https://example.com/plugin.tar.gz"`
3. **Object:**
   - `{ "type": "github", "repo": "owner/repo" }`
   - `{ "type": "directory", "path": "./plugins/my-plugin" }`
   - `{ "type": "url", "url": "https://example.com/plugin.tar.gz" }`

## 4. CLI Commands and Flags

### Main Command

```
marketplace-validator validate [file]
```

- `[file]` defaults to `./marketplace.json` in the current working directory
- Reads and validates the specified marketplace.json file

### Flags

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--format` | `text \| json \| compact` | `text` | Output format |
| `--strict` | `boolean` | `false` | Treat warnings as errors (exit code 1) |
| `--quiet` | `boolean` | `false` | Show errors only, suppress warnings and info |
| `--no-color` | `boolean` | `false` | Disable colored output (auto-detected in non-TTY) |
| `--version` | - | - | Print CLI version and exit |
| `--help` | - | - | Print help text and exit |

## 5. Validation Rules

### Errors (Severity: error)

Errors cause validation to fail (exit code 1).

| Rule ID | Description | Example Message |
|---------|-------------|-----------------|
| `E001` | Missing required field | `Missing required field "name" at root` |
| `E002` | Invalid type | `Expected string for "name", got number at root.name` |
| `E003` | Invalid semantic version | `Invalid semver "1.0" at plugins[0].version. Expected format: MAJOR.MINOR.PATCH (e.g., "1.0.0")` |
| `E004` | Invalid email format | `Invalid email "not-an-email" at owner.email` |
| `E005` | Invalid URL format | `Invalid URL "not-a-url" at plugins[0].homepage` |
| `E006` | Invalid category | `Invalid category "unknown" at plugins[0].category. Valid categories: development, productivity, testing, database, deployment, design, learning, monitoring, security` |
| `E007` | Duplicate plugin names | `Duplicate plugin name "my-plugin" at plugins[1]. First occurrence at plugins[0]` |
| `E008` | Empty plugins array | `"plugins" array must contain at least one plugin` |
| `E009` | Invalid source format | `Invalid source at plugins[0].source. Expected a string (path or URL) or object with type "github", "directory", or "url"` |
| `E010` | Invalid source object | `Missing required field "repo" for source type "github" at plugins[0].source` |

### Warnings (Severity: warning)

Warnings indicate potential issues but do not fail validation (unless `--strict`).

| Rule ID | Description | Example Message |
|---------|-------------|-----------------|
| `W001` | Missing `$schema` field | `Missing "$schema" field. Adding a $schema enables editor autocompletion` |
| `W002` | Missing `homepage` in plugin | `Missing "homepage" at plugins[0]. A homepage URL helps users find documentation` |
| `W003` | Missing `tags` in plugin | `Missing "tags" at plugins[0]. Tags improve plugin discoverability in search` |
| `W004` | Empty description | `Empty "description" at plugins[0]. A meaningful description helps users understand what the plugin does` |

### Info (Severity: info)

Informational messages for best practices. Suppressed in `--quiet` mode.

| Rule ID | Description | Example Message |
|---------|-------------|-----------------|
| `I001` | Version is pre-release | `Version "0.1.0-beta.1" at plugins[0].version is a pre-release version` |
| `I002` | Large number of tags | `plugins[0] has 15 tags. Consider using fewer than 10 tags for better discoverability` |

## 6. Error Message UX

All messages follow a consistent format with:
- **Severity icon** (in text mode): error, warning, or info indicator
- **Rule ID** for lookup and suppression
- **Location path** showing exactly where the issue is in the JSON
- **Actionable suggestion** explaining how to fix the issue

### Design Principles

1. **Specific over generic**: "Missing required field `name` at `plugins[0]`" not "Validation failed"
2. **Show the path**: Always include the JSON path to the problematic value
3. **Suggest the fix**: Include what the user should do to resolve the issue
4. **Group by location**: When multiple errors exist at the same location, group them together
5. **Show context**: When possible, show the invalid value alongside the expected format

## 7. Output Formats

### Text Format (default, `--format text`)

Human-readable output with colors and structure:

```
marketplace-validator v1.0.0

Validating: marketplace.json

  ERROR  E001  Missing required field "description" at root
               Add a "description" field with a human-readable description of the package.

  ERROR  E003  Invalid semver "1.0" at plugins[0].version
               Expected format: MAJOR.MINOR.PATCH (e.g., "1.0.0")

  WARN   W002  Missing "homepage" at plugins[0]
               A homepage URL helps users find documentation.

  INFO   I001  Version "2.0.0-beta.1" at plugins[1].version is a pre-release version

  2 errors, 1 warning, 1 info

  Validation failed.
```

When validation passes:

```
marketplace-validator v1.0.0

Validating: marketplace.json

  1 warning, 1 info

  Validation passed.
```

With no issues at all:

```
marketplace-validator v1.0.0

Validating: marketplace.json

  Validation passed. No issues found.
```

### JSON Format (`--format json`)

Machine-readable output for programmatic consumption:

```json
{
  "valid": false,
  "file": "marketplace.json",
  "summary": {
    "errors": 2,
    "warnings": 1,
    "info": 1
  },
  "issues": [
    {
      "severity": "error",
      "rule": "E001",
      "path": "root",
      "field": "description",
      "message": "Missing required field \"description\"",
      "suggestion": "Add a \"description\" field with a human-readable description of the package."
    },
    {
      "severity": "error",
      "rule": "E003",
      "path": "plugins[0].version",
      "field": "version",
      "value": "1.0",
      "message": "Invalid semver \"1.0\"",
      "suggestion": "Expected format: MAJOR.MINOR.PATCH (e.g., \"1.0.0\")"
    },
    {
      "severity": "warning",
      "rule": "W002",
      "path": "plugins[0]",
      "field": "homepage",
      "message": "Missing \"homepage\"",
      "suggestion": "A homepage URL helps users find documentation."
    },
    {
      "severity": "info",
      "rule": "I001",
      "path": "plugins[1].version",
      "field": "version",
      "value": "2.0.0-beta.1",
      "message": "Version is a pre-release version",
      "suggestion": null
    }
  ]
}
```

### Compact Format (`--format compact`)

One-line-per-issue format suitable for log aggregation and editor integration:

```
error[E001] root: Missing required field "description"
error[E003] plugins[0].version: Invalid semver "1.0"
warning[W002] plugins[0]: Missing "homepage"
info[I001] plugins[1].version: Version "2.0.0-beta.1" is a pre-release version
```

## 8. Exit Codes

| Code | Meaning | When |
|------|---------|------|
| `0` | Valid | No errors (warnings and info are OK) |
| `1` | Validation errors | One or more error-level issues found, or warnings found with `--strict` |
| `2` | File or parse error | File not found, not readable, or invalid JSON |

## 9. CI/CD Integration

### GitHub Actions Example

```yaml
name: Validate Marketplace Config

on:
  pull_request:
    paths:
      - 'marketplace.json'

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install marketplace-validator
        run: npm install -g @anthropic/marketplace-validator

      - name: Validate marketplace.json
        run: marketplace-validator validate --strict --format compact
```

### Usage in npm Scripts

```json
{
  "scripts": {
    "validate": "marketplace-validator validate",
    "validate:strict": "marketplace-validator validate --strict",
    "validate:ci": "marketplace-validator validate --strict --format compact --no-color"
  }
}
```

### Pre-commit Hook

```bash
#!/bin/sh
# .git/hooks/pre-commit
if git diff --cached --name-only | grep -q 'marketplace.json'; then
  npx @anthropic/marketplace-validator validate --strict
fi
```

## 10. Non-Functional Requirements

| Requirement | Target |
|-------------|--------|
| **Startup time** | < 200ms for validation of a typical file |
| **Dependencies** | Minimal runtime dependencies |
| **Node.js support** | Node.js 18+ |
| **No network calls** | All validation is offline; no HTTP requests during validation |
| **File size** | Handle marketplace.json files up to 1MB |

## 11. Future Considerations (Out of Scope for v1)

- `marketplace-validator init` - scaffold a new marketplace.json
- `marketplace-validator fix` - auto-fix certain issues
- Custom rule plugins / configuration file (`.marketplace-validator.json`)
- Watch mode for development
- JSON Schema generation from validation rules
