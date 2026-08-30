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
const runtimeDirectory = fs.mkdtempSync(path.join(testDirectory, ".paper-cache-runtime-"));
const sourcePath = path.join(repositoryRoot, "lib/paper-content-cache.ts");

let cacheModule = null;
if (fs.existsSync(sourcePath)) {
  const compiled = ts.transpileModule(fs.readFileSync(sourcePath, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    fileName: "lib/paper-content-cache.ts",
    reportDiagnostics: true,
  });
  const errors = (compiled.diagnostics ?? []).filter(
    (diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error,
  );
  assert.equal(errors.length, 0, "논문 조회 캐시 테스트용 변환에 실패했습니다.");
  const outputPath = path.join(runtimeDirectory, "paper-content-cache.cjs");
  fs.writeFileSync(outputPath, compiled.outputText, "utf8");
  cacheModule = require(outputPath);
}

after(() => fs.rmSync(runtimeDirectory, { recursive: true, force: true }));

test("공개 논문 조회 결과는 30일 동안 재사용하고 이후 만료한다", () => {
  assert.ok(cacheModule, "논문 조회 캐시 모듈이 필요합니다.");
  let now = 1_000;
  const cache = cacheModule.createPaperContentCache({ now: () => now });
  cache.set("professor-1:paper-1", { status: "found" });

  now += cacheModule.PAPER_CONTENT_CACHE_TTL_MS - 1;
  assert.deepEqual(cache.get("professor-1:paper-1"), { status: "found" });

  now += 2;
  assert.equal(cache.get("professor-1:paper-1"), undefined);
});

test("공개 논문 미발견 결과는 짧게만 보관해 다시 찾기를 막지 않는다", () => {
  assert.ok(cacheModule, "논문 조회 캐시 모듈이 필요합니다.");
  let now = 1_000;
  const cache = cacheModule.createPaperContentCache({ now: () => now });
  cache.set(
    "professor-1:paper-missing",
    { status: "unavailable" },
    cacheModule.PAPER_CONTENT_NEGATIVE_CACHE_TTL_MS,
  );

  now += cacheModule.PAPER_CONTENT_NEGATIVE_CACHE_TTL_MS - 1;
  assert.deepEqual(cache.get("professor-1:paper-missing"), { status: "unavailable" });

  now += 2;
  assert.equal(cache.get("professor-1:paper-missing"), undefined);
  assert.ok(cacheModule.PAPER_CONTENT_NEGATIVE_CACHE_TTL_MS < cacheModule.PAPER_CONTENT_CACHE_TTL_MS);
});
