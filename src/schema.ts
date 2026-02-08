import { z } from "zod";

const SEMVER_REGEX =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;

const KEBAB_CASE_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const VALID_CATEGORIES = [
  "development",
  "productivity",
  "testing",
  "database",
  "deployment",
  "design",
  "learning",
  "monitoring",
  "security",
] as const;

export type Category = (typeof VALID_CATEGORIES)[number];

// Owner: name required, email optional (per official docs)
const ownerSchema = z.object({
  name: z.string().min(1, "Owner name must not be empty"),
  email: z.string().email("Invalid email format").optional(),
});

const authorSchema = z.object({
  name: z.string().min(1, "Author name must not be empty"),
  email: z.string().email("Invalid email format").optional(),
});

// Source object uses "source" discriminator, not "type" (per official docs)
// Only "github" and "url" are supported as object types
const githubSourceSchema = z.object({
  source: z.literal("github"),
  repo: z.string().min(1, 'Missing required field "repo" for source type "github"'),
  ref: z.string().optional(),
  sha: z.string().length(40, "SHA must be a full 40-character Git commit SHA").optional(),
});

const urlSourceSchema = z.object({
  source: z.literal("url"),
  url: z.string().url('Invalid URL for source type "url"'),
  ref: z.string().optional(),
  sha: z.string().length(40, "SHA must be a full 40-character Git commit SHA").optional(),
});

const sourceObjectSchema = z.discriminatedUnion("source", [
  githubSourceSchema,
  urlSourceSchema,
]);

const sourceSchema = z.union([
  z.string().min(1, "Source must not be empty"),
  sourceObjectSchema,
]);

const lspServerSchema = z
  .object({
    command: z.string().min(1),
    args: z.array(z.string()).optional(),
    extensionToLanguage: z.record(z.string()).optional(),
    startupTimeout: z.number().positive().optional(),
  })
  .passthrough();

// Hook schema for inline hook definitions
const hookEntrySchema = z.object({
  type: z.string(),
  command: z.string(),
}).passthrough();

const hookMatcherSchema = z.object({
  matcher: z.string().optional(),
  hooks: z.array(hookEntrySchema),
}).passthrough();

const hooksSchema = z.union([
  z.string(), // path to hooks file
  z.record(z.array(hookMatcherSchema)), // inline hooks object
]);

// MCP server schema
const mcpServerEntrySchema = z.object({
  command: z.string(),
  args: z.array(z.string()).optional(),
}).passthrough();

const mcpServersSchema = z.union([
  z.string(), // path to MCP config file
  z.record(mcpServerEntrySchema), // inline MCP servers
]);

// Plugin schema per official docs:
// Required: name, source
// Optional: description, version, author, homepage, repository, license,
//           keywords, category, tags, strict, commands, agents, hooks, mcpServers, lspServers
const pluginSchema = z.object({
  name: z.string().min(1, "Plugin name must not be empty"),
  source: sourceSchema,
  description: z.string().optional(),
  version: z.string().regex(SEMVER_REGEX, "Invalid semantic version format. Expected MAJOR.MINOR.PATCH (e.g., \"1.0.0\")").optional(),
  author: authorSchema.optional(),
  homepage: z.string().url("Invalid URL format for homepage").optional(),
  repository: z.string().url("Invalid URL format for repository").optional(),
  license: z.string().optional(),
  keywords: z.array(z.string()).optional(),
  category: z.enum(VALID_CATEGORIES, {
    errorMap: () => ({
      message: `Invalid category. Valid categories: ${VALID_CATEGORIES.join(", ")}`,
    }),
  }).optional(),
  tags: z.array(z.string().min(1)).optional(),
  strict: z.boolean().optional(),
  commands: z.union([z.string(), z.array(z.string())]).optional(),
  agents: z.union([z.string(), z.array(z.string())]).optional(),
  hooks: hooksSchema.optional(),
  mcpServers: mcpServersSchema.optional(),
  lspServers: z.union([z.string(), z.record(lspServerSchema)]).optional(),
}).passthrough();

// Marketplace metadata
const metadataSchema = z.object({
  description: z.string().optional(),
  version: z.string().optional(),
  pluginRoot: z.string().optional(),
}).passthrough();

// Marketplace root schema per official docs:
// Required: name, owner, plugins
// Optional: metadata
export const marketplaceSchema = z.object({
  name: z.string().min(1, "Marketplace name must not be empty"),
  owner: ownerSchema,
  plugins: z.array(pluginSchema).min(1, "plugins array must contain at least one plugin"),
  metadata: metadataSchema.optional(),
}).passthrough();

export { KEBAB_CASE_REGEX, SEMVER_REGEX };

export type Owner = z.infer<typeof ownerSchema>;
export type Author = z.infer<typeof authorSchema>;
export type Plugin = z.infer<typeof pluginSchema>;
export type Marketplace = z.infer<typeof marketplaceSchema>;
