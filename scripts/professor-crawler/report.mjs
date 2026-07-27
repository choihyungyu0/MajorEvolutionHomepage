import path from "node:path";
import { STATUS_VALUES } from "./constants.mjs";
import { sha256, stableSortBy, writeJsonAtomic } from "./utils.mjs";
import { writeFile } from "node:fs/promises";

export function createManifest({
  runId,
  startedAt,
  finishedAt,
  options,
  dataset,
  discovery,
  departmentResults,
  robotsAudit,
  metadataReport,
}) {
  const records = dataset.records;
  const statusCounts = Object.fromEntries(
    STATUS_VALUES.map((status) => [
      status,
      records.filter((record) => record.status === status).length,
    ]),
  );
  const researchStatusCounts = Object.fromEntries(
    STATUS_VALUES.map((status) => [
      status,
      records.filter((record) => record.research_fields_status === status).length,
    ]),
  );
  const publicationStatusCounts = Object.fromEntries(
    STATUS_VALUES.map((status) => [
      status,
      records.filter((record) => record.publications_status === status).length,
    ]),
  );
  const departmentCount = new Set(
    records.map((record) => `${record.university}|${record.college}|${record.department}`),
  ).size;
  const coverageGaps = discovery.flatMap((entry) => entry.issues ?? []);
  const boundedSample =
    Number.isFinite(options.maxDepartments) || Number.isFinite(options.maxProfessors);
  const cbnuPartial = discovery.some(
    (entry) => entry.university === "충북대학교" && entry.source?.declared_scope !== "FULL",
  );
  const hasFailures = records.some((record) =>
    ["PROFILE_UNAVAILABLE", "PARSE_FAILED", "ROBOTS_BLOCKED"].includes(record.status),
  );
  const scopeStatus = boundedSample
    ? "SAMPLE"
    : cbnuPartial || coverageGaps.length || hasFailures
      ? "PARTIAL"
      : "COMPLETE";

  return {
    schema_version: dataset.schema_version,
    run_id: runId,
    started_at: startedAt,
    finished_at: finishedAt,
    scope_requested: {
      universities: options.universities,
      departments: "ALL_DEPARTMENTS",
      publications: "OFFICIAL_PROFILE_LIST_ONLY",
    },
    scope_status: scopeStatus,
    limits: {
      max_departments: serializeLimit(options.maxDepartments),
      max_professors_per_department: serializeLimit(options.maxProfessors),
    },
    privacy: {
      persisted_fields_excluded: ["email", "telephone", "fax", "photo/image"],
      cache_policy:
        "Persistent cache is rebuilt from allowlisted department/professor/research/publication/navigation fragments; raw responses exist only in memory.",
    },
    counts: {
      records: records.length,
      professors: records.filter((record) => record.name).length,
      departments_with_records: departmentCount,
      departments_attempted: departmentResults.length,
      publications: records.reduce((sum, record) => sum + record.publications.length, 0),
      by_status: statusCounts,
      research_fields_by_status: researchStatusCounts,
      publications_by_status: publicationStatusCounts,
    },
    department_results: departmentResults,
    discovery,
    coverage_gaps: coverageGaps,
    metadata_enrichment: metadataReport,
    robots_audit: compactRobotsAudit(robotsAudit),
    data_content_hash: sha256(JSON.stringify(records)),
  };
}

export async function writeRunArtifacts(outputDirectory, dataset, manifest) {
  const sortedDataset = {
    ...dataset,
    records: stableSortBy(
      dataset.records,
      (record) =>
        `${record.university}|${record.college}|${record.department}|${record.name ?? ""}`,
    ),
  };
  await writeJsonAtomic(path.join(outputDirectory, "dataset.json"), sortedDataset);
  await writeJsonAtomic(path.join(outputDirectory, "manifest.json"), manifest);
  await writeFile(
    path.join(outputDirectory, "report.md"),
    renderMarkdownReport(manifest),
    "utf8",
  );
  return {
    dataset: path.join(outputDirectory, "dataset.json"),
    manifest: path.join(outputDirectory, "manifest.json"),
    report: path.join(outputDirectory, "report.md"),
  };
}

export function renderMarkdownReport(manifest) {
  const statusLines = Object.entries(manifest.counts.by_status)
    .map(([status, count]) => `| ${status} | ${count} |`)
    .join("\n");
  const gaps =
    manifest.coverage_gaps.length > 0
      ? manifest.coverage_gaps
          .map(
            (gap) =>
              `- **${gap.status}** — ${gap.source_url}: ${gap.reason}${
                gap.scope_impact ? ` (영향: ${gap.scope_impact})` : ""
              }`,
          )
          .join("\n")
      : "- 없음";
  const publicationStatusLines = Object.entries(manifest.counts.publications_by_status)
    .map(([status, count]) => `| ${status} | ${count} |`)
    .join("\n");
  return `# 교수 공개 데이터 수집 보고서

- 실행 ID: \`${manifest.run_id}\`
- 범위 상태: **${manifest.scope_status}**
- 대학: ${manifest.scope_requested.universities.join(", ")}
- 논문 범위: 공식 교수 프로필에 노출된 목록만
- 교수 레코드: ${manifest.counts.professors}
- 논문 레코드: ${manifest.counts.publications}

## 상태

| 상태 | 건수 |
|---|---:|
${statusLines}

### 논문 목록 공개 상태

| 상태 | 교수 레코드 수 |
|---|---:|
${publicationStatusLines}

## 범위 공백과 차단

${gaps}

## 개인정보·출처 원칙

- 이메일, 전화·팩스, 사진·이미지 필드는 결과에 저장하지 않습니다.
- 영속 캐시는 원문 전체가 아니라 학과·교수·연구분야·연구실적·탐색 링크의 허용된 조각만 재구성합니다.
- DOI/KCI 조회는 공식 프로필에 이미 있는 논문의 식별자 보정에만 쓰며, 새 논문을 추가하지 않습니다.
- \`NOT_LISTED_ON_OFFICIAL_PROFILE\`은 “논문/연구가 없음”이 아니라 공식 프로필에 목록이 노출되지 않았다는 뜻입니다.
`;
}

function compactRobotsAudit(audit) {
  const map = new Map();
  for (const entry of audit) {
    const key = `${entry.url}|${entry.allowed}|${entry.matched_rule ?? ""}`;
    map.set(key, entry);
  }
  return [...map.values()];
}

function serializeLimit(value) {
  return Number.isFinite(value) ? value : "UNBOUNDED";
}
