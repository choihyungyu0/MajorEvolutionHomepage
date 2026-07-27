#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildDkuCentralSearchUrl,
  parseDkuCentralSearch,
  parseDkuProfessorDetail,
} from "./adapters/dku.mjs";
import { STATUS, UNIVERSITY } from "./constants.mjs";
import { HttpClient } from "./http-client.mjs";
import { createManifest, writeRunArtifacts } from "./report.mjs";
import { buildProfessorRecord, validateDataset } from "./schema.mjs";
import { normalizeSpace, safeIsoDate } from "./utils.mjs";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "..", "..");
const professorDataRoot = path.join(repositoryRoot, "data", "professors");

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [datasetArg, manifestArg, outputArg] = process.argv.slice(2);
  if (!datasetArg || !manifestArg || !outputArg) {
    console.error(
      "Usage: node scripts/professor-crawler/recover-dku-gaps.mjs <dataset.json> <manifest.json> <output-directory>",
    );
    process.exitCode = 1;
  } else {
    try {
      const result = await recoverDkuCoverageGaps({
        datasetPath: resolveRepositoryPath(datasetArg),
        manifestPath: resolveRepositoryPath(manifestArg),
        outputDirectory: resolveProfessorDataPath(outputArg),
      });
      console.log(JSON.stringify(result, null, 2));
    } catch (error) {
      console.error(`[professor-gap-recovery] ${error.stack || error.message}`);
      process.exitCode = 1;
    }
  }
}

export async function recoverDkuCoverageGaps({
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
      !record.name &&
      record.status === STATUS.PROFILE_UNAVAILABLE,
  );
  const client = new HttpClient({
    cacheDirectory: path.join(professorDataRoot, ".cache"),
    timeoutMs,
    retries,
    minDelayMs,
    fetchImpl,
  });
  const replacements = new Map();
  const searches = [];
  const startedAt = safeIsoDate();

  for (const [index, record] of candidates.entries()) {
    logger.info?.(
      `[professor-gap-recovery] ${index + 1}/${candidates.length}: ${record.department}`,
    );
    const searchUrl = buildDkuCentralSearchUrl(record.department);
    try {
      const searchPage = await client.fetchText(searchUrl, {
        purpose: "dku-central-professor-search",
        useCache: false,
      });
      const exactProfessors = parseDkuCentralSearch(searchPage.body, searchPage.url).filter(
        (professor) => organizationMatchesDepartment(
          professor.organization_name,
          record.department,
        ),
      );
      const recovered = [];
      const failures = [];
      for (const professor of exactProfessors) {
        try {
          const detailPage = await client.fetchText(professor.detail_url, {
            purpose: "dku-professor-profile-gap-recovery",
            useCache: false,
          });
          const detail = parseDkuProfessorDetail(detailPage.body, detailPage.url);
          const parseFailed =
            detail.research_fields_status === STATUS.PARSE_FAILED &&
            detail.publications_status === STATUS.PARSE_FAILED;
          if (parseFailed) {
            throw new Error("Expected DKU research/profile sections were not found.");
          }
          recovered.push(
            buildProfessorRecord({
              university: record.university,
              college: record.college,
              department: record.department,
              name: professor.name,
              title: professor.title,
              research_fields: detail.research_fields,
              publications: detail.publications,
              official_profile_url: detailPage.url,
              source_url: searchPage.url,
              collected_at: startedAt,
              status:
                detail.research_fields.length || detail.publications.length
                  ? STATUS.FOUND
                  : STATUS.NOT_LISTED_ON_OFFICIAL_PROFILE,
              research_fields_status: detail.research_fields_status,
              publications_status: detail.publications_status,
              failure_reason: null,
              content_hash: detailPage.content_hash,
            }),
          );
        } catch (error) {
          failures.push({ name: professor.name, reason: error.message });
        }
      }
      if (recovered.length) replacements.set(record.id, recovered);
      searches.push({
        department: record.department,
        search_url: searchPage.url,
        exact_results: exactProfessors.length,
        recovered_records: recovered.length,
        failures,
      });
    } catch (error) {
      searches.push({
        department: record.department,
        search_url: searchUrl,
        exact_results: 0,
        recovered_records: 0,
        failures: [{ reason: error.message }],
      });
    }
  }

  const records = sourceDataset.records.flatMap(
    (record) => replacements.get(record.id) ?? [record],
  );
  const finishedAt = safeIsoDate();
  const dataset = {
    ...sourceDataset,
    generated_at: finishedAt,
    records,
  };
  validateDataset(dataset);
  const manifest = createManifest({
    runId: `${sourceManifest.run_id}-gaps-${finishedAt.replace(/[:.]/g, "-")}`,
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
    targeted_departments: candidates.length,
    recovered_departments: replacements.size,
    recovered_professor_records: [...replacements.values()].flat().length,
    remaining_departments: candidates
      .filter((record) => !replacements.has(record.id))
      .map((record) => record.department),
    searches,
    policy:
      "Only official DKU central-search results whose organization matched the missing department were accepted.",
  };
  const files = await writeRunArtifacts(outputDirectory, dataset, manifest);
  return {
    recovery: manifest.recovery,
    counts: manifest.counts,
    files,
  };
}

function organizationMatchesDepartment(organizationName, department) {
  const compact = (value) =>
    normalizeSpace(value)
      .replace(/\([^)]*\)/g, "")
      .replace(/\s+/g, "");
  const organization = compact(organizationName);
  const target = compact(department);
  return organization.includes(target) || target.includes(organization);
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
