#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runCrawler } from "./pipeline.mjs";
import { validateDataset } from "./schema.mjs";
import { readJson } from "./utils.mjs";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "..", "..");
const professorDataRoot = path.join(repositoryRoot, "data", "professors");

const [command = "crawl", ...argumentValues] = process.argv.slice(2);
const args = parseArguments(argumentValues);

try {
  if (command === "crawl") {
    const universities = parseUniversities(args.university ?? "all");
    const maxDepartments = parseLimit(args["max-departments"]);
    const maxProfessors = parseLimit(args["max-professors"]);
    const defaultOutput = path.join(
      professorDataRoot,
      "runs",
      new Date().toISOString().replace(/[:.]/g, "-"),
    );
    const outputDirectory = resolveDataPath(args.output ?? defaultOutput);
    const result = await runCrawler({
      repositoryRoot,
      outputDirectory,
      universities,
      maxDepartments,
      maxProfessors,
      timeoutMs: parsePositiveInteger(args["timeout-ms"], 15_000),
      retries: parseNonNegativeInteger(args.retries, 2),
      minDelayMs: parseNonNegativeInteger(args["min-delay-ms"], 1_200),
      offline: Boolean(args.offline),
      enrichCrossref: Boolean(args["enrich-crossref"]),
      enrichMaxPublications: parsePositiveInteger(args["enrich-max"], 50),
    });
    console.log(
      JSON.stringify(
        {
          scope_status: result.manifest.scope_status,
          counts: result.manifest.counts,
          files: result.files,
        },
        null,
        2,
      ),
    );
  } else if (command === "validate") {
    const inputPath = path.resolve(
      repositoryRoot,
      args._?.[0] ?? path.join("data", "professors", "sample", "dataset.json"),
    );
    const result = validateDataset(await readJson(inputPath));
    console.log(JSON.stringify({ file: inputPath, ...result }, null, 2));
  } else if (command === "help" || args.help) {
    printHelp();
  } else {
    throw new Error(`Unknown command: ${command}`);
  }
} catch (error) {
  console.error(`[professor-crawler] ${error.stack || error.message}`);
  process.exitCode = 1;
}
function parseArguments(values) {
  const parsed = { _: [] };
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (!value.startsWith("--")) {
      parsed._.push(value);
      continue;
    }
    const [rawKey, inlineValue] = value.slice(2).split("=", 2);
    if (inlineValue !== undefined) {
      parsed[rawKey] = inlineValue;
      continue;
    }
    const next = values[index + 1];
    if (next && !next.startsWith("--")) {
      parsed[rawKey] = next;
      index += 1;
    } else {
      parsed[rawKey] = true;
    }
  }
  return parsed;
}

function parseUniversities(value) {
  if (value === "all") return ["dku", "cbnu"];
  const values = String(value)
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  if (!values.length || values.some((item) => !["dku", "cbnu"].includes(item))) {
    throw new Error("--university must be dku, cbnu, or all");
  }
  return [...new Set(values)];
}

function parseLimit(value) {
  if (value === undefined) return Number.POSITIVE_INFINITY;
  return parsePositiveInteger(value, Number.POSITIVE_INFINITY);
}

function parsePositiveInteger(value, fallback) {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Expected a positive integer, received: ${value}`);
  }
  return parsed;
}

function parseNonNegativeInteger(value, fallback) {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`Expected a non-negative integer, received: ${value}`);
  }
  return parsed;
}

function resolveDataPath(value) {
  const resolved = path.resolve(repositoryRoot, value);
  const relative = path.relative(professorDataRoot, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Output must remain under ${professorDataRoot}`);
  }
  return resolved;
}

function printHelp() {
  console.log(`Professor public-data crawler

Usage:
  node scripts/professor-crawler/cli.mjs crawl [options]
  node scripts/professor-crawler/cli.mjs validate [dataset.json]

Options:
  --university dku|cbnu|all    University selection (default: all)
  --max-departments N          Bounded sample; omitted means all discovered
  --max-professors N           Per-department bound
  --min-delay-ms N             Minimum delay per host (default: 1200)
  --timeout-ms N               Per-request timeout (default: 15000)
  --retries N                  Retry count for 429/5xx/network failures (default: 2)
  --offline                    Use only redacted persistent cache
  --enrich-crossref            DOI lookup for official-profile titles only
  --enrich-max N               Metadata-query bound (default: 50)
  --output data/professors/... Output directory

KCI:
  Set KCI_API_KEY to enable KCI identifier lookup. The key is never written to output.
`);
}
