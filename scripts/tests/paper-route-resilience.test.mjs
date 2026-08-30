import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test, { after } from "node:test";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(testDirectory, "../..");
const runtimeDirectory = fs.mkdtempSync(path.join(testDirectory, ".paper-resilience-runtime-"));

function loadModule(sourceRelativePath, outputName) {
  const sourcePath = path.join(repositoryRoot, sourceRelativePath);
  if (!fs.existsSync(sourcePath)) return null;
  const compiled = ts.transpileModule(fs.readFileSync(sourcePath, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
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
  return require(outputPath);
}

const lookupModule = loadModule("lib/paper-content-lookup.ts", "paper-content-lookup.cjs");
const materializerModule = loadModule(
  "lib/paper-content-materializer.server.ts",
  "paper-content-materializer.server.cjs",
);
const rateLimitModule = loadModule("lib/paper-pdf-rate-limit.ts", "paper-pdf-rate-limit.cjs");

after(() => fs.rmSync(runtimeDirectory, { recursive: true, force: true }));

test("한 공개 학술 제공자라도 연결에 실패하면 30일 미발견 결과로 취급하지 않는다", async () => {
  assert.ok(lookupModule, "논문 공개 자료 조회 모듈이 필요합니다.");
  const result = await lookupModule.lookupPublicPaperContent({
    title: "일시적 연결 실패 연구",
    publishedDate: "2025-01-01",
    doi: null,
  }, {
    fetcher: async (url) => {
      if (String(url).includes("api.openalex.org")) {
        throw new TypeError("temporary network failure");
      }
      return new Response(JSON.stringify({ message: { items: [] } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    },
  });

  assert.equal(result.status, "error");
  assert.match(result.message, /다시 시도/);
});

test("공개 학술 제공자의 503 응답은 30일 미발견 결과로 취급하지 않는다", async () => {
  assert.ok(lookupModule, "논문 공개 자료 조회 모듈이 필요합니다.");
  const result = await lookupModule.lookupPublicPaperContent({
    title: "일시적 서버 실패 연구",
    publishedDate: "2025-01-01",
    doi: null,
  }, {
    fetcher: async (url) => {
      if (String(url).includes("api.openalex.org")) {
        return new Response(JSON.stringify({ error: "temporarily unavailable" }), {
          status: 503,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ message: { items: [] } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    },
  });

  assert.equal(result.status, "error");
  assert.match(result.message, /다시 시도/);
});

test("공개 학술 제공자의 인증·권한 오류도 논문 미발견으로 캐시하지 않는다", async () => {
  assert.ok(lookupModule, "논문 공개 자료 조회 모듈이 필요합니다.");
  const result = await lookupModule.lookupPublicPaperContent({
    title: "제공자 권한 오류 연구",
    publishedDate: "2025-01-01",
    doi: null,
  }, {
    fetcher: async (url) => {
      if (String(url).includes("api.openalex.org")) {
        return new Response(JSON.stringify({ error: "forbidden" }), {
          status: 403,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ message: { items: [] } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    },
  });

  assert.equal(result.status, "error");
  assert.match(result.message, /다시 시도/);
});

test("공개 학술 제공자의 깨진 JSON 응답은 재시도 가능한 오류로 처리한다", async () => {
  assert.ok(lookupModule, "논문 공개 자료 조회 모듈이 필요합니다.");
  const result = await lookupModule.lookupPublicPaperContent({
    title: "깨진 응답 연구",
    publishedDate: "2025-01-01",
    doi: null,
  }, {
    fetcher: async (url) => {
      if (String(url).includes("api.openalex.org")) {
        return new Response("{not-json", {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ message: { items: [] } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    },
  });

  assert.equal(result.status, "error");
  assert.match(result.message, /다시 시도/);
});

test("공개 PDF 다운로드나 파싱 실패는 재시도 가능한 오류로 보존한다", async () => {
  assert.ok(materializerModule, "PDF 텍스트 물질화 모듈이 필요합니다.");
  const result = await materializerModule.materializePublicPaperContent({
    status: "pdf_available",
    content: null,
    provider: "openalex",
    sourceUrl: "https://arxiv.org/abs/2501.00001",
    pdfUrl: "https://arxiv.org/pdf/2501.00001.pdf",
    license: "cc-by",
    matchedTitle: "공개 PDF 연구",
    matchedBy: "title",
    isOpenAccess: true,
    message: "공개 PDF를 찾았습니다.",
  }, new AbortController().signal, async () => {
    throw new Error("PDF 파싱 서비스가 잠시 응답하지 않습니다.");
  });

  assert.equal(result.status, "error");
  assert.equal(result.content, null);
  assert.equal(result.contentSourceType, null);
  assert.match(result.message, /다시 시도/);
});

test("관련 논문 PDF 추출 실패도 성공적인 미발견처럼 캐시하지 않는다", () => {
  const routeSource = fs.readFileSync(
    path.join(repositoryRoot, "app/api/professors/paper-content/route.ts"),
    "utf8",
  );
  assert.match(
    routeSource,
    /candidateContent\.status === "error"[\s\S]*responseStatus = "error"/,
  );
  assert.match(routeSource, /responsePayload\.status !== "error"/);
  assert.match(routeSource, /responsePayload\.status === "unavailable"[\s\S]*PAPER_CONTENT_NEGATIVE_CACHE_TTL_MS/);
});

function createCounterStore() {
  const buckets = new Map();
  return {
    kind: "memory",
    async increment(key, windowMs, now) {
      const current = buckets.get(key);
      if (!current || current.resetAt <= now) {
        buckets.set(key, { count: 1, resetAt: now + windowMs });
        return { count: 1, resetInSec: Math.ceil(windowMs / 1_000) };
      }
      current.count += 1;
      return {
        count: current.count,
        resetInSec: Math.max(1, Math.ceil((current.resetAt - now) / 1_000)),
      };
    },
  };
}

test("PDF 자동 열기는 클라이언트별 분당 호출 상한을 외부 조회 전에 적용한다", async () => {
  assert.ok(rateLimitModule, "공개 PDF 요청 제한 모듈이 필요합니다.");
  const store = createCounterStore();
  const request = new Request("http://localhost/api/professors/paper-pdf", {
    headers: { "x-forwarded-for": "203.0.113.8, 10.0.0.1" },
  });
  const maximum = rateLimitModule.PAPER_PDF_RATE_LIMITS.perMinute.max;
  for (let index = 0; index < maximum; index += 1) {
    const result = await rateLimitModule.checkPaperPdfRequestLimit(request, { store, now: 1_000 });
    assert.equal(result.allowed, true);
  }
  const blocked = await rateLimitModule.checkPaperPdfRequestLimit(request, { store, now: 1_000 });
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.scope, "minute");
  assert.ok(blocked.retryAfterSec >= 1);

  const otherClient = await rateLimitModule.checkPaperPdfRequestLimit(
    new Request("http://localhost/api/professors/paper-pdf", {
      headers: { "x-forwarded-for": "198.51.100.22" },
    }),
    { store, now: 1_000 },
  );
  assert.equal(otherClient.allowed, true);
});

test("PDF 자동 열기는 분당 제한을 피해 반복해도 클라이언트별 시간당 상한을 유지한다", async () => {
  assert.ok(rateLimitModule, "공개 PDF 요청 제한 모듈이 필요합니다.");
  const store = createCounterStore();
  const request = new Request("http://localhost/api/professors/paper-pdf", {
    headers: { "x-forwarded-for": "203.0.113.18" },
  });
  const maximum = rateLimitModule.PAPER_PDF_RATE_LIMITS.perHour.max;
  for (let index = 0; index < maximum; index += 1) {
    const result = await rateLimitModule.checkPaperPdfRequestLimit(request, {
      store,
      now: 1_000 + index * 61_000,
    });
    assert.equal(result.allowed, true);
  }
  const blocked = await rateLimitModule.checkPaperPdfRequestLimit(request, {
    store,
    now: 1_000 + maximum * 61_000,
  });
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.scope, "hour");
});

test("제한 저장소가 잠시 응답하지 않아도 비싼 PDF 외부 요청은 실행하지 않는다", async () => {
  assert.ok(rateLimitModule, "공개 PDF 요청 제한 모듈이 필요합니다.");
  const result = await rateLimitModule.checkPaperPdfRequestLimit(
    new Request("http://localhost/api/professors/paper-pdf"),
    {
      store: {
        kind: "redis",
        async increment() {
          throw new Error("store unavailable");
        },
      },
      now: 1_000,
    },
  );
  assert.equal(result.allowed, false);
  assert.equal(result.scope, "store");
  assert.ok(result.retryAfterSec >= 1);
});

test("PDF 요청 제한은 API 키를 읽기 전에 실행하고 429에 비밀정보를 담지 않는다", () => {
  const routeSource = fs.readFileSync(
    path.join(repositoryRoot, "app/api/professors/paper-pdf/route.ts"),
    "utf8",
  );
  const limitIndex = routeSource.indexOf("checkPaperPdfRequestLimit(request");
  const credentialIndex = routeSource.indexOf("process.env.OPENALEX_API_KEY");
  const lookupIndex = routeSource.indexOf("lookupPublicPaperContent({");
  assert.ok(limitIndex >= 0, "PDF 요청 제한을 라우트에 연결해야 합니다.");
  assert.ok(limitIndex < credentialIndex);
  assert.ok(limitIndex < lookupIndex);
  assert.match(routeSource, /status: 429/);
  assert.match(routeSource, /"Retry-After"/);
  const limitedResponse = routeSource.slice(limitIndex, credentialIndex);
  assert.doesNotMatch(limitedResponse, /OPENALEX_API_KEY|CROSSREF_MAILTO|UPSTASH/);
});

test("논문 내용 조회도 같은 고비용 작업 제한을 외부 조회 전에 적용한다", () => {
  const contentRouteSource = fs.readFileSync(
    path.join(repositoryRoot, "app/api/professors/paper-content/route.ts"),
    "utf8",
  );
  const pdfRouteSource = fs.readFileSync(
    path.join(repositoryRoot, "app/api/professors/paper-pdf/route.ts"),
    "utf8",
  );
  const contentLimitIndex = contentRouteSource.indexOf("checkPaperPdfRequestLimit(request");
  const contentCredentialIndex = contentRouteSource.indexOf("process.env.OPENALEX_API_KEY");
  const contentLookupIndex = contentRouteSource.indexOf("lookupPublicPaperContent({");

  assert.ok(contentLimitIndex >= 0, "논문 내용 조회에도 공개 PDF 작업 제한을 연결해야 합니다.");
  assert.ok(contentLimitIndex < contentCredentialIndex);
  assert.ok(contentLimitIndex < contentLookupIndex);
  assert.match(contentRouteSource.slice(contentLimitIndex, contentCredentialIndex), /status: 429/);
  assert.match(contentRouteSource, /"Retry-After"/);
  assert.match(pdfRouteSource, /checkPaperPdfRequestLimit\(request/);
});
