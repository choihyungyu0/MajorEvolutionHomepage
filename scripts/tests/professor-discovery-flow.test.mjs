import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(testDirectory, "../..");
const runtimeDirectory = fs.mkdtempSync(path.join(testDirectory, ".professor-discovery-runtime-"));

function compileCommonJs(sourceRelativePath, outputName) {
  const source = fs.readFileSync(path.join(repositoryRoot, sourceRelativePath), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
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
  return outputPath;
}

const taxonomyModule = require(
  compileCommonJs("lib/professor-academic-taxonomy.ts", "professor-academic-taxonomy.cjs"),
);
const discoveryModule = require(
  compileCommonJs("lib/professor-discovery-model.ts", "professor-discovery-model.cjs"),
);
const evidenceModule = require(
  compileCommonJs("lib/professor-match-evidence.ts", "professor-match-evidence.cjs"),
);
const pitchModule = require(
  compileCommonJs("lib/professor-pitch.ts", "professor-pitch.cjs"),
);

after(() => fs.rmSync(runtimeDirectory, { recursive: true, force: true }));

test("공식 교수 데이터에서 안전한 단과대-학과 관계만 만든다", () => {
  const runtime = JSON.parse(fs.readFileSync(
    path.join(repositoryRoot, "data/professors/runtime/dku-professors.json"),
    "utf8",
  ));
  const taxonomy = taxonomyModule.buildProfessorAcademicTaxonomy(
    runtime.records.map((record) => ({
      college: record.college,
      departments: record.departments,
    })),
    runtime.official_record_count,
    runtime.coverage_gaps.map((gap) => gap.department),
  );

  assert.equal(taxonomy.officialProfessorCount, 1_051);
  assert.equal(taxonomy.colleges.length, 20);
  assert.equal(taxonomyModule.countMappedDepartments(taxonomy), 111);
  assert.deepEqual(
    taxonomy.unmappedDepartments,
    ["골프전공", "동물생명공학전공", "연기영상예술학과", "한국학과"],
  );
  assert.ok(taxonomy.colleges.some((college) => college.name === "음악·예술대학"));
  assert.ok(taxonomy.colleges.every((college) => !college.name.includes(" · ")));
});

test("서비스 런타임 교수 데이터는 1,051명과 공식 출처 무결성을 유지한다", () => {
  const runtime = JSON.parse(fs.readFileSync(
    path.join(repositoryRoot, "data/professors/runtime/dku-professors.json"),
    "utf8",
  ));
  assert.equal(runtime.schema_version, "1.0.0");
  assert.equal(runtime.official_record_count, 1_051);
  assert.equal(runtime.records.length, runtime.official_record_count);
  assert.equal(new Set(runtime.records.map((record) => record.id)).size, runtime.records.length);
  assert.ok(runtime.records.every((record) => record.university === "단국대학교"));
  assert.ok(runtime.records.every((record) => record.name && record.department));
  assert.ok(runtime.records.every((record) => /^https:\/\//.test(record.official_profile_url)));
  assert.ok(runtime.records.every((record) => /^https:\/\//.test(record.source_url)));
  assert.ok(runtime.records.every((record) => record.publication_count >= record.publications.length));
  assert.ok(runtime.records.every((record) => record.publications.every(
    (publication) => publication.official_profile_url === record.official_profile_url,
  )));
});

test("일반 전공명은 유일한 공식 학과로 보정하고 중복 학과는 추측하지 않는다", () => {
  const taxonomy = taxonomyModule.buildProfessorAcademicTaxonomy([
    { college: "경영경제대학", departments: ["경제학과"] },
    { college: "사회과학대학", departments: ["정치외교학과"] },
  ], 2);
  assert.deepEqual(
    taxonomyModule.findAcademicSelection(taxonomy, "경제학"),
    { college: "경영경제대학", department: "경제학과" },
  );

  const ambiguous = taxonomyModule.buildProfessorAcademicTaxonomy([
    { college: "가대학", departments: ["융합학과"] },
    { college: "나대학", departments: ["융합학과"] },
  ], 2);
  assert.equal(taxonomyModule.findAcademicSelection(ambiguous, "융합학"), null);
});

test("같은 학과 판정은 부분 문자열이 아니라 공식 학과명 단위로 비교한다", () => {
  assert.equal(
    taxonomyModule.comparableDepartmentName("경제학"),
    taxonomyModule.comparableDepartmentName("경제학과"),
  );
  assert.notEqual(
    taxonomyModule.comparableDepartmentName("경제학과"),
    taxonomyModule.comparableDepartmentName("식품자원경제학과"),
  );
  assert.notEqual(
    taxonomyModule.comparableDepartmentName("행정학과"),
    taxonomyModule.comparableDepartmentName("보건행정학과"),
  );
});

test("기본 질문과 부전공 무결성을 검증한다", () => {
  const valid = {
    ...discoveryModule.EMPTY_PROFESSOR_DISCOVERY_CONTEXT,
    university: "단국대학교",
    college: "경영경제대학",
    major: "경제학과",
    studentStage: "취업을 준비하는 중",
    goal: "취업·직무 조언 받기",
    interests: ["경제·금융"],
    careerConcerns: ["취업시장·전망"],
  };
  assert.equal(discoveryModule.validateProfessorDiscoveryBasics(valid), null);
  assert.equal(discoveryModule.validateProfessorDiscoverySecondary(valid), null);

  const sameSecondary = {
    ...valid,
    secondaryMajorType: "부전공",
    secondaryMajor: "경제학과",
  };
  assert.match(
    discoveryModule.validateProfessorDiscoverySecondary(sameSecondary),
    /주전공과 다른/,
  );
  assert.deepEqual(
    discoveryModule.toggleLimitedValue(["A", "B"], "C", 2),
    ["A", "B"],
  );
});

test("빠른 교수 매칭은 전공과 관심 분야만으로 기본 설정을 완료한다", () => {
  const minimalSetup = {
    ...discoveryModule.EMPTY_PROFESSOR_DISCOVERY_CONTEXT,
    university: "단국대학교",
    college: "SW융합대학",
    major: "소프트웨어학과",
    interests: ["AI·데이터"],
  };

  assert.equal(discoveryModule.validateProfessorDiscoverySetup(minimalSetup), null);
  assert.equal(
    discoveryModule.validateProfessorDiscoveryBasics(minimalSetup)?.field,
    "studentStage",
    "상세 교수 찾기 폼의 기존 엄격한 검증은 유지해야 한다",
  );

  const withoutInterest = { ...minimalSetup, interests: [] };
  assert.equal(
    discoveryModule.validateProfessorDiscoverySetup(withoutInterest)?.field,
    "interests",
  );

  const topic = discoveryModule.discoveryContextToMatchTopic(minimalSetup, null);
  assert.equal(topic.title, "AI·데이터");
  assert.equal(topic.major, "소프트웨어학과");
  assert.ok(topic.id);
  assert.ok(topic.question);
});

test("교수 매칭 튜토리얼은 최소 설정 뒤 확인 화면으로 이어진다", () => {
  const source = fs.readFileSync(
    path.join(repositoryRoot, "components/tutorial/professor-tutorial-screen.tsx"),
    "utf8",
  );
  const directFormSource = fs.readFileSync(
    path.join(repositoryRoot, "components/screens/official-professor-screens.tsx"),
    "utf8",
  );

  assert.match(source, /const SETUP_STEPS = \["academic", "interests"\] as const;/);
  assert.deepEqual(discoveryModule.PRESENTATION_PROFESSOR_DEFAULTS, {
    college: "SW융합대학",
    major: "통계데이터사이언스학과",
    interests: ["AI·데이터", "경제·금융", "SW·보안", "경영·마케팅", "환경·ESG"],
  });
  assert.match(source, /college: PRESENTATION_PROFESSOR_DEFAULTS\.college/);
  assert.match(source, /major: PRESENTATION_PROFESSOR_DEFAULTS\.major/);
  assert.match(source, /interests: \[\.\.\.PRESENTATION_PROFESSOR_DEFAULTS\.interests\]/);
  assert.match(directFormSource, /college: PRESENTATION_PROFESSOR_DEFAULTS\.college/);
  assert.match(directFormSource, /major: PRESENTATION_PROFESSOR_DEFAULTS\.major/);
  assert.match(directFormSource, /interests: \[\.\.\.PRESENTATION_PROFESSOR_DEFAULTS\.interests\]/);
  assert.match(source, /title: "이제 교수님을 찾으러 가볼까요\?"/);
  assert.match(source, />교수님 찾기 <ArrowRight/);
  assert.match(source, /const profileState = useProfileStore\.getState\(\);/);
  assert.match(source, /school: context\.university/);
  assert.match(source, /major: context\.major/);
  assert.match(source, /interests: context\.interests/);
  assert.match(source, /name: profileState\.profile\.name/);
  assert.match(source, /careerConcern: profileState\.profile\.careerConcern/);
  assert.match(source, /profileState\.completeProfessorTutorial\(\);/);
  assert.ok(
    source.indexOf("profileState.completeProfessorTutorial();")
      < source.indexOf('router.push("/professors/pitch")'),
    "교수 피칭으로 이동하기 전에 튜토리얼 완료 상태를 저장해야 한다",
  );
  assert.doesNotMatch(source, /기본 질문 다섯 개/);
  assert.doesNotMatch(source, /2분 더 알려주기/);
  assert.doesNotMatch(source, /교수 찾기 빠른 시작/);
});

test("진로 고민과 만남 맥락은 공식 연구근거 검색문에 섞지 않는다", () => {
  const context = {
    ...discoveryModule.EMPTY_PROFESSOR_DISCOVERY_CONTEXT,
    university: "단국대학교",
    college: "경영경제대학",
    major: "경제학과",
    studentStage: "취업을 준비하는 중",
    goal: "프로젝트·학부연구 참여",
    interests: ["AI·데이터", "경제·금융"],
    secondaryMajorType: "부전공",
    secondaryCollege: "SW융합대학",
    secondaryMajor: "소프트웨어학과",
    careerInterests: ["데이터·AI 직무"],
    careerConcerns: ["취업시장·전망", "필요한 역량·포트폴리오"],
    careerGoal: "민간기업 취업",
    meetingSituation: "오피스아워",
    preferredSupport: "진로 경험과 준비법을 듣고 싶어요",
    experience: "통계 수업과 설문 프로젝트 경험",
    additionalContext: "포트폴리오가 부족해요",
  };
  const topic = discoveryModule.discoveryContextToMatchTopic(context, null);
  const text = evidenceModule.buildProfessorEvidenceText(topic);
  const roleText = evidenceModule.buildProfessorRoleEvidenceText(topic);

  assert.match(text, /경제학과/);
  assert.match(text, /소프트웨어학과/);
  assert.match(text, /데이터·AI 직무/);
  assert.doesNotMatch(text, /프로젝트·학부연구 참여/);
  assert.doesNotMatch(text, /취업을 준비하는 중/);
  assert.doesNotMatch(text, /취업시장·전망/);
  assert.doesNotMatch(text, /필요한 역량·포트폴리오/);
  assert.doesNotMatch(text, /민간기업 취업/);
  assert.doesNotMatch(text, /오피스아워/);
  assert.doesNotMatch(text, /진로 경험과 준비법/);
  assert.doesNotMatch(text, /통계 수업과 설문 프로젝트 경험/);
  assert.doesNotMatch(text, /포트폴리오가 부족해요/);
  assert.doesNotMatch(
    text,
    /전공 관점에서 어떻게 탐색할 수 있을까/,
    "찾다 폼의 자동 생성 질문은 공식 연구근거 검색문에서 제외해야 한다",
  );
  assert.match(roleText.topic, /AI·데이터/);
  assert.match(roleText.method, /^$/);
  assert.match(roleText.context, /데이터·AI 직무/);
  assert.match(roleText.context, /진로 경험과 준비법/);
  assert.match(roleText.context, /통계 수업과 설문 프로젝트 경험/);
  assert.doesNotMatch(roleText.topic, /경제학과|소프트웨어학과/);
  assert.doesNotMatch(roleText.method, /경제학과|소프트웨어학과/);
  assert.doesNotMatch(roleText.context, /오피스아워|포트폴리오가 부족해요/);
});

test("기본·심층 맥락은 세 개의 면담 질문으로 변환된다", () => {
  const questions = discoveryModule.buildProfessorContextQuestions({
    ...discoveryModule.EMPTY_PROFESSOR_DISCOVERY_CONTEXT,
    major: "경제학과",
    studentStage: "취업을 준비하는 중",
    goal: "취업·직무 조언 받기",
    secondaryMajorType: "부전공",
    secondaryMajor: "소프트웨어학과",
    careerConcerns: ["취업시장·전망", "필요한 역량·포트폴리오"],
    careerInterests: ["데이터·AI 직무"],
    careerGoal: "민간기업 취업",
    meetingSituation: "오피스아워",
    preferredSupport: "진로 경험과 준비법을 듣고 싶어요",
    experience: "통계 수업 경험",
    additionalContext: "코딩 경험이 적어요",
  }, "산업조직론");

  assert.equal(questions.length, 3);
  assert.match(questions[0], /취업을 준비하는 중/);
  assert.match(questions[0], /취업·직무 조언 받기/);
  assert.match(questions[0], /취업시장·전망/);
  assert.match(questions[0], /필요한 역량·포트폴리오/);
  assert.match(questions[1], /주전공 ‘경제학과’/);
  assert.match(questions[1], /부전공 ‘소프트웨어학과’/);
  assert.match(questions[1], /데이터·AI 직무/);
  assert.match(questions[1], /민간기업 취업/);
  assert.match(questions[2], /오피스아워/);
  assert.match(questions[2], /진로 경험과 준비법/);
  assert.match(questions[2], /통계 수업 경험/);
  assert.match(questions[2], /코딩 경험이 적어요/);

  const redactedQuestion = discoveryModule.buildProfessorContextQuestions({
    ...discoveryModule.EMPTY_PROFESSOR_DISCOVERY_CONTEXT,
    major: "경제학과",
    careerConcerns: ["취업시장·전망"],
  }, "[redacted-phone] : 고효율 무선 전력 장치")[0];
  assert.doesNotMatch(redactedQuestion, /redacted/);
  assert.match(redactedQuestion, /고효율 무선 전력 장치/);
});

test("심층분석 전환은 현재 관심 분야와 직접 입력 초안을 한 번에 확정한다", () => {
  const context = {
    ...discoveryModule.EMPTY_PROFESSOR_DISCOVERY_CONTEXT,
    university: "단국대학교",
    college: "공공인재대학",
    major: "식품자원경제학과",
    studentStage: "진로를 다시 탐색하는 중",
    goal: "대학원·연구실 탐색",
    interests: ["AI·데이터", "SW·보안", "경제·금융", "식품·농업"],
    careerConcerns: ["인턴·프로젝트 경험", "취업과 대학원 사이"],
  };
  const prepared = discoveryModule.prepareProfessorDiscoveryDeepTransition(
    context,
    "  농산물 가격예측  ",
  );

  assert.equal(prepared.error, null);
  assert.deepEqual(prepared.context.interests, [
    "AI·데이터",
    "SW·보안",
    "경제·금융",
    "식품·농업",
    "농산물 가격예측",
  ]);
  assert.deepEqual(context.interests, ["AI·데이터", "SW·보안", "경제·금융", "식품·농업"]);
  assert.deepEqual(
    discoveryModule.discoveryContextToMatchTopic(prepared.context, null).interests,
    prepared.context.interests,
  );

  const duplicate = discoveryModule.prepareProfessorDiscoveryDeepTransition(
    prepared.context,
    "식품·농업",
  );
  assert.equal(duplicate.error, null);
  assert.deepEqual(duplicate.context.interests, prepared.context.interests);

  const overflow = discoveryModule.prepareProfessorDiscoveryDeepTransition(
    prepared.context,
    "환경·ESG",
  );
  assert.match(overflow.error, /최대 5개/);
  assert.deepEqual(overflow.context.interests, prepared.context.interests);
});

test("심층분석과 기본분석 복귀는 동일한 관심 분야 context를 사용한다", () => {
  const source = fs.readFileSync(
    path.join(repositoryRoot, "components/screens/professor-discovery-form.tsx"),
    "utf8",
  );
  const continueBlock = source.slice(
    source.indexOf("  const continueToDeepAnalysis = () => {"),
    source.indexOf("\n\n  return ("),
  );
  assert.match(continueBlock, /prepareProfessorDiscoveryDeepTransition\(context, customInterest\)/);
  assert.match(continueBlock, /interests: \[\.\.\.prepared\.context\.interests\]/);
  assert.ok(
    continueBlock.indexOf("changeContext") < continueBlock.indexOf("setStep(2)"),
    "최신 관심 분야를 부모 context에 반영한 뒤 심층 단계로 이동해야 한다",
  );

  const deepBlock = source.slice(
    source.indexOf('<div className="professor-discovery-step" data-step="deep">'),
    source.indexOf("{(stepError || inputError)"),
  );
  assert.match(deepBlock, /aria-label="심층분석에 반영된 관심 분야"/);
  assert.match(deepBlock, /context\.interests\.map/);
  const backButton = deepBlock.slice(
    deepBlock.indexOf('className="discovery-back-button"'),
    deepBlock.indexOf("<PrimaryButton onClick={submit}"),
  );
  assert.match(backButton, /onClick=\{\(\) => setStep\(1\)\}/);
  assert.doesNotMatch(backButton, /changeContext|onContextChange|interests:/);
});

test("새로고침용 매칭 요청에서 교수 찾기 맥락을 복원한다", () => {
  const original = {
    ...discoveryModule.EMPTY_PROFESSOR_DISCOVERY_CONTEXT,
    university: "단국대학교",
    college: "경영경제대학",
    major: "경제학과",
    studentStage: "취업을 준비하는 중",
    goal: "취업·직무 조언 받기",
    interests: ["경제·금융"],
    careerInterests: ["데이터·AI 직무"],
    careerConcerns: ["취업시장·전망"],
    secondaryMajorType: "부전공",
    secondaryCollege: "SW융합대학",
    secondaryMajor: "소프트웨어학과",
    topic: "금융시장 변화",
    meetingSituation: "오피스아워",
    preferredSupport: "시작할 수업과 프로젝트",
  };
  const topic = discoveryModule.discoveryContextToMatchTopic(original, null);
  const restored = discoveryModule.professorMatchTopicToDiscoveryContext(topic);

  assert.equal(restored.university, original.university);
  assert.equal(restored.college, original.college);
  assert.equal(restored.major, original.major);
  assert.equal(restored.studentStage, original.studentStage);
  assert.equal(restored.goal, original.goal);
  assert.deepEqual(restored.interests, original.interests);
  assert.deepEqual(restored.careerInterests, original.careerInterests);
  assert.deepEqual(restored.careerConcerns, original.careerConcerns);
  assert.equal(restored.secondaryCollege, original.secondaryCollege);
  assert.equal(restored.secondaryMajor, original.secondaryMajor);
  assert.equal(restored.topic, original.topic);
  assert.equal(restored.meetingSituation, original.meetingSituation);
  assert.equal(restored.preferredSupport, original.preferredSupport);
});

test("교수 3인 피칭은 학생 조건·공식 근거·서비스 제안을 분리한다", () => {
  const context = {
    ...discoveryModule.EMPTY_PROFESSOR_DISCOVERY_CONTEXT,
    major: "경제학과",
    interests: ["경제·금융"],
    careerInterests: ["데이터·AI 직무"],
    careerConcerns: ["취업시장·전망"],
  };
  const professor = {
    id: "professor:test",
    university: "단국대학교",
    college: "경영경제대학",
    department: "경제학과",
    departments: ["경제학과"],
    associationStatuses: [],
    name: "테스트",
    title: "교수",
    researchFields: ["금융계량경제"],
    publications: [{
      id: "publication:test",
      title: "금융시장 예측 연구",
      publicationType: "학술논문",
      publishedDate: "2026-01-01",
      doi: null,
      kciId: null,
      officialProfileUrl: "https://www.dankook.ac.kr/example",
    }],
    publicationCount: 1,
    officialProfileUrl: "https://www.dankook.ac.kr/example",
    sourceUrl: "https://www.dankook.ac.kr/example",
    collectedAt: "2026-07-30T00:00:00.000Z",
    status: "FOUND",
    researchFieldsStatus: "FOUND",
    publicationsStatus: "FOUND",
    failureReason: null,
    profileEvidenceId: "profile:test",
  };
  const baseMatch = {
    professor,
    strength: "DIRECT",
    reason: "공식 프로필의 금융계량경제 연구가 연결됩니다.",
    evidenceIds: ["profile:test", "publication:test"],
    matchedTerms: ["금융계량경제"],
    doesNotEstablish: [
      "교수의 면담·지도·모집 가능 여부",
      "추천 결과의 우열이나 성공 가능성",
    ],
    decisionBasis: {
      matchedConcepts: ["가격·시장"],
      departmentMatchesMajor: true,
      roleMatches: { topic: true, method: true, context: true },
      sources: {
        officialProfile: true,
        researchFields: true,
        matchedPublication: true,
      },
    },
  };

  for (const role of ["TOPIC", "METHOD", "CONTEXT"]) {
    const pitch = pitchModule.buildProfessorPitch(
      { ...baseMatch, role },
      context,
      "취업시장의 변화를 데이터로 보려면 무엇부터 시작하면 좋을까요?",
    );
    assert.equal(pitch.studentConnections.includes("경제학과 전공"), true);
    assert.equal(pitch.officialConnections.includes("금융계량경제"), true);
    assert.equal(
      pitch.officialConnections.includes("가격·시장"),
      false,
      "내부 분류 개념을 공식 프로필 문구처럼 표시하면 안 된다",
    );
    assert.equal(pitch.potentialLearning.length, 3);
    assert.match(pitch.firstQuestion, /무엇부터 시작/);
    assert.equal(pitch.hasOfficialPublications, true);
    assert.doesNotMatch(pitch.pitchLine, /궁합|점수|순위|지도 가능|모집 가능/);
    if (role === "CONTEXT") {
      assert.equal(pitch.roleLabel, "같은 학과 연결");
      assert.match(pitch.mentorRole, /가까운 시작점/);
    }
  }
});

test("부전공·복수전공으로 연결된 교수는 해당 입력 구분을 피칭에 표시한다", () => {
  const context = {
    ...discoveryModule.EMPTY_PROFESSOR_DISCOVERY_CONTEXT,
    major: "경제학과",
    secondaryMajorType: "부전공",
    secondaryCollege: "SW융합대학",
    secondaryMajor: "소프트웨어학과",
    interests: ["AI·데이터"],
    careerInterests: ["데이터·AI 직무"],
  };
  const professor = {
    id: "professor:secondary-major",
    university: "단국대학교",
    college: "SW융합대학",
    department: "소프트웨어학과",
    departments: ["소프트웨어학과"],
    associationStatuses: [],
    name: "테스트",
    title: "교수",
    researchFields: ["인공지능"],
    publications: [],
    publicationCount: 0,
    officialProfileUrl: "https://www.dankook.ac.kr/example",
    sourceUrl: "https://www.dankook.ac.kr/example",
    collectedAt: "2026-07-30T00:00:00.000Z",
    status: "FOUND",
    researchFieldsStatus: "FOUND",
    publicationsStatus: "NOT_LISTED_ON_OFFICIAL_PROFILE",
    failureReason: null,
    profileEvidenceId: "profile:secondary-major",
  };

  for (const secondaryMajorType of ["부전공", "복수전공"]) {
    const pitch = pitchModule.buildProfessorPitch(
      {
        professor,
        role: "CONTEXT",
        strength: "DIRECT",
        reason: "공식 소속과 연구분야가 연결됩니다.",
        evidenceIds: ["profile:secondary-major"],
        matchedTerms: ["소프트웨어학과", "인공지능"],
        doesNotEstablish: ["교수의 면담·지도·모집 가능 여부"],
        decisionBasis: {
          matchedConcepts: ["AI·데이터"],
          departmentMatchesMajor: true,
          matchedAcademicAffiliation: {
            type: "SECONDARY",
            label: secondaryMajorType,
            college: "SW융합대학",
            major: "소프트웨어학과",
            officialDepartment: "소프트웨어학과",
          },
          roleMatches: { topic: true, method: false, context: true },
          sources: {
            officialProfile: true,
            researchFields: true,
            matchedPublication: false,
          },
        },
      },
      { ...context, secondaryMajorType },
      "AI 분야를 탐색하려면 무엇부터 시작하면 좋을까요?",
    );

    assert.equal(pitch.roleLabel, `${secondaryMajorType} 연결`);
    assert.match(pitch.pitchLine, new RegExp(`${secondaryMajorType}.*소프트웨어학과`));
    assert.match(pitch.mentorRole, new RegExp(secondaryMajorType));
  }
});

test("데스크톱 교수 찾기 폼은 결과 영역을 sticky로 가리지 않는다", () => {
  const css = fs.readFileSync(path.join(repositoryRoot, "app/globals.css"), "utf8");
  const screen = fs.readFileSync(
    path.join(repositoryRoot, "components/screens/official-professor-screens.tsx"),
    "utf8",
  );

  assert.doesNotMatch(
    css,
    /\.find-professor-screen\s+\.context-panel\s*\{[^}]*position:\s*sticky/si,
  );
  assert.match(css, /\.find-professor-screen\s+\.context-panel\s*\{[^}]*position:\s*static/si);
  assert.match(screen, /세 분 중 한 분과 첫 대화를 시작해 보세요/);
  assert.match(screen, /hasHomeDepartmentMatch/);
  assert.match(screen, /공식 데이터에서 입력한 주전공·부전공·복수전공 소속 교수를 확인하지 못해/);
  assert.match(screen, /공식 데이터 기반 캐스팅 한마디/);
  assert.doesNotMatch(screen, /> AI 캐스팅 한마디</);
  assert.match(screen, /서비스가 제안한 탐색 역할/);
  assert.match(screen, /이 교수님과 첫 대화 준비하기/);
  assert.match(screen, /추천 이유와 공식 근거 더 보기/);
  assert.match(screen, /왜 이 교수님을 제안했나요/);
  assert.match(screen, /근거 확인 상태/);
  assert.match(screen, /공식 프로필에서 연결된 항목/);
  assert.match(screen, /공식 근거와 출처/);
  assert.doesNotMatch(
    css,
    /\.match-card__actions\s*\{[^}]*grid-template-columns:\s*repeat\(2/si,
    "첫 대화 준비와 더 보기는 같은 행에 배치하지 않아야 한다",
  );
  assert.match(
    screen,
    /matches\.length > 0\s*&& !storedDiscoveryTopic[\s\S]*clearProfessorMatches\(\)/,
    "검색 맥락 없는 저장 결과는 재사용하지 않아야 한다",
  );
  assert.match(
    screen,
    /const showsStoredMatches =[\s\S]*Boolean\(storedDiscoveryTopic\)/,
    "저장된 결과는 검색 맥락이 있을 때만 노출해야 한다",
  );
  assert.match(css, /@media \(min-width: 1280px\)[\s\S]*\.match-grid/);
  assert.match(
    css,
    /@media \(max-width: 700px\)[\s\S]*\.professor-pitch-screen \.match-grid[\s\S]*scroll-snap-type: inline mandatory/,
    "모바일 피칭은 세로 장문 대신 한 장씩 넘기는 비교 구조여야 한다",
  );
  assert.doesNotMatch(css, /var\(--border-subtle\)/);
});

test("교수님 3인 피칭은 찾기 폼 아래가 아니라 전용 주소에서 보여준다", () => {
  const screen = fs.readFileSync(
    path.join(repositoryRoot, "components/screens/official-professor-screens.tsx"),
    "utf8",
  );
  const route = fs.readFileSync(
    path.join(repositoryRoot, "app/professors/pitch/page.tsx"),
    "utf8",
  );

  assert.match(route, /ProfessorPitchScreen/);
  assert.match(screen, /export function ProfessorPitchScreen\(\)/);
  assert.match(
    screen,
    /router\.push\("\/professors\/pitch"\)/,
    "검색에 성공하면 피칭 전용 주소로 이동해야 한다",
  );

  const formScreen = screen.slice(
    screen.indexOf("export function OfficialProfessorsScreen("),
    screen.indexOf("export function ProfessorPitchScreen()"),
  );
  assert.doesNotMatch(
    formScreen,
    /<MatchCard/,
    "찾기 화면은 결과 카드를 직접 렌더링하지 않는다",
  );
  assert.match(formScreen, /href="\/professors\/pitch"/, "저장된 결과로 되돌아갈 링크가 있어야 한다");
  assert.match(
    formScreen,
    /const profileState = useProfileStore\.getState\(\);[\s\S]*profileState\.completeProfessorTutorial\(\);/,
    "상세 조건 입력으로 바로 매칭한 경우에도 다음 탭 진입은 교수 홈이어야 한다",
  );

  const pitchScreen = screen.slice(screen.indexOf("export function ProfessorPitchScreen()"));
  assert.match(pitchScreen, /<MatchCard/);
  assert.match(pitchScreen, /이 유형의 다른 교수 보기|onReject/);
  assert.match(pitchScreen, /router\.push\("\/quest"\)/);
  assert.match(
    pitchScreen,
    /professorMatchTopicToDiscoveryContext\(storedDiscoveryTopic\)/,
    "피칭 문구는 저장된 요청 맥락으로 복원해야 한다",
  );
});

test("새 연구주제로 전환하면 프로젝트 자문 추천만 초기화하고 학생 교수 탐색은 보존한다", () => {
  const store = fs.readFileSync(
    path.join(repositoryRoot, "store/research-store.ts"),
    "utf8",
  );
  const sections = [
    store.slice(
      store.indexOf("completeCoDesign: (topics, groundingNote) =>"),
      store.indexOf("  reRecommend: () => {"),
    ),
    store.slice(
      store.indexOf("  reRecommend: () => {"),
      store.indexOf("  selectTopic: (id) =>"),
    ),
    store.slice(
      store.indexOf("  selectTopic: (id) =>"),
      store.indexOf("  setProfessorMatchLoading: (professorMatchTopicId) =>"),
    ),
  ];

  for (const section of sections) {
    assert.match(section, /\.\.\.emptyProjectProfessorMatchState\(\)/);
    assert.doesNotMatch(section, /professorDiscoveryTopic:\s*null/);
    assert.doesNotMatch(section, /professorDiscoverySummary:\s*null/);
  }
  assert.match(store, /clearProfessorMatches:[\s\S]*professorMatches:[\s\S]*professorDiscoveryTopic:[\s\S]*selectedProfessorId:/);
  assert.doesNotMatch(
    store.slice(store.indexOf("clearProfessorMatches: () =>"), store.indexOf("clearProjectProfessorMatches:")),
    /projectProfessorMatches/,
    "학생 탐색 초기화는 프로젝트 추천 버킷을 건드리면 안 된다",
  );
  assert.match(
    store,
    /persistedVersion < 4[\s\S]*professorDiscoverySummary:\s*null/,
    "v4 마이그레이션에서도 검색 결과 없는 이전 요약을 정리해야 한다",
  );
});

test("첫 교수 매칭은 입력한 학업 소속을 연결하고 전체 후보에서 주제·방법 근거를 비교한다", () => {
  const matcher = fs.readFileSync(
    path.join(repositoryRoot, "lib/professor-data.server.ts"),
    "utf8",
  );
  const route = fs.readFileSync(
    path.join(repositoryRoot, "app/api/professors/match/route.ts"),
    "utf8",
  );

  assert.match(matcher, /const academicHomeCandidates = officialProfileCandidates/);
  assert.match(matcher, /const primaryMajorCandidates = academicHomeCandidates\.filter/);
  assert.match(matcher, /const hasSecondaryAcademicAffiliation = Boolean/);
  assert.match(matcher, /hasSecondaryAcademicAffiliation[\s\S]*\? academicHomeCandidates/);
  assert.doesNotMatch(matcher, /!item\.match\.decisionBasis\.departmentMatchesMajor/);
  assert.match(matcher, /academicAffiliations/);
  assert.match(matcher, /topic\.secondaryMajor/);
  assert.match(matcher, /matchedAcademicAffiliation/);
  assert.match(matcher, /officialDepartment/);
  assert.match(matcher, /affiliation\?\.type === "PRIMARY"/);
  assert.match(matcher, /affiliation\?\.label === "복수전공"/);
  assert.match(matcher, /affiliation\?\.label === "부전공"/);
  assert.match(matcher, /\["CONTEXT", "TOPIC", "METHOD"\]/);
  assert.doesNotMatch(matcher, /homeCollege|leftSharesCollege|rightSharesCollege|usedExternalDepartments|externalCandidates/);
  assert.match(route, /journey: isProjectMentorRequest \? "project" : "student"/);
  assert.match(
    matcher,
    /options\.journey === "project"[\s\S]*\["TOPIC", "METHOD", "CONTEXT"\]/,
    "프로젝트 교수 추천의 역할 순서는 개인 매칭과 분리되어야 한다",
  );

  const store = fs.readFileSync(
    path.join(repositoryRoot, "store/research-store.ts"),
    "utf8",
  );
  const discoveryForm = fs.readFileSync(
    path.join(repositoryRoot, "components/screens/professor-discovery-form.tsx"),
    "utf8",
  );
  assert.match(store, /version:\s*9/);
  assert.match(store, /persistedVersion < 7[\s\S]*secondaryMajor/);
  assert.match(store, /selectionPolicy:\s*response\.selectionPolicy/);
  assert.match(discoveryForm, /부·복수전공도 가까운 학과 연결 범위에 포함/);
  assert.match(discoveryForm, /onClick=\{continueToDeepAnalysis\}/);
  assert.match(discoveryForm, /prepareProfessorDiscoveryDeepTransition\(context, customInterest\)/);
  assert.match(discoveryForm, /심층분석에 반영된 관심 분야/);
});

test("교수 추천 정책은 학업 소속 한 자리와 공식 근거 기반 주제·방법 자리를 분리한다", () => {
  const source = fs.readFileSync(
    path.join(repositoryRoot, "lib/professor-data.server.ts"),
    "utf8",
  );
  const domain = fs.readFileSync(
    path.join(repositoryRoot, "lib/professor-domain.ts"),
    "utf8",
  );

  assert.match(domain, /OFFICIAL_EVIDENCE_RULES_V7/);
  assert.match(source, /label: "경제·금융"/);
  assert.match(source, /label: "SW·보안"/);
  assert.match(source, /topicTerms: \[[\s\S]*"경제·금융"[\s\S]*"금융"/);
  assert.match(source, /specificRoleTerms/);
  assert.match(source, /buildProfessorRoleEvidenceText/);
  assert.match(source, /roleEvidence\.context/);
  assert.match(source, /label: "피드백·진로 대화"/);
  assert.match(source, /const findCandidate = \(requireDirectRole: boolean\) =>[\s\S]*officialCandidates/);
  assert.match(source, /if \(requireDirectRole && !item\.match\.decisionBasis\.roleMatches\[roleKey\]\) return false/);
  assert.match(source, /right\.roleEvidenceCounts\[role\] - left\.roleEvidenceCounts\[role\]/);
  assert.doesNotMatch(source, /leftSharesCollege|rightSharesCollege/);
  const roleComparator = source.slice(
    source.indexOf("function compareForRole"),
    source.indexOf("function presentAsRole"),
  );
  assert.equal(
    (roleComparator.match(/departmentMatchesMajor/g) ?? []).length,
    3,
    "주전공 일치 여부는 CONTEXT 비교에서만 사용해야 한다",
  );
  assert.ok(
    roleComparator.indexOf("explicitRoleEvidenceTerms")
      < roleComparator.indexOf("roleEvidenceCounts"),
    "입력 고유어 직접 근거가 일반 개념 근거보다 먼저 비교돼야 한다",
  );
  assert.ok(
    source.indexOf('for (const role of ["TOPIC", "METHOD"] as const)')
      < source.indexOf("const homeDepartmentCandidate = homeCandidatePool.find"),
    "주제·방법 최적 후보를 예약한 뒤 남은 학업 소속 교수를 연결해야 한다",
  );
  assert.match(source, /입력한 주전공과 부·복수전공/);
  assert.match(source, /주제·방법 연결은 학과를 제한하지 않은 전체 후보에서 역할별 공식 근거가 가장 강한 교수/);
  assert.match(source, /다른 공식 연구 연결 근거가 있는 후보만 제한적으로 보완/);
});

test("전공 아이디어 튜토리얼은 최종 확인 전 로컬 초안만 쓰고 한 번에 공동설계를 시작한다", () => {
  const screen = fs.readFileSync(
    path.join(repositoryRoot, "components/tutorial/research-tutorial-screen.tsx"),
    "utf8",
  );
  const store = fs.readFileSync(
    path.join(repositoryRoot, "store/research-store.ts"),
    "utf8",
  );
  const route = fs.readFileSync(
    path.join(repositoryRoot, "app/research/tutorial/page.tsx"),
    "utf8",
  );

  assert.match(route, /ResearchTutorialScreen/);
  assert.match(screen, /major-evolution-research-tutorial-v1/);
  assert.match(
    screen,
    /QUESTION_STEPS = \["major", "mode", "interests", "readiness", "feasibility", "review"\]/,
  );
  assert.match(
    screen,
    /const startCoDesign = \(\) => \{[\s\S]*beginIdeaCoDesign\([\s\S]*router\.replace\("\/co-design"\)/,
  );

  const atomicCommit = store.slice(
    store.indexOf("  beginIdeaCoDesign: ({ ideaMode, conditions }) => {"),
    store.indexOf("  submit: () => {"),
  );
  assert.match(atomicCommit, /if \(missing\.length\) return missing;[\s\S]*set\(\{/);
  assert.match(atomicCommit, /\.\.\.invalidatedResearchState\(\)/);
  assert.equal(
    (atomicCommit.match(/\bset\(\{/g) ?? []).length,
    1,
    "최종 확인은 연구 상태를 한 번에 반영해야 한다",
  );
});

test("프로젝트 설계는 하나의 적응형 시작 흐름에서 저장된 조건 편집으로만 분기한다", () => {
  const tutorial = fs.readFileSync(
    path.join(repositoryRoot, "components/tutorial/research-tutorial-screen.tsx"),
    "utf8",
  );
  const fullForm = fs.readFileSync(
    path.join(repositoryRoot, "components/screens/research-condition.tsx"),
    "utf8",
  );
  const fullFormRoute = fs.readFileSync(
    path.join(repositoryRoot, "app/research/conditions/page.tsx"),
    "utf8",
  );
  const store = fs.readFileSync(
    path.join(repositoryRoot, "store/research-store.ts"),
    "utf8",
  );

  assert.match(tutorial, /프로젝트 설계 시작하기|이어서 설계하기/);
  assert.doesNotMatch(tutorial, /한 화면에서 직접 입력/);
  assert.match(tutorial, /저장된 조건 빠르게 수정/);
  assert.match(tutorial, /router\.push\("\/research\/conditions\?view=review"\)/);
  assert.match(tutorial, /프로젝트 설계 단계 바로가기/);
  assert.match(tutorial, /나중에 답하기/);
  assert.match(tutorial, /저장하고 나가기/);
  assert.match(tutorial, /saveIdeaDraft\(\{ ideaMode: draft\.ideaMode, conditions: draft\.conditions \}\)/);
  assert.match(fullForm, /\/research\/tutorial\?source=full/);
  assert.match(fullForm, /프로젝트 설계 단계/);
  assert.match(fullForm, /단계별 설계로 돌아가기/);
  assert.match(fullForm, /renderCurrentStep\(\)/);
  assert.match(fullForm, /현재 입력은 이 브라우저에 자동 저장돼요/);
  assert.match(fullForm, /initialStep/);
  assert.match(fullFormRoute, /initialStep=\{view === "review" \? "review" : "direction"\}/);
  assert.match(store, /saveIdeaDraft: \(\{ ideaMode, conditions \}\) =>/);
});

test("교수 상세와 논문 열람은 선택을 저장하지 않고 첫 대화 준비만 저장한다", () => {
  const screen = fs.readFileSync(
    path.join(repositoryRoot, "components/screens/official-professor-screens.tsx"),
    "utf8",
  );
  const openProfessorBlock = screen.slice(
    screen.indexOf("  const openProfessor ="),
    screen.indexOf("  const chooseProfessor ="),
  );
  const chooseProfessorBlock = screen.slice(
    screen.indexOf("  const chooseProfessor ="),
    screen.indexOf("  const hasHomeDepartmentMatch ="),
  );

  assert.doesNotMatch(openProfessorBlock, /selectProfessor\(/);
  assert.match(openProfessorBlock, /router\.push\(`\/professors\/\$\{match\.professor\.id\}\?from=pitch`\)/);
  assert.match(openProfessorBlock, /router\.push\("\/paper\/reader\?mode=bite&source=favorites"\)/);
  assert.match(chooseProfessorBlock, /selectProfessor\(match\.professor\.id\)/);
  assert.match(screen, /이 교수님과 첫 대화 준비하기/);
  const detailScreen = screen.slice(screen.indexOf("export function OfficialProfessorDetailScreen"));
  assert.match(detailScreen, /projectProfessorMatches/);
  assert.match(detailScreen, /selectProjectProfessor/);
  assert.match(detailScreen, /professorDetailNavigation\(from, journey\)/);
  assert.match(detailScreen, /detailNavigation\.matchBucket === "project"/);
  assert.match(detailScreen, /backHref=\{detailNavigation\.backHref\}/);
  assert.match(detailScreen, /match \? \(/);
  assert.match(detailScreen, /교수님 찾기에서 연결 맥락 만들기/);
});

test("직접 교수 찾기도 프로필을 저장하고 기존 프로필은 빈 입력만 채운다", () => {
  const screen = fs.readFileSync(
    path.join(repositoryRoot, "components/screens/official-professor-screens.tsx"),
    "utf8",
  );

  assert.match(screen, /const profileHasHydrated = useProfileStore/);
  assert.match(screen, /if \(!hasHydrated \|\| !profileHasHydrated \|\| prefilled\) return/);
  assert.match(screen, /const sourceMajor = current\.major[\s\S]*\|\| profile\.major/);
  assert.match(screen, /interests: current\.interests\.length > 0[\s\S]*profile\.interests\.slice\(0, 5\)/);
  assert.match(screen, /studentStage: current\.studentStage[\s\S]*profileGradeToStudentStage\(profile\.grade\)/);
  assert.match(screen, /const profileState = useProfileStore\.getState\(\);[\s\S]*profileState\.saveProfile\(\{/);
  assert.match(screen, /school: requestContext\.university/);
  assert.match(screen, /major: requestContext\.major/);
  assert.match(screen, /interests: requestContext\.interests/);
  assert.match(screen, /profileState\.completeProfessorTutorial\(\)/);
});

test("교수 기본 설정은 저장 초안을 우선하고 프로필은 사용자 입력 전에만 채운다", () => {
  const screen = fs.readFileSync(
    path.join(repositoryRoot, "components/tutorial/professor-tutorial-screen.tsx"),
    "utf8",
  );

  assert.match(screen, /if \(!profileHasHydrated \|\| restored\) return/);
  assert.match(screen, /if \(saved\) \{[\s\S]*setContext\(\{ \.\.\.saved\.context/);
  assert.match(screen, /else if \(!userEditedRef\.current\)/);
  assert.match(screen, /findAcademicSelection\(taxonomy, profile\.major\)/);
  assert.match(screen, /major: current\.major \|\| academicSelection\?\.department \|\| profile\.major/);
  assert.match(screen, /interests: current\.interests\.length > 0[\s\S]*profile\.interests\.slice/);
  assert.match(screen, /const update = [\s\S]*userEditedRef\.current = true/);
});
