# claude-code-marketplace-validator

A CLI tool to validate [Claude Code Marketplace](https://code.claude.com) configuration files (`.claude-plugin/marketplace.json`).

Ensures plugin definitions are correct, complete, and follow best practices before publishing to the Claude Code Marketplace. Based on the [official plugin marketplace documentation](https://code.claude.com/docs/en/plugin-marketplaces).

## Installation

```bash
# Install globally
npm install -g claude-code-marketplace-validator

# Or run directly with npx
npx claude-code-marketplace-validator validate .claude-plugin/marketplace.json
```

## Quick Start

```bash
# Validate marketplace.json in current directory
marketplace-validator validate

# Validate a specific file
marketplace-validator validate .claude-plugin/marketplace.json

# Strict mode (treat warnings as errors)
marketplace-validator validate --strict

# JSON output for CI/CD
marketplace-validator validate --format json
```

## Usage

```
marketplace-validator validate [file] [options]

Arguments:
  file                     Path to marketplace.json (default: "./marketplace.json")

Options:
  -f, --format <type>      Output format: text, json, compact (default: "text")
  --strict                 Treat warnings as errors (default: false)
  -q, --quiet              Only output errors, suppress warnings and info (default: false)
  --no-color               Disable colored output
  -V, --version            Output version number
  -h, --help               Display help
```

## Validation Rules

### Errors

| Rule | Description |
|------|-------------|
| E001 | Missing required field (`name`, `owner`, `plugins`, plugin `name`, plugin `source`) |
| E002 | Invalid type for a field |
| E003 | Invalid semantic version (must follow semver: `MAJOR.MINOR.PATCH`) |
| E004 | Invalid email format |
| E005 | Invalid URL format |
| E006 | Invalid category (must be one of: development, productivity, testing, database, deployment, design, learning, monitoring, security) |
| E007 | Duplicate plugin names within a marketplace |
| E008 | Empty plugins array (at least one plugin required) |
| E009 | Invalid source format (must be string or object with `source: "github"` or `source: "url"`) |
| E010 | Plugin directory not found at relative source path |
| E011 | Missing `.claude-plugin/plugin.json` in plugin directory (required when `strict` is true/default) |
| E012 | Path traversal (`..`) not allowed in source paths |

### Warnings

| Rule | Description |
|------|-------------|
| W001 | Missing marketplace description (`metadata.description`) |
| W002 | Missing `description` in plugin |
| W003 | Missing `tags` or `keywords` in plugin |
| W004 | Empty description string |
| W005 | Plugin has `strict: false` but `.claude-plugin/plugin.json` exists |
| W006 | Name is not kebab-case (lowercase with hyphens) |

### Info

| Rule | Description |
|------|-------------|
| I001 | Pre-release version detected |
| I002 | More than 10 tags (may reduce discoverability) |

## Output Formats

### Text (default)

```
  ERROR  E010  Plugin directory not found: ./plugins/missing
               Ensure the directory exists at the specified source path.

  ERROR  E011  Missing .claude-plugin/plugin.json in plugin directory "./plugins/my-plugin"
               Create a .claude-plugin/plugin.json manifest, or set "strict": false.

  WARN   W006  Plugin name "MyPlugin" is not kebab-case
               Use kebab-case for plugin names (e.g., "my-plugin").

  2 errors, 1 warning

  Validation failed.
```

### JSON (`--format json`)

```json
{
  "valid": false,
  "summary": { "errors": 2, "warnings": 1, "info": 0 },
  "issues": [
    {
      "severity": "error",
      "rule": "E010",
      "path": "plugins[0].source",
      "message": "Plugin directory not found: ./plugins/missing",
      "suggestion": "Ensure the directory exists at the specified source path."
    }
  ]
}
```

### Compact (`--format compact`)

```
error[E010] plugins[0].source: Plugin directory not found: ./plugins/missing
error[E011] plugins[1]: Missing .claude-plugin/plugin.json
warning[W006] plugins[2].name: Plugin name "MyPlugin" is not kebab-case
```

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Valid (no errors) |
| 1 | Validation errors found (or warnings with `--strict`) |
| 2 | File not found, permission denied, or invalid JSON |

## marketplace.json Schema

Based on the [official Claude Code documentation](https://code.claude.com/docs/en/plugin-marketplaces):

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Marketplace identifier (kebab-case) |
| `owner` | object | `{ name: string, email?: string }` |
| `plugins` | array | Array of plugin entries (min 1) |

### Optional Fields

| Field | Type | Description |
|-------|------|-------------|
| `metadata.description` | string | Marketplace description |
| `metadata.version` | string | Marketplace version |
| `metadata.pluginRoot` | string | Base directory for relative plugin paths |

### Plugin Entry

**Required:** `name`, `source`

**Optional:** `description`, `version`, `author`, `homepage`, `repository`, `license`, `keywords`, `category`, `tags`, `strict`, `commands`, `agents`, `hooks`, `mcpServers`, `lspServers`

### Source Formats

```jsonc
// Relative path
"source": "./plugins/my-plugin"

// GitHub repository
"source": { "source": "github", "repo": "owner/repo", "ref": "v1.0", "sha": "abc..." }

// Git URL
"source": { "source": "url", "url": "https://gitlab.com/team/plugin.git" }
```

### strict Flag

- `strict: true` (default) - Plugin must have `.claude-plugin/plugin.json`. Marketplace fields merge with plugin.json.
- `strict: false` - Marketplace entry defines the entire plugin. No plugin.json needed.

## CI/CD Integration

### GitHub Actions

```yaml
name: Validate Marketplace Config
on:
  pull_request:
    paths: ['**marketplace.json']
jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: KeisukeYamashita/claude-code-marketplace-validation@v1
        with:
          strict: "true"
          format: compact
```

## Development

```bash
pnpm install
pnpm run build
pnpm test
pnpm run typecheck
```

## License

MIT
