import path from "node:path";
import { SCHEMA_VERSION, STATUS, UNIVERSITY } from "./constants.mjs";
import { crawlCbnuDepartment, discoverCbnuDepartments } from "./adapters/cbnu.mjs";
import { crawlDkuDepartment, discoverDkuDepartments } from "./adapters/dku.mjs";
import {
  buildDepartmentFailureRecord,
  statusFromError,
} from "./adapters/common.mjs";
import { dedupeProfessorRecords } from "./dedupe.mjs";
import { HttpClient } from "./http-client.mjs";
import { enrichPublicationIdentifiers } from "./metadata.mjs";
import { createManifest, writeRunArtifacts } from "./report.mjs";
import { validateDataset } from "./schema.mjs";
import { safeIsoDate } from "./utils.mjs";

export async function runCrawler({
  repositoryRoot,
  outputDirectory,
  universities = ["dku", "cbnu"],
  maxDepartments = Number.POSITIVE_INFINITY,
  maxProfessors = Number.POSITIVE_INFINITY,
  timeoutMs = 15_000,
  retries = 2,
  minDelayMs = 1_200,
  offline = false,
  enrichCrossref = false,
  enrichMaxPublications = 50,
  logger = console,
} = {}) {
  if (!repositoryRoot || !outputDirectory) {
    throw new Error("repositoryRoot and outputDirectory are required");
  }
  const startedAt = safeIsoDate();
  const runId = `professors-${startedAt.replace(/[:.]/g, "-")}`;
  const client = new HttpClient({
    cacheDirectory: path.join(repositoryRoot, "data", "professors", ".cache"),
    timeoutMs,
    retries,
    minDelayMs,
    offline,
  });
  const discovery = [];
  const departmentResults = [];
  const rawRecords = [];

  for (const universityCode of universities) {
    let discovered;
    let crawlDepartment;
    let universityName;
    if (universityCode === "dku") {
      universityName = UNIVERSITY.DKU;
      discovered = await discoverDkuDepartments(client);
      crawlDepartment = crawlDkuDepartment;
    } else if (universityCode === "cbnu") {
      universityName = UNIVERSITY.CBNU;
      discovered = await discoverCbnuDepartments(
        client,
        path.join(repositoryRoot, "data", "professors", "seeds", "cbnu-departments.json"),
      );
      crawlDepartment = crawlCbnuDepartment;
    } else {
      throw new Error(`Unsupported university code: ${universityCode}`);
    }

    discovery.push({ university: universityName, ...discovered });
    const selectedDepartments = discovered.departments.slice(0, maxDepartments);
    logger.info?.(
      `[professor-crawler] ${universityName}: ${discovered.departments.length} discovered, ${selectedDepartments.length} selected`,
    );
    for (const [index, department] of selectedDepartments.entries()) {
      logger.info?.(
        `[professor-crawler] ${universityName} ${index + 1}/${selectedDepartments.length}: ${department.college} ${department.department}`,
      );
      let result;
      try {
        result = await crawlDepartment(client, department, {
          maxProfessors,
          collectedAt: startedAt,
        });
      } catch (error) {
        const status = statusFromError(error);
        logger.error?.(
          `[professor-crawler] ${universityName} ${department.department} failed safely: ${error.message}`,
        );
        result = {
          records: [
            buildDepartmentFailureRecord({
              department,
              sourceUrl: department.homepage_url ?? department.discovery_source_url,
              status: status === STATUS.ROBOTS_BLOCKED ? status : STATUS.PARSE_FAILED,
              reason: `Department crawl isolated after an unexpected error: ${error.message}`,
              collectedAt: startedAt,
            }),
          ],
          page: null,
          discovered_professors: 0,
        };
      }
      departmentResults.push({
        university: universityName,
        college: department.college,
        department: department.department,
        page: result.page,
        discovered_professors: result.discovered_professors ?? 0,
        output_records: result.records.length,
      });
      rawRecords.push(...result.records);
    }
  }

  let records = dedupeProfessorRecords(rawRecords);
  const enrichment = await enrichPublicationIdentifiers(records, {
    crossref: enrichCrossref,
    maxPublications: enrichMaxPublications,
  });
  records = enrichment.records;
  const finishedAt = safeIsoDate();
  const dataset = {
    schema_version: SCHEMA_VERSION,
    generated_at: finishedAt,
    publication_scope: "OFFICIAL_PROFILE_LIST_ONLY",
    records,
  };
  validateDataset(dataset);
  const options = {
    universities: universities.map((code) =>
      code === "dku" ? UNIVERSITY.DKU : UNIVERSITY.CBNU,
    ),
    maxDepartments,
    maxProfessors,
  };
  const manifest = createManifest({
    runId,
    startedAt,
    finishedAt,
    options,
    dataset,
    discovery,
    departmentResults,
    robotsAudit: client.robots.audit,
    metadataReport: enrichment.report,
  });
  const files = await writeRunArtifacts(outputDirectory, dataset, manifest);
  return { dataset, manifest, files };
}
