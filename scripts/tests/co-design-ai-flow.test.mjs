import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

test("공동설계는 공통 3문항 뒤 API 맞춤 질문 2문항으로 이어진다", async () => {
  const [data, screen, route] = await Promise.all([
    read("data/co-design.ts"),
    read("components/screens/co-design-screen.tsx"),
    read("app/api/ai/co-design/questions/route.ts"),
  ]);

  assert.match(data, /CO_DESIGN_BASE_QUESTION_COUNT = 3/);
  assert.match(data, /CO_DESIGN_TOTAL_QUESTION_COUNT = 5/);
  assert.match(data, /id: "adaptive-1"/);
  assert.match(data, /id: "adaptive-2"/);
  assert.match(screen, /requestCoDesignFollowUpQuestions/);
  assert.match(screen, /step === CO_DESIGN_BASE_QUESTION_COUNT - 1/);
  assert.match(screen, /setFollowUpQuestions\(response\.questions, "ai"\)/);
  assert.match(screen, /setFollowUpQuestions\(DEFAULT_FOLLOW_UP_QUESTIONS, "fallback"\)/);
  assert.match(route, /generateCoDesignFollowUpQuestions/);
});

test("공동설계 화면은 탐색 방식별 테마와 전용 배경 자산을 사용한다", async () => {
  const screen = await read("components/screens/co-design-screen.tsx");
  const styles = await read("app/globals.css");

  assert.match(screen, /co-design-mode-\$\{ideaMode\}/);
  assert.match(styles, /nyp-co-design-canvas-1600x1000-v01\.webp/);
  assert.match(styles, /\.co-design-mode-free/);
  assert.match(styles, /\.co-design-mode-trend/);
  assert.match(styles, /\.co-design-mode-fusion/);
  assert.match(styles, /--co-mode-accent/);
});

test("첫 공동설계 화면은 답변 평가가 아니라 AI의 역할과 답변 방법을 먼저 안내한다", async () => {
  const screen = await read("components/screens/co-design-screen.tsx");

  assert.match(screen, /반가워요, \{conditions\.major \?\? "전공"\}에서 시작해 볼게요/);
  assert.match(screen, /첫 질문에는 정답이 없으니/);
  assert.match(screen, /오른쪽 제안 중 가장 가까운 방향을 고르거나/);
  assert.doesNotMatch(screen, /좋은 질문이에요/);
});

test("후보 생성은 공통·맞춤 질문 ID 다섯 개를 모두 요구한다", async () => {
  const [data, server] = await Promise.all([
    read("data/co-design.ts"),
    read("lib/openai-server.ts"),
  ]);

  assert.match(data, /expectedCoDesignQuestionIds/);
  assert.match(server, /expectedQuestionIds = expectedCoDesignQuestionIds/);
  assert.match(server, /answers\.length !== expectedQuestionIds\.length/);
});

test("프로젝트 교수 연결만 공식 후보 안에서 AI 재정렬한다", async () => {
  const [route, server, data] = await Promise.all([
    read("app/api/professors/match/route.ts"),
    read("lib/openai-server.ts"),
    read("lib/professor-data.server.ts"),
  ]);

  assert.match(data, /getOfficialProfessorRoleCandidates/);
  assert.match(route, /!topic\.id\.startsWith\("discovery:"\)/);
  assert.match(route, /!topic\.id\.startsWith\("context:"\)/);
  assert.match(route, /rerankProfessorMentors\(topic, roleCandidates\)/);
  assert.match(server, /제공된 candidateKey만 고르세요/);
  assert.match(server, /completeProfessorMentorSelections\(selected, candidates\)/);
});
