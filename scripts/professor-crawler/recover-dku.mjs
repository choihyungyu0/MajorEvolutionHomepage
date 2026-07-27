#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseDkuProfessorDetail } from "./adapters/dku.mjs";
import { STATUS, UNIVERSITY } from "./constants.mjs";
import { HttpClient } from "./http-client.mjs";
import { createManifest, writeRunArtifacts } from "./report.mjs";
import { buildProfessorRecord, validateDataset } from "./schema.mjs";
import { safeIsoDate } from "./utils.mjs";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "..", "..");
const professorDataRoot = path.join(repositoryRoot, "data", "professors");

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [datasetArg, manifestArg, outputArg] = process.argv.slice(2);
  if (!datasetArg || !manifestArg || !outputArg) {
    console.error(
      "Usage: node scripts/professor-crawler/recover-dku.mjs <dataset.json> <manifest.json> <output-directory>",
    );
    process.exitCode = 1;
  } else {
    try {
      const result = await recoverDkuParseFailures({
        datasetPath: resolveRepositoryPath(datasetArg),
        manifestPath: resolveRepositoryPath(manifestArg),
        outputDirectory: resolveProfessorDataPath(outputArg),
      });
      console.log(JSON.stringify(result, null, 2));
    } catch (error) {
      console.error(`[professor-recovery] ${error.stack || error.message}`);
      process.exitCode = 1;
    }
  }
}

export async function recoverDkuParseFailures({
  datasetPath,
  manifestPath,
  outputDirectory,
  timeoutMs = 15_000,
  retries = 2,
  minDelayMs = 1_200,
  fetchImpl = globalThis.fetch,
  logger = console,
}) {
  const sourceDataset = JSON.parse(await readFile(datasetPath, "utf8"));
  const sourceManifest = JSON.parse(await readFile(manifestPath, "utf8"));
  validateDataset(sourceDataset);

  const candidates = sourceDataset.records.filter(
    (record) =>
      record.university === UNIVERSITY.DKU &&
      record.name &&
      record.status === STATUS.PARSE_FAILED &&
      record.official_profile_url,
  );
  const recordsByProfile = new Map();
  for (const record of candidates) {
    const related = recordsByProfile.get(record.official_profile_url) ?? [];
    related.push(record);
    recordsByProfile.set(record.official_profile_url, related);
  }

  const client = new HttpClient({
    cacheDirectory: path.join(professorDataRoot, ".cache"),
    timeoutMs,
    retries,
    minDelayMs,
    fetchImpl,
  });
  const replacements = new Map();
  const failures = [];
  const startedAt = safeIsoDate();

  for (const [index, [profileUrl, records]] of [...recordsByProfile].entries()) {
    logger.info?.(
      `[professor-recovery] ${index + 1}/${recordsByProfile.size}: ${records[0].name}`,
    );
    try {
      const page = await client.fetchText(profileUrl, {
        purpose: "dku-professor-profile-recovery",
        useCache: false,
      });
      const detail = parseDkuProfessorDetail(page.body, page.url);
      const parseFailed =
        detail.research_fields_status === STATUS.PARSE_FAILED &&
        detail.publications_status === STATUS.PARSE_FAILED;
      if (parseFailed) {
        throw new Error("Expected DKU research/profile sections were not found.");
      }
      for (const sourceRecord of records) {
        const recovered = buildProfessorRecord({
          university: sourceRecord.university,
          college: sourceRecord.college,
          department: sourceRecord.department,
          name: sourceRecord.name,
          title: sourceRecord.title,
          research_fields: detail.research_fields,
          publications: detail.publications,
          official_profile_url: page.url,
          source_url: sourceRecord.source_url,
          collected_at: startedAt,
          status:
            detail.research_fields.length || detail.publications.length
              ? STATUS.FOUND
              : STATUS.NOT_LISTED_ON_OFFICIAL_PROFILE,
          research_fields_status: detail.research_fields_status,
          publications_status: detail.publications_status,
          failure_reason: null,
          content_hash: page.content_hash,
        });
        replacements.set(sourceRecord.id, recovered);
      }
    } catch (error) {
      failures.push({
        profile_url: profileUrl,
        record_ids: records.map((record) => record.id),
        reason: error.message,
      });
    }
  }

  const finishedAt = safeIsoDate();
  const dataset = {
    ...sourceDataset,
    generated_at: finishedAt,
    records: sourceDataset.records.map((record) => replacements.get(record.id) ?? record),
  };
  validateDataset(dataset);
  const manifest = createManifest({
    runId: `${sourceManifest.run_id}-recovered-${finishedAt.replace(/[:.]/g, "-")}`,
    startedAt,
    finishedAt,
    options: {
      universities: sourceManifest.scope_requested?.universities ?? [UNIVERSITY.DKU],
      maxDepartments: parseManifestLimit(sourceManifest.limits?.max_departments),
      maxProfessors: parseManifestLimit(
        sourceManifest.limits?.max_professors_per_department,
      ),
    },
    dataset,
    discovery: sourceManifest.discovery ?? [],
    departmentResults: sourceManifest.department_results ?? [],
    robotsAudit: [...(sourceManifest.robots_audit ?? []), ...client.robots.audit],
    metadataReport: sourceManifest.metadata_enrichment ?? {},
  });
  manifest.recovery = {
    source_run_id: sourceManifest.run_id,
    targeted_records: candidates.length,
    targeted_profiles: recordsByProfile.size,
    recovered_records: replacements.size,
    remaining_failures: failures,
    policy:
      "Only DKU records previously marked PARSE_FAILED with an official profile URL were refreshed.",
  };
  const files = await writeRunArtifacts(outputDirectory, dataset, manifest);
  return {
    recovery: manifest.recovery,
    counts: manifest.counts,
    files,
  };
}

function parseManifestLimit(value) {
  return Number.isFinite(value) ? value : Number.POSITIVE_INFINITY;
}

function resolveRepositoryPath(value) {
  const resolved = path.resolve(repositoryRoot, value);
  const relative = path.relative(repositoryRoot, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Input must remain under ${repositoryRoot}`);
  }
  return resolved;
}

function resolveProfessorDataPath(value) {
  const resolved = path.resolve(repositoryRoot, value);
  const relative = path.relative(professorDataRoot, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Output must remain under ${professorDataRoot}`);
  }
  return resolved;
}
