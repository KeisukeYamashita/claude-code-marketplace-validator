import { describe, it, expect } from "vitest";
import { marketplaceSchema } from "../src/schema.js";

// Minimal valid marketplace per official docs: name, owner{name}, plugins[{name, source}]
const validMinimal = {
  name: "test",
  owner: { name: "Owner" },
  plugins: [
    {
      name: "plugin",
      source: "./plugins/test",
    },
  ],
};

describe("marketplaceSchema", () => {
  describe("valid data", () => {
    it("accepts minimal valid marketplace (name, owner, plugins with name+source)", () => {
      const result = marketplaceSchema.safeParse(validMinimal);
      expect(result.success).toBe(true);
    });

    it("accepts owner with optional email", () => {
      const data = {
        ...validMinimal,
        owner: { name: "Owner", email: "owner@example.com" },
      };
      const result = marketplaceSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it("accepts marketplace with metadata", () => {
      const data = {
        ...validMinimal,
        metadata: {
          description: "A great marketplace",
          version: "1.0.0",
          pluginRoot: "./plugins",
        },
      };
      const result = marketplaceSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it("accepts plugin with all optional fields", () => {
      const data = {
        ...validMinimal,
        plugins: [
          {
            name: "full-plugin",
            source: "./plugins/test",
            description: "A full plugin",
            version: "1.0.0",
            author: { name: "Author", email: "author@example.com" },
            homepage: "https://example.com",
            repository: "https://github.com/owner/repo",
            license: "MIT",
            keywords: ["test"],
            category: "development" as const,
            strict: true,
            tags: ["test", "dev"],
            lspServers: {
              typescript: {
                command: "ts-server",
                args: ["--stdio"],
              },
            },
          },
        ],
      };
      const result = marketplaceSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it("accepts source as github object with source discriminator", () => {
      const data = {
        ...validMinimal,
        plugins: [
          {
            name: "plugin",
            source: { source: "github" as const, repo: "owner/repo" },
          },
        ],
      };
      const result = marketplaceSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it("accepts github source with ref and sha", () => {
      const data = {
        ...validMinimal,
        plugins: [
          {
            name: "plugin",
            source: {
              source: "github" as const,
              repo: "owner/repo",
              ref: "v2.0.0",
              sha: "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0",
            },
          },
        ],
      };
      const result = marketplaceSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it("accepts source as url object", () => {
      const data = {
        ...validMinimal,
        plugins: [
          {
            name: "plugin",
            source: { source: "url" as const, url: "https://gitlab.com/team/plugin.git" },
          },
        ],
      };
      const result = marketplaceSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it("accepts all valid categories", () => {
      const categories = [
        "development", "productivity", "testing", "database",
        "deployment", "design", "learning", "monitoring", "security",
      ] as const;
      for (const category of categories) {
        const data = {
          ...validMinimal,
          plugins: [{ ...validMinimal.plugins[0], category }],
        };
        const result = marketplaceSchema.safeParse(data);
        expect(result.success, `category "${category}" should be valid`).toBe(true);
      }
    });

    it("accepts valid semver versions", () => {
      const versions = ["0.0.1", "1.0.0", "10.20.30", "1.0.0-alpha", "1.0.0-beta.1", "1.0.0+build.123"];
      for (const version of versions) {
        const data = {
          ...validMinimal,
          plugins: [{ ...validMinimal.plugins[0], version }],
        };
        const result = marketplaceSchema.safeParse(data);
        expect(result.success, `version "${version}" should be valid`).toBe(true);
      }
    });

    it("accepts plugin with commands as string or array", () => {
      for (const commands of ["./commands/", ["./commands/core/", "./commands/extra/"]]) {
        const data = {
          ...validMinimal,
          plugins: [{ ...validMinimal.plugins[0], commands }],
        };
        const result = marketplaceSchema.safeParse(data);
        expect(result.success).toBe(true);
      }
    });

    it("accepts plugin with hooks as string or object", () => {
      const hooksObj = {
        PostToolUse: [
          { matcher: "Write|Edit", hooks: [{ type: "command", command: "validate.sh" }] },
        ],
      };
      for (const hooks of ["./hooks.json", hooksObj]) {
        const data = {
          ...validMinimal,
          plugins: [{ ...validMinimal.plugins[0], hooks }],
        };
        const result = marketplaceSchema.safeParse(data);
        expect(result.success).toBe(true);
      }
    });

    it("accepts plugin with mcpServers as string or object", () => {
      const mcpObj = {
        "my-server": { command: "my-server", args: ["--config", "config.json"] },
      };
      for (const mcpServers of ["./mcp.json", mcpObj]) {
        const data = {
          ...validMinimal,
          plugins: [{ ...validMinimal.plugins[0], mcpServers }],
        };
        const result = marketplaceSchema.safeParse(data);
        expect(result.success).toBe(true);
      }
    });

    it("allows extra/unknown fields (passthrough)", () => {
      const data = {
        ...validMinimal,
        customField: "allowed",
        plugins: [{ ...validMinimal.plugins[0], extraField: true }],
      };
      const result = marketplaceSchema.safeParse(data);
      expect(result.success).toBe(true);
    });
  });

  describe("invalid data", () => {
    it("rejects missing name", () => {
      const { name, ...data } = validMinimal;
      expect(marketplaceSchema.safeParse(data).success).toBe(false);
    });

    it("rejects missing owner", () => {
      const { owner, ...data } = validMinimal;
      expect(marketplaceSchema.safeParse(data).success).toBe(false);
    });

    it("rejects missing plugins", () => {
      const { plugins, ...data } = validMinimal;
      expect(marketplaceSchema.safeParse(data).success).toBe(false);
    });

    it("rejects empty plugins array", () => {
      const data = { ...validMinimal, plugins: [] };
      expect(marketplaceSchema.safeParse(data).success).toBe(false);
    });

    it("rejects invalid email in owner", () => {
      const data = {
        ...validMinimal,
        owner: { name: "Owner", email: "not-an-email" },
      };
      expect(marketplaceSchema.safeParse(data).success).toBe(false);
    });

    it("rejects invalid semver version", () => {
      const badVersions = ["1.0", "v1.0.0", "1", "abc", "1.0.0.0"];
      for (const version of badVersions) {
        const data = {
          ...validMinimal,
          plugins: [{ ...validMinimal.plugins[0], version }],
        };
        expect(marketplaceSchema.safeParse(data).success, `version "${version}" should be invalid`).toBe(false);
      }
    });

    it("rejects invalid category", () => {
      const data = {
        ...validMinimal,
        plugins: [{ ...validMinimal.plugins[0], category: "invalid" }],
      };
      expect(marketplaceSchema.safeParse(data).success).toBe(false);
    });

    it("rejects invalid homepage URL", () => {
      const data = {
        ...validMinimal,
        plugins: [{ ...validMinimal.plugins[0], homepage: "not-a-url" }],
      };
      expect(marketplaceSchema.safeParse(data).success).toBe(false);
    });

    it("rejects empty plugin name", () => {
      const data = {
        ...validMinimal,
        plugins: [{ ...validMinimal.plugins[0], name: "" }],
      };
      expect(marketplaceSchema.safeParse(data).success).toBe(false);
    });

    it("rejects non-object data", () => {
      expect(marketplaceSchema.safeParse("string").success).toBe(false);
      expect(marketplaceSchema.safeParse(42).success).toBe(false);
      expect(marketplaceSchema.safeParse(null).success).toBe(false);
    });

    it("rejects plugin missing source (required per official docs)", () => {
      const data = {
        ...validMinimal,
        plugins: [{ name: "no-source" }],
      };
      expect(marketplaceSchema.safeParse(data).success).toBe(false);
    });

    it("rejects invalid source object discriminator", () => {
      const data = {
        ...validMinimal,
        plugins: [
          { name: "plugin", source: { source: "npm", package: "foo" } },
        ],
      };
      expect(marketplaceSchema.safeParse(data).success).toBe(false);
    });
  });
});
