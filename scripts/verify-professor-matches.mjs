#!/usr/bin/env node
import assert from "node:assert/strict";

const baseUrl = process.argv[2] ?? "http://127.0.0.1:3000";
const EXPECTED_POLICY = "OFFICIAL_EVIDENCE_RULES_V8";

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
      id: "discovery:consumer-value",
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
      const topicMatch = matches.find((match) => match.role === "TOPIC");
      assert.ok(
        topicMatch?.matchedTerms.some((term) => /소비|행동|지불의사|마케팅/.test(term)),
        "consumer-value TOPIC must expose consumer evidence",
      );
    },
  },
  {
    id: "food-price",
    topic: {
      id: "discovery:food-price",
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
        matches.some((match) => match.professor.department.includes("식품자원경제학과")),
        "food-price matches must include a food-resource-economics professor",
      );
    },
  },
  {
    id: "greenwashing-ai",
    topic: {
      id: "discovery:greenwashing-ai",
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
      id: "discovery:research-evidence-context-boundary",
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
      id: "discovery:dance-performance-project",
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
        ["CONTEXT", "TOPIC", "METHOD"],
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
function recommendationSignature(payload) {
  return payload.matches.map((match) => ({
    professorId: match.professor.id,
    role: match.role,
    strength: match.strength,
  }));
}

async function assertStableRecommendations(topic, payload, label) {
  const repeated = await requestMatches(topic);
  assert.deepEqual(
    recommendationSignature(repeated),
    recommendationSignature(payload),
    `${label} repeated result`,
  );
  const reordered = await requestMatches({
    ...topic,
    interests: [...topic.interests].reverse(),
    methods: [...topic.methods].reverse(),
  });
  assert.deepEqual(
    recommendationSignature(reordered),
    recommendationSignature(payload),
    `${label} input-order independence`,
  );
  for (const match of payload.matches) {
    const excluded = await requestMatches(topic, [match.professor.id]);
    assert.equal(
      excluded.matches.some((candidate) => candidate.professor.id === match.professor.id),
      false,
      `${label} excluded professor ${match.professor.id}`,
    );
  }
}

for (const testCase of cases) {
  const payload = await requestMatches(testCase.topic);
  assert.ok(payload.officialRecordCount >= 1_000, "full DKU runtime was not loaded");
  assert.equal(payload.matches.length, 3, `${testCase.id} match count`);
  assert.deepEqual(
    payload.matches.map((match) => match.role),
    ["CONTEXT", "TOPIC", "METHOD"],
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
    ["CONTEXT", "TOPIC", "METHOD"],
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
    `${secondaryMajorType} can occupy the academic-affiliation slot after deep input`,
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
    new Set(payload.matches.map((match) => match.professor.id)).size,
    payload.matches.length,
    `${secondaryMajorType} does not duplicate a professor across roles`,
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



const sameDepartmentEligibilityCases = [{
  id: "discovery:economics-specific-current",
  title: "에너지자원경제와 탄소가격 예측",
  interests: ["경제·금융", "환경·ESG", "에너지자원경제", "탄소가격"],
  methods: ["금융계량경제", "경제예측"],
  methodDetail: "금융계량경제와 경제예측",
  major: "경제학과",
  college: "경영경제대학",
  expectedRoles: {
    TOPIC: ["에너지자원경제", "탄소가격"],
    METHOD: ["금융계량경제", "경제예측"],
  },
}];

for (const testCase of sameDepartmentEligibilityCases) {
  const topic = {
    ...testCase,
    question: "관심 분야에 맞는 교수님을 찾고 싶어요",
    scope: "",
    university: "단국대학교",
    goal: "진로 방향 찾기",
    studentStage: "재학생",
  };
  const payload = await requestMatches(topic);
  assert.deepEqual(
    payload.matches.map((match) => match.role),
    ["CONTEXT", "TOPIC", "METHOD"],
    `${testCase.id} role order`,
  );
  assert.equal(
    new Set(payload.matches.map((match) => match.professor.id)).size,
    3,
    `${testCase.id} unique professors`,
  );
  const homeMatch = payload.matches[0];
  assert.equal(
    homeMatch.decisionBasis.matchedAcademicAffiliation?.label,
    "주전공",
    `${testCase.id} primary-major home slot`,
  );
  for (const [expectedRole, expectedTerms] of Object.entries(testCase.expectedRoles)) {
    const sameDepartmentRole = payload.matches.find(
      (match) => match.role === expectedRole,
    );
    assert.ok(sameDepartmentRole, `${testCase.id} ${expectedRole} exists`);
    assert.equal(
      sameDepartmentRole.decisionBasis.departmentMatchesMajor,
      true,
      `${testCase.id} permits the strongest same-department ${expectedRole} candidate`,
    );
    assert.equal(
      sameDepartmentRole.decisionBasis.roleMatches[expectedRole.toLocaleLowerCase("en-US")],
      true,
      `${testCase.id} same-department candidate has direct ${expectedRole} evidence`,
    );
    assert.ok(
      expectedTerms.some((term) => sameDepartmentRole.matchedTerms.includes(term)),
      `${testCase.id} ${expectedRole} exposes specific official evidence`,
    );
  }
  await assertStableRecommendations(topic, payload, testCase.id);
  results.push({
    topic: topic.id,
    scope_status: payload.scopeStatus,
    official_record_count: payload.officialRecordCount,
    same_department_roles: Object.keys(testCase.expectedRoles),
    matches: payload.matches.map((match) => ({
      name: match.professor.name,
      department: match.professor.department,
      role: match.role,
      strength: match.strength,
      matched_terms: match.matchedTerms,
    })),
  });
}

const malwareExpertTopic = {
  id: "discovery:malware-specific-current",
  title: "기계학습 기반 멀웨어 탐지",
  question: "관심 분야에 맞는 교수님을 찾고 싶어요",
  scope: "",
  interests: ["SW·보안", "AI·데이터", "멀웨어 탐지"],
  methods: ["머신러닝", "분류"],
  methodDetail: "머신러닝 분류",
  major: "소프트웨어학과",
  college: "SW융합대학",
  university: "단국대학교",
  goal: "진로 방향 찾기",
  studentStage: "재학생",
};
const malwareExpertPayload = await requestMatches(malwareExpertTopic);
const malwareTopicMatch = malwareExpertPayload.matches.find((match) => match.role === "TOPIC");
assert.equal(malwareTopicMatch?.professor.name, "조성제", "malware TOPIC expert");
assert.ok(
  malwareTopicMatch.matchedTerms.some((term) => ["기계학습", "멀웨어", "탐지"].includes(term)),
  "malware TOPIC exposes specific official evidence",
);
assert.equal(
  new Set(malwareExpertPayload.matches.map((match) => match.professor.id)).size,
  3,
  "malware expert result has unique professors",
);
await assertStableRecommendations(
  malwareExpertTopic,
  malwareExpertPayload,
  malwareExpertTopic.id,
);
results.push({
  topic: malwareExpertTopic.id,
  scope_status: malwareExpertPayload.scopeStatus,
  official_record_count: malwareExpertPayload.officialRecordCount,
  matches: malwareExpertPayload.matches.map((match) => ({
    name: match.professor.name,
    department: match.professor.department,
    role: match.role,
    strength: match.strength,
    matched_terms: match.matchedTerms,
  })),
});

const deepInputBase = {
  id: "discovery:deep-input-base",
  title: "AI·데이터",
  question: "관심 분야에 맞는 교수님을 찾고 싶어요",
  scope: "",
  interests: ["AI·데이터"],
  methods: [],
  methodDetail: "",
  major: "식품자원경제학과",
  college: "공공인재대학",
  university: "단국대학교",
  goal: "진로 방향 찾기",
  studentStage: "재학생",
  preferredSupport: "",
  experience: "",
  meetingSituation: "연구실 방문",
};
const deepBasePayload = await requestMatches(deepInputBase);
const supportPayload = await requestMatches({
  ...deepInputBase,
  id: "discovery:deep-input-support",
  preferredSupport: "프로젝트·연구에 참여하고 싶어요",
});
assert.notDeepEqual(
  supportPayload.matches.map((match) => match.professor.id),
  deepBasePayload.matches.map((match) => match.professor.id),
  "preferred support changes the evidence-based candidate set",
);
assert.ok(
  supportPayload.matches.some((match) =>
    match.decisionBasis.matchedConcepts.includes("프로젝트·실무 연결")),
  "preferred support activates the project conversation context",
);
const experiencePayload = await requestMatches({
  ...deepInputBase,
  id: "discovery:deep-input-experience",
  experience: "농산물 거래자료와 사진을 활용한 가격 예측 AI 프로젝트를 준비하고 있어요. Python으로 데이터 분석을 해봤어요.",
});
const experienceTopicMatch = experiencePayload.matches.find((match) => match.role === "TOPIC");
assert.ok(
  experienceTopicMatch?.professor.department.includes("식품자원경제학과"),
  "experience steers TOPIC toward official agricultural-market evidence",
);
assert.ok(
  experienceTopicMatch.matchedTerms.some((term) => /농식품|식품|농산물|가격/.test(term)),
  "experience exposes the official topic evidence it activated",
);
const screenDeepPayload = await requestMatches({
  ...deepInputBase,
  id: "discovery:screen-deep-input",
  title: "농산물의 외관 정보가 실제 낙찰가격에 얼마나 영향을 주는지 알아보고 싶어요.",
  interests: ["AI·데이터", "경제·금융", "환경·ESG"],
  careerInterests: ["데이터·AI 직무", "서비스기획·PM", "연구개발·실험"],
  preferredSupport: "프로젝트·연구에 참여하고 싶어요",
  experience: "농산물 거래자료와 사진을 활용한 가격 예측 AI 프로젝트를 준비하고 있어요. Python으로 간단한 데이터 분석과 시각화를 해봤어요.",
});
const screenDeepTopicMatch = screenDeepPayload.matches.find((match) => match.role === "TOPIC");
assert.ok(
  screenDeepTopicMatch?.professor.department.includes("식품자원경제학과"),
  "screen deep input avoids substring false positives and keeps agricultural evidence",
);
assert.ok(
  screenDeepTopicMatch.matchedTerms.some((term) => /농식품|식품|농산물|가격/.test(term)),
  "screen deep input explains the agricultural-market match",
);
const producePhotoPricePayload = await requestMatches({
  ...deepInputBase,
  id: "discovery:produce-photo-price",
  title: "농산물 거래자료와 사진을 활용한 가격 예측 AI 프로젝트를 준비",
  interests: ["AI·데이터", "경제·금융", "푸드테크", "도매시장", "식품·농업"],
  major: "통계데이터사이언스학과",
  college: "SW융합대학",
  secondaryMajorType: "복수전공",
  secondaryCollege: "공공인재대학",
  secondaryMajor: "식품자원경제학과",
  careerInterests: ["데이터·AI 직무", "서비스기획·PM", "연구개발·실험"],
  careerConcerns: ["아직 잘 모르겠어요"],
  careerGoal: "아직 탐색 중",
  preferredSupport: "프로젝트·연구에 참여하고 싶어요",
  experience: "파이썬 기반 데이터분석이 가능합니다.",
});
const producePhotoPriceTopicMatch = producePhotoPricePayload.matches.find(
  (match) => match.role === "TOPIC",
);
assert.equal(
  producePhotoPriceTopicMatch?.professor.name,
  "양성범",
  "a short photo term must not outrank richer official food-price evidence",
);
assert.ok(
  producePhotoPriceTopicMatch.matchedTerms.some((term) => /농식품|식품|가격|유통|무역/.test(term)),
  "produce photo-price topic exposes agricultural price or distribution evidence",
);
const differentMeetingPayload = await requestMatches({
  ...deepInputBase,
  id: "discovery:deep-input-meeting-boundary",
  meetingSituation: "이메일",
});
assert.deepEqual(
  differentMeetingPayload.matches.map((match) => match.professor.id),
  deepBasePayload.matches.map((match) => match.professor.id),
  "meeting situation personalizes preparation but does not claim professor fit",
);
results.push({
  topic: "deep-input-influence",
  support_matches: supportPayload.matches.map((match) => match.professor.name),
  experience_matches: experiencePayload.matches.map((match) => match.professor.name),
  screen_deep_matches: screenDeepPayload.matches.map((match) => match.professor.name),
  meeting_boundary_verified: true,
});

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
