import {
  SCHEMA_VERSION,
  SENSITIVE_KEY_PATTERN,
  STATUS,
  STATUS_VALUES,
  UNIVERSITY,
} from "./constants.mjs";
import { normalizeNullable, normalizeSpace, safeIsoDate, sha256 } from "./utils.mjs";

const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const KOREAN_PHONE_PATTERN =
  /(?<!\d)(?:\+?82[-\s]?)?(?:2|0(?:2|3[1-3]|4[1-4]|5[1-5]|6[1-4]))[-\s)]?\d{3,4}[-\s]?\d{4}(?!\d)/;
const IMAGE_URL_PATTERN = /\.(?:avif|gif|jpe?g|png|svg|webp)(?:[?#]|$)/i;

export function buildPublication(publication, officialProfileUrl) {
  const title = normalizeSpace(publication.title ?? "");
  if (!title) throw new Error("Publication title is required");
  return {
    title,
    publication_type: normalizeNullable(publication.publication_type),
    published_date: normalizeNullable(publication.published_date),
    doi: normalizeDoi(publication.doi),
    kci_id: normalizeNullable(publication.kci_id),
    official_profile_url: officialProfileUrl,
    metadata_source: normalizeSpace(publication.metadata_source || "OFFICIAL_PROFILE"),
  };
}

export function buildProfessorRecord(input) {
  const university = normalizeSpace(input.university);
  const college = normalizeSpace(input.college);
  const department = normalizeSpace(input.department);
  const name = normalizeNullable(input.name);
  const title = normalizeNullable(input.title);
  const sourceUrl = normalizeSpace(input.source_url);
  const officialProfileUrl = normalizeNullable(input.official_profile_url);
  const collectedAt = safeIsoDate(input.collected_at);
  const researchFields = [
    ...new Set((input.research_fields ?? []).map(normalizeSpace).filter(Boolean)),
  ];
  const publications = (input.publications ?? []).map((publication) =>
    buildPublication(publication, officialProfileUrl),
  );
  const status = input.status ?? deriveOverallStatus(input);

  const record = {
    schema_version: SCHEMA_VERSION,
    id: sha256(
      [university, college, department, name ?? "", officialProfileUrl ?? sourceUrl].join("|"),
    ).slice(0, 24),
    university,
    college,
    department,
    name,
    title,
    research_fields: researchFields,
    publications,
    official_profile_url: officialProfileUrl,
    source_url: sourceUrl,
    collected_at: collectedAt,
    status,
    research_fields_status:
      input.research_fields_status ??
      (researchFields.length ? STATUS.FOUND : STATUS.NOT_LISTED_ON_OFFICIAL_PROFILE),
    publications_status:
      input.publications_status ??
      (publications.length ? STATUS.FOUND : STATUS.NOT_LISTED_ON_OFFICIAL_PROFILE),
    failure_reason: sanitizeFailureReason(input.failure_reason),
    content_hash: normalizeNullable(input.content_hash),
  };

  assertProfessorRecord(record);
  return record;
}

export function deriveOverallStatus(input) {
  if (input.research_fields?.length || input.publications?.length) return STATUS.FOUND;
  return STATUS.NOT_LISTED_ON_OFFICIAL_PROFILE;
}

export function assertProfessorRecord(record) {
  const errors = [];
  if (record.schema_version !== SCHEMA_VERSION) {
    errors.push(`schema_version must equal ${SCHEMA_VERSION}`);
  }
  if (![UNIVERSITY.DKU, UNIVERSITY.CBNU].includes(record.university)) {
    errors.push("university is not supported");
  }
  for (const field of ["college", "department", "source_url", "collected_at"]) {
    if (typeof record[field] !== "string" || !record[field].trim()) {
      errors.push(`${field} is required`);
    }
  }
  for (const field of ["status", "research_fields_status", "publications_status"]) {
    if (!STATUS_VALUES.includes(record[field])) {
      errors.push(`${field} is invalid: ${record[field]}`);
    }
  }
  if (record.status === STATUS.FOUND && !record.name) {
    errors.push("name is required when status is FOUND");
  }
  if (!Array.isArray(record.research_fields)) errors.push("research_fields must be an array");
  if (!Array.isArray(record.publications)) errors.push("publications must be an array");
  if (
    [STATUS.PARSE_FAILED, STATUS.PROFILE_UNAVAILABLE, STATUS.ROBOTS_BLOCKED].includes(
      record.status,
    ) &&
    !record.failure_reason
  ) {
    errors.push("failure_reason is required for failed or blocked records");
  }
  findSensitiveValues(record, "$", errors);
  if (errors.length) {
    throw new Error(`Invalid professor record ${record.id ?? "(no id)"}:\n- ${errors.join("\n- ")}`);
  }
  return record;
}

export function validateDataset(dataset) {
  if (!dataset || typeof dataset !== "object") throw new Error("Dataset must be an object");
  if (dataset.schema_version !== SCHEMA_VERSION) {
    throw new Error(`Dataset schema_version must equal ${SCHEMA_VERSION}`);
  }
  if (!Array.isArray(dataset.records)) throw new Error("Dataset records must be an array");
  dataset.records.forEach(assertProfessorRecord);
  const ids = new Set();
  for (const record of dataset.records) {
    if (ids.has(record.id)) throw new Error(`Duplicate record id: ${record.id}`);
    ids.add(record.id);
  }
  return {
    valid: true,
    record_count: dataset.records.length,
    university_count: new Set(dataset.records.map((record) => record.university)).size,
  };
}

function normalizeDoi(value) {
  const normalized = normalizeNullable(value);
  return normalized
    ? normalized.replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "").replace(/^doi:\s*/i, "")
    : null;
}

function sanitizeFailureReason(value) {
  const normalized = normalizeNullable(value);
  if (!normalized) return null;
  return normalizeSpace(normalized)
    .replace(/https?:\/\/\S+/gi, "[official URL omitted]")
    .replace(/[A-F0-9]{24,}/gi, "[identifier omitted]")
    .replace(EMAIL_PATTERN, "[email omitted]")
    .replace(KOREAN_PHONE_PATTERN, "[phone omitted]")
    .replace(IMAGE_URL_PATTERN, "[image URL omitted]");
}

function findSensitiveValues(value, location, errors) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => findSensitiveValues(item, `${location}[${index}]`, errors));
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, nested] of Object.entries(value)) {
      if (SENSITIVE_KEY_PATTERN.test(key)) errors.push(`sensitive key is forbidden at ${location}.${key}`);
      findSensitiveValues(nested, `${location}.${key}`, errors);
    }
    return;
  }
  if (typeof value !== "string") return;
  const isOpaqueIdentifier =
    /(?:^|\.)id$/i.test(location) &&
    /^[a-f0-9]{24}$/i.test(value);
  if (isOpaqueIdentifier) return;
  const isSha256Metadata =
    /(?:^|\.)[a-z_]*content_hash$/i.test(location) &&
    /^[a-f0-9]{64}$/i.test(value);
  if (isSha256Metadata) return;
  const isUrlField = /(?:^|\.)[a-z_]*url$/i.test(location) && /^https?:\/\//i.test(value);
  if (isUrlField) {
    try {
      const parsed = new URL(value);
      for (const key of parsed.searchParams.keys()) {
        if (SENSITIVE_KEY_PATTERN.test(key)) {
          errors.push(`sensitive URL query key is forbidden at ${location}`);
        }
      }
    } catch {
      errors.push(`invalid URL at ${location}`);
    }
    if (EMAIL_PATTERN.test(value)) errors.push(`email-like value is forbidden at ${location}`);
    if (IMAGE_URL_PATTERN.test(value)) errors.push(`image URL is forbidden at ${location}`);
    return;
  }
  const isAcademicText =
    /^\$\.research_fields\[\d+\]$/i.test(location) ||
    /^\$\.publications\[\d+\]\.title$/i.test(location);
  if (isAcademicText) return;
  if (EMAIL_PATTERN.test(value)) errors.push(`email-like value is forbidden at ${location}`);
  if (KOREAN_PHONE_PATTERN.test(value)) errors.push(`phone-like value is forbidden at ${location}`);
  if (IMAGE_URL_PATTERN.test(value)) errors.push(`image URL is forbidden at ${location}`);
}
