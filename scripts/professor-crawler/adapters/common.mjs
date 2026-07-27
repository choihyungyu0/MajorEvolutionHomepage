import { STATUS } from "../constants.mjs";
import { buildProfessorRecord } from "../schema.mjs";
import {
  extractAnchors,
  isOfficialUniversityUrl,
  normalizeSpace,
  uniqueBy,
} from "../utils.mjs";

const POSITIVE_TERMS = [
  ["교수소개", 120],
  ["교수 소개", 120],
  ["교수진", 115],
  ["교원소개", 110],
  ["교원 소개", 110],
  ["구성원", 80],
  ["faculty", 100],
  ["professor", 100],
  ["people", 65],
  ["member", 55],
];

export function rankProfessorPageLinks(html, baseUrl) {
  return uniqueBy(
    extractAnchors(html, baseUrl)
      .map((anchor) => ({ ...anchor, score: scoreProfessorAnchor(anchor) }))
      .filter(
        (anchor) =>
          anchor.score > 0 &&
          isOfficialUniversityUrl(anchor.href) &&
          !/\.(?:hwp|pdf|docx?|xlsx?|pptx?|zip)(?:[?#]|$)/i.test(anchor.href),
      )
      .sort((left, right) => right.score - left.score),
    (anchor) => anchor.href,
  );
}
export function scoreProfessorAnchor(anchor) {
  const haystack = normalizeSpace(
    `${anchor.text} ${anchor.title} ${anchor.className} ${anchor.href}`,
  ).toLowerCase();
  if (/교수법|teaching.?method/.test(haystack)) return -100;
  let score = 0;
  for (const [term, weight] of POSITIVE_TERMS) {
    if (haystack.includes(term)) score += weight;
  }
  if (/\/(?:prof|faculty|member|people)/i.test(new URL(anchor.href).pathname)) score += 30;
  return score;
}

export function buildDepartmentFailureRecord({
  department,
  sourceUrl,
  status,
  reason,
  collectedAt,
}) {
  return buildProfessorRecord({
    university: department.university,
    college: department.college,
    department: department.department,
    name: null,
    title: null,
    research_fields: [],
    publications: [],
    official_profile_url: department.profile_url ?? null,
    source_url: sourceUrl || department.homepage_url || department.discovery_source_url,
    collected_at: collectedAt,
    status,
    research_fields_status: status,
    publications_status: status,
    failure_reason: reason,
    content_hash: null,
  });
}

export function statusFromError(error) {
  if (error?.code === STATUS.ROBOTS_BLOCKED || error?.name === "RobotsBlockedError") {
    return STATUS.ROBOTS_BLOCKED;
  }
  if (/HTTP_40[134]|PROFILE_UNAVAILABLE|OFFLINE_CACHE_MISS/.test(error?.message ?? "")) {
    return STATUS.PROFILE_UNAVAILABLE;
  }
  return STATUS.PARSE_FAILED;
}
