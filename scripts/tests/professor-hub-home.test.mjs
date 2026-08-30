import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (relativePath) => readFileSync(
  new URL(`../../${relativePath}`, import.meta.url),
  "utf8",
);

const hub = read("components/screens/professor-hub-screen.tsx");
const styles = read("components/screens/professor-hub-screen.module.css");
const theme = read("lib/journey-stage-theme.ts");
const quest = read("components/screens/quest-hub-screen.tsx");
const sideNav = read("components/app/side-nav.tsx");
const questContext = read("lib/quest-context.ts");
const researchStore = read("store/research-store.ts");

test("매칭 탭 홈은 저장 상태에 따라 히어로의 제목과 주 행동을 바꾼다", () => {
  assert.match(hub, /전공과 관심 분야부터 가볍게 설정해 볼까요\?/);
  assert.match(hub, /연결 이유를 비교하고 첫 교수를 골라볼까요\?/);
  assert.match(hub, /교수님과 첫 대화를 준비해 볼까요\?/);
  assert.match(hub, /<JourneyStageHero[\s\S]*title=\{primary\.title\}[\s\S]*description=\{primary\.description\}/);
  assert.match(hub, /className=\{routeStyles\.heroPrimaryAction\}[\s\S]*\{primary\.cta\}/);
  assert.match(hub, /primary\.secondary/);
});

test("PC와 모바일의 매칭 탭은 설정 여부와 관계없이 전용 매칭 홈을 연다", () => {
  assert.match(sideNav, /href: "\/professors", section: "\/professors", label: "교수 매칭"/);
  assert.doesNotMatch(sideNav, /\/home\?professor=quick/);
  assert.doesNotMatch(sideNav, /function useProfessorTabHref/);
});

test("매칭 탭 홈은 선택 교수와 실제 첫 대화 준비 진행률을 함께 보여준다", () => {
  assert.match(hub, /useQuestStore/);
  assert.match(hub, /useQuestContext\(\{ includeFavoriteFallback: false, includePaperSelection: false \}\)/);
  assert.match(hub, /getJourneyProgress\(/);
  assert.match(hub, /첫 대화 준비 진행률/);
  assert.match(hub, /교수 선택/);
  assert.match(hub, /만나기 전/);
  assert.match(hub, /대화 중/);
  assert.match(hub, /만난 후/);
  assert.match(hub, /role="progressbar"/);
  assert.match(hub, /aria-valuenow=\{completedJourneySteps\}/);
});

test("새 일반 교수를 준비할 때 이전 논문 교수의 활성 맥락을 이어 쓰지 않는다", () => {
  assert.match(questContext, /includePaperSelection = true/);
  assert.match(questContext, /selectedProfessorPaper: includePaperSelection \? selectedProfessorPaper : null/);
  assert.match(hub, /const selectProfessorPaper = useResearchStore/);
  assert.match(hub, /onClick=\{\(\) => \{[\s\S]*selectProfessorPaper\(null\)/);
  assert.match(
    researchStore,
    /selectProfessor: \(selectedProfessorId\)[\s\S]*selectedProfessorPaper:[\s\S]*professorId === selectedProfessorId[\s\S]*\? state\.selectedProfessorPaper[\s\S]*: null/,
  );
});

test("매칭 탭은 다른 여정과 구분되는 어두운 도서관 히어로와 반응형 홈 레이아웃을 사용한다", () => {
  assert.match(theme, /match:[\s\S]*nyp-scene-home-student-thinking-16x9-v01\.png/);
  assert.match(theme, /match:[\s\S]*foreground: "#f8fbff"/);
  assert.match(styles, /\.matchHero/);
  assert.match(styles, /linear-gradient/);
  assert.match(styles, /\.progressPanel/);
  assert.match(styles, /@media \(min-width: 1280px\)[\s\S]*grid-template-areas/);
  assert.match(styles, /@media \(max-width: 640px\)[\s\S]*\.progressSteps/);
});

test("저장 보기는 저장 카드가 없어도 존재하는 목적지와 빈 상태를 연다", () => {
  const allTools = quest.slice(quest.indexOf("export function QuestAllToolsScreen"));
  assert.match(allTools, /id="saved-cards"/);
  assert.doesNotMatch(allTools, /\{cards\.length > 0 && \(\s*<div id="saved-cards">/);
  assert.match(allTools, /저장한 준비물이 아직 없어요/);
  assert.match(allTools, /준비 도구 살펴보기/);
});
