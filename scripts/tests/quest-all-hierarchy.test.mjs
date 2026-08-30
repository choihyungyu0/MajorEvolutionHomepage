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
const runtimeDirectory = fs.mkdtempSync(path.join(testDirectory, ".quest-all-hierarchy-runtime-"));
const sourcePath = path.join(repositoryRoot, "lib/quest-tools-hierarchy.ts");

let hierarchyModule = null;
if (fs.existsSync(sourcePath)) {
  const compiled = ts.transpileModule(fs.readFileSync(sourcePath, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    fileName: "lib/quest-tools-hierarchy.ts",
    reportDiagnostics: true,
  });
  const outputPath = path.join(runtimeDirectory, "quest-tools-hierarchy.cjs");
  fs.writeFileSync(outputPath, compiled.outputText, "utf8");
  hierarchyModule = require(outputPath);
}

after(() => fs.rmSync(runtimeDirectory, { recursive: true, force: true }));

const screen = fs.readFileSync(
  path.join(repositoryRoot, "components/screens/quest-hub-screen.tsx"),
  "utf8",
);
const styles = fs.readFileSync(
  path.join(repositoryRoot, "components/screens/quest-hub-screen.module.css"),
  "utf8",
);

test("현재 필터에서 아직 저장하지 않은 첫 도구를 추천하고 모두 완료하면 마지막 행동을 제안한다", () => {
  assert.ok(hierarchyModule, "전체 준비 도구 위계 모듈이 필요합니다.");
  const order = ["paper-bite", "first-line", "email-guard", "silence-rescue", "next-seed"];
  assert.equal(
    hierarchyModule.getRecommendedQuestToolId({
      visibleToolIds: order,
      savedCounts: { "paper-bite": 1, "first-line": 0 },
    }),
    "first-line",
  );
  assert.equal(
    hierarchyModule.getRecommendedQuestToolId({
      visibleToolIds: ["silence-rescue"],
      savedCounts: { "silence-rescue": 2 },
    }),
    "silence-rescue",
  );
});

test("현재 교수·주제의 실제 준비 기록을 도구별 완료 수로 변환한다", () => {
  const counts = hierarchyModule.getQuestToolCompletionCounts({
    before: { paper: 3, question: 2, email: 1, total: 6 },
    during: { total: 1 },
    after: { total: 2 },
  });
  assert.deepEqual(counts, {
    "paper-bite": 3,
    "first-line": 2,
    "email-guard": 1,
    "silence-rescue": 1,
    "next-seed": 2,
  });
});

test("전체 준비 도구는 추천 행동을 먼저 보여주고 나머지를 단계별로 묶는다", () => {
  const allTools = screen.slice(screen.indexOf("export function QuestAllToolsScreen"));
  assert.match(allTools, /className="scene-banner--compact"/);
  assert.match(allTools, /const recommendedTool/);
  assert.match(allTools, /data-quest-recommended="true"/);
  assert.match(allTools, /getJourneyProgress\(/);
  assert.match(allTools, /getQuestToolCompletionCounts\(/);
  assert.match(allTools, /const knockKitDrafts = useResearchStore/);
  assert.match(allTools, /const mentorLoopEntries = useResearchStore/);
  assert.match(allTools, /지금 추천하는 도구/);
  assert.match(allTools, /const phaseGroups/);
  assert.match(allTools, /TIMING_LABEL\[group\.timing\]/);
  assert.match(allTools, /questStyles\.allToolsWorkspace/);
  assert.match(allTools, /questStyles\.savedRail/);
  assert.match(allTools, /id="saved-cards"/);
  assert.match(allTools, /role="group"[\s\S]*aria-label="만남 단계별 도구 필터"/);
  assert.match(allTools, /querySelector\('\[data-quest-recommended="true"\]'\)/);
  assert.doesNotMatch(allTools, /querySelector\("\.quest-tool-grid"\)/);
});

test("전체 준비 도구는 데스크톱 2열과 모바일 단일 흐름으로 정보 위계를 바꾼다", () => {
  assert.match(styles, /\.allToolsWorkspace/);
  assert.match(styles, /grid-template-areas:[\s\S]*"tools saved"/);
  assert.match(styles, /\.savedRail[\s\S]*position: sticky/);
  assert.match(styles, /@media \(max-width: 900px\)[\s\S]*\.allToolsWorkspace[\s\S]*grid-template-areas:[\s\S]*"tools"[\s\S]*"saved"/);
  assert.match(styles, /@media \(max-width: 640px\)[\s\S]*\.phaseToolGrid/);
  assert.match(styles, /scene-banner__image\)[\s\S]*height: 248px/);
  assert.match(styles, /@media \(max-width: 700px\)[\s\S]*scene-banner__image\)[\s\S]*height: 216px/);
  assert.doesNotMatch(styles, /\.savedRail :global\(\.quest-saved p\)[^{]*\{[^}]*max-height/);
});
