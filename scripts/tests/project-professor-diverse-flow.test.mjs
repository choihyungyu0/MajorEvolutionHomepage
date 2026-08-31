import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

test("프로젝트 교수 추천은 수치 분석과 문서 텍스트 후보의 직접 근거를 구분한다", () => {
  const data = read("lib/professor-data.server.ts");
  assert.match(data, /label: "AI·머신러닝"[\s\S]*label: "텍스트·자연어 분석"/);
  assert.match(data, /"etf",[\s\S]*"포트폴리오",[\s\S]*"자본시장",[\s\S]*"공시"/);
  assert.match(data, /"텍스트 분석",[\s\S]*"텍스트 분류",[\s\S]*"토픽 모델링"/);
  assert.match(data, /topicTerms: \["설문", "회귀", "통계", "정량", "정량적", "측정"/);
  assert.match(data, /"유형별",[\s\S]*"만들고",[\s\S]*"특성",[\s\S]*"프로토타입",[\s\S]*"의사결정"/);
});

test("프로젝트 교수 추천은 공식 후보 안에서 역할별 한 명과 중복 없는 교수를 유지한다", () => {
  const route = read("app/api/professors/match/route.ts");
  const server = read("lib/openai-server.ts");
  const matcher = read("lib/professor-data.server.ts");
  const store = read("store/research-store.ts");

  assert.match(route, /getOfficialProfessorRoleCandidates\(topic/);
  assert.match(route, /rerankProfessorMentors\(topic, roleCandidates\)/);
  assert.match(server, /TOPIC, METHOD, CONTEXT 역할에서 각각 정확히 한 명/);
  assert.match(server, /completeProfessorMentorSelections\(selected, candidates\)/);
  assert.match(server, /TOPIC은 결과물 형식이나 일반적인 의사결정 표현보다/);
  assert.match(server, /METHOD는 methodDetail과 methods에 적힌/);
  assert.match(server, /CONTEXT는 scope, major, interests에 적힌/);
  assert.match(matcher, /for \(const role of \["TOPIC", "METHOD", "CONTEXT"\] as const\)/);
  assert.match(matcher, /projectUsedIds\.has\(item\.match\.professor\.id\)/);
  assert.match(store, /projectProfessorMatches: response\.matches/);
  assert.match(store, /response\.topicId !== state\.selectedTopicId/);
});
