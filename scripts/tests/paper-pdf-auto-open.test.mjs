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
const runtimeDirectory = fs.mkdtempSync(path.join(testDirectory, ".paper-pdf-runtime-"));

function loadModule(sourceRelativePath, outputName) {
  const sourcePath = path.join(repositoryRoot, sourceRelativePath);
  if (!fs.existsSync(sourcePath)) return null;
  const compiled = ts.transpileModule(fs.readFileSync(sourcePath, "utf8"), {
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
  return require(outputPath);
}

const resolverModule = loadModule("lib/public-pdf-source.server.ts", "public-pdf-source.server.cjs");
const downloadModule = loadModule("lib/public-pdf-extractor.server.ts", "public-pdf-extractor.server.cjs");
const clientModule = loadModule("lib/professor-paper-pdf-client.ts", "professor-paper-pdf-client.cjs");
const pdfTextModule = loadModule("lib/pdf-text.ts", "pdf-text.cjs");

after(() => fs.rmSync(runtimeDirectory, { recursive: true, force: true }));

test("MDPI 공개 논문 주소는 실제 다운로드 가능한 공식 PDF 주소로 해석한다", async () => {
  assert.ok(resolverModule, "공개 PDF 주소 해석 모듈이 필요합니다.");
  const requests = [];
  const resolved = await resolverModule.resolvePublicPdfDownloadUrl({
    pdfUrl: "https://www.mdpi.com/2071-1050/16/9/3614/pdf?version=1714390215",
    doi: "10.3390/su16093614",
  }, {
    fetcher: async (url) => {
      requests.push(String(url));
      return new Response(JSON.stringify({
        message: {
          "container-title": ["Sustainability"],
          volume: "16",
          issue: "9",
          page: "3614",
        },
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    },
  });

  assert.match(requests[0], /api\.crossref\.org\/works\/10\.3390%2Fsu16093614/);
  assert.equal(
    resolved,
    "https://mdpi-res.com/d_attachment/sustainability/sustainability-16-03614/article_deploy/sustainability-16-03614-v2.pdf",
  );
});

test("검증된 공개 PDF는 저장하지 않고 제한된 바이트와 출처만 반환한다", async () => {
  assert.equal(typeof downloadModule?.downloadVerifiedPublicPdf, "function");
  const result = await downloadModule.downloadVerifiedPublicPdf(
    "https://mdpi-res.com/d_attachment/sustainability/paper/article_deploy/paper-v2.pdf",
    {
      fetcher: async () => new Response(new TextEncoder().encode("%PDF-1.7 verified"), {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Length": "17",
        },
      }),
    },
  );
  assert.equal(new TextDecoder().decode(result.bytes), "%PDF-1.7 verified");
  assert.equal(
    result.sourceUrl,
    "https://mdpi-res.com/d_attachment/sustainability/paper/article_deploy/paper-v2.pdf",
  );
});

test("공개 PDF API 응답은 기존 리더가 열 수 있는 브라우저 File로 변환한다", async () => {
  assert.ok(clientModule, "공개 PDF 클라이언트 모듈이 필요합니다.");
  const result = await clientModule.requestProfessorPaperPdf({
    professorId: "professor-1",
    paperId: "paper-1",
    relatedPaperId: "paper-public-version",
  }, {
    fetcher: async (_url, init) => {
      assert.deepEqual(JSON.parse(init.body), {
        professorId: "professor-1",
        paperId: "paper-1",
        relatedPaperId: "paper-public-version",
      });
      return new Response(new TextEncoder().encode("%PDF-1.7 browser"), {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "X-Paper-Title": encodeURIComponent("공개 논문 제목"),
          "X-Paper-Source-Url": encodeURIComponent("https://example.org/paper.pdf"),
        },
      });
    },
  });

  assert.equal(result.file.name, "공개 논문 제목.pdf");
  assert.equal(result.file.type, "application/pdf");
  assert.equal(result.sourceUrl, "https://example.org/paper.pdf");
  assert.equal(await result.file.text(), "%PDF-1.7 browser");
});

test("PDF가 아닌 자동 다운로드 응답은 리더로 넘기지 않는다", async () => {
  assert.ok(clientModule, "공개 PDF 클라이언트 모듈이 필요합니다.");
  await assert.rejects(
    clientModule.requestProfessorPaperPdf({ professorId: "professor-1", paperId: "paper-1" }, {
      fetcher: async () => new Response("blocked", {
        status: 200,
        headers: { "Content-Type": "text/html" },
      }),
    }),
    /PDF 형식/,
  );
});

test("브라우저 논문 리더는 과도하게 긴 PDF를 전체 순회하지 않는다", () => {
  assert.equal(typeof pdfTextModule?.assertSupportedPdfPageCount, "function");
  assert.doesNotThrow(() => pdfTextModule.assertSupportedPdfPageCount(40));
  assert.throws(() => pdfTextModule.assertSupportedPdfPageCount(41), /40쪽 이하/);
});
