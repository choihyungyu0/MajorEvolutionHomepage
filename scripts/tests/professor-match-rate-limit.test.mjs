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
const runtimeDirectory = fs.mkdtempSync(
  path.join(testDirectory, ".professor-match-rate-limit-runtime-"),
);

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

const rateLimitModule = loadModule(
  "lib/professor-match-rate-limit.ts",
  "professor-match-rate-limit.cjs",
);

after(() => fs.rmSync(runtimeDirectory, { recursive: true, force: true }));

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

test("AI 교수 재정렬은 클라이언트별 분당 상한을 넘으면 429용 결과를 반환한다", async () => {
  assert.ok(rateLimitModule, "교수 매칭 AI 요청 제한 모듈이 필요합니다.");
  const store = createCounterStore();
  const request = new Request("http://localhost/api/professors/match", {
    headers: { "x-forwarded-for": "203.0.113.8, 10.0.0.1" },
  });
  const maximum = rateLimitModule.PROFESSOR_MATCH_AI_RATE_LIMITS.perMinute.max;

  for (let index = 0; index < maximum; index += 1) {
    const result = await rateLimitModule.checkProfessorMatchAiRequestLimit(request, {
      store,
      now: 1_000,
    });
    assert.equal(result.allowed, true);
  }

  const blocked = await rateLimitModule.checkProfessorMatchAiRequestLimit(request, {
    store,
    now: 1_000,
  });
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.scope, "minute");
  assert.ok(blocked.retryAfterSec >= 1);
  assert.doesNotMatch(JSON.stringify(blocked), /203\.0\.113\.8|x-forwarded-for|redis|upstash/i);

  const otherClient = await rateLimitModule.checkProfessorMatchAiRequestLimit(
    new Request("http://localhost/api/professors/match", {
      headers: { "x-forwarded-for": "198.51.100.22" },
    }),
    { store, now: 1_000 },
  );
  assert.equal(otherClient.allowed, true);
});

test("AI 교수 재정렬은 분당 창을 피한 반복에도 클라이언트별 시간당 상한을 유지한다", async () => {
  assert.ok(rateLimitModule, "교수 매칭 AI 요청 제한 모듈이 필요합니다.");
  const store = createCounterStore();
  const request = new Request("http://localhost/api/professors/match", {
    headers: { "x-real-ip": "203.0.113.18" },
  });
  const maximum = rateLimitModule.PROFESSOR_MATCH_AI_RATE_LIMITS.perHour.max;

  for (let index = 0; index < maximum; index += 1) {
    const result = await rateLimitModule.checkProfessorMatchAiRequestLimit(request, {
      store,
      now: 1_000 + index * 61_000,
    });
    assert.equal(result.allowed, true);
  }

  const blocked = await rateLimitModule.checkProfessorMatchAiRequestLimit(request, {
    store,
    now: 1_000 + maximum * 61_000,
  });
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.scope, "hour");
  assert.ok(blocked.retryAfterSec >= 1);
});

test("제한 저장소가 응답하지 않으면 AI 교수 재정렬을 fail-closed로 막는다", async () => {
  assert.ok(rateLimitModule, "교수 매칭 AI 요청 제한 모듈이 필요합니다.");
  const result = await rateLimitModule.checkProfessorMatchAiRequestLimit(
    new Request("http://localhost/api/professors/match"),
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

test("공개 교수 매칭은 로컬 분기를 보존하고 AI 호출 직전에만 429 제한을 적용한다", () => {
  const routeSource = fs.readFileSync(
    path.join(repositoryRoot, "app/api/professors/match/route.ts"),
    "utf8",
  );
  const projectBranchIndex = routeSource.indexOf("if (isProjectMentorRequest)");
  const localMatchIndex = routeSource.indexOf("const baseline = matchOfficialProfessors(");
  const limitIndex = routeSource.indexOf("checkProfessorMatchAiRequestLimit(request");
  const candidateIndex = routeSource.indexOf("getOfficialProfessorRoleCandidates(topic");
  const rerankIndex = routeSource.indexOf("await rerankProfessorMentors(topic");

  assert.ok(projectBranchIndex >= 0, "프로젝트 AI 재정렬 분기가 필요합니다.");
  assert.ok(localMatchIndex >= 0 && localMatchIndex < projectBranchIndex);
  assert.ok(limitIndex > projectBranchIndex, "일반 로컬 교수 매칭은 제한 저장소를 거치지 않아야 합니다.");
  assert.ok(limitIndex < candidateIndex);
  assert.ok(limitIndex < rerankIndex, "OpenAI 재정렬 전에 사용량을 확인해야 합니다.");

  const limitedResponse = routeSource.slice(limitIndex, candidateIndex);
  assert.match(limitedResponse, /status: 429/);
  assert.match(limitedResponse, /"Retry-After"/);
  assert.match(limitedResponse, /"Cache-Control": "private, no-store"/);
  assert.doesNotMatch(
    limitedResponse,
    /OPENAI_API_KEY|UPSTASH_REDIS_REST_(?:URL|TOKEN)|x-forwarded-for|x-real-ip/i,
  );
});
