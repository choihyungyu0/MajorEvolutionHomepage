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
const runtimeDirectory = fs.mkdtempSync(path.join(testDirectory, ".data-controls-runtime-"));
const backupSourcePath = path.join(repositoryRoot, "lib/local-record-backup.ts");
const dataControlsSourcePath = path.join(repositoryRoot, "components/screens/data-controls.tsx");
const dataControlsSource = fs.readFileSync(dataControlsSourcePath, "utf8");

const backupCompiled = ts.transpileModule(fs.readFileSync(backupSourcePath, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  fileName: "lib/local-record-backup.ts",
  reportDiagnostics: true,
});
assert.equal(
  (backupCompiled.diagnostics ?? []).filter(
    (diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error,
  ).length,
  0,
  "백업 검증 모듈 테스트용 변환에 실패했습니다.",
);
const backupOutputPath = path.join(runtimeDirectory, "local-record-backup.cjs");
fs.writeFileSync(backupOutputPath, backupCompiled.outputText, "utf8");
const backupModule = require(backupOutputPath);

const dataControlsCompiled = ts.transpileModule(dataControlsSource, {
  compilerOptions: {
    esModuleInterop: true,
    jsx: ts.JsxEmit.ReactJSX,
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
  fileName: "components/screens/data-controls.tsx",
  reportDiagnostics: true,
});
assert.equal(
  (dataControlsCompiled.diagnostics ?? []).filter(
    (diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error,
  ).length,
  0,
  "내 기록 관리 모듈 테스트용 변환에 실패했습니다.",
);

const iconStub = () => null;
const lucideStub = new Proxy({}, { get: () => iconStub });
const moduleStubs = {
  "@/lib/ai-conversation-map": { buildConversationMap: () => [] },
  "@/lib/local-record-backup": backupModule,
  "@/store/ai-professor-store": {},
  "@/store/profile-store": {},
  "@/store/quest-store": {},
  "@/store/research-store": {},
  "./data-controls.module.css": {},
  "lucide-react": lucideStub,
  "next/link": {},
  react: {},
  "react/jsx-runtime": { Fragment: Symbol("Fragment"), jsx: () => null, jsxs: () => null },
};
const dataControlsModule = { exports: {} };
new Function("exports", "module", "require", dataControlsCompiled.outputText)(
  dataControlsModule.exports,
  dataControlsModule,
  (specifier) => {
    if (specifier in moduleStubs) return moduleStubs[specifier];
    throw new Error(`예상하지 못한 테스트 모듈 요청: ${specifier}`);
  },
);

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
  };
}

const tutorialDraft = {
  version: 1,
  step: "interests",
  ideaMode: "trend",
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

function auxiliaryStorage() {
  return createStorage({
    "major-evolution-research-tutorial-v1": JSON.stringify(tutorialDraft),
    "project-execution:topic-1:professor-1": JSON.stringify(projectExecutionDraft),
    "project-execution:topic-2:professor-2": JSON.stringify({
      ...projectExecutionDraft,
      topicId: "topic-2",
      professorId: "professor-2",
      questions: null,
    }),
    "project-execution:topic 3:professor-3": JSON.stringify({
      ...projectExecutionDraft,
      topicId: "topic 3",
      professorId: "professor-3",
    }),
    "project-execution:topic-4:professor-4:extra": JSON.stringify({
      ...projectExecutionDraft,
      topicId: "topic-4",
      professorId: "professor-4",
    }),
    "unrelated-setting": "keep",
  });
}

test("내 기록 관리는 유효한 튜토리얼과 프로젝트 실행 초안만 목록과 총 개수에 포함한다", () => {
  const collect = dataControlsModule.exports.collectManagedAuxiliaryRecords;
  assert.equal(typeof collect, "function", "보조 기록 목록 함수가 필요합니다.");
  const records = collect(auxiliaryStorage());

  assert.deepEqual(records.map(({ key, kind }) => ({ key, kind })), [
    {
      key: "major-evolution-research-tutorial-v1",
      kind: "research-tutorial",
    },
    {
      key: "project-execution:topic-1:professor-1",
      kind: "project-execution",
    },
  ]);
  assert.equal(records.length, 2, "두 보조 기록만 있어도 총 기록은 0개가 아니어야 합니다.");
  assert.match(dataControlsSource, /items:\s*managedAuxiliaryItems/);
});

test("내 기록 관리는 검증된 보조 기록만 개별 삭제하고 손상·유사 키는 보존한다", () => {
  const remove = dataControlsModule.exports.removeManagedAuxiliaryRecord;
  assert.equal(typeof remove, "function", "검증된 보조 기록 삭제 함수가 필요합니다.");
  const storage = auxiliaryStorage();

  assert.equal(remove(storage, "major-evolution-research-tutorial-v1"), true);
  assert.equal(remove(storage, "project-execution:topic-1:professor-1"), true);
  assert.equal(remove(storage, "project-execution:topic-2:professor-2"), false);
  assert.equal(remove(storage, "project-execution:topic 3:professor-3"), false);

  assert.equal(storage.getItem("major-evolution-research-tutorial-v1"), null);
  assert.equal(storage.getItem("project-execution:topic-1:professor-1"), null);
  assert.notEqual(storage.getItem("project-execution:topic-2:professor-2"), null);
  assert.notEqual(storage.getItem("project-execution:topic 3:professor-3"), null);
  assert.equal(storage.getItem("unrelated-setting"), "keep");
});

test("저장소 접근이 차단되면 안전한 빈 목록과 사용자 경고 상태를 반환한다", () => {
  const load = dataControlsModule.exports.loadManagedAuxiliaryRecords;
  assert.equal(typeof load, "function", "안전한 보조 기록 로더가 필요합니다.");
  const getterBlocked = load(() => {
    throw new DOMException("저장소 접근 차단", "SecurityError");
  });
  assert.deepEqual(getterBlocked, {
    records: [],
    loaded: true,
    error: "현재 브라우저의 프로젝트 초안 기록을 읽지 못했습니다. 저장소 접근 설정을 확인해 주세요.",
    hasPersistedSnapshots: false,
  });

  const iterationBlocked = load(() => ({
    get length() {
      throw new DOMException("저장소 순회 차단", "SecurityError");
    },
    key: () => null,
    getItem: () => null,
    setItem: () => undefined,
    removeItem: () => undefined,
  }));
  assert.deepEqual(iterationBlocked, getterBlocked);
});

test("삭제 직전 값이 손상되거나 removeItem이 실패하면 삭제 성공으로 처리하지 않는다", () => {
  const remove = dataControlsModule.exports.removeManagedAuxiliaryRecord;
  const removeFromProvider = dataControlsModule.exports.removeManagedAuxiliaryRecordFromProvider;
  assert.equal(typeof remove, "function", "검증된 보조 기록 삭제 함수가 필요합니다.");
  assert.equal(typeof removeFromProvider, "function", "저장소 getter까지 보호하는 삭제 함수가 필요합니다.");

  const staleStorage = auxiliaryStorage();
  staleStorage.setItem("major-evolution-research-tutorial-v1", JSON.stringify({
    ...tutorialDraft,
    conditions: { ...tutorialDraft.conditions, interests: null },
  }));
  assert.equal(remove(staleStorage, "major-evolution-research-tutorial-v1"), false);
  assert.notEqual(staleStorage.getItem("major-evolution-research-tutorial-v1"), null);

  const removalBlocked = auxiliaryStorage();
  removalBlocked.removeItem = () => {
    throw new DOMException("삭제 차단", "SecurityError");
  };
  assert.doesNotThrow(() => {
    assert.equal(remove(removalBlocked, "project-execution:topic-1:professor-1"), false);
  });
  assert.notEqual(removalBlocked.getItem("project-execution:topic-1:professor-1"), null);
  assert.equal(removeFromProvider(() => {
    throw new DOMException("저장소 getter 차단", "SecurityError");
  }, "project-execution:topic-1:professor-1"), false);
  assert.match(
    dataControlsSource,
    /const removalResult = item\.remove\(\);[\s\S]*if \(removalResult === false\)[\s\S]*삭제하지 못했습니다/,
  );
  assert.match(
    dataControlsSource,
    /if \(!removed\) \{[\s\S]*setManagedAuxiliaryState\(loadManagedAuxiliaryRecords/,
    "삭제 직전 손상된 값은 다시 읽어 목록에서도 제외해야 합니다.",
  );
});

test("백업 버튼은 UI 목록 밖의 저장된 Zustand 조건도 백업 대상으로 인정한다", () => {
  const canDownload = dataControlsModule.exports.canDownloadLocalRecordBackup;
  const load = dataControlsModule.exports.loadManagedAuxiliaryRecords;
  assert.equal(typeof canDownload, "function", "백업 가능 상태 판정 함수가 필요합니다.");
  assert.equal(canDownload(0, { loaded: false, error: null, hasPersistedSnapshots: false }), false);
  assert.equal(canDownload(0, { loaded: true, error: null, hasPersistedSnapshots: false }), false);
  assert.equal(canDownload(2, { loaded: true, error: null, hasPersistedSnapshots: false }), true);
  assert.equal(canDownload(2, { loaded: true, error: "저장소 접근 차단", hasPersistedSnapshots: true }), false);

  const conditionsOnly = load(() => createStorage({
    "major-evolution-research-v1": JSON.stringify({
      version: 9,
      state: { conditions: { major: "컴퓨터공학과", interests: ["교육·학습"] } },
    }),
  }));
  assert.equal(conditionsOnly.records.length, 0, "보조 초안이 없는 조건 저장 상태여야 합니다.");
  assert.equal(conditionsOnly.hasPersistedSnapshots, true);
  assert.equal(canDownload(0, conditionsOnly), true, "조건만 저장돼도 백업을 내려받을 수 있어야 합니다.");
  assert.match(dataControlsSource, /disabled=\{!canDownloadLocalRecordBackup/);
});
