#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { writeJsonAtomic } from "./utils.mjs";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "..", "..");
const professorDataRoot = path.join(repositoryRoot, "data", "professors");

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [normalizedArg, outputArg, publicationLimitArg = "6"] = process.argv.slice(2);
  if (!normalizedArg || !outputArg) {
    console.error(
      "Usage: node scripts/professor-crawler/build-runtime.mjs <normalized.json> <output.json> [publication-limit]",
    );
    process.exitCode = 1;
  } else {
    try {
      const publicationLimit = Number(publicationLimitArg);
      if (!Number.isInteger(publicationLimit) || publicationLimit <= 0) {
        throw new Error("publication-limit must be a positive integer");
      }
      const result = await buildProfessorRuntime({
        normalizedPath: resolveProfessorDataPath(normalizedArg),
        outputPath: resolveProfessorDataPath(outputArg),
        publicationLimit,
      });
      console.log(JSON.stringify(result, null, 2));
    } catch (error) {
      console.error(`[professor-runtime] ${error.stack || error.message}`);
      process.exitCode = 1;
    }
  }
}

export async function buildProfessorRuntime({
  normalizedPath,
  outputPath,
  publicationLimit = 6,
}) {
  const normalized = JSON.parse(await readFile(normalizedPath, "utf8"));
  const colleges = new Map(normalized.colleges.map((row) => [row.id, row]));
  const departments = new Map(normalized.departments.map((row) => [row.id, row]));
  const fieldsByProfessor = groupBy(normalized.research_fields, "professor_id");
  const publicationsByProfessor = groupBy(normalized.publications, "professor_id");
  const affiliationsByProfessor = new Map();

  for (const relation of normalized.professor_departments) {
    const department = departments.get(relation.department_id);
    const college = department ? colleges.get(department.college_id) : null;
    const affiliations = affiliationsByProfessor.get(relation.professor_id) ?? [];
    affiliations.push({
      college: college?.name ?? "단과대학 미확인",
      department: department?.name ?? "학과 미확인",
      association_status: relation.association_status,
    });
    affiliationsByProfessor.set(relation.professor_id, affiliations);
  }

  const records = normalized.professors.map((professor) => {
    const affiliations = affiliationsByProfessor.get(professor.id) ?? [];
    const publications = publicationsByProfessor.get(professor.id) ?? [];
    return {
      id: professor.id,
      university: professor.university,
      college: unique(affiliations.map((item) => item.college)).join(" · "),
      department: unique(affiliations.map((item) => item.department)).join(" · "),
      departments: unique(affiliations.map((item) => item.department)),
      association_statuses: unique(
        affiliations.map((item) => item.association_status),
      ),
      name: professor.name,
      title: professor.title,
      research_fields: (fieldsByProfessor.get(professor.id) ?? []).map(
        (item) => item.field,
      ),
      publication_count: publications.length,
      publications: publications.slice(0, publicationLimit).map((publication) => ({
        id: publication.id,
        title: publication.title,
        publication_type: publication.publication_type,
        published_date: publication.published_date,
        doi: publication.doi,
        kci_id: publication.kci_id,
        official_profile_url: publication.official_profile_url,
      })),
      official_profile_url: professor.official_profile_url,
      source_url: professor.source_url,
      collected_at: professor.collected_at,
      status: professor.status,
      research_fields_status: professor.research_fields_status,
      publications_status: professor.publications_status,
      failure_reason: null,
    };
  });
  const coverageGaps = normalized.collection_issues.map((issue) => {
    const department = departments.get(issue.department_id);
    const college = department ? colleges.get(department.college_id) : null;
    return {
      university: normalized.university,
      college: college?.name ?? "단과대학 미확인",
      department: department?.name ?? "학과 미확인",
      status: issue.status,
      reason: issue.reason,
      scope_impact: `${department?.name ?? "해당 학과"} 교수 후보는 자동 매칭에서 제외`,
      source_url: issue.source_url,
    };
  });
  const runtime = {
    schema_version: "1.0.0",
    generated_at: normalized.generated_at,
    scope_status: coverageGaps.length ? "PARTIAL" : "COMPLETE",
    publication_scope: normalized.publication_scope,
    official_record_count: records.length,
    runtime_publication_limit: publicationLimit,
    note:
      "단국대학교 공식 교수 프로필 전체 수집본을 정규화한 런타임 데이터입니다. 교수의 면담·지도·모집 가능 여부는 포함하지 않습니다.",
    records,
    coverage_gaps: coverageGaps,
  };
  await writeJsonAtomic(outputPath, runtime);
  return {
    output: outputPath,
    scope_status: runtime.scope_status,
    professor_count: records.length,
    publication_evidence_count: records.reduce(
      (sum, record) => sum + record.publications.length,
      0,
    ),
    full_publication_count: records.reduce(
      (sum, record) => sum + record.publication_count,
      0,
    ),
    coverage_gap_count: coverageGaps.length,
  };
}

function groupBy(rows, key) {
  const groups = new Map();
  for (const row of rows) {
    const values = groups.get(row[key]) ?? [];
    values.push(row);
    groups.set(row[key], values);
  }
  return groups;
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function resolveProfessorDataPath(value) {
  const resolved = path.resolve(repositoryRoot, value);
  const relative = path.relative(professorDataRoot, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Path must remain under ${professorDataRoot}`);
  }
  return resolved;
}
