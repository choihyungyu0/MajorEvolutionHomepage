import path from "node:path";
import { STATUS, UNIVERSITY } from "../constants.mjs";
import { buildProfessorRecord } from "../schema.mjs";
import {
  extractElementsByClass,
  htmlToText,
  normalizeSpace,
  normalizeUrl,
  readJson,
  splitResearchFields,
  uniqueBy,
} from "../utils.mjs";
import {
  buildDepartmentFailureRecord,
  rankProfessorPageLinks,
  statusFromError,
} from "./common.mjs";

export async function discoverCbnuDepartments(client, seedPath) {
  const seed = await readJson(seedPath);
  if (seed.university !== UNIVERSITY.CBNU) {
    throw new Error(`CBNU seed university mismatch: ${seed.university}`);
  }
  const issues = [];
  for (const source of seed.discovery_sources ?? []) {
    const decision = await client.checkRobots(source.url);
    if (!decision.allowed) {
      issues.push({
        status: STATUS.ROBOTS_BLOCKED,
        source_url: source.url,
        reason: `Full-catalog discovery was not attempted: ${decision.matched_rule}`,
        scope_impact: source.scope_impact ?? "Unknown department coverage",
      });
    } else {
      issues.push({
        status: STATUS.PROFILE_UNAVAILABLE,
        source_url: source.url,
        reason:
          "Discovery source is robots-allowed but no automatic CBNU central-directory adapter is configured; review before enabling.",
        scope_impact: source.scope_impact ?? "Unknown department coverage",
      });
    }
  }
  const departments = (seed.departments ?? []).map((department) => ({
    university: UNIVERSITY.CBNU,
    college: normalizeSpace(department.college),
    department: normalizeSpace(department.department),
    homepage_url: normalizeUrl(department.homepage_url),
    profile_url: normalizeUrl(department.profile_url, department.homepage_url),
    parser: department.parser ?? "cbnu_generic",
    discovery_source_url: department.source_url ?? department.homepage_url,
  }));
  return {
    departments: uniqueBy(
      departments,
      (department) =>
        `${department.college}|${department.department}|${department.homepage_url}`,
    ),
    issues,
    source: {
      url: path.resolve(seedPath),
      discovered_count: departments.length,
      declared_scope: seed.declared_scope ?? "PARTIAL",
    },
  };
}

export async function crawlCbnuDepartment(
  client,
  department,
  { maxProfessors = Number.POSITIVE_INFINITY, maxCandidates = 8, collectedAt = new Date() } = {},
) {
  if (!department.homepage_url) {
    return {
      records: [
        buildDepartmentFailureRecord({
          department,
          sourceUrl: department.discovery_source_url,
          status: STATUS.PROFILE_UNAVAILABLE,
          reason: "Department homepage URL is absent from the reviewed CBNU seed registry.",
          collectedAt,
        }),
      ],
      page: null,
    };
  }

  let page;
  try {
    if (department.profile_url) {
      page = await client.fetchText(department.profile_url, {
        purpose: "cbnu-professor-list",
      });
    } else {
      const homepage = await client.fetchText(department.homepage_url, {
        purpose: "cbnu-department-homepage",
      });
      if (looksLikeCbnuProfessorPage(homepage.body)) {
        page = homepage;
      } else {
        const candidates = rankProfessorPageLinks(homepage.body, homepage.url).slice(
          0,
          maxCandidates,
        );
        for (const candidate of candidates) {
          const candidatePage = await client.fetchText(candidate.href, {
            purpose: "cbnu-professor-list",
          });
          if (looksLikeCbnuProfessorPage(candidatePage.body)) {
            page = candidatePage;
            break;
          }
        }
      }
    }
  } catch (error) {
    const status = statusFromError(error);
    return {
      records: [
        buildDepartmentFailureRecord({
          department,
          sourceUrl: department.profile_url ?? department.homepage_url,
          status,
          reason: error.message,
          collectedAt,
        }),
      ],
      page: null,
    };
  }

  if (!page) {
    return {
      records: [
        buildDepartmentFailureRecord({
          department,
          sourceUrl: department.homepage_url,
          status: STATUS.PROFILE_UNAVAILABLE,
          reason:
            "No official professor/member page was found within the bounded department navigation scan.",
          collectedAt,
        }),
      ],
      page: null,
    };
  }

  try {
    const professors = parseCbnuGenericProfessorPage(page.body, page.url);
    if (!professors.length) throw new Error("CBNU generic parser found no professor blocks.");
    return {
      page: page.url,
      discovered_professors: professors.length,
      records: professors.slice(0, maxProfessors).map((professor) =>
        buildProfessorRecord({
          university: department.university,
          college: department.college,
          department: department.department,
          name: professor.name,
          title: professor.title,
          research_fields: professor.research_fields,
          publications: professor.publications,
          official_profile_url: professor.official_profile_url ?? page.url,
          source_url: page.url,
          collected_at: collectedAt,
          status:
            professor.research_fields.length || professor.publications.length
              ? STATUS.FOUND
              : STATUS.NOT_LISTED_ON_OFFICIAL_PROFILE,
          research_fields_status: professor.research_fields.length
            ? STATUS.FOUND
            : STATUS.NOT_LISTED_ON_OFFICIAL_PROFILE,
          publications_status: professor.publications.length
            ? STATUS.FOUND
            : STATUS.NOT_LISTED_ON_OFFICIAL_PROFILE,
          failure_reason: null,
          content_hash: page.content_hash,
        }),
      ),
    };
  } catch (error) {
    return {
      records: [
        buildDepartmentFailureRecord({
          department,
          sourceUrl: page.url,
          status: STATUS.PARSE_FAILED,
          reason: error.message,
          collectedAt,
        }),
      ],
      page: page.url,
    };
  }
}

export function looksLikeCbnuProfessorPage(html) {
  return (
    /class=["'][^"']*\bprofinfo\b/i.test(String(html)) ||
    (/연구분야/.test(String(html)) && /(?:교수|교수진|구성원)/.test(String(html)))
  );
}

export function parseCbnuGenericProfessorPage(html, sourceUrl) {
  const blocks = extractElementsByClass(html, "profinfo", "div");
  const professors = [];
  for (const block of blocks) {
    const headingMatch = /<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/i.exec(block);
    if (!headingMatch) continue;
    const title =
      htmlToText(/<span\b[^>]*>([\s\S]*?)<\/span>/i.exec(headingMatch[1])?.[1] ?? "") ||
      null;
    const name = htmlToText(
      headingMatch[1].replace(/<span\b[^>]*>[\s\S]*?<\/span>/gi, " "),
    );
    if (!name || /(?:학사\s*주무관|조교|직원)/.test(title ?? "")) continue;

    const researchMatch =
      /<span\b[^>]*>\s*연구분야\s*<\/span>([\s\S]*?)<\/p>/i.exec(block) ??
      /연구분야\s*[:：]?\s*([^<\n]+)/i.exec(block);
    const researchFields = splitResearchFields(
      researchMatch ? htmlToText(researchMatch[1]) : "",
    );
    const profileHref =
      /<a\b[^>]*\bhref=["']([^"']+)["'][^>]*class=["'][^"']*\bproflink\b/i.exec(block)?.[1] ??
      null;
    professors.push({
      name,
      title,
      research_fields: researchFields,
      publications: [],
      official_profile_url: normalizeUrl(profileHref, sourceUrl) ?? sourceUrl,
    });
  }
  return uniqueBy(
    professors,
    (professor) => `${professor.name}|${professor.title}|${professor.official_profile_url}`,
  );
}
