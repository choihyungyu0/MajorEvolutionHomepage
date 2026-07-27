import { STATUS, UNIVERSITY } from "../constants.mjs";
import { buildProfessorRecord } from "../schema.mjs";
import {
  extractElementById,
  extractElementsByClass,
  extractScriptJson,
  decodeHtmlEntities,
  htmlToText,
  normalizeSpace,
  normalizeUrl,
  splitResearchFields,
  uniqueBy,
} from "../utils.mjs";
import {
  buildDepartmentFailureRecord,
  rankProfessorPageLinks,
  statusFromError,
} from "./common.mjs";

export const DKU_DISCOVERY_URL = "https://cms.dankook.ac.kr/web/kor/faculty";
export const DKU_CENTRAL_SEARCH_URL =
  "https://portal.dankook.ac.kr/ctt/dku/profinfo/search";

export async function discoverDkuDepartments(client) {
  const response = await client.fetchText(DKU_DISCOVERY_URL, {
    purpose: "dku-department-discovery",
  });
  const scripts = extractScriptJson(response.body, "_deptData");
  const parseErrors = scripts.filter((value) => value?.__parse_error);
  const departments = scripts
    .filter(
      (value) =>
        value &&
        !value.__parse_error &&
        typeof value === "object" &&
        value.orgzNm &&
        value.orgzPrtNm,
    )
    .map((value) => ({
      university: UNIVERSITY.DKU,
      college: deriveCollege(value.orgzNm),
      department: normalizeSpace(value.orgzPrtNm),
      organization_name: normalizeSpace(value.orgzNm),
      organization_id: normalizeSpace(value.orgId ?? ""),
      homepage_url: normalizeUrl(value.hpUrl, DKU_DISCOVERY_URL),
      profile_url: null,
      discovery_source_url: DKU_DISCOVERY_URL,
      discovery_content_hash: response.content_hash,
    }));
  return {
    departments: uniqueBy(
      departments,
      (department) =>
        `${department.college}|${department.department}|${department.homepage_url ?? ""}`,
    ),
    issues: parseErrors.map((error) => ({
      status: STATUS.PARSE_FAILED,
      source_url: DKU_DISCOVERY_URL,
      reason: `Failed to parse one _deptData block: ${error.__parse_error}`,
    })),
    source: {
      url: response.url,
      content_hash: response.content_hash,
      discovered_count: departments.length,
    },
  };
}

export async function crawlDkuDepartment(
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
          reason: "Department homepage URL is not listed in the official DKU department directory.",
          collectedAt,
        }),
      ],
      page: null,
    };
  }

  let professorPage;
  try {
    professorPage = await findDkuProfessorPage(client, department.homepage_url, maxCandidates);
  } catch (error) {
    const status = statusFromError(error);
    return {
      records: [
        buildDepartmentFailureRecord({
          department,
          sourceUrl: department.homepage_url,
          status,
          reason: error.message,
          collectedAt,
        }),
      ],
      page: null,
    };
  }

  if (!professorPage) {
    return {
      records: [
        buildDepartmentFailureRecord({
          department,
          sourceUrl: department.homepage_url,
          status: STATUS.PROFILE_UNAVAILABLE,
          reason:
            "No linked official page containing the DKU professorsData block was found within the bounded navigation scan.",
          collectedAt,
        }),
      ],
      page: null,
    };
  }

  let list;
  try {
    list = parseDkuProfessorList(professorPage.body, professorPage.url);
  } catch (error) {
    return {
      records: [
        buildDepartmentFailureRecord({
          department,
          sourceUrl: professorPage.url,
          status: STATUS.PARSE_FAILED,
          reason: error.message,
          collectedAt,
        }),
      ],
      page: professorPage.url,
    };
  }

  const selected = list.slice(0, maxProfessors);
  const records = [];
  for (const professor of selected) {
    records.push(
      await crawlDkuProfessorDetail(client, department, professor, professorPage, collectedAt),
    );
  }
  return { records, page: professorPage.url, discovered_professors: list.length };
}

export async function findDkuProfessorPage(client, homepageUrl, maxCandidates = 8) {
  const homepage = await client.fetchText(homepageUrl, { purpose: "dku-department-homepage" });
  if (containsDkuProfessorData(homepage.body)) return homepage;
  const candidates = rankProfessorPageLinks(homepage.body, homepage.url).slice(0, maxCandidates);
  for (const candidate of candidates) {
    try {
      const page = await client.fetchText(candidate.href, { purpose: "dku-professor-list" });
      if (containsDkuProfessorData(page.body)) return page;
    } catch (error) {
      if (error?.code === STATUS.ROBOTS_BLOCKED) throw error;
    }
  }
  return null;
}

export function containsDkuProfessorData(html) {
  return /<script\b[^>]*\bid=["'][^"']*_professorsData["']/i.test(String(html));
}

export function parseDkuProfessorList(html, sourceUrl) {
  const scripts = extractScriptJson(html, "_professorsData");
  if (!scripts.length) throw new Error("DKU professorsData block is missing.");
  const parseError = scripts.find((value) => value?.__parse_error);
  if (parseError) throw new Error(`DKU professorsData JSON parse failed: ${parseError.__parse_error}`);
  const rows = scripts.flatMap((value) => (Array.isArray(value) ? value : []));
  if (!rows.length) throw new Error("DKU professorsData did not contain professor rows.");
  return uniqueBy(
    rows
      .map((row) => ({
        name: normalizeSpace(row.nm ?? ""),
        title: normalizeSpace(row.wkgrKnm ?? row.repnPosn ?? ""),
        organization_name: normalizeSpace(row.orgzNm ?? ""),
        detail_url: normalizeUrl(row.detailUrl, sourceUrl),
      }))
      .filter((row) => row.name),
    (row) => row.detail_url || `${row.organization_name}|${row.name}|${row.title}`,
  );
}

export function buildDkuCentralSearchUrl(keyword) {
  const url = new URL(DKU_CENTRAL_SEARCH_URL);
  url.searchParams.set("profSch", normalizeSpace(keyword));
  url.searchParams.set("searchCategory", "univ");
  return url.toString();
}

export function parseDkuCentralSearch(html, sourceUrl) {
  const professors = [];
  for (const block of extractElementsByClass(html, "sch_box", "div")) {
    const decodedBlock = decodeHtmlEntities(block);
    const nameMatch =
      /<strong\b[^>]*class=["'][^"']*\bprofEmpNm\b[^"']*["'][^>]*>([\s\S]*?)<\/strong>/i.exec(
        decodedBlock,
      );
    const name = nameMatch ? htmlToText(nameMatch[1]) : "";
    const detailUrlRaw =
      /moreInfo\(\s*['"]([^'"]*\/profinfo\/detailSearch[^'"]*)['"]\s*\)/i.exec(decodedBlock)?.[1] ??
      "";
    const organizationMatch =
      /<li\b[^>]*>\s*<i\b[^>]*class=["'][^"']*\bfile_s\b[^"']*["'][^>]*><\/i>\s*<span\b[^>]*>\s*소속\s*<\/span>([\s\S]*?)<\/li>/i.exec(
        decodedBlock,
      );
    const organizationName = organizationMatch ? htmlToText(organizationMatch[1]) : "";
    const titleCandidates = [
      ...decodedBlock.matchAll(/<span\b[^>]*>([^<>]*\|[^<>]*)<\/span>/gi),
    ]
      .map((match) => htmlToText(match[1]))
      .filter((text) => /\|/.test(text));
    const title = normalizeSpace(titleCandidates[0]?.split("|")[0] ?? "");
    if (!name || !detailUrlRaw || !organizationName) continue;
    professors.push({
      name,
      title: title || null,
      organization_name: organizationName,
      detail_url: normalizeUrl(decodeHtmlEntities(detailUrlRaw), sourceUrl),
    });
  }
  return uniqueBy(
    professors.filter((professor) => professor.detail_url),
    (professor) => professor.detail_url,
  );
}

export function parseDkuCentralPhotoReferences(html, sourceUrl) {
  const references = [];
  for (const block of extractElementsByClass(html, "sch_box", "div")) {
    const decodedBlock = decodeHtmlEntities(block);
    const name =
      htmlToText(
        /<strong\b[^>]*class=["'][^"']*\bprofEmpNm\b[^"']*["'][^>]*>([\s\S]*?)<\/strong>/i.exec(
          decodedBlock,
        )?.[1] ?? "",
      );
    const detailUrlRaw =
      /moreInfo\(\s*['"]([^'"]*\/profinfo\/detailSearch[^'"]*)['"]\s*\)/i.exec(
        decodedBlock,
      )?.[1] ?? "";
    const photoUrlRaw =
      /<img\b[^>]*class=["'][^"']*\bprofPrfImg\b[^"']*["'][^>]*\bsrc=["']([^"']+)["']/i.exec(
        decodedBlock,
      )?.[1] ??
      /<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*class=["'][^"']*\bprofPrfImg\b/i.exec(
        decodedBlock,
      )?.[1] ??
      "";
    if (!name || !detailUrlRaw || !photoUrlRaw) continue;
    references.push({
      name,
      official_profile_url: normalizeUrl(detailUrlRaw, sourceUrl),
      photo_source_url: normalizeUrl(photoUrlRaw, sourceUrl),
      source_page_url: sourceUrl,
    });
  }
  return uniqueBy(
    references.filter(
      (reference) =>
        reference.official_profile_url && reference.photo_source_url,
    ),
    (reference) => reference.official_profile_url,
  );
}

export function parseDkuProfessorDetail(html, officialProfileUrl) {
  const researchArea = extractElementById(html, "profResult_area2") ?? "";
  const researchMatch =
    /<h4\b[^>]*>\s*연구분야\s*<\/h4>\s*<div\b[^>]*class=["'][^"']*search_list_area3[^"']*["'][^>]*>([\s\S]*?)<\/div>/i.exec(
      researchArea,
    );
  const researchText = researchMatch
    ? decodeHtmlEntities(
        researchMatch[1]
          .replace(/<(?:br|hr)\b[^>]*>/gi, "\n")
          .replace(/<[^>]+>/g, " "),
      )
    : "";
  const researchFields = splitResearchFields(researchText, { splitCommas: false });

  const publicationArea = extractElementById(html, "profResult_area3") ?? "";
  const publications = [];
  for (const rowMatch of publicationArea.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const rawCells = [
      ...rowMatch[1].matchAll(/<(?:td|th)\b[^>]*>([\s\S]*?)<\/(?:td|th)>/gi),
    ].map((cell) => cell[1]);
    if (rawCells.length < 3) continue;
    const cells = rawCells.map(htmlToText);
    if (
      cells.some((cell) => /조회\s*된\s*데이터가\s*없습니다/.test(cell)) ||
      /^(?:구분|기준일|제목)$/.test(cells[0])
    ) {
      continue;
    }
    const title = normalizeSpace(cells.slice(2).join(" "));
    if (!title) continue;
    const doi =
      /(?:https?:\/\/(?:dx\.)?doi\.org\/|doi:\s*)(10\.\d{4,9}\/[-._;()/:A-Z0-9]+)/i.exec(
        rowMatch[1],
      )?.[1] ?? null;
    publications.push({
      title,
      publication_type: cells[0] || null,
      published_date: cells[1] || null,
      doi,
      kci_id: null,
      official_profile_url: officialProfileUrl,
      metadata_source: "OFFICIAL_PROFILE",
    });
  }

  const researchFieldsStatus = researchFields.length
    ? STATUS.FOUND
    : researchArea
      ? STATUS.NOT_LISTED_ON_OFFICIAL_PROFILE
      : STATUS.PARSE_FAILED;
  const publicationsStatus = publications.length
    ? STATUS.FOUND
    : publicationArea
      ? STATUS.NOT_LISTED_ON_OFFICIAL_PROFILE
      : STATUS.PARSE_FAILED;
  return {
    research_fields: researchFields,
    publications,
    research_fields_status: researchFieldsStatus,
    publications_status: publicationsStatus,
  };
}

async function crawlDkuProfessorDetail(
  client,
  department,
  professor,
  professorPage,
  collectedAt,
) {
  if (!professor.detail_url) {
    return buildProfessorRecord({
      university: department.university,
      college: department.college,
      department: department.department,
      name: professor.name,
      title: professor.title,
      research_fields: [],
      publications: [],
      official_profile_url: null,
      source_url: professorPage.url,
      collected_at: collectedAt,
      status: STATUS.PROFILE_UNAVAILABLE,
      research_fields_status: STATUS.PROFILE_UNAVAILABLE,
      publications_status: STATUS.PROFILE_UNAVAILABLE,
      failure_reason: "Official professor detail URL is not exposed in professorsData.",
      content_hash: professorPage.content_hash,
    });
  }

  let detailPage;
  try {
    detailPage = await client.fetchText(professor.detail_url, {
      purpose: "dku-professor-profile",
    });
  } catch (error) {
    const status = statusFromError(error);
    return buildProfessorRecord({
      university: department.university,
      college: department.college,
      department: department.department,
      name: professor.name,
      title: professor.title,
      research_fields: [],
      publications: [],
      official_profile_url: professor.detail_url,
      source_url: professorPage.url,
      collected_at: collectedAt,
      status,
      research_fields_status: status,
      publications_status: status,
      failure_reason: error.message,
      content_hash: professorPage.content_hash,
    });
  }

  try {
    const detail = parseDkuProfessorDetail(detailPage.body, detailPage.url);
    const parseFailed =
      detail.research_fields_status === STATUS.PARSE_FAILED &&
      detail.publications_status === STATUS.PARSE_FAILED;
    return buildProfessorRecord({
      university: department.university,
      college: department.college,
      department: department.department,
      name: professor.name,
      title: professor.title,
      research_fields: detail.research_fields,
      publications: detail.publications,
      official_profile_url: detailPage.url,
      source_url: professorPage.url,
      collected_at: collectedAt,
      status: parseFailed
        ? STATUS.PARSE_FAILED
        : detail.research_fields.length || detail.publications.length
          ? STATUS.FOUND
          : STATUS.NOT_LISTED_ON_OFFICIAL_PROFILE,
      research_fields_status: detail.research_fields_status,
      publications_status: detail.publications_status,
      failure_reason: parseFailed
        ? "Expected DKU research/profile sections were not found in the official profile HTML."
        : null,
      content_hash: detailPage.content_hash,
    });
  } catch (error) {
    return buildProfessorRecord({
      university: department.university,
      college: department.college,
      department: department.department,
      name: professor.name,
      title: professor.title,
      research_fields: [],
      publications: [],
      official_profile_url: detailPage.url,
      source_url: professorPage.url,
      collected_at: collectedAt,
      status: STATUS.PARSE_FAILED,
      research_fields_status: STATUS.PARSE_FAILED,
      publications_status: STATUS.PARSE_FAILED,
      failure_reason: error.message,
      content_hash: detailPage.content_hash,
    });
  }
}

function deriveCollege(organizationName) {
  const tokens = normalizeSpace(organizationName).split(" ");
  return (
    tokens.find((token) => /(?:대학|칼리지)$/.test(token)) ??
    tokens[0] ??
    "소속 단과대학 미표기"
  );
}
