#!/usr/bin/env node
import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { validateDataset } from "./schema.mjs";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "..", "..");
const professorDataRoot = path.join(repositoryRoot, "data", "professors");

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [datasetArg, manifestArg, outputArg] = process.argv.slice(2);
  if (!datasetArg || !manifestArg || !outputArg) {
    console.error(
      "Usage: node scripts/professor-crawler/export-database.mjs <dataset.json> <manifest.json> <output-directory>",
    );
    process.exitCode = 1;
  } else {
    try {
      const datasetPath = resolveRepositoryPath(datasetArg);
      const manifestPath = resolveRepositoryPath(manifestArg);
      const outputDirectory = resolveProfessorDataPath(outputArg);
      const dataset = JSON.parse(await readFile(datasetPath, "utf8"));
      const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
      validateDataset(dataset);
      const normalized = normalizeProfessorDataset(dataset, manifest);
      const files = await exportNormalizedDatabase({
        dataset,
        manifest,
        normalized,
        datasetPath,
        manifestPath,
        outputDirectory,
      });
      console.log(JSON.stringify({ counts: normalized.counts, files }, null, 2));
    } catch (error) {
      console.error(`[professor-database] ${error.stack || error.message}`);
      process.exitCode = 1;
    }
  }
}

export function normalizeProfessorDataset(dataset, manifest) {
  const discoveredDepartments = manifest.discovery
    ?.flatMap((entry) => entry.departments ?? [])
    .filter((department) => department.university === "단국대학교") ?? [];
  const homepageCounts = new Map();
  for (const department of discoveredDepartments) {
    if (!department.homepage_url) continue;
    homepageCounts.set(
      department.homepage_url,
      (homepageCounts.get(department.homepage_url) ?? 0) + 1,
    );
  }

  const colleges = new Map();
  const departments = new Map();
  const departmentByLabel = new Map();
  for (const department of discoveredDepartments) {
    const collegeId = stableId("college", department.university, department.college);
    const departmentId = department.organization_id
      ? `dku-${department.organization_id}`
      : stableId("department", department.university, department.college, department.department);
    colleges.set(collegeId, {
      id: collegeId,
      university: department.university,
      name: department.college,
    });
    const associationStatus = !department.homepage_url
      ? "NO_OFFICIAL_HOMEPAGE"
      : homepageCounts.get(department.homepage_url) > 1
        ? "SHARED_OFFICIAL_HOMEPAGE"
        : "DIRECT_OFFICIAL_DEPARTMENT_PAGE";
    const normalizedDepartment = {
      id: departmentId,
      college_id: collegeId,
      name: department.department,
      organization_id: department.organization_id ?? null,
      official_homepage_url: department.homepage_url ?? null,
      discovery_source_url: department.discovery_source_url,
      association_status: associationStatus,
    };
    departments.set(departmentId, normalizedDepartment);
    departmentByLabel.set(
      departmentLabel(department.university, department.college, department.department),
      normalizedDepartment,
    );
  }

  const professors = new Map();
  const professorDepartments = new Map();
  const collectionIssues = [];
  for (const record of dataset.records) {
    let department = departmentByLabel.get(
      departmentLabel(record.university, record.college, record.department),
    );
    if (!department) {
      const collegeId = stableId("college", record.university, record.college);
      colleges.set(collegeId, {
        id: collegeId,
        university: record.university,
        name: record.college,
      });
      department = {
        id: stableId("department", record.university, record.college, record.department),
        college_id: collegeId,
        name: record.department,
        organization_id: null,
        official_homepage_url: null,
        discovery_source_url: record.source_url,
        association_status: "NOT_IN_DISCOVERY_DIRECTORY",
      };
      departments.set(department.id, department);
      departmentByLabel.set(
        departmentLabel(record.university, record.college, record.department),
        department,
      );
    }

    if (!record.name) {
      collectionIssues.push({
        id: stableId("issue", record.id, record.status, record.failure_reason ?? ""),
        department_id: department.id,
        status: record.status,
        reason: record.failure_reason ?? "공식 페이지에 교수 레코드가 확인되지 않았습니다.",
        source_url: record.source_url,
        collected_at: record.collected_at,
      });
      continue;
    }

    const professorId = canonicalProfessorId(record);
    const existing = professors.get(professorId);
    const researchFields = new Set([
      ...(existing?.research_fields ?? []),
      ...record.research_fields,
    ]);
    const publications = new Map(
      (existing?.publications ?? []).map((publication) => [
        publicationKey(publication),
        publication,
      ]),
    );
    for (const publication of record.publications) {
      const key = publicationKey(publication);
      if (!publications.has(key)) {
        publications.set(key, {
          id: stableId("publication", professorId, key),
          professor_id: professorId,
          title: publication.title,
          publication_type: publication.publication_type,
          published_date: publication.published_date,
          doi: publication.doi,
          kci_id: publication.kci_id,
          official_profile_url: publication.official_profile_url,
          metadata_source: publication.metadata_source,
        });
      }
    }
    professors.set(professorId, {
      id: professorId,
      university: record.university,
      name: record.name,
      title: existing?.title ?? record.title,
      official_profile_url: existing?.official_profile_url ?? record.official_profile_url,
      source_url: existing?.source_url ?? record.source_url,
      status: preferStatus(existing?.status, record.status),
      research_fields_status: preferStatus(
        existing?.research_fields_status,
        record.research_fields_status,
      ),
      publications_status: preferStatus(
        existing?.publications_status,
        record.publications_status,
      ),
      collected_at: latestIso(existing?.collected_at, record.collected_at),
      content_hash: existing?.content_hash ?? record.content_hash,
      research_fields: [...researchFields].sort(localeCompareKo),
      publications: [...publications.values()].sort(comparePublications),
    });

    const relationKey = `${professorId}|${department.id}`;
    professorDepartments.set(relationKey, {
      professor_id: professorId,
      department_id: department.id,
      source_record_id: record.id,
      association_status: department.association_status,
    });
  }

  const professorRows = [...professors.values()].sort((left, right) =>
    localeCompareKo(left.name, right.name));
  const researchFields = professorRows.flatMap((professor) =>
    professor.research_fields.map((field) => ({
      id: stableId("field", professor.id, field),
      professor_id: professor.id,
      field,
    })));
  const publications = professorRows.flatMap((professor) => professor.publications);
  const normalized = {
    schema_version: "1.0.0",
    generated_at: dataset.generated_at,
    university: "단국대학교",
    publication_scope: dataset.publication_scope,
    colleges: [...colleges.values()].sort((left, right) => localeCompareKo(left.name, right.name)),
    departments: [...departments.values()].sort((left, right) =>
      localeCompareKo(left.name, right.name)),
    professors: professorRows.map(({ research_fields, publications: ignored, ...professor }) => professor),
    professor_departments: [...professorDepartments.values()].sort((left, right) =>
      `${left.professor_id}|${left.department_id}`.localeCompare(
        `${right.professor_id}|${right.department_id}`,
      )),
    research_fields: researchFields,
    publications,
    publication_metadata: [],
    collection_issues: collectionIssues.sort((left, right) =>
      left.department_id.localeCompare(right.department_id)),
  };
  normalized.counts = {
    colleges: normalized.colleges.length,
    departments: normalized.departments.length,
    professors: normalized.professors.length,
    professor_department_links: normalized.professor_departments.length,
    research_fields: normalized.research_fields.length,
    publications: normalized.publications.length,
    publication_metadata: normalized.publication_metadata.length,
    collection_issues: normalized.collection_issues.length,
    shared_homepage_departments: normalized.departments.filter(
      (department) => department.association_status === "SHARED_OFFICIAL_HOMEPAGE",
    ).length,
  };
  return normalized;
}

export async function exportNormalizedDatabase({
  dataset,
  manifest,
  normalized,
  datasetPath,
  manifestPath,
  outputDirectory,
}) {
  await mkdir(outputDirectory, { recursive: true });
  const normalizedJsonPath = path.join(outputDirectory, "normalized.json");
  const databasePath = path.join(outputDirectory, "dankook-professors.sqlite");
  const reportPath = path.join(outputDirectory, "README.md");
  await writeFile(normalizedJsonPath, `${JSON.stringify(normalized, null, 2)}\n`, "utf8");
  await copyFile(datasetPath, path.join(outputDirectory, "source-dataset.json"));
  await copyFile(manifestPath, path.join(outputDirectory, "source-manifest.json"));
  await writeCsvFiles(outputDirectory, normalized);
  await writeSqliteDatabase(databasePath, normalized, manifest);
  await writeFile(reportPath, buildReadme(normalized, manifest), "utf8");
  return {
    sqlite: databasePath,
    normalized_json: normalizedJsonPath,
    csv_directory: path.join(outputDirectory, "csv"),
    source_dataset: path.join(outputDirectory, "source-dataset.json"),
    source_manifest: path.join(outputDirectory, "source-manifest.json"),
    readme: reportPath,
  };
}

async function writeSqliteDatabase(databasePath, normalized, manifest) {
  const resolved = path.resolve(databasePath);
  const relative = path.relative(professorDataRoot, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Database output must remain under ${professorDataRoot}`);
  }
  await rm(resolved, { force: true });
  const database = new DatabaseSync(resolved);
  database.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA journal_mode = DELETE;
    CREATE TABLE metadata (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    ) STRICT;
    CREATE TABLE colleges (
      id TEXT PRIMARY KEY,
      university TEXT NOT NULL,
      name TEXT NOT NULL
    ) STRICT;
    CREATE TABLE departments (
      id TEXT PRIMARY KEY,
      college_id TEXT NOT NULL REFERENCES colleges(id),
      name TEXT NOT NULL,
      organization_id TEXT,
      official_homepage_url TEXT,
      discovery_source_url TEXT NOT NULL,
      association_status TEXT NOT NULL
    ) STRICT;
    CREATE TABLE professors (
      id TEXT PRIMARY KEY,
      university TEXT NOT NULL,
      name TEXT NOT NULL,
      title TEXT,
      official_profile_url TEXT,
      source_url TEXT NOT NULL,
      status TEXT NOT NULL,
      research_fields_status TEXT NOT NULL,
      publications_status TEXT NOT NULL,
      collected_at TEXT NOT NULL,
      content_hash TEXT
    ) STRICT;
    CREATE TABLE professor_departments (
      professor_id TEXT NOT NULL REFERENCES professors(id),
      department_id TEXT NOT NULL REFERENCES departments(id),
      source_record_id TEXT NOT NULL,
      association_status TEXT NOT NULL,
      PRIMARY KEY (professor_id, department_id)
    ) STRICT;
    CREATE TABLE research_fields (
      id TEXT PRIMARY KEY,
      professor_id TEXT NOT NULL REFERENCES professors(id),
      field TEXT NOT NULL,
      UNIQUE (professor_id, field)
    ) STRICT;
    CREATE TABLE publications (
      id TEXT PRIMARY KEY,
      professor_id TEXT NOT NULL REFERENCES professors(id),
      title TEXT NOT NULL,
      publication_type TEXT,
      published_date TEXT,
      doi TEXT,
      kci_id TEXT,
      official_profile_url TEXT,
      metadata_source TEXT NOT NULL,
      UNIQUE (professor_id, title, published_date)
    ) STRICT;
    CREATE TABLE publication_metadata (
      id TEXT PRIMARY KEY,
      publication_id TEXT NOT NULL REFERENCES publications(id),
      provider TEXT NOT NULL,
      external_id TEXT,
      canonical_title TEXT,
      journal_title TEXT,
      authors_json TEXT NOT NULL,
      abstract TEXT,
      keywords_json TEXT NOT NULL,
      citation_count INTEGER,
      landing_url TEXT,
      license_url TEXT,
      fetched_at TEXT NOT NULL,
      match_method TEXT NOT NULL,
      match_score REAL NOT NULL,
      UNIQUE (publication_id, provider)
    ) STRICT;
    CREATE TABLE collection_issues (
      id TEXT PRIMARY KEY,
      department_id TEXT NOT NULL REFERENCES departments(id),
      status TEXT NOT NULL,
      reason TEXT NOT NULL,
      source_url TEXT NOT NULL,
      collected_at TEXT NOT NULL
    ) STRICT;
    CREATE INDEX idx_departments_college ON departments(college_id);
    CREATE INDEX idx_professor_departments_department ON professor_departments(department_id);
    CREATE INDEX idx_research_fields_professor ON research_fields(professor_id);
    CREATE INDEX idx_publications_professor ON publications(professor_id);
    CREATE INDEX idx_publications_date ON publications(published_date);
    CREATE INDEX idx_publication_metadata_publication ON publication_metadata(publication_id);
  `);
  const insertMetadata = database.prepare("INSERT INTO metadata (key, value) VALUES (?, ?)");
  const metadata = {
    schema_version: normalized.schema_version,
    generated_at: normalized.generated_at,
    university: normalized.university,
    publication_scope: normalized.publication_scope,
    source_run_id: manifest.run_id ?? "",
    source_data_content_hash: manifest.data_content_hash ?? "",
    counts: JSON.stringify(normalized.counts),
  };
  const insertCollege = database.prepare(
    "INSERT INTO colleges (id, university, name) VALUES (?, ?, ?)",
  );
  const insertDepartment = database.prepare(`
    INSERT INTO departments (
      id, college_id, name, organization_id, official_homepage_url,
      discovery_source_url, association_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const insertProfessor = database.prepare(`
    INSERT INTO professors (
      id, university, name, title, official_profile_url, source_url, status,
      research_fields_status, publications_status, collected_at, content_hash
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertProfessorDepartment = database.prepare(`
    INSERT INTO professor_departments (
      professor_id, department_id, source_record_id, association_status
    ) VALUES (?, ?, ?, ?)
  `);
  const insertResearchField = database.prepare(
    "INSERT INTO research_fields (id, professor_id, field) VALUES (?, ?, ?)",
  );
  const insertPublication = database.prepare(`
    INSERT INTO publications (
      id, professor_id, title, publication_type, published_date, doi, kci_id,
      official_profile_url, metadata_source
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertIssue = database.prepare(`
    INSERT INTO collection_issues (
      id, department_id, status, reason, source_url, collected_at
    ) VALUES (?, ?, ?, ?, ?, ?)
  `);
  const insertPublicationMetadata = database.prepare(`
    INSERT INTO publication_metadata (
      id, publication_id, provider, external_id, canonical_title, journal_title,
      authors_json, abstract, keywords_json, citation_count, landing_url,
      license_url, fetched_at, match_method, match_score
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  database.exec("BEGIN IMMEDIATE");
  try {
    for (const [key, value] of Object.entries(metadata)) insertMetadata.run(key, value);
    for (const item of normalized.colleges) {
      insertCollege.run(item.id, item.university, item.name);
    }
    for (const item of normalized.departments) {
      insertDepartment.run(
        item.id,
        item.college_id,
        item.name,
        item.organization_id,
        item.official_homepage_url,
        item.discovery_source_url,
        item.association_status,
      );
    }
    for (const item of normalized.professors) {
      insertProfessor.run(
        item.id,
        item.university,
        item.name,
        item.title,
        item.official_profile_url,
        item.source_url,
        item.status,
        item.research_fields_status,
        item.publications_status,
        item.collected_at,
        item.content_hash,
      );
    }
    for (const item of normalized.professor_departments) {
      insertProfessorDepartment.run(
        item.professor_id,
        item.department_id,
        item.source_record_id,
        item.association_status,
      );
    }
    for (const item of normalized.research_fields) {
      insertResearchField.run(item.id, item.professor_id, item.field);
    }
    for (const item of normalized.publications) {
      insertPublication.run(
        item.id,
        item.professor_id,
        item.title,
        item.publication_type,
        item.published_date,
        item.doi,
        item.kci_id,
        item.official_profile_url,
        item.metadata_source,
      );
    }
    for (const item of normalized.publication_metadata) {
      insertPublicationMetadata.run(
        item.id,
        item.publication_id,
        item.provider,
        item.external_id,
        item.canonical_title,
        item.journal_title,
        item.authors_json,
        item.abstract,
        item.keywords_json,
        item.citation_count,
        item.landing_url,
        item.license_url,
        item.fetched_at,
        item.match_method,
        item.match_score,
      );
    }
    for (const item of normalized.collection_issues) {
      insertIssue.run(
        item.id,
        item.department_id,
        item.status,
        item.reason,
        item.source_url,
        item.collected_at,
      );
    }
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  } finally {
    database.close();
  }
}

async function writeCsvFiles(outputDirectory, normalized) {
  const csvDirectory = path.join(outputDirectory, "csv");
  await mkdir(csvDirectory, { recursive: true });
  const tables = {
    colleges: normalized.colleges,
    departments: normalized.departments,
    professors: normalized.professors,
    professor_departments: normalized.professor_departments,
    research_fields: normalized.research_fields,
    publications: normalized.publications,
    publication_metadata: normalized.publication_metadata,
    collection_issues: normalized.collection_issues,
  };
  for (const [name, rows] of Object.entries(tables)) {
    const columns = rows.length ? Object.keys(rows[0]) : [];
    const csv = toCsv(rows, columns);
    await writeFile(path.join(csvDirectory, `${name}.csv`), `\ufeff${csv}`, "utf8");
  }
}

function toCsv(rows, columns) {
  const lines = [columns.map(csvCell).join(",")];
  for (const row of rows) {
    lines.push(columns.map((column) => csvCell(row[column])).join(","));
  }
  return `${lines.join("\r\n")}\r\n`;
}

function csvCell(value) {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

function buildReadme(normalized, manifest) {
  const counts = normalized.counts;
  return `# 단국대학교 교수 공개 데이터

- 생성 시각: ${normalized.generated_at}
- 원본 실행 ID: \`${manifest.run_id ?? "확인 필요"}\`
- 범위 상태: **${manifest.scope_status ?? "확인 필요"}**
- 논문 범위: 대학 공식 교수 프로필에 노출된 목록만

## 파일

- \`dankook-professors.sqlite\`: 정규화 SQLite 데이터베이스
- \`normalized.json\`: SQLite와 같은 구조의 JSON
- \`csv/\`: 테이블별 UTF-8 CSV
- \`source-dataset.json\`: 검증된 수집 원본
- \`source-manifest.json\`: 수집 범위·오류·출처·robots 감사 기록

## 정규화 결과

| 항목 | 건수 |
|---|---:|
| 단과대학 | ${counts.colleges} |
| 학과·전공 | ${counts.departments} |
| 중복 제거 교수 | ${counts.professors} |
| 교수-학과 연결 | ${counts.professor_department_links} |
| 연구분야 | ${counts.research_fields} |
| 공식 프로필 연구실적 | ${counts.publications} |
| KCI·Crossref 상세 메타데이터 | ${counts.publication_metadata} |
| 수집 이슈 | ${counts.collection_issues} |
| 공유 홈페이지 학과 | ${counts.shared_homepage_departments} |

## 주의사항

- 이메일과 전화·팩스는 저장하지 않습니다.
- 사진은 핵심 데이터와 캐시에 저장하지 않습니다. 선택적으로 생성되는
  \`photo-references.json\`은 공식 사진 URL과 출처만 보관하며, 사진 파일을
  내려받지 않고 이용 허가 확인 전 앱에도 표시하지 않습니다.
- 교수의 모집·지도·면담 가능 여부를 포함하지 않으며 추정해서도 안 됩니다.
- \`SHARED_OFFICIAL_HOMEPAGE\` 연결은 하나의 공식 홈페이지가 여러 전공에 공통으로 연결된 경우입니다. 해당 교수가 각 세부 전공에 직접 소속됐다는 뜻으로 사용하지 않습니다.
- \`NOT_LISTED_ON_OFFICIAL_PROFILE\`은 정보가 없다는 뜻이 아니라 공식 프로필에 노출되지 않았다는 뜻입니다.
- DOI/KCI 검색 결과만으로 논문을 추가하지 않습니다.
- \`publication_metadata\`는 KCI·Crossref에서 보강한 상세정보를 출처별로 저장하기 위한 테이블입니다. API 보강 전에는 비어 있을 수 있습니다.

## SQLite 예시

\`\`\`sql
SELECT
  p.name,
  p.title,
  c.name AS college,
  d.name AS department,
  pd.association_status
FROM professors p
JOIN professor_departments pd ON pd.professor_id = p.id
JOIN departments d ON d.id = pd.department_id
JOIN colleges c ON c.id = d.college_id
ORDER BY c.name, d.name, p.name;
\`\`\`
`;
}

function canonicalProfessorId(record) {
  const identity = record.official_profile_url
    ? `${record.university}|${record.official_profile_url}`
    : `${record.university}|${record.name}|${record.source_url}`;
  return stableId("professor", identity);
}

function stableId(...values) {
  return createHash("sha256").update(values.join("|")).digest("hex").slice(0, 24);
}

function departmentLabel(university, college, department) {
  return `${university}|${college}|${department}`;
}

function publicationKey(publication) {
  return `${publication.title.trim().toLocaleLowerCase("ko-KR")}|${publication.published_date ?? ""}`;
}

function preferStatus(left, right) {
  const priority = {
    FOUND: 5,
    NOT_LISTED_ON_OFFICIAL_PROFILE: 4,
    PROFILE_UNAVAILABLE: 3,
    PARSE_FAILED: 2,
    ROBOTS_BLOCKED: 1,
  };
  if (!left) return right;
  return priority[left] >= priority[right] ? left : right;
}

function latestIso(left, right) {
  if (!left) return right;
  return Date.parse(left) >= Date.parse(right) ? left : right;
}

function comparePublications(left, right) {
  const dateComparison = (right.published_date ?? "").localeCompare(left.published_date ?? "");
  return dateComparison || localeCompareKo(left.title, right.title);
}

function localeCompareKo(left, right) {
  return String(left).localeCompare(String(right), "ko-KR");
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
