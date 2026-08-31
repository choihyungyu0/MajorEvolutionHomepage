import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test, { after } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(testDirectory, "../..");
const runtimeDirectory = fs.mkdtempSync(path.join(testDirectory, ".co-design-diversity-runtime-"));
const helperSourcePath = path.join(repositoryRoot, "lib/co-design-diversity.ts");
const compiled = ts.transpileModule(fs.readFileSync(helperSourcePath, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  fileName: "lib/co-design-diversity.ts",
  reportDiagnostics: true,
});
const errors = (compiled.diagnostics ?? []).filter(
  (diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error,
);
assert.equal(errors.length, 0, "공동설계 다양성 판별기를 테스트용으로 변환하지 못했습니다.");
const outputPath = path.join(runtimeDirectory, "co-design-diversity.cjs");
fs.writeFileSync(outputPath, compiled.outputText, "utf8");
const diversity = await import(pathToFileURL(outputPath).href);

after(() => fs.rmSync(runtimeDirectory, { recursive: true, force: true }));

const similarEtfCandidates = [
  {
    title: "공개 데이터 기반 ETF 리스크 지표 개발 및 보고서",
    problem: "ETF 투자자에게 위험을 설명할 지표가 필요하다.",
    question: "공개 시장 데이터에서 ETF 투자 위험 지표를 어떻게 산출할 수 있는가?",
    dataOptions: [{ name: "한국거래소 ETF 시세·거래량 데이터" }],
    methodDetail: "공개 ETF 시세를 수집해 변동성과 유동성 지표를 계산",
  },
  {
    title: "공개 데이터 기반 ETF 투자자 리스크 지표 개발 및 분석",
    problem: "ETF 투자자 피해 가능성을 예측할 지표가 필요하다.",
    question: "공개 거래 데이터로 ETF별 투자자 위험 지표를 어떻게 비교할 수 있는가?",
    dataOptions: [{ name: "ETF 시세·거래 데이터" }],
    methodDetail: "공개 ETF 데이터를 수집해 변동성과 추적오차 지표를 계산",
  },
];

const distinctEtfCandidates = [
  {
    title: "ETF 시장 변동성을 설명하는 거래 구조 지표",
    problem: "ETF별 유동성과 추적오차 차이를 설명할 기준이 부족하다.",
    question: "거래량과 스프레드 변화는 ETF 추적오차와 어떤 관계를 보이는가?",
    dataOptions: [{ name: "ETF 시세·거래량·스프레드 시계열" }],
    methodDetail: "시계열 시각화와 패널 회귀로 관계를 설명",
  },
  {
    title: "ETF 공시 텍스트로 만드는 초보 투자자 위험 안내 도구",
    problem: "초보 투자자가 상품 설명서의 위험 문구를 비교하기 어렵다.",
    question: "ETF 공시 문구를 위험 유형별로 분류해 선택 안내로 바꿀 수 있는가?",
    dataOptions: [{ name: "ETF 투자설명서와 운용보고서 텍스트" }],
    methodDetail: "텍스트 분류 기준을 만들고 위험 안내 프로토타입으로 검증",
  },
];

test("범위와 표현만 조금 다른 ETF 후보는 서로 다른 방향으로 인정하지 않는다", () => {
  assert.equal(diversity.coDesignCandidatesAreDistinct(...similarEtfCandidates), false);
});

test("현상 분석과 투자자 안내처럼 문제·데이터·방법이 다른 후보는 통과한다", () => {
  assert.equal(diversity.coDesignCandidatesAreDistinct(...distinctEtfCandidates), true);
});

test("AI 생성과 로컬 대체 모두 서로 다른 관점을 우선하고 결과 라벨도 이를 설명한다", () => {
  const server = fs.readFileSync(path.join(repositoryRoot, "lib/openai-server.ts"), "utf8");
  const recommend = fs.readFileSync(path.join(repositoryRoot, "lib/recommend.ts"), "utf8");
  const coDesign = fs.readFileSync(path.join(repositoryRoot, "lib/co-design-ai.ts"), "utf8");
  const result = fs.readFileSync(path.join(repositoryRoot, "components/screens/research-result.tsx"), "utf8");

  assert.match(server, /문제 대상, 연구질문, 주요 데이터, 방법, 최종 결과물 중 최소 세 가지/);
  assert.match(server, /coDesignCandidatesAreDistinct\(candidates\[0\], candidates\[1\]\)/);
  assert.match(recommend, /topic\.pairId !== top\.pairId && topic\.variant !== top\.variant/);
  assert.match(recommend, /pairId: `\$\{pairId\}-evidence`/);
  assert.match(recommend, /pairId: `\$\{pairId\}-application`/);
  assert.match(coDesign, /pairId: `\$\{batchId\}-\$\{index === 0 \? "evidence" : "application"\}`/);
  assert.match(result, /"안전 축소형": "핵심 분석형"/);
  assert.match(result, /"차별 심화형": "융합 확장형"/);
});
