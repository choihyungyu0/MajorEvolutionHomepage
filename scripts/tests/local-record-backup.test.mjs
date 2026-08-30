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
const runtimeDirectory = fs.mkdtempSync(path.join(testDirectory, ".local-record-backup-runtime-"));
const sourcePath = path.join(repositoryRoot, "lib/local-record-backup.ts");

let backupModule = null;
if (fs.existsSync(sourcePath)) {
  const compiled = ts.transpileModule(fs.readFileSync(sourcePath, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    fileName: "lib/local-record-backup.ts",
    reportDiagnostics: true,
  });
  const errors = (compiled.diagnostics ?? []).filter(
    (diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error,
  );
  assert.equal(errors.length, 0, "로컬 기록 백업 모듈 테스트용 변환에 실패했습니다.");
  const outputPath = path.join(runtimeDirectory, "local-record-backup.cjs");
  fs.writeFileSync(outputPath, compiled.outputText, "utf8");
  backupModule = require(outputPath);
}

after(() => fs.rmSync(runtimeDirectory, { recursive: true, force: true }));

function createStorage(entries = {}) {
  const values = new Map(Object.entries(entries));
  return {
    get length() {
      return values.size;
    },
    key(index) {
      return [...values.keys()][index] ?? null;
    },
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      values.set(key, value);
    },
    removeItem(key) {
      values.delete(key);
    },
    entries() {
      return Object.fromEntries(values);
    },
  };
}

const profileState = {
  hasEnteredService: true,
  hasCompletedProfessorTutorial: false,
  profile: {
    name: "학생",
    school: "단국대학교",
    major: "컴퓨터공학과",
    grade: "3학년",
    careerConcern: "",
    interests: ["교육·학습"],
    updatedAt: "2026-08-30T00:00:00.000Z",
  },
};
const professorMatch = {
  professor: {
    id: "professor-1",
    university: "단국대학교",
    college: "공과대학",
    department: "컴퓨터공학과",
    departments: ["컴퓨터공학과"],
    associationStatuses: ["재직"],
    name: "김교수",
    title: "교수",
    researchFields: ["교육 데이터 분석"],
    publications: [{
      id: "paper-1",
      title: "교육 데이터 분석 연구",
      publicationType: "학술논문",
      publishedDate: "2026-01-01",
      doi: null,
      kciId: null,
      officialProfileUrl: "https://example.com/professor-1",
    }],
    publicationCount: 1,
    officialProfileUrl: "https://example.com/professor-1",
    sourceUrl: "https://example.com/directory",
    collectedAt: "2026-08-30T00:00:00.000Z",
    status: "FOUND",
    researchFieldsStatus: "FOUND",
    publicationsStatus: "FOUND",
    failureReason: null,
    profileEvidenceId: "evidence-1",
  },
  role: "TOPIC",
  strength: "DIRECT",
  reason: "공식 연구분야가 주제와 직접 연결됩니다.",
  evidenceIds: ["evidence-1"],
  matchedTerms: ["교육 데이터"],
  doesNotEstablish: ["지도 가능 여부"],
  decisionBasis: {
    matchedConcepts: ["교육 데이터"],
    departmentMatchesMajor: true,
    roleMatches: { topic: true, method: false, context: false },
    sources: { officialProfile: true, researchFields: true, matchedPublication: true },
  },
};
const researchState = {
  conditions: {
    school: "단국대학교",
    majorArea: "공학",
    major: "컴퓨터공학과",
    interests: ["교육·학습"],
    experience: "경험 없음",
    methods: ["텍스트 분석"],
    period: "한 학기",
    dataAccess: "공개 데이터",
    avoid: [],
  },
  coDesignAnswers: [{
    questionId: "target",
    label: "바꾸고 싶은 대상",
    value: "학생의 학습 경험",
    status: "사용자 확인",
  }],
  coDesignFollowUpQuestions: [{
    id: "adaptive-1",
    prompt: "어떤 변화를 확인하고 싶나요?",
    helper: "측정할 변화를 한 가지 골라 보세요.",
    options: ["학습 시간", "이해도"],
    contextLabel: "확인할 변화",
    allowCustom: true,
  }],
  professorMatches: [professorMatch],
  projectProfessorMatches: [professorMatch],
  professorRejectedIds: ["professor-2"],
  favoriteProfessorIds: ["professor-1"],
  growthProjectHistory: [{
    topicId: "topic-1",
    title: "교육 데이터 분석",
    question: "학습 기록으로 이해도를 설명할 수 있는가?",
    selectedAt: "2026-08-30T00:00:00.000Z",
  }],
  growthProfessorHistory: [{
    professorId: "professor-1",
    name: "김교수",
    title: "교수",
    college: "공과대학",
    department: "컴퓨터공학과",
    role: "TOPIC",
    reason: "공식 연구분야가 주제와 직접 연결됩니다.",
    source: "student",
    connectedAt: "2026-08-30T00:00:00.000Z",
    selectedAt: null,
  }],
  knockKitDrafts: {},
  mentorLoopEntries: {},
  seenIds: ["topic-1"],
};
const questState = {
  cards: [{
    id: "card-1",
    tool: "paper-bite",
    title: "문제",
    body: "연구가 다루는 문제입니다.",
    evidence: { label: "공개 초록", page: null, href: "https://example.com/paper-1" },
    professorId: "professor-1",
    topicId: "topic-1",
    paperId: "paper-1",
    bundleId: "bundle-1",
    slot: "problem",
    createdAt: "2026-08-30T00:00:00.000Z",
    updatedAt: "2026-08-30T00:00:00.000Z",
  }],
};
const aiProfessorState = {
  messages: [{
    id: "message-1",
    role: "assistant",
    content: "먼저 공개 데이터를 확인해 보세요.",
    createdAt: "2026-08-30T00:00:00.000Z",
    branchParentMessageId: null,
    reflection: { title: "다음 확인", body: "공개 데이터의 범위를 확인합니다." },
    suggestedPrompts: [{ text: "어떤 자료부터 보면 좋을까요?", kind: "continue", axis: "clarify" }],
  }],
  growthNotes: [{
    id: "note-1",
    title: "다음 확인",
    body: "공개 데이터의 범위를 확인합니다.",
    sourceMessageId: "message-1",
    createdAt: "2026-08-30T00:00:00.000Z",
  }],
  mapDecisions: {},
  collapsedMapNodeIds: ["message-1"],
  detachedMapNodeIds: ["message-1"],
};
const tutorialDraft = {
  version: 1,
  step: "interests",
  ideaMode: "trend",
  conditions: researchState.conditions,
};
const projectExecutionDraft = {
  topicId: "topic-1",
  professorId: "professor-1",
  meetingGoal: "연구 범위 확인",
  executionPlan: "표본을 먼저 정리한다.",
  questions: ["질문 1", "질문 2", "질문 3"],
  materials: {
    "project-brief": true,
    evidence: false,
    "sample-data": true,
    "decision-log": false,
  },
  reflection: "",
  updatedAt: "2026-08-30T00:00:00.000Z",
};

const persistedProfile = JSON.stringify({ state: profileState, version: 2 });
const persistedResearch = JSON.stringify({ state: researchState, version: 9 });
const persistedQuest = JSON.stringify({ state: questState, version: 2 });
const persistedAiProfessor = JSON.stringify({ state: aiProfessorState, version: 7 });

test("허용한 Zustand 기록과 정확한 튜토리얼·프로젝트 실행 초안만 백업하고 임의 값은 제외한다", () => {
  assert.ok(backupModule, "로컬 기록 백업 모듈이 필요합니다.");
  const storage = createStorage({
    "major-evolution-profile-v1": persistedProfile,
    "major-evolution-research-v1": persistedResearch,
    "nyp-quest-cards-v1": persistedQuest,
    "major-evolution-ai-professor-v1": persistedAiProfessor,
    "major-evolution-research-tutorial-v1": JSON.stringify(tutorialDraft),
    "project-execution:topic-1:professor-1": JSON.stringify(projectExecutionDraft),
    OPENAI_API_KEY: "절대 내보내면 안 됨",
    "unrelated-setting": "private",
  });

  const backup = backupModule.createLocalRecordBackup(storage, {
    now: () => "2026-08-30T00:00:00.000Z",
  });

  assert.deepEqual(backup, {
    format: "major-evolution-local-record-backup",
    formatVersion: 2,
    exportedAt: "2026-08-30T00:00:00.000Z",
    snapshots: {
      "major-evolution-profile-v1": { state: profileState, version: 2 },
      "major-evolution-research-v1": { state: researchState, version: 9 },
      "nyp-quest-cards-v1": { state: questState, version: 2 },
      "major-evolution-ai-professor-v1": { state: aiProfessorState, version: 7 },
    },
    records: {
      "major-evolution-research-tutorial-v1": tutorialDraft,
      "project-execution:topic-1:professor-1": projectExecutionDraft,
    },
  });
});

test("구형 화면 백업과 누락된 스냅샷은 지원하지 않는 형식으로 거절한다", () => {
  assert.ok(backupModule, "로컬 기록 백업 모듈이 필요합니다.");
  assert.throws(
    () => backupModule.parseLocalRecordBackup(JSON.stringify({ profile: { name: "구형" } })),
    /지원하지 않는 형식/,
  );
  assert.throws(
    () => backupModule.parseLocalRecordBackup(JSON.stringify({
      format: "major-evolution-local-record-backup",
      formatVersion: 2,
      exportedAt: "2026-08-30T00:00:00.000Z",
      snapshots: { "major-evolution-profile-v1": { state: {}, version: 2 } },
    })),
    /지원하지 않는 형식/,
  );
  assert.throws(
    () => backupModule.parseLocalRecordBackup(JSON.stringify({
      format: "major-evolution-local-record-backup",
      formatVersion: 2,
      exportedAt: "2026-08-30T00:00:00.000Z",
      snapshots: {
        "major-evolution-profile-v1": { state: profileState, version: 2 },
        "major-evolution-research-v1": { state: researchState, version: 9 },
        "nyp-quest-cards-v1": { state: { cards: [null] }, version: 1 },
        "major-evolution-ai-professor-v1": { state: aiProfessorState, version: 7 },
      },
      records: {},
    })),
    /지원하지 않는 형식/,
    "최신 백업 포맷 안에서도 구버전 Zustand 스냅샷으로 검증을 우회하면 안 됩니다.",
  );
});

test("현재 버전 Zustand 스냅샷의 필수 컬렉션이 잘못되면 쓰기 전에 거절한다", () => {
  assert.ok(backupModule, "로컬 기록 백업 모듈이 필요합니다.");
  const malformedStates = [
    ["major-evolution-profile-v1", { ...profileState, profile: null }],
    ["major-evolution-research-v1", { ...researchState, professorMatches: null }],
    ["nyp-quest-cards-v1", { cards: null }],
    ["major-evolution-ai-professor-v1", { ...aiProfessorState, mapDecisions: null }],
  ];

  for (const [key, malformedState] of malformedStates) {
    const snapshots = {
      "major-evolution-profile-v1": { state: profileState, version: 2 },
      "major-evolution-research-v1": { state: researchState, version: 9 },
      "nyp-quest-cards-v1": { state: questState, version: 2 },
      "major-evolution-ai-professor-v1": { state: aiProfessorState, version: 7 },
    };
    snapshots[key] = { ...snapshots[key], state: malformedState };
    const storage = createStorage({ "unrelated-setting": "keep" });
    let writes = 0;
    const originalSetItem = storage.setItem;
    storage.setItem = (...args) => {
      writes += 1;
      originalSetItem(...args);
    };

    assert.throws(() => backupModule.restoreLocalRecordBackup(storage, {
      format: "major-evolution-local-record-backup",
      formatVersion: 2,
      exportedAt: "2026-08-30T00:00:00.000Z",
      snapshots,
      records: {},
    }), /지원하지 않는 형식/);
    assert.equal(writes, 0, `${key} 검증 실패 뒤에는 어떤 기록도 쓰면 안 됩니다.`);
    assert.deepEqual(storage.entries(), { "unrelated-setting": "keep" });
  }
});

test("현재 버전 Zustand 스냅샷의 손상된 컬렉션 원소는 쓰기 전에 모두 거절한다", () => {
  assert.ok(backupModule, "로컬 기록 백업 모듈이 필요합니다.");
  const malformedStates = [
    [
      "major-evolution-profile-v1",
      { ...profileState, profile: { ...profileState.profile, interests: [null] } },
      "profile.interests",
    ],
    [
      "major-evolution-research-v1",
      { ...researchState, conditions: { ...researchState.conditions, methods: [null] } },
      "conditions.methods",
    ],
    [
      "major-evolution-research-v1",
      { ...researchState, conditions: { ...researchState.conditions, school: null } },
      "conditions.school",
    ],
    [
      "major-evolution-research-v1",
      { ...researchState, result: { kind: "ok", candidates: [null] } },
      "result.candidates",
    ],
    ["major-evolution-research-v1", { ...researchState, coDesignAnswers: [{}] }, "coDesignAnswers"],
    [
      "major-evolution-research-v1",
      { ...researchState, coDesignFollowUpQuestions: [{}] },
      "coDesignFollowUpQuestions",
    ],
    ["major-evolution-research-v1", { ...researchState, professorMatches: [{}] }, "professorMatches"],
    [
      "major-evolution-research-v1",
      { ...researchState, projectProfessorMatches: [{ professor: null }] },
      "projectProfessorMatches",
    ],
    [
      "major-evolution-research-v1",
      { ...researchState, professorRejectedIds: [null] },
      "professorRejectedIds",
    ],
    [
      "major-evolution-research-v1",
      { ...researchState, favoriteProfessorIds: [null] },
      "favoriteProfessorIds",
    ],
    [
      "major-evolution-research-v1",
      { ...researchState, growthProjectHistory: [{}] },
      "growthProjectHistory",
    ],
    [
      "major-evolution-research-v1",
      { ...researchState, growthProfessorHistory: [{}] },
      "growthProfessorHistory",
    ],
    [
      "major-evolution-research-v1",
      { ...researchState, knockKitDrafts: { broken: null } },
      "knockKitDrafts",
    ],
    [
      "major-evolution-research-v1",
      { ...researchState, mentorLoopEntries: { broken: null } },
      "mentorLoopEntries",
    ],
    [
      "major-evolution-research-v1",
      { ...researchState, growthDirectionBaseline: { major: "컴퓨터공학과", interests: null, careerConcerns: [], capturedAt: "2026-08-30" } },
      "growthDirectionBaseline",
    ],
    [
      "major-evolution-research-v1",
      { ...researchState, professorDiscoverySummary: { major: "컴퓨터공학과", interests: null, careerConcerns: [] } },
      "professorDiscoverySummary",
    ],
    [
      "major-evolution-research-v1",
      { ...researchState, professorCoverage: { coverageGaps: null } },
      "professorCoverage",
    ],
    [
      "major-evolution-research-v1",
      { ...researchState, selectedProfessorPaper: { professorId: null } },
      "selectedProfessorPaper",
    ],
    [
      "major-evolution-research-v1",
      { ...researchState, groundingNote: {} },
      "groundingNote",
    ],
    [
      "major-evolution-research-v1",
      { ...researchState, coDesignQuestionSource: "unknown" },
      "coDesignQuestionSource",
    ],
    [
      "major-evolution-research-v1",
      { ...researchState, resultOrigin: {} },
      "resultOrigin",
    ],
    ["major-evolution-research-v1", { ...researchState, seenIds: [null] }, "seenIds"],
    ["nyp-quest-cards-v1", { cards: [null] }, "cards"],
    ["nyp-quest-cards-v1", { cards: [{}] }, "cards minimum schema"],
    ["major-evolution-ai-professor-v1", { ...aiProfessorState, messages: [{}] }, "messages"],
    [
      "major-evolution-ai-professor-v1",
      {
        ...aiProfessorState,
        messages: [
          aiProfessorState.messages[0],
          {
            id: "user-duplicate-branch",
            role: "user",
            content: "이전 답변에서 이어갈게요.",
            createdAt: "2026-08-30T00:01:00.000Z",
            branchParentMessageId: "message-1",
            reflection: null,
            suggestedPrompts: [],
          },
          { ...aiProfessorState.messages[0], createdAt: "2026-08-30T00:02:00.000Z" },
        ],
      },
      "messages duplicate id",
    ],
    [
      "major-evolution-ai-professor-v1",
      {
        ...aiProfessorState,
        messages: [
          {
            id: "user-forward-branch",
            role: "user",
            content: "뒤에 있는 답변에서 이어갈게요.",
            createdAt: "2026-08-30T00:00:00.000Z",
            branchParentMessageId: "later-assistant",
            reflection: null,
            suggestedPrompts: [],
          },
          { ...aiProfessorState.messages[0], id: "later-assistant", createdAt: "2026-08-30T00:01:00.000Z" },
        ],
      },
      "messages forward parent",
    ],
    ["major-evolution-ai-professor-v1", { ...aiProfessorState, growthNotes: [{}] }, "growthNotes"],
    [
      "major-evolution-ai-professor-v1",
      { ...aiProfessorState, collapsedMapNodeIds: [null] },
      "collapsedMapNodeIds",
    ],
    [
      "major-evolution-ai-professor-v1",
      { ...aiProfessorState, detachedMapNodeIds: [null] },
      "detachedMapNodeIds",
    ],
  ];

  for (const [key, malformedState, field] of malformedStates) {
    const snapshots = {
      "major-evolution-profile-v1": { state: profileState, version: 2 },
      "major-evolution-research-v1": { state: researchState, version: 9 },
      "nyp-quest-cards-v1": { state: questState, version: 2 },
      "major-evolution-ai-professor-v1": { state: aiProfessorState, version: 7 },
    };
    snapshots[key] = { ...snapshots[key], state: malformedState };
    const storage = createStorage({ "unrelated-setting": "keep" });
    let writes = 0;
    const originalSetItem = storage.setItem;
    storage.setItem = (...args) => {
      writes += 1;
      originalSetItem(...args);
    };

    assert.throws(() => backupModule.restoreLocalRecordBackup(storage, {
      format: "major-evolution-local-record-backup",
      formatVersion: 2,
      exportedAt: "2026-08-30T00:00:00.000Z",
      snapshots,
      records: {},
    }), /지원하지 않는 형식/, `${field} 손상 원소를 거절해야 합니다.`);
    assert.equal(writes, 0, `${field} 검증 실패 뒤에는 어떤 기록도 쓰면 안 됩니다.`);
    assert.deepEqual(storage.entries(), { "unrelated-setting": "keep" });
  }
});

test("복원은 허용된 고정 키와 튜토리얼·모든 프로젝트 실행 초안만 교체한다", () => {
  assert.ok(backupModule, "로컬 기록 백업 모듈이 필요합니다.");
  const storage = createStorage({
    "major-evolution-profile-v1": JSON.stringify({ state: profileState, version: 2 }),
    "major-evolution-research-tutorial-v1": JSON.stringify({ ...tutorialDraft, step: "major" }),
    "project-execution:stale-topic:stale-professor": JSON.stringify({
      ...projectExecutionDraft,
      topicId: "stale-topic",
      professorId: "stale-professor",
    }),
    "unrelated-setting": "keep-me",
    OPENAI_API_KEY: "keep-secret",
  });
  const backup = {
    format: "major-evolution-local-record-backup",
    formatVersion: 2,
    exportedAt: "2026-08-30T00:00:00.000Z",
    snapshots: {
      "major-evolution-profile-v1": { state: { ...profileState, profile: { ...profileState.profile, name: "복원" } }, version: 2 },
      "major-evolution-research-v1": { state: researchState, version: 9 },
      "nyp-quest-cards-v1": { state: { cards: [] }, version: 2 },
      "major-evolution-ai-professor-v1": { state: { ...aiProfessorState, messages: [] }, version: 7 },
    },
    records: {
      "major-evolution-research-tutorial-v1": tutorialDraft,
      "project-execution:topic-1:professor-1": projectExecutionDraft,
    },
  };

  backupModule.restoreLocalRecordBackup(storage, backup);

  assert.equal(storage.getItem("major-evolution-profile-v1"), JSON.stringify(backup.snapshots["major-evolution-profile-v1"]));
  assert.equal(storage.getItem("major-evolution-research-tutorial-v1"), JSON.stringify(tutorialDraft));
  assert.equal(storage.getItem("project-execution:topic-1:professor-1"), JSON.stringify(projectExecutionDraft));
  assert.equal(storage.getItem("project-execution:stale-topic:stale-professor"), null);
  assert.equal(storage.getItem("unrelated-setting"), "keep-me");
  assert.equal(storage.getItem("OPENAI_API_KEY"), "keep-secret");
});

test("임의 보조 키·손상된 실행 초안·허용 개수 초과는 가져오기 전에 거절한다", () => {
  assert.ok(backupModule, "로컬 기록 백업 모듈이 필요합니다.");
  const base = {
    format: "major-evolution-local-record-backup",
    formatVersion: 2,
    exportedAt: "2026-08-30T00:00:00.000Z",
    snapshots: {
      "major-evolution-profile-v1": { state: profileState, version: 2 },
      "major-evolution-research-v1": { state: researchState, version: 9 },
      "nyp-quest-cards-v1": { state: questState, version: 2 },
      "major-evolution-ai-professor-v1": { state: aiProfessorState, version: 7 },
    },
  };
  assert.throws(
    () => backupModule.parseLocalRecordBackup(JSON.stringify({ ...base, records: { "unrelated-setting": {} } })),
    /지원하지 않는 형식/,
  );
  assert.throws(
    () => backupModule.parseLocalRecordBackup(JSON.stringify({
      ...base,
      records: {
        "project-execution:topic 1:professor-1": { ...projectExecutionDraft, topicId: "topic 1" },
      },
    })),
    /지원하지 않는 형식/,
  );
  assert.throws(
    () => backupModule.parseLocalRecordBackup(JSON.stringify({
      ...base,
      records: {
        "project-execution:topic-1:professor-1": { ...projectExecutionDraft, questions: null },
      },
    })),
    /지원하지 않는 형식/,
  );
  const tooManyRecords = Object.fromEntries(Array.from(
    { length: backupModule.LOCAL_RECORD_MAX_PROJECT_EXECUTION_RECORDS + 1 },
    (_, index) => [
      `project-execution:topic-${index}:professor-${index}`,
      { ...projectExecutionDraft, topicId: `topic-${index}`, professorId: `professor-${index}` },
    ],
  ));
  assert.throws(
    () => backupModule.parseLocalRecordBackup(JSON.stringify({ ...base, records: tooManyRecords })),
    /프로젝트 실행 기록은 최대/,
  );
});

test("형식 오류나 저장 공간 오류가 나면 기존 기록을 부분 복원하지 않는다", () => {
  assert.ok(backupModule, "로컬 기록 백업 모듈이 필요합니다.");
  const storage = createStorage({
    "major-evolution-profile-v1": "before-profile",
    "major-evolution-research-v1": "before-research",
  });
  const before = storage.entries();
  assert.throws(
    () => backupModule.restoreLocalRecordBackup(storage, {
      format: "major-evolution-local-record-backup",
      formatVersion: 2,
      exportedAt: "2026-08-30T00:00:00.000Z",
      snapshots: {
        "major-evolution-profile-v1": { state: profileState, version: 2 },
        "major-evolution-research-v1": { state: researchState, version: 9 },
        "nyp-quest-cards-v1": { state: questState, version: "2" },
        "major-evolution-ai-professor-v1": { state: aiProfessorState, version: 7 },
      },
      records: {},
    }),
    /지원하지 않는 형식/,
  );
  assert.deepEqual(storage.entries(), before);

  let failedOnce = false;
  const originalSetItem = storage.setItem;
  const validBackup = backupModule.parseLocalRecordBackup(JSON.stringify({
    format: "major-evolution-local-record-backup",
    formatVersion: 2,
    exportedAt: "2026-08-30T00:00:00.000Z",
    snapshots: {
      "major-evolution-profile-v1": { state: profileState, version: 2 },
      "major-evolution-research-v1": { state: researchState, version: 9 },
      "nyp-quest-cards-v1": { state: questState, version: 2 },
      "major-evolution-ai-professor-v1": { state: aiProfessorState, version: 7 },
    },
    records: {
      "major-evolution-research-tutorial-v1": tutorialDraft,
      "project-execution:topic-1:professor-1": projectExecutionDraft,
    },
  }));
  storage.setItem = (key, value) => {
    if (key === "project-execution:topic-1:professor-1" && !failedOnce) {
      failedOnce = true;
      throw new DOMException("저장 공간 부족", "QuotaExceededError");
    }
    originalSetItem(key, value);
  };
  failedOnce = false;
  assert.throws(() => backupModule.restoreLocalRecordBackup(storage, validBackup), /저장 공간/);
  assert.deepEqual(storage.entries(), before);
});

test("지속적인 저장 공간 오류도 실제 키를 하나라도 바꾸기 전에 감지한다", () => {
  assert.ok(backupModule, "로컬 기록 백업 모듈이 필요합니다.");
  const storage = createStorage({
    "major-evolution-profile-v1": "before-profile",
    "major-evolution-research-v1": "before-research",
    "unrelated-setting": "keep",
  });
  const before = storage.entries();
  const originalSetItem = storage.setItem;
  let writeAttempts = 0;
  storage.setItem = (key, value) => {
    writeAttempts += 1;
    if (writeAttempts >= 2) {
      throw new DOMException("지속적인 저장 공간 부족", "QuotaExceededError");
    }
    originalSetItem(key, value);
  };
  const validBackup = backupModule.parseLocalRecordBackup(JSON.stringify({
    format: "major-evolution-local-record-backup",
    formatVersion: 2,
    exportedAt: "2026-08-30T00:00:00.000Z",
    snapshots: {
      "major-evolution-profile-v1": { state: profileState, version: 2 },
      "major-evolution-research-v1": { state: researchState, version: 9 },
      "nyp-quest-cards-v1": { state: questState, version: 2 },
      "major-evolution-ai-professor-v1": { state: aiProfessorState, version: 7 },
    },
    records: {},
  }));

  assert.throws(() => backupModule.restoreLocalRecordBackup(storage, validBackup), /저장 공간/);
  assert.deepEqual(storage.entries(), before);
});
