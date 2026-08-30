import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(testDirectory, "../..");
const runtimeDirectory = fs.mkdtempSync(path.join(testDirectory, ".favorite-paper-runtime-"));

function compileCommonJs(sourceRelativePath, outputName) {
  const source = fs.readFileSync(path.join(repositoryRoot, sourceRelativePath), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
    fileName: sourceRelativePath,
    reportDiagnostics: true,
  });
  const errors = (compiled.diagnostics ?? []).filter(
    (diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error,
  );
  assert.equal(errors.length, 0, `테스트용 변환 실패: ${sourceRelativePath}`);
  const outputPath = path.join(runtimeDirectory, outputName);
  fs.writeFileSync(outputPath, compiled.outputText, "utf8");
  return outputPath;
}

const memory = new Map();
globalThis.localStorage = {
  getItem: (key) => memory.get(key) ?? null,
  setItem: (key, value) => memory.set(key, value),
  removeItem: (key) => memory.delete(key),
  clear: () => memory.clear(),
  key: (index) => Array.from(memory.keys())[index] ?? null,
  get length() {
    return memory.size;
  },
};

const selectionModule = require(
  compileCommonJs("lib/professor-paper-selection.ts", "professor-paper-selection.cjs"),
);
const contentLookupModule = require(
  compileCommonJs("lib/paper-content-lookup.ts", "paper-content-lookup.cjs"),
);
const contentClientModule = require(
  compileCommonJs("lib/professor-paper-content-client.ts", "professor-paper-content-client.cjs"),
);
const publicPdfModule = require(
  compileCommonJs("lib/public-pdf-extractor.server.ts", "public-pdf-extractor.server.cjs"),
);
const questStoreModule = require(
  compileCommonJs("store/quest-store.ts", "quest-store.cjs"),
);

after(() => fs.rmSync(runtimeDirectory, { recursive: true, force: true }));

const publications = [
  {
    id: "paper-old",
    title: "교육 데이터 분석",
    publicationType: "일반논문",
    publishedDate: "2022-05-10",
    doi: null,
    kciId: null,
    officialProfileUrl: "https://example.edu/professor",
  },
  {
    id: "paper-new",
    title: "AI 기반 진로 멘토링",
    publicationType: "일반논문",
    publishedDate: "2025-03-01",
    doi: "10.0000/example",
    kciId: null,
    officialProfileUrl: "https://example.edu/professor",
  },
  {
    id: "paper-undated",
    title: "전공 탐색 연구",
    publicationType: "학술발표",
    publishedDate: null,
    doi: null,
    kciId: null,
    officialProfileUrl: "https://example.edu/professor",
  },
];

test("공식 논문을 최신순으로 정렬하고 제목·연도로 필터링한다", () => {
  const sorted = selectionModule.filterAndSortPublications(publications);
  assert.deepEqual(sorted.map((paper) => paper.id), [
    "paper-new",
    "paper-old",
    "paper-undated",
  ]);
  assert.deepEqual(
    selectionModule.filterAndSortPublications(publications, { query: "진로" })
      .map((paper) => paper.id),
    ["paper-new"],
  );
  assert.deepEqual(
    selectionModule.filterAndSortPublications(publications, { year: "2022" })
      .map((paper) => paper.id),
    ["paper-old"],
  );
  assert.deepEqual(
    selectionModule.availablePublicationYears(publications),
    ["2025", "2022"],
  );
});

test("선택 메타데이터는 교수와 논문의 공식 ID를 함께 보존한다", () => {
  const professor = {
    id: "professor-1",
    university: "단국대학교",
    college: "사회과학대학",
    department: "상담학과",
    name: "김교수",
    title: "교수",
    publications,
    publicationCount: publications.length,
    publicationsStatus: "FOUND",
    officialProfileUrl: "https://example.edu/professor",
  };
  const selection = selectionModule.createProfessorPaperSelection(
    professor,
    publications[1],
  );
  assert.equal(selection.professorId, "professor-1");
  assert.equal(selection.paperId, "paper-new");
  assert.equal(selection.title, "AI 기반 진로 멘토링");
  assert.equal(selection.officialProfileUrl, "https://example.edu/professor");
});

test("DOI가 있는 공식 논문은 공개 초록을 순서대로 복원한다", async () => {
  const requests = [];
  const result = await contentLookupModule.lookupPublicPaperContent({
    title: "AI 기반 진로 멘토링",
    publishedDate: "2025-03-01",
    doi: "10.0000/example",
  }, {
    fetcher: async (url) => {
      requests.push(String(url));
      return new Response(JSON.stringify({
        display_name: "AI 기반 진로 멘토링",
        publication_date: "2025-03-01",
        doi: "https://doi.org/10.0000/example",
        abstract_inverted_index: {
          "대학생의": [0],
          "진로": [1],
          "탐색을": [2],
          "돕는다.": [3],
        },
        open_access: { is_oa: true, oa_url: "https://example.org/paper" },
        best_oa_location: { landing_page_url: "https://example.org/paper" },
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    },
  });

  assert.equal(result.status, "found");
  assert.equal(result.content, "대학생의 진로 탐색을 돕는다.");
  assert.equal(result.provider, "openalex");
  assert.equal(result.sourceUrl, "https://example.org/paper");
  assert.match(requests[0], /works\/https:\/\/doi\.org\/10\.0000%2Fexample/);
});

test("제목 검색은 공식 논문과 정확히 일치한 공개 초록만 선택한다", async () => {
  const result = await contentLookupModule.lookupPublicPaperContent({
    title: "로컬푸드를 통한 친환경 농업 활성화 방안",
    publishedDate: "2023-08-25",
    doi: null,
  }, {
    fetcher: async (url) => {
      assert.match(String(url), /api\.openalex\.org\/works\?/);
      return new Response(JSON.stringify({
        results: [
          {
            display_name: "로컬푸드 직매장 활성화 방안",
            publication_date: "2023-08-25",
            abstract_inverted_index: { "잘못된": [0], "초록": [1] },
          },
          {
            display_name: "로컬푸드를 통한 친환경 농업 활성화 방안",
            publication_date: "2023-08-25",
            id: "https://openalex.org/W123",
            abstract_inverted_index: {
              "지역": [0],
              "먹거리와": [1],
              "친환경": [2],
              "농업의": [3],
              "관계를": [4],
              "분석했다.": [5],
            },
            open_access: { is_oa: false, oa_url: null },
            best_oa_location: null,
          },
        ],
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    },
  });

  assert.equal(result.status, "found");
  assert.equal(result.content, "지역 먹거리와 친환경 농업의 관계를 분석했다.");
  assert.equal(result.sourceUrl, "https://openalex.org/W123");
});

test("정확 일치가 없으면 같은 교수 공식 목록의 확장 제목을 확인 후보로 돌려준다", async () => {
  assert.equal(typeof contentLookupModule.lookupRelatedPublicPaperCandidate, "function");
  const candidate = await contentLookupModule.lookupRelatedPublicPaperCandidate([
    {
      id: "paper-english-short",
      title: "The Effects of Local Food on Carbon Emissions",
      publicationType: "학술발표",
      publishedDate: "2023-07-26",
      doi: null,
      kciId: null,
      officialProfileUrl: "https://example.edu/professor",
    },
  ], {
    fetcher: async () => new Response(JSON.stringify({
      results: [
        {
          id: "https://openalex.org/W-preprint",
          type: "preprint",
          display_name: "The Effects of Local Food on Carbon Emissions: The Case of the Republic of Korea",
          publication_date: "2024-03-06",
          doi: "https://doi.org/10.20944/preprints202403.0337.v1",
          abstract_inverted_index: { "사전": [0], "공개본": [1] },
          open_access: { is_oa: true, oa_url: "https://example.org/preprint" },
          best_oa_location: { landing_page_url: "https://example.org/preprint", license: "cc-by" },
        },
        {
          id: "https://openalex.org/W-article",
          type: "article",
          display_name: "The Effects of Local Food on Carbon Emissions: The Case of the Republic of Korea",
          publication_date: "2024-04-25",
          doi: "https://doi.org/10.3390/su16093614",
          abstract_inverted_index: { "정식": [0], "공개": [1], "초록": [2] },
          open_access: { is_oa: true, oa_url: "https://example.org/article" },
          best_oa_location: { landing_page_url: "https://example.org/article", license: "cc-by" },
        },
      ],
    }), { status: 200, headers: { "Content-Type": "application/json" } }),
  });

  assert.equal(candidate?.officialPaper.id, "paper-english-short");
  assert.equal(candidate?.result.status, "found");
  assert.equal(candidate?.result.matchedBy, "related-title");
  assert.equal(candidate?.result.matchedTitle, "The Effects of Local Food on Carbon Emissions: The Case of the Republic of Korea");
  assert.equal(candidate?.result.matchedPublishedDate, "2024-04-25");
  assert.equal(candidate?.result.matchedDoi, "10.3390/su16093614");
  assert.equal(candidate?.result.content, "정식 공개 초록");
});

test("같은 교수 목록이라도 제목이 이어지지 않는 공개 논문은 후보로 제안하지 않는다", async () => {
  assert.equal(typeof contentLookupModule.lookupRelatedPublicPaperCandidate, "function");
  const candidate = await contentLookupModule.lookupRelatedPublicPaperCandidate([
    {
      id: "paper-unrelated",
      title: "농식품 유통 연구",
      publicationType: "학술발표",
      publishedDate: "2023-07-26",
      doi: null,
      kciId: null,
      officialProfileUrl: "https://example.edu/professor",
    },
  ], {
    fetcher: async () => new Response(JSON.stringify({
      results: [{
        id: "https://openalex.org/W-unrelated",
        type: "article",
        display_name: "전혀 다른 농업 정책 연구",
        publication_date: "2024-04-25",
        doi: "https://doi.org/10.0000/unrelated",
        abstract_inverted_index: { "관련없는": [0], "초록": [1] },
        open_access: { is_oa: true, oa_url: "https://example.org/unrelated" },
        best_oa_location: { landing_page_url: "https://example.org/unrelated", license: "cc-by" },
      }],
    }), { status: 200, headers: { "Content-Type": "application/json" } }),
  });
  assert.equal(candidate, null);
});

test("초록이 없어도 재사용 가능한 라이선스의 공개 PDF는 추출 후보로 돌려준다", async () => {
  const result = await contentLookupModule.lookupPublicPaperContent({
    title: "공개 PDF 기반 연구",
    publishedDate: "2024-02-01",
    doi: null,
  }, {
    fetcher: async () => new Response(JSON.stringify({
      results: [{
        id: "https://openalex.org/W456",
        display_name: "공개 PDF 기반 연구",
        publication_date: "2024-02-01",
        abstract_inverted_index: null,
        open_access: { is_oa: true, oa_url: "https://example.org/article" },
        best_oa_location: {
          is_oa: true,
          pdf_url: "https://arxiv.org/pdf/2402.00001.pdf",
          landing_page_url: "https://arxiv.org/abs/2402.00001",
          license: "cc-by",
        },
      }],
    }), { status: 200, headers: { "Content-Type": "application/json" } }),
  });

  assert.equal(result.status, "pdf_available");
  assert.equal(result.content, null);
  assert.equal(result.pdfUrl, "https://arxiv.org/pdf/2402.00001.pdf");
  assert.equal(result.license, "cc-by");
  assert.equal(result.sourceUrl, "https://arxiv.org/abs/2402.00001");
});

test("라이선스가 없거나 변경 금지인 공개 PDF는 자동 추출 후보로 사용하지 않는다", async () => {
  const licenses = [null, "cc-by-nd", "cc-by-nc-nd", "other-oa"];
  for (const license of licenses) {
    const result = await contentLookupModule.lookupPublicPaperContent({
      title: "열람만 가능한 연구",
      publishedDate: "2024-02-01",
      doi: null,
    }, {
      fetcher: async (url) => {
        if (String(url).includes("api.openalex.org")) {
          return new Response(JSON.stringify({
            results: [{
              id: "https://openalex.org/W789",
              display_name: "열람만 가능한 연구",
              publication_date: "2024-02-01",
              abstract_inverted_index: null,
              open_access: { is_oa: true, oa_url: "https://example.org/article" },
              best_oa_location: {
                is_oa: true,
                pdf_url: "https://example.org/paper.pdf",
                landing_page_url: "https://example.org/article",
                license,
              },
            }],
          }), { status: 200, headers: { "Content-Type": "application/json" } });
        }
        return new Response(JSON.stringify({ message: { items: [] } }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    });
    assert.equal(result.status, "unavailable", `license=${license}`);
    assert.equal(result.pdfUrl, null, `license=${license}`);
  }
});

test("공개 PDF 주소는 HTTPS와 검증된 공개 저장소만 허용한다", () => {
  assert.equal(publicPdfModule.isAllowedPublicPdfUrl("https://arxiv.org/pdf/2402.00001.pdf"), true);
  assert.equal(publicPdfModule.isAllowedPublicPdfUrl("https://pmc.ncbi.nlm.nih.gov/articles/PMC123/pdf/a.pdf"), true);
  assert.equal(publicPdfModule.isAllowedPublicPdfUrl("http://arxiv.org/pdf/2402.00001.pdf"), false);
  assert.equal(publicPdfModule.isAllowedPublicPdfUrl("https://localhost/paper.pdf"), false);
  assert.equal(publicPdfModule.isAllowedPublicPdfUrl("https://127.0.0.1/paper.pdf"), false);
  assert.equal(publicPdfModule.isAllowedPublicPdfUrl("https://arxiv.org.evil.example/paper.pdf"), false);
  assert.equal(publicPdfModule.isAllowedPublicPdfUrl("https://arxiv.org:444/paper.pdf"), false);
});

test("검증된 공개 PDF는 제한된 분량만 텍스트로 추출한다", async () => {
  let parsedBytes = 0;
  const result = await publicPdfModule.extractPublicPdfText(
    "https://arxiv.org/pdf/2402.00001.pdf",
    {
      fetcher: async (_url, init) => {
        assert.equal(init.redirect, "manual");
        return new Response(new TextEncoder().encode("%PDF-1.7 test"), {
          status: 200,
          headers: {
            "Content-Type": "application/pdf",
            "Content-Length": "13",
          },
        });
      },
      parser: async (bytes) => {
        parsedBytes = bytes.byteLength;
        return { pageCount: 2, text: "첫 페이지 내용\n\n둘째 페이지 내용" };
      },
    },
  );

  assert.equal(parsedBytes, 13);
  assert.equal(result.pageCount, 2);
  assert.equal(result.text, "첫 페이지 내용\n\n둘째 페이지 내용");
  assert.equal(result.sourceUrl, "https://arxiv.org/pdf/2402.00001.pdf");
});

test("용량 제한을 넘거나 PDF 형식이 아닌 응답은 파싱하지 않는다", async () => {
  let parsed = false;
  await assert.rejects(
    publicPdfModule.extractPublicPdfText("https://arxiv.org/pdf/too-large.pdf", {
      fetcher: async () => new Response("not used", {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Length": String(10 * 1024 * 1024 + 1),
        },
      }),
      parser: async () => {
        parsed = true;
        return { pageCount: 1, text: "실행되면 안 됨" };
      },
    }),
    /10MB 이하/,
  );
  assert.equal(parsed, false);

  await assert.rejects(
    publicPdfModule.extractPublicPdfText("https://arxiv.org/pdf/not-pdf.pdf", {
      fetcher: async () => new Response("plain text", {
        status: 200,
        headers: { "Content-Type": "text/plain" },
      }),
      parser: async () => {
        parsed = true;
        return { pageCount: 1, text: "실행되면 안 됨" };
      },
    }),
    /PDF 형식/,
  );
  assert.equal(parsed, false);
});

test("일치하는 공개 초록이 없으면 다른 논문 내용을 대신 채우지 않는다", async () => {
  const result = await contentLookupModule.lookupPublicPaperContent({
    title: "공식 프로필에만 있는 학술발표",
    publishedDate: "2023-08-25",
    doi: null,
  }, {
    fetcher: async (url) => {
      if (String(url).includes("api.openalex.org")) {
        return new Response(JSON.stringify({
          results: [{
            display_name: "비슷하지만 다른 학술발표",
            publication_date: "2023-08-25",
            abstract_inverted_index: { "대체하면": [0], "안": [1], "된다.": [2] },
          }],
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({
        message: { items: [{
          title: ["또 다른 논문"],
          abstract: "<jats:p>임의 초록</jats:p>",
          URL: "https://doi.org/10.0000/wrong",
        }] },
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    },
  });

  assert.equal(result.status, "unavailable");
  assert.equal(result.content, null);
});

test("공식 교수·논문 ID로 자동 초록 API를 요청하고 검증된 응답만 사용한다", async () => {
  const requests = [];
  const result = await contentClientModule.requestProfessorPaperContent({
    professorId: "professor-1",
    paperId: "paper-new",
  }, {
    fetcher: async (url, init) => {
      requests.push({ url: String(url), init });
      return new Response(JSON.stringify({
        status: "found",
        paperId: "paper-new",
        title: "AI 기반 진로 멘토링",
        content: "공개 초록 내용",
        provider: "openalex",
        sourceUrl: "https://openalex.org/W123",
        pdfUrl: null,
        license: null,
        matchedTitle: "AI 기반 진로 멘토링",
        matchedPublishedDate: "2025-03-01",
        matchedDoi: "10.0000/example",
        matchedBy: "doi",
        isOpenAccess: true,
        contentSourceType: "abstract",
        pageCount: null,
        message: "공개 초록을 불러왔습니다.",
        fetchedAt: "2026-08-30T00:00:00.000Z",
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    },
  });

  assert.equal(requests[0].url, "/api/professors/paper-content");
  assert.equal(requests[0].init.method, "POST");
  assert.deepEqual(JSON.parse(requests[0].init.body), {
    professorId: "professor-1",
    paperId: "paper-new",
  });
  assert.equal(result.status, "found");
  assert.equal(result.paperId, "paper-new");
  assert.equal(result.content, "공개 초록 내용");
  assert.equal(result.contentSourceType, "abstract");
});

test("관련 공개 논문 후보 응답은 원래 선택과 후보 근거를 함께 보존한다", async () => {
  const result = await contentClientModule.requestProfessorPaperContent({
    professorId: "professor-1",
    paperId: "paper-korean-presentation",
  }, {
    fetcher: async () => new Response(JSON.stringify({
      status: "candidate",
      paperId: "paper-korean-presentation",
      title: "로컬푸드를 통한 친환경 농업 활성화 방안",
      content: "공개 논문의 검증된 초록",
      provider: "openalex",
      sourceUrl: "https://doi.org/10.3390/su16093614",
      pdfUrl: null,
      license: null,
      matchedTitle: "The Effects of Local Food on Carbon Emissions: The Case of the Republic of Korea",
      matchedPublishedDate: "2024-04-25",
      matchedDoi: "10.3390/su16093614",
      matchedBy: "related-title",
      isOpenAccess: true,
      contentSourceType: "abstract",
      pageCount: null,
      relatedOfficialPaper: {
        id: "paper-english-short",
        title: "The Effects of Local Food on Carbon Emissions",
        publicationType: "학술발표",
        publishedDate: "2023-07-26",
        doi: null,
        kciId: null,
        officialProfileUrl: "https://example.edu/professor",
      },
      message: "관련 공개 논문 후보를 찾았습니다.",
      fetchedAt: "2026-08-30T00:00:00.000Z",
    }), { status: 200, headers: { "Content-Type": "application/json" } }),
  });

  assert.equal(result.status, "candidate");
  assert.equal(result.paperId, "paper-korean-presentation");
  assert.equal(result.relatedOfficialPaper?.id, "paper-english-short");
  assert.equal(result.matchedBy, "related-title");
  assert.equal(result.matchedDoi, "10.3390/su16093614");
});

test("같은 논문 묶음은 5장을 갱신하고 다른 논문은 별도 묶음으로 저장한다", async () => {
  memory.clear();
  const { migrateQuestState, useQuestStore } = questStoreModule;
  const migrated = migrateQuestState({
    cards: [{
      id: "legacy",
      tool: "paper-bite",
      title: "기존 카드",
      body: "기존 내용",
      evidence: null,
      professorId: null,
      topicId: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    }],
  });
  assert.equal(migrated.cards?.[0]?.body, "기존 내용");
  assert.equal(migrated.cards?.[0]?.paperId, null);
  assert.equal(migrated.cards?.[0]?.bundleId, null);
  assert.equal(migrated.cards?.[0]?.slot, null);

  useQuestStore.setState({ cards: [], hasHydrated: true });
  const slots = ["problem", "method", "result", "limitations", "questions"];

  const saveBundle = (paperId, suffix) => {
    useQuestStore.getState().savePaperBundle({
      bundleId: `paper:professor-1:${paperId}`,
      evidence: {
        label: "사용자가 붙여 넣은 텍스트",
        page: null,
        href: "https://example.edu/professor",
      },
      professorId: "professor-1",
      topicId: null,
      paperId,
      cards: slots.map((slot) => ({
        slot,
        title: `${slot}-${suffix}`,
        body: `body-${suffix}`,
      })),
    });
  };

  saveBundle("paper-1", "first");
  const firstIds = useQuestStore.getState().cards.map((card) => card.id).sort();
  saveBundle("paper-1", "updated");
  const updatedCards = useQuestStore.getState().cards;
  assert.equal(updatedCards.length, 5);
  assert.deepEqual(updatedCards.map((card) => card.id).sort(), firstIds);
  assert.ok(updatedCards.every((card) => card.body === "body-updated"));

  saveBundle("paper-2", "second");
  assert.equal(useQuestStore.getState().cards.length, 10);
});

test("저장 공간 오류가 나도 3분 카드 묶음은 부분 저장되지 않는다", () => {
  const { useQuestStore } = questStoreModule;
  useQuestStore.setState({ cards: [], hasHydrated: true });
  const originalSetItem = globalThis.localStorage.setItem;
  globalThis.localStorage.setItem = () => {
    throw new DOMException("저장 공간 부족", "QuotaExceededError");
  };

  let threw = false;
  try {
    useQuestStore.getState().savePaperBundle({
      bundleId: "paper:professor-1:quota-paper",
      evidence: { label: "테스트", page: null, href: null },
      professorId: "professor-1",
      topicId: null,
      paperId: "quota-paper",
      cards: ["problem", "method", "result", "limitations", "questions"].map((slot) => ({
        slot,
        title: slot,
        body: slot,
      })),
    });
  } catch {
    threw = true;
  } finally {
    globalThis.localStorage.setItem = originalSetItem;
  }

  assert.equal(threw, true);
  assert.equal(useQuestStore.getState().cards.length, 5);
  useQuestStore.setState({ cards: [] });
});

test("논문 활용 선택 단계 뒤에 목적별 첫 질문과 메일 초안으로 이어진다", () => {
  const route = fs.readFileSync(
    path.join(repositoryRoot, "app/paper/reader/page.tsx"),
    "utf8",
  );
  const shell = fs.readFileSync(
    path.join(repositoryRoot, "components/paper-reader/paper-reader-shell.tsx"),
    "utf8",
  );
  const reader = fs.readFileSync(
    path.join(repositoryRoot, "components/paper-reader/paper-reader.tsx"),
    "utf8",
  );
  const steps = fs.readFileSync(
    path.join(repositoryRoot, "components/paper-reader/paper-reading-steps.tsx"),
    "utf8",
  );
  const styles = fs.readFileSync(
    path.join(repositoryRoot, "app/globals.css"),
    "utf8",
  );

  assert.match(route, /mode === "pdf"/);
  assert.match(route, /initialStep=\{step === "card" \? "card"/);
  assert.match(shell, /type PaperBiteWorkflowStep = "select" \| "card"/);
  assert.match(shell, /읽을 논문 한 편을 고르세요/);
  assert.match(shell, /논문 1개 선택하기/);
  assert.match(shell, /초록이나 본문을 3분 카드로 정리해요/);
  assert.match(shell, /3분 카드 만들기/);
  assert.match(shell, /4단계 · 목적별 첫 질문 고르기/);
  assert.match(shell, /ready=\{isSaved\}/);
  assert.doesNotMatch(shell, /PDF 6탭 리더로 더 깊게 읽기/);
  assert.doesNotMatch(shell, /paper-reader-capabilities/);
  assert.match(reader, /PDF 넣고 페이지별 해설·요약 시작/);
  assert.match(reader, /4단계 · 목적별 첫 질문 고르기/);
  assert.match(reader, /paperId: selectedProfessorPaper\?\.paperId \?\? null/);
  assert.match(steps, /PAPER_TO_EMAIL_STEPS/);
  assert.match(steps, /current: 1 \| 2 \| 3 \| 4 \| 5/);
  assert.match(styles, /\.paper-reading-steps ol[\s\S]*repeat\(5, minmax\(0, 1fr\)\)/);
  assert.match(styles, /@media \(max-width: 420px\)[\s\S]*\.paper-reading-steps li/);
  assert.match(styles, /\.paper-bite-pdf-next[\s\S]*grid-template-columns/);
});
