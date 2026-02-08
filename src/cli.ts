import { dirname, resolve } from "node:path";
import { Command } from "commander";
import chalk from "chalk";
import { loadMarketplaceFile, LoadError } from "./loader.js";
import { validate } from "./validator.js";
import { formatResult } from "./reporter.js";
import type { CLIOptions, OutputFormat } from "./types.js";

export function createProgram(): Command {
  const program = new Command();

  program
    .name("marketplace-validator")
    .description("Validate Claude Code Marketplace configuration files (marketplace.json)")
    .version("1.0.0");

  program
    .command("validate")
    .description("Validate a marketplace.json file")
    .argument("[file]", "Path to marketplace.json file", "./marketplace.json")
    .option("-f, --format <type>", "Output format: text, json, compact", "text")
    .option("--strict", "Treat warnings as errors", false)
    .option("-q, --quiet", "Only output errors, suppress warnings and info", false)
    .option("--no-color", "Disable colored output")
    .action((file: string, opts: Record<string, unknown>) => {
      const options: CLIOptions = {
        format: opts.format as OutputFormat,
        strict: Boolean(opts.strict),
        quiet: Boolean(opts.quiet),
        color: Boolean(opts.color),
      };

      runValidation(file, options);
    });

  return program;
}

function runValidation(filePath: string, options: CLIOptions): void {
  const noColor = !options.color;

  // Load file
  let data: unknown;
  try {
    data = loadMarketplaceFile(filePath);
  } catch (err) {
    if (err instanceof LoadError) {
      if (options.format === "json") {
        console.log(
          JSON.stringify(
            {
              valid: false,
              error: err.message,
              code: err.code,
            },
            null,
            2,
          ),
        );
      } else {
        console.error(noColor ? `Error: ${err.message}` : chalk.red(`Error: ${err.message}`));
      }
      process.exit(2);
    }
    throw err;
  }

  // Validate with basePath for filesystem checks
  const basePath = dirname(resolve(filePath));
  const result = validate(data, { strict: options.strict, basePath });

  // Format and output
  const output = formatResult(result, {
    format: options.format,
    quiet: options.quiet,
    noColor,
  });

  if (output) {
    console.log(output);
  }

  process.exit(result.valid ? 0 : 1);
}

export function run(argv: string[]): void {
  const program = createProgram();
  program.parse(argv);
}
