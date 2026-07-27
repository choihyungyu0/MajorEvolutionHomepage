import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  buildDkuCentralSearchUrl,
  parseDkuCentralSearch,
  parseDkuCentralPhotoReferences,
  parseDkuProfessorDetail,
  parseDkuProfessorList,
} from "../adapters/dku.mjs";
import { parseCbnuGenericProfessorPage } from "../adapters/cbnu.mjs";
import { STATUS, UNIVERSITY } from "../constants.mjs";
import { queryCrossrefMetadata, titleSimilarity } from "../metadata.mjs";
import { evaluateRules, parseRobots } from "../robots.mjs";
import {
  assertProfessorRecord,
  buildProfessorRecord,
  validateDataset,
} from "../schema.mjs";
import { sanitizeForPersistentCache } from "../utils.mjs";
import { normalizeProfessorDataset } from "../export-database.mjs";

const fixtureDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "fixtures",
);

test("CBNU central robots policy blocks every non-allowed path for this crawler", () => {
  const groups = parseRobots("User-agent: *\nDisallow: /\n");
  const decision = evaluateRules(
    groups,
    "majorevolutionresearchbot",
    new URL("https://www.cbnu.ac.kr/www/contents.do?key=391"),
  );
  assert.equal(decision.allowed, false);
  assert.equal(decision.matchedRule, "DISALLOW: /");
});

test("robots allow rule wins when equally specific", () => {
  const groups = parseRobots("User-agent: *\nDisallow: /public\nAllow: /public\n");
  const decision = evaluateRules(
    groups,
    "majorevolutionresearchbot",
    new URL("https://example.edu/public"),
  );
  assert.equal(decision.allowed, true);
});

test("DKU adapters parse only approved professor fields", async () => {
  const listHtml = await readFile(path.join(fixtureDirectory, "dku-list.html"), "utf8");
  const detailHtml = await readFile(path.join(fixtureDirectory, "dku-detail.html"), "utf8");
  const list = parseDkuProfessorList(listHtml, "https://cms.dankook.ac.kr/web/test/prof");
  const detail = parseDkuProfessorDetail(detailHtml, list[0].detail_url);
  assert.deepEqual(
    Object.keys(list[0]).sort(),
    ["detail_url", "name", "organization_name", "title"].sort(),
  );
  assert.deepEqual(detail.research_fields, ["인공지능", "데이터 시각화"]);
  assert.equal(detail.publications.length, 1);
  assert.equal(detail.publications[0].title, "공개 프로필 기반 테스트 논문");
});

test("DKU central fallback parser excludes contact and photo fields", async () => {
  const html = await readFile(
    path.join(fixtureDirectory, "dku-central-search.html"),
    "utf8",
  );
  const sourceUrl = buildDkuCentralSearchUrl("코스메디컬소재학과");
  const professors = parseDkuCentralSearch(html, sourceUrl);
  assert.equal(professors.length, 1);
  assert.deepEqual(
    Object.keys(professors[0]).sort(),
    ["detail_url", "name", "organization_name", "title"].sort(),
  );
  assert.equal(professors[0].name, "테스트교수");
  assert.equal(professors[0].title, "조교수");
  assert.equal(professors[0].organization_name, "바이오융합대학 코스메디컬소재학과");
  assert.match(professors[0].detail_url, /detailSearch\?uld=TEST$/);
  const photoReferences = parseDkuCentralPhotoReferences(html, sourceUrl);
  assert.equal(photoReferences.length, 1);
  assert.match(photoReferences[0].photo_source_url, /webinfo\.dankook\.ac\.kr/);
  assert.deepEqual(
    Object.keys(photoReferences[0]).sort(),
    [
      "name",
      "official_profile_url",
      "photo_source_url",
      "source_page_url",
    ].sort(),
  );
});

test("CBNU generic adapter parses research fields without contact fields", async () => {
  const html = await readFile(path.join(fixtureDirectory, "cbnu-list.html"), "utf8");
  const professors = parseCbnuGenericProfessorPage(
    html,
    "https://software.cbnu.ac.kr/sub0105",
  );
  assert.equal(professors.length, 1);
  assert.equal(professors[0].name, "테스트교수");
  assert.deepEqual(professors[0].research_fields, ["인공지능", "소프트웨어공학"]);
});

test("schema rejects contact information and accepts explicit missing-list status", () => {
  const record = buildProfessorRecord({
    university: UNIVERSITY.CBNU,
    college: "전자정보대학",
    department: "소프트웨어학부",
    name: "테스트교수",
    title: "교수",
    research_fields: ["인공지능"],
    publications: [],
    official_profile_url: "https://software.cbnu.ac.kr/sub0105?uld=0212345678abcdef",
    source_url: "https://software.cbnu.ac.kr/sub0105",
    collected_at: "2026-07-26T00:00:00.000Z",
    status: STATUS.FOUND,
    publications_status: STATUS.NOT_LISTED_ON_OFFICIAL_PROFILE,
    content_hash: "0212345678abcdefaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  });
  validateDataset({
    schema_version: "1.0.0",
    generated_at: "2026-07-26T00:00:00.000Z",
    publication_scope: "OFFICIAL_PROFILE_LIST_ONLY",
    records: [record],
  });
  assert.throws(
    () => assertProfessorRecord({ ...record, email: "person@example.edu" }),
    /sensitive key|email-like/,
  );
  assert.throws(
    () => assertProfessorRecord({
      ...record,
      official_profile_url: "https://software.cbnu.ac.kr/sub0105?tel=043-261-1234",
    }),
    /sensitive URL query key/,
  );
  assert.doesNotThrow(() =>
    assertProfessorRecord({
      ...record,
      id: "0212345678abcdefaaaaaaaa",
    }),
  );
  const safeFailure = buildProfessorRecord({
    ...record,
    status: STATUS.PROFILE_UNAVAILABLE,
    research_fields_status: STATUS.PROFILE_UNAVAILABLE,
    publications_status: STATUS.PROFILE_UNAVAILABLE,
    failure_reason:
      "REQUEST_TIMEOUT: https://portal.dankook.ac.kr/detail?uld=0212345678ABCDEF02123456",
  });
  assert.doesNotMatch(safeFailure.failure_reason, /0212345678|https?:\/\//);
});

test("schema keeps numeric strings inside official publication titles", () => {
  const record = buildProfessorRecord({
    university: UNIVERSITY.DKU,
    college: "보건과학대학",
    department: "보건행정학과",
    name: "테스트교수",
    title: "교수",
    research_fields: ["지역 코드 031-123-4567 비교 연구"],
    publications: [{
      title: "지역 코드 031-123-4567 기반 지표 비교",
      publication_type: "일반논문",
      published_date: "2026-01-01",
      metadata_source: "OFFICIAL_PROFILE",
    }],
    official_profile_url:
      "https://portal.dankook.ac.kr/ctt/dku/profinfo/detailSearch?uld=TEST",
    source_url: "https://cms.dankook.ac.kr/web/healthadmin",
    collected_at: "2026-07-27T00:00:00.000Z",
    status: STATUS.FOUND,
    content_hash: "b".repeat(64),
  });
  assert.equal(record.publications[0].title, "지역 코드 031-123-4567 기반 지표 비교");
  assert.equal(record.research_fields[0], "지역 코드 031-123-4567 비교 연구");
});

test("persistent cache sanitizer removes email, telephone and image tags", () => {
  const sanitized = sanitizeForPersistentCache(
    `<script id="_dku_org_DeptInfoPortlet_INSTANCE_test_deptData" type="application/json">
      {"orgId":"2000000992","orgzNm":"테스트대학 테스트학과","orgzPrtNm":"테스트학과","hpUrl":"https://cms.dankook.ac.kr/web/test","telNo":"043-261-1234","email":"person@example.edu"}
    </script>
    <img src="/person.jpg"><p>person@example.edu 043-261-1234 192.0.2.1 token-secret</p>`,
  );
  assert.doesNotMatch(
    sanitized,
    /person\.jpg|person@example|043-261-1234|192\.0\.2\.1|token-secret/,
  );
  assert.match(
    sanitized,
    /"orgId":"2000000992"/,
  );
});

test("persistent cache keeps numeric strings inside DKU academic sections", () => {
  const sanitized = sanitizeForPersistentCache(`
    <div id="profResult_area3">
      <table><tr><td>일반논문</td><td>2026-01-01</td>
      <td>지역 코드 031-123-4567 기반 지표 비교</td></tr></table>
    </div>
  `);
  assert.match(sanitized, /031-123-4567/);
});

test("database normalization merges shared professor profiles and preserves department links", () => {
  const baseRecord = buildProfessorRecord({
    university: UNIVERSITY.DKU,
    college: "SW융합대학",
    department: "소프트웨어학과",
    name: "테스트교수",
    title: "교수",
    research_fields: ["인공지능"],
    publications: [{
      title: "안전한 AI 연구",
      publication_type: "일반논문",
      published_date: "2026-01-01",
      metadata_source: "OFFICIAL_PROFILE",
    }],
    official_profile_url: "https://portal.dankook.ac.kr/ctt/dku/profinfo/detailSearch?uld=TEST",
    source_url: "https://cms.dankook.ac.kr/web/sw/faculty",
    collected_at: "2026-07-27T00:00:00.000Z",
    status: STATUS.FOUND,
    content_hash: "a".repeat(64),
  });
  const secondRecord = buildProfessorRecord({
    ...baseRecord,
    department: "컴퓨터공학과",
    research_fields: ["소프트웨어공학"],
  });
  const homepage = "https://cms.dankook.ac.kr/web/sw";
  const normalized = normalizeProfessorDataset(
    {
      schema_version: "1.0.0",
      generated_at: "2026-07-27T00:00:00.000Z",
      publication_scope: "OFFICIAL_PROFILE_LIST_ONLY",
      records: [baseRecord, secondRecord],
    },
    {
      discovery: [{
        departments: [
          {
            university: UNIVERSITY.DKU,
            college: "SW융합대학",
            department: "소프트웨어학과",
            organization_id: "1",
            homepage_url: homepage,
            discovery_source_url: "https://cms.dankook.ac.kr/web/kor/faculty",
          },
          {
            university: UNIVERSITY.DKU,
            college: "SW융합대학",
            department: "컴퓨터공학과",
            organization_id: "2",
            homepage_url: homepage,
            discovery_source_url: "https://cms.dankook.ac.kr/web/kor/faculty",
          },
        ],
      }],
    },
  );
  assert.equal(normalized.professors.length, 1);
  assert.equal(normalized.professor_departments.length, 2);
  assert.equal(normalized.research_fields.length, 2);
  assert.equal(normalized.publications.length, 1);
  assert.equal(normalized.counts.shared_homepage_departments, 2);
});

test("metadata title matching is conservative", () => {
  assert.equal(titleSimilarity("AI 융합 연구", "AI 융합 연구"), 1);
  assert.ok(titleSimilarity("AI 융합 연구", "완전히 다른 논문") < 0.5);
});

test("Crossref metadata matching checks title and publication year", async () => {
  const match = await queryCrossrefMetadata(
    {
      title: "Official profile paper",
      published_date: "2025-06-30",
    },
    {
      fetchImpl: async () =>
        new Response(
          JSON.stringify({
            message: {
              items: [{
                DOI: "10.1234/example",
                title: ["Official profile paper"],
                "container-title": ["Example Journal"],
                author: [{ given: "Test", family: "Author" }],
                published: { "date-parts": [[2025, 6, 30]] },
                "is-referenced-by-count": 7,
                URL: "https://doi.org/10.1234/example",
                subject: ["Data Science"],
              }],
            },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
    },
  );
  assert.equal(match.externalId, "10.1234/example");
  assert.equal(match.matchMethod, "TITLE_EXACT_YEAR_EXACT");
  assert.equal(match.citationCount, 7);
  assert.deepEqual(match.authors, ["Test Author"]);
});
