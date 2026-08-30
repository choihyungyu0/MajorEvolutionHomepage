import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (relativePath) => readFileSync(
  new URL(`../../${relativePath}`, import.meta.url),
  "utf8",
);

const researchStore = read("store/research-store.ts");
const questRouter = read("components/screens/quest-router.tsx");
const questHub = read("components/screens/quest-hub-screen.tsx");
const questContext = read("lib/quest-context.ts");
const knockKit = read("components/screens/official-knock-kit.tsx");
const coDesign = read("components/screens/co-design-screen.tsx");
const researchTutorial = read("components/tutorial/research-tutorial-screen.tsx");
const researchCondition = read("components/screens/research-condition.tsx");
const researchResult = read("components/screens/research-result.tsx");
const aiProfessor = read("components/screens/ai-professor-screen.tsx");
const projectProfessorHub = read("components/screens/project-professor-hub-screen.tsx");
const globalStyles = read("app/globals.css");
const brandLogoStyles = read("components/brand/brand-logo.module.css");
const paperReaderShell = read("components/paper-reader/paper-reader-shell.tsx");
const paperReadingSteps = read("components/paper-reader/paper-reading-steps.tsx");

test("같은 프로젝트 탐색 방식과 같은 후보를 다시 선택해도 하위 진행 상태를 지우지 않는다", () => {
  assert.match(
    researchStore,
    /setIdeaMode:\s*\(ideaMode\)\s*=>\s*set\(\(state\)\s*=>[\s\S]*state\.ideaMode === ideaMode\s*\? state/,
  );
  assert.match(
    researchStore,
    /selectTopic:\s*\(id\)\s*=>\s*set\(\(state\)\s*=>[\s\S]*state\.selectedTopicId === id\s*\? state/,
  );
  const selectHandler = researchResult.slice(researchResult.indexOf("const onSelectTopic"));
  assert.match(selectHandler, /if \(selectedTopicId === id\) return;[\s\S]*professorRequestRef\.current\?\.abort\(\)/);
});

test("즐겨찾기 교수로 시작한 논문·첫 질문 흐름도 이메일 맥락을 복원한다", () => {
  assert.match(questRouter, /const context = getOfficialQuestContext\(\);/);
  assert.doesNotMatch(questRouter, /const hasSelectedProfessor/);
  assert.doesNotMatch(questRouter, /selectedProfessorId && matches\.some/);
  assert.match(questHub, /const \{ topic, match: selectedProfessorMatch \} = useQuestContext\(\);/);
  assert.doesNotMatch(questHub, /includeFavoriteFallback: false/);
  assert.match(questContext, /resolveQuestProfessorContextMatch/);
  assert.match(questContext, /createProfessorPaperQuestTopic/);
  assert.match(knockKit, /resolveQuestProfessorContextMatch/);
  assert.match(knockKit, /createProfessorPaperQuestTopic/);
});

test("공동설계 이전 버튼은 히스토리 함정을 만들지 않고 프로젝트 홈으로 교체 이동한다", () => {
  assert.match(coDesign, /router\.replace\("\/research"\)/);
  assert.doesNotMatch(coDesign, /onBack=\{\(\) => router\.push\("\/research"\)\}/);
});

test("완료한 프로젝트 설계 단계는 교체 이동해 브라우저 뒤로가기 루프를 만들지 않는다", () => {
  assert.match(researchTutorial, /router\.replace\("\/co-design"\)/);
  assert.match(researchCondition, /router\.replace\("\/co-design"\)/);
  assert.match(coDesign, /router\.replace\("\/result"\)/);
  assert.match(researchResult, /if \(view === "summary"\) router\.replace\(primaryAction\.href \?\? "\/result\/compare"\)/);
});

test("AI 교수님 보기 탭은 URL과 동기화되어 새로고침·브라우저 뒤로가기를 보존한다", () => {
  assert.match(aiProfessor, /window\.history\.pushState/);
  assert.match(aiProfessor, /popstate/);
  assert.match(aiProfessor, /role="tablist"/);
  assert.match(aiProfessor, /aria-selected=/);
  assert.match(aiProfessor, /onBackToChat=\{\(\) => changeViewMode\("chat"\)\}/);
  assert.match(aiProfessor, /onStartBranch=[\s\S]*changeViewMode\("chat"\)/);
});

test("선택된 프로젝트 교수 버튼은 보조기기에도 선택 상태를 전달한다", () => {
  assert.match(projectProfessorHub, /aria-pressed=\{selected\}/);
  assert.match(projectProfessorHub, /disabled=\{selectionButton\.disabled\}/);
});

test("공통 내비게이션의 작은 안내 문구도 AA 대비를 확보하는 진한 토큰을 사용한다", () => {
  assert.match(globalStyles, /side-nav__profile-copy small \{ color: var\(--text-secondary\)/);
  assert.match(globalStyles, /side-nav__journey-label \{[\s\S]*color: #5b479d/);
  assert.match(globalStyles, /side-nav__journey-item--professor \.side-nav__journey-label \{[\s\S]*color: #176b5e/);
  assert.match(globalStyles, /side-nav__journey-step \{[\s\S]*color: #625686/);
  assert.match(brandLogoStyles, /\.copy small \{[\s\S]*color: #56647d/);
  assert.match(brandLogoStyles, /\.wordmark em \{[\s\S]*color: #127363/);
  assert.match(aiProfessor, /className=\{styles\.promptSuggestions\} role="group" aria-label="이어갈 대화 예시"/);
});

test("편집한 논문 카드는 저장하기 전 다른 단계로 이동해 유실되지 않는다", () => {
  const nextStep = paperReaderShell.slice(paperReaderShell.indexOf("function PaperPdfNextStep"));
  assert.match(nextStep, /\{ready \? \([\s\S]*FIRST_QUESTION_FROM_PAPER_HREF/);
  assert.match(nextStep, /첫 질문은 카드 저장 후 이용/);
  assert.match(paperReaderShell, /const hasUnsavedDraft = Boolean\(analysis && draft && !isSaved\)/);
  assert.match(paperReaderShell, /<PaperReadingSteps current=\{2\} navigationLocked=\{hasUnsavedDraft\}/);
  assert.match(paperReaderShell, /onBack=\{\(\) => discardAndNavigate\("\/quest"\)\}/);
  assert.match(paperReaderShell, /onChange=\{openPaperPicker\}/);
  assert.match(paperReaderShell, /if \(!confirmDiscardUnsavedDraft\(\)\) return;/);
  assert.match(paperReaderShell, /PAPER_BITE_WORKING_DRAFT_STORAGE_KEY/);
  assert.match(paperReaderShell, /window\.sessionStorage\.setItem/);
  assert.match(paperReaderShell, /window\.sessionStorage\.getItem/);
  assert.match(paperReaderShell, /setFeedback\("저장하지 않은 논문 카드 수정 내용을 복원했어요\."\)/);
  assert.match(paperReaderShell, /if \(analysis && draft\) \{[\s\S]*paperContentAbortControllerRef\.current\?\.abort\(\)/);
  assert.match(paperReadingSteps, /navigationLocked/);
  assert.match(paperReadingSteps, /aria-disabled="true"/);
});
