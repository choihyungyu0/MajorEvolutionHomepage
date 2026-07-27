import { STATUS } from "./constants.mjs";
import { assertProfessorRecord } from "./schema.mjs";
import { normalizeSpace, uniqueBy } from "./utils.mjs";

const STATUS_PRIORITY = Object.freeze({
  [STATUS.FOUND]: 5,
  [STATUS.NOT_LISTED_ON_OFFICIAL_PROFILE]: 4,
  [STATUS.PROFILE_UNAVAILABLE]: 3,
  [STATUS.PARSE_FAILED]: 2,
  [STATUS.ROBOTS_BLOCKED]: 1,
});

export function dedupeProfessorRecords(records) {
  const byKey = new Map();
  for (const record of records) {
    const key = dedupeKey(record);
    const existing = byKey.get(key);
    byKey.set(key, existing ? mergeRecords(existing, record) : record);
  }
  return [...byKey.values()].map(assertProfessorRecord);
}

function dedupeKey(record) {
  return [
    record.university,
    record.college,
    record.department,
    normalizeSpace(record.name ?? ""),
    record.official_profile_url ?? record.source_url,
  ].join("|");
}

function mergeRecords(left, right) {
  const preferred =
    STATUS_PRIORITY[left.status] >= STATUS_PRIORITY[right.status] ? left : right;
  const secondary = preferred === left ? right : left;
  const researchFields = [
    ...new Set([...left.research_fields, ...right.research_fields].map(normalizeSpace)),
  ].filter(Boolean);
  const publications = uniqueBy(
    [...left.publications, ...right.publications],
    (publication) =>
      `${normalizeSpace(publication.title).toLowerCase()}|${publication.published_date ?? ""}`,
  );
  return {
    ...preferred,
    title: preferred.title ?? secondary.title,
    research_fields: researchFields,
    publications,
    research_fields_status: chooseStatus(
      left.research_fields_status,
      right.research_fields_status,
    ),
    publications_status: chooseStatus(left.publications_status, right.publications_status),
    failure_reason:
      preferred.status === STATUS.FOUND ||
      preferred.status === STATUS.NOT_LISTED_ON_OFFICIAL_PROFILE
        ? null
        : preferred.failure_reason ?? secondary.failure_reason,
  };
}

function chooseStatus(left, right) {
  return STATUS_PRIORITY[left] >= STATUS_PRIORITY[right] ? left : right;
}
