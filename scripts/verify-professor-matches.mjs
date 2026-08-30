#!/usr/bin/env node
import assert from "node:assert/strict";

const baseUrl = process.argv[2] ?? "http://127.0.0.1:3000";
const EXPECTED_POLICY = "OFFICIAL_EVIDENCE_RULES_V4";

async function requestMatches(topic, excludeIds = [], university = "단국대학교") {
  const response = await fetch(`${baseUrl}/api/professors/match`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ university, topic, excludeIds }),
  });
  assert.equal(response.status, 200, `${topic.id} API status`);
  assert.equal(
    response.headers.get("x-professor-match-policy"),
    EXPECTED_POLICY,
    `${topic.id} policy header`,
  );
  const payload = await response.json();
  assert.equal(payload.selectionPolicy, EXPECTED_POLICY, `${topic.id} policy`);
  return payload;
}

function assertDecisionContract(match, testCaseId) {
  assert.equal("score" in match, false, `${testCaseId} leaked score`);
  assert.equal("rank" in match, false, `${testCaseId} leaked rank`);
  assert.ok(Array.isArray(match.decisionBasis?.matchedConcepts));
  assert.equal(typeof match.decisionBasis?.departmentMatchesMajor, "boolean");
  assert.equal(typeof match.decisionBasis?.roleMatches?.topic, "boolean");
  assert.equal(typeof match.decisionBasis?.roleMatches?.method, "boolean");
  assert.equal(typeof match.decisionBasis?.roleMatches?.context, "boolean");
  assert.equal(typeof match.decisionBasis?.sources?.officialProfile, "boolean");
  assert.equal(typeof match.decisionBasis?.sources?.researchFields, "boolean");
  assert.equal(typeof match.decisionBasis?.sources?.matchedPublication, "boolean");
  assert.equal(match.decisionBasis.sources.officialProfile, true);
  assert.ok(
    match.decisionBasis.sources.researchFields
      || match.decisionBasis.sources.matchedPublication,
    `${testCaseId} match lacks official research evidence`,
  );
  assert.equal(typeof match.professor?.officialProfileUrl, "string");
  const officialEvidenceText = [
    match.professor.department,
    ...match.professor.researchFields,
    ...match.professor.publications.map((publication) => publication.title),
  ].join(" ").toLocaleLowerCase("ko-KR");
  for (const matchedTerm of match.matchedTerms) {
    assert.ok(
      officialEvidenceText.includes(matchedTerm.toLocaleLowerCase("ko-KR")),
      `${testCaseId} exposed internal concept as official evidence: ${matchedTerm}`,
    );
  }
}

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
      university: "단국대학교",
      goal: "대학원·연구실 탐색",
      meetingSituation: "오피스아워",
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
      university: "단국대학교",
      goal: "수업·연구 주제 탐색",
      meetingSituation: "수업 후 질문",
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
      university: "단국대학교",
      goal: "프로젝트·학부연구 참여",
      meetingSituation: "연구실 방문",
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
  {
    id: "research-evidence-context-boundary",
    topic: {
      id: "research-evidence-context-boundary",
      title: "AI 기반 대학생 연구 프로젝트",
      question: "AI 프로젝트를 학부연구로 발전시키려면 무엇을 확인해야 하는가",
      methodDetail: "머신러닝",
      scope: "학부 프로젝트",
      interests: ["AI·데이터"],
      methods: ["머신러닝"],
      major: "소프트웨어학",
      university: "단국대학교",
      goal: "프로젝트·학부연구 참여",
      meetingSituation: "오피스아워",
    },
    verify(matches) {
      const concepts = matches.flatMap(
        (match) => match.decisionBasis.matchedConcepts,
      );
      assert.ok(
        concepts.includes("프로젝트·실무 연결"),
        "research-project wording must participate in the evidence rules",
      );
      assert.equal(
        concepts.includes("교수와의 만남 상황"),
        false,
        "meetingSituation must not be treated as official research evidence",
      );
    },
  },
  {
    id: "dance-performance-project",
    topic: {
      id: "dance-performance-project",
      title: "무용 공연 데이터 프로젝트",
      question: "공연 데이터를 활용해 무용 관객 경험을 탐색할 수 있는가",
      methodDetail: "",
      scope: "학부 프로젝트",
      interests: ["예술·디자인", "공연 데이터"],
      methods: [],
      major: "무용학과",
      university: "단국대학교",
      goal: "프로젝트·학부연구 참여",
      meetingSituation: "연구실 방문",
    },
    verify(matches) {
      assert.deepEqual(
        matches.map((match) => match.role),
        ["TOPIC", "METHOD", "CONTEXT"],
        "sparse evidence must still return one honest card per role",
      );
      const limitedRole = matches.find((match) => match.strength === "LIMITED");
      if (limitedRole) {
        assert.match(
          limitedRole.reason,
          /직접 일치.+근거.+확인되지 않았습니다/,
          "fallback role must state its evidence limitation",
        );
      }
    },
  },
];

const results = [];
for (const testCase of cases) {
  const payload = await requestMatches(testCase.topic);
  assert.ok(payload.officialRecordCount >= 1_000, "full DKU runtime was not loaded");
  assert.equal(payload.matches.length, 3, `${testCase.id} match count`);
  assert.deepEqual(
    payload.matches.map((match) => match.role),
    ["TOPIC", "METHOD", "CONTEXT"],
    `${testCase.id} role contract`,
  );
  payload.matches.forEach((match) => assertDecisionContract(match, testCase.id));
  assert.equal(
    new Set(payload.matches.map((match) => match.professor.id)).size,
    payload.matches.length,
    `${testCase.id} duplicate professor`,
  );
  assert.ok(
    payload.matches.every((match) =>
      /^https:\/\/(?:[^/]+\.)?dankook\.ac\.kr\//.test(
        match.professor.officialProfileUrl,
      )),
    `${testCase.id} official source URL`,
  );
  const repeated = await requestMatches(testCase.topic);
  assert.ok(
    ["ai-reranked", "official-rules"].includes(repeated.rankingSource),
    `${testCase.id} repeated ranking source`,
  );
  assert.deepEqual(
    repeated.matches.map((match) => match.role),
    ["TOPIC", "METHOD", "CONTEXT"],
    `${testCase.id} repeated role contract`,
  );
  repeated.matches.forEach((match) => assertDecisionContract(match, testCase.id));
  if (
    payload.rankingSource === "official-rules"
    && repeated.rankingSource === "official-rules"
  ) {
    assert.deepEqual(
      repeated.matches.map(({ professor, decisionBasis, role, strength }) => ({
        professorId: professor.id,
        decisionBasis,
        role,
        strength,
      })),
      payload.matches.map(({ professor, decisionBasis, role, strength }) => ({
        professorId: professor.id,
        decisionBasis,
        role,
        strength,
      })),
      `${testCase.id} deterministic decision`,
    );
  }
  const excludedId = payload.matches[0].professor.id;
  const excluded = await requestMatches(testCase.topic, [excludedId]);
  assert.equal(
    excluded.matches.some((match) => match.professor.id === excludedId),
    false,
    `${testCase.id} excluded professor returned`,
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

for (const secondaryMajorType of ["부전공", "복수전공"]) {
  const topic = {
    id: `discovery:secondary-affiliation:${secondaryMajorType}`,
    title: "AI 데이터 진로 탐색",
    question: "경제학과 소프트웨어를 연결해 AI 데이터 진로를 어떻게 탐색할 수 있을까?",
    methodDetail: "",
    scope: "대학생 진로 탐색",
    interests: ["AI·데이터"],
    methods: [],
    major: "경제학과",
    university: "단국대학교",
    college: "경영경제대학",
    goal: "진로 방향 찾기",
    studentStage: "재학생",
    secondaryMajorType,
    secondaryCollege: "SW융합대학",
    secondaryMajor: "소프트웨어학과",
    careerInterests: ["데이터·AI 직무"],
  };
  const payload = await requestMatches(topic);
  assert.equal(payload.matches.length, 3, `${secondaryMajorType} match count`);
  const affiliationMatch = payload.matches[0];
  assert.equal(affiliationMatch.role, "CONTEXT", `${secondaryMajorType} first role`);
  assert.equal(
    affiliationMatch.decisionBasis.departmentMatchesMajor,
    true,
    `${secondaryMajorType} department match`,
  );
  assert.equal(
    affiliationMatch.decisionBasis.matchedAcademicAffiliation?.label,
    secondaryMajorType,
    `${secondaryMajorType} label`,
  );
  assert.equal(
    affiliationMatch.decisionBasis.matchedAcademicAffiliation?.major,
    "소프트웨어학과",
    `${secondaryMajorType} input major`,
  );
  assert.equal(
    affiliationMatch.decisionBasis.matchedAcademicAffiliation?.officialDepartment,
    "소프트웨어학과",
    `${secondaryMajorType} official department`,
  );
  assert.match(affiliationMatch.reason, new RegExp(secondaryMajorType));
  assert.equal(
    payload.matches.slice(1).some((match) => match.decisionBasis.departmentMatchesMajor),
    false,
    `${secondaryMajorType} external cards must stay outside declared affiliations`,
  );
  const repeated = await requestMatches(topic);
  assert.deepEqual(
    repeated.matches.map((match) => ({
      professorId: match.professor.id,
      affiliation: match.decisionBasis.matchedAcademicAffiliation ?? null,
    })),
    payload.matches.map((match) => ({
      professorId: match.professor.id,
      affiliation: match.decisionBasis.matchedAcademicAffiliation ?? null,
    })),
    `${secondaryMajorType} deterministic affiliation decision`,
  );
  results.push({
    topic: topic.id,
    scope_status: payload.scopeStatus,
    official_record_count: payload.officialRecordCount,
    matches: payload.matches.map((match) => ({
      name: match.professor.name,
      department: match.professor.department,
      role: match.role,
      strength: match.strength,
      academic_affiliation: match.decisionBasis.matchedAcademicAffiliation ?? null,
    })),
  });
}

const outOfScopeResponse = await fetch(`${baseUrl}/api/professors/match`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ university: "단국대아님", topic: cases[0].topic }),
});
assert.equal(outOfScopeResponse.status, 422, "non-DKU university must be out of scope");
const outOfScopePayload = await outOfScopeResponse.json();
assert.equal(outOfScopePayload.code, "UNIVERSITY_OUT_OF_SCOPE");
assert.equal("matches" in outOfScopePayload, false, "out-of-scope request leaked matches");

const missingUniversityResponse = await fetch(`${baseUrl}/api/professors/match`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ topic: { ...cases[0].topic, university: "" } }),
});
assert.equal(missingUniversityResponse.status, 400, "missing university must be rejected");
const missingUniversityPayload = await missingUniversityResponse.json();
assert.equal(missingUniversityPayload.code, "UNIVERSITY_REQUIRED");

console.log(JSON.stringify({ valid: true, results }, null, 2));
