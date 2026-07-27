import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseCbnuGenericProfessorPage } from "./adapters/cbnu.mjs";
import { parseDkuProfessorDetail, parseDkuProfessorList } from "./adapters/dku.mjs";
import { STATUS, UNIVERSITY } from "./constants.mjs";
import { buildProfessorRecord, validateDataset } from "./schema.mjs";

const directory = path.dirname(fileURLToPath(import.meta.url));
const fixture = (name) => readFile(path.join(directory, "fixtures", name), "utf8");
const [dkuListHtml, dkuDetailHtml, cbnuListHtml] = await Promise.all([
  fixture("dku-list.html"),
  fixture("dku-detail.html"),
  fixture("cbnu-list.html"),
]);

const dkuProfessor = parseDkuProfessorList(
  dkuListHtml,
  "https://cms.dankook.ac.kr/web/test/professors",
)[0];
const dkuDetail = parseDkuProfessorDetail(dkuDetailHtml, dkuProfessor.detail_url);
const cbnuProfessor = parseCbnuGenericProfessorPage(
  cbnuListHtml,
  "https://software.cbnu.ac.kr/sub0105",
)[0];
const collectedAt = "2026-07-26T00:00:00.000Z";
const records = [
  buildProfessorRecord({
    university: UNIVERSITY.DKU,
    college: "테스트대학",
    department: "테스트학과",
    name: dkuProfessor.name,
    title: dkuProfessor.title,
    research_fields: dkuDetail.research_fields,
    publications: dkuDetail.publications,
    official_profile_url: dkuProfessor.detail_url,
    source_url: "https://cms.dankook.ac.kr/web/test/professors",
    collected_at: collectedAt,
    status: STATUS.FOUND,
  }),
  buildProfessorRecord({
    university: UNIVERSITY.CBNU,
    college: "전자정보대학",
    department: "소프트웨어학부",
    name: cbnuProfessor.name,
    title: cbnuProfessor.title,
    research_fields: cbnuProfessor.research_fields,
    publications: [],
    official_profile_url: "https://software.cbnu.ac.kr/sub0105",
    source_url: "https://software.cbnu.ac.kr/sub0105",
    collected_at: collectedAt,
    status: STATUS.FOUND,
    publications_status: STATUS.NOT_LISTED_ON_OFFICIAL_PROFILE,
  }),
];
const result = validateDataset({
  schema_version: "1.0.0",
  generated_at: collectedAt,
  publication_scope: "OFFICIAL_PROFILE_LIST_ONLY",
  records,
});
console.log(JSON.stringify({ smoke: "PASS", ...result }, null, 2));
