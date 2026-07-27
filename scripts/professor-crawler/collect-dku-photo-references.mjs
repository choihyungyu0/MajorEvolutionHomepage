#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildDkuCentralSearchUrl,
  parseDkuCentralPhotoReferences,
} from "./adapters/dku.mjs";
import { HttpClient } from "./http-client.mjs";
import { writeJsonAtomic } from "./utils.mjs";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "..", "..");
const professorDataRoot = path.join(repositoryRoot, "data", "professors");

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [normalizedArg, outputDirectoryArg] = process.argv.slice(2);
  if (!normalizedArg || !outputDirectoryArg) {
    console.error(
      "Usage: node scripts/professor-crawler/collect-dku-photo-references.mjs <normalized.json> <output-directory>",
    );
    process.exitCode = 1;
  } else {
    try {
      const result = await collectDkuPhotoReferences({
        normalizedPath: resolveProfessorDataPath(normalizedArg),
        outputDirectory: resolveProfessorDataPath(outputDirectoryArg),
      });
      console.log(JSON.stringify(result, null, 2));
    } catch (error) {
      console.error(`[professor-photo-references] ${error.stack || error.message}`);
      process.exitCode = 1;
    }
  }
}

export async function collectDkuPhotoReferences({
  normalizedPath,
  outputDirectory,
  timeoutMs = 15_000,
  retries = 2,
  minDelayMs = 1_200,
  fetchImpl = globalThis.fetch,
  logger = console,
}) {
  const normalized = JSON.parse(await readFile(normalizedPath, "utf8"));
  const client = new HttpClient({
    cacheDirectory: path.join(professorDataRoot, ".cache"),
    timeoutMs,
    retries,
    minDelayMs,
    fetchImpl,
  });
  const professorByProfile = new Map(
    normalized.professors
      .filter((professor) => professor.official_profile_url)
      .map((professor) => [professor.official_profile_url, professor]),
  );
  const checkedAt = new Date().toISOString();
  const references = new Map();
  const queries = [];

  for (const [index, college] of normalized.colleges.entries()) {
    logger.info?.(
      `[professor-photo-references] ${index + 1}/${normalized.colleges.length}: ${college.name}`,
    );
    const searchUrl = buildDkuCentralSearchUrl(college.name);
    try {
      const page = await client.fetchText(searchUrl, {
        purpose: "dku-central-photo-reference-search",
        useCache: false,
      });
      const parsed = parseDkuCentralPhotoReferences(page.body, page.url);
      let matched = 0;
      for (const reference of parsed) {
        const professor = professorByProfile.get(reference.official_profile_url);
        if (!professor) continue;
        references.set(professor.id, {
          professor_id: professor.id,
          professor_name: professor.name,
          official_profile_url: reference.official_profile_url,
          photo_source_url: reference.photo_source_url,
          source_page_url: reference.source_page_url,
          checked_at: checkedAt,
          usage_status: "REFERENCE_ONLY_PERMISSION_UNVERIFIED",
        });
        matched += 1;
      }
      queries.push({
        college: college.name,
        result_count: parsed.length,
        matched_count: matched,
        source_url: page.url,
      });
    } catch (error) {
      queries.push({
        college: college.name,
        result_count: 0,
        matched_count: 0,
        source_url: searchUrl,
        error: error.message,
      });
    }
  }

  const rows = [...references.values()].sort((left, right) =>
    left.professor_name.localeCompare(right.professor_name, "ko-KR"));
  const payload = {
    schema_version: "1.0.0",
    generated_at: checkedAt,
    policy: {
      storage: "URL_REFERENCE_ONLY",
      image_binary_downloaded: false,
      application_display_enabled: false,
      usage_status: "REFERENCE_ONLY_PERMISSION_UNVERIFIED",
      note:
        "공식 페이지에 공개된 사진 URL은 자유 이용 허가를 뜻하지 않습니다. 학교 또는 권리자 사용 허가 확인 전 앱에 표시하지 않습니다.",
    },
    professor_count: normalized.professors.length,
    matched_reference_count: rows.length,
    references: rows,
    queries,
  };
  const jsonPath = path.join(outputDirectory, "photo-references.json");
  const csvPath = path.join(outputDirectory, "photo-references.csv");
  await writeJsonAtomic(jsonPath, payload);
  await writeFile(csvPath, `\ufeff${toCsv(rows)}\r\n`, "utf8");
  return {
    json: jsonPath,
    csv: csvPath,
    professor_count: normalized.professors.length,
    matched_reference_count: rows.length,
    image_binary_downloaded: false,
    application_display_enabled: false,
    query_errors: queries.filter((query) => query.error).length,
  };
}

function toCsv(rows) {
  const columns = [
    "professor_id",
    "professor_name",
    "official_profile_url",
    "photo_source_url",
    "source_page_url",
    "checked_at",
    "usage_status",
  ];
  const lines = [columns.map(csvCell).join(",")];
  for (const row of rows) {
    lines.push(columns.map((column) => csvCell(row[column])).join(","));
  }
  return lines.join("\r\n");
}

function csvCell(value) {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

function resolveProfessorDataPath(value) {
  const resolved = path.resolve(repositoryRoot, value);
  const relative = path.relative(professorDataRoot, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Path must remain under ${professorDataRoot}`);
  }
  return resolved;
}
