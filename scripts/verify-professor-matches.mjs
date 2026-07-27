#!/usr/bin/env node
import assert from "node:assert/strict";

const baseUrl = process.argv[2] ?? "http://127.0.0.1:3000";
const cases = [
  {
    id: "consumer-value",
    topic: {
      id: "consumer-value",
      title: "친환경 식품 소비자 지불의사",
      question: "친환경 속성에 소비자가 얼마나 더 지불하려 하는가",
      methodDetail: "설문 설계와 회귀 분석",
      scope: "단국대 학생 소비자",
      interests: ["소비자 행동", "ESG", "식품 소비"],
      methods: ["설문", "회귀 분석"],
      major: "경제학",
    },
    verify(matches) {
      assert.ok(
        matches.some((match) =>
          match.professor.department.includes("식품자원경제학과")),
        "consumer-value topic must include a food-resource-economics professor",
      );
    },
  },
  {
    id: "food-price",
    topic: {
      id: "food-price",
      title: "농식품 가격 급등 조기경보",
      question: "날씨와 수급 변화가 농식품 가격 급등을 예측하는가",
      methodDetail: "시계열 분석과 지표 설계",
      scope: "국내 농식품 시장",
      interests: ["농식품 가격", "데이터 분석", "정책"],
      methods: ["시계열", "회귀 분석"],
      major: "경제학",
    },
    verify(matches) {
      assert.ok(
        matches[0].professor.department.includes("식품자원경제학과"),
        "food-price primary match must be a food-resource-economics professor",
      );
    },
  },
  {
    id: "greenwashing-ai",
    topic: {
      id: "greenwashing-ai",
      title: "그린워싱 문구 탐지 AI",
      question: "친환경 표시 문구의 과장 가능성을 텍스트로 분류할 수 있는가",
      methodDetail: "텍스트 분석과 분류 모델",
      scope: "온라인 식품 상품 설명",
      interests: ["AI", "텍스트 분석", "ESG"],
      methods: ["머신러닝", "분류"],
      major: "경제학",
    },
    verify(matches) {
      assert.ok(
        matches.some((match) => match.role === "METHOD"),
        "greenwashing-AI topic must include a method professor",
      );
      assert.ok(
        matches.some((match) =>
          match.professor.researchFields.some((field) =>
            /(?:AI|인공지능|머신러닝|텍스트)/i.test(field))),
        "greenwashing-AI match must expose official AI or text evidence",
      );
    },
  },
];

const results = [];
for (const testCase of cases) {
  const response = await fetch(`${baseUrl}/api/professors/match`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ topic: testCase.topic }),
  });
  assert.equal(response.status, 200, `${testCase.id} API status`);
  const payload = await response.json();
  assert.ok(payload.officialRecordCount >= 1_000, "full DKU runtime was not loaded");
  assert.equal(payload.matches.length, 2, `${testCase.id} match count`);
  assert.notEqual(
    payload.matches[0].professor.id,
    payload.matches[1].professor.id,
    `${testCase.id} duplicate professor`,
  );
  assert.ok(
    payload.matches.every((match) =>
      /^https:\/\/(?:[^/]+\.)?dankook\.ac\.kr\//.test(
        match.professor.officialProfileUrl,
      )),
    `${testCase.id} official source URL`,
  );
  try {
    testCase.verify(payload.matches);
  } catch (error) {
    console.error(
      JSON.stringify(
        {
          failed_topic: testCase.id,
          matches: payload.matches.map((match) => ({
            name: match.professor.name,
            department: match.professor.department,
            role: match.role,
            strength: match.strength,
            research_fields: match.professor.researchFields,
            matched_terms: match.matchedTerms,
          })),
        },
        null,
        2,
      ),
    );
    throw error;
  }
  results.push({
    topic: testCase.id,
    scope_status: payload.scopeStatus,
    official_record_count: payload.officialRecordCount,
    matches: payload.matches.map((match) => ({
      name: match.professor.name,
      department: match.professor.department,
      role: match.role,
      strength: match.strength,
      matched_terms: match.matchedTerms,
    })),
  });
}

console.log(JSON.stringify({ valid: true, results }, null, 2));
