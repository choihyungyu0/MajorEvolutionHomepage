import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(testDirectory, "../..");
const STORAGE_ERROR_MESSAGE = "이 브라우저에 저장하지 못했지만 현재 화면에서는 계속 진행할 수 있어요.";

const iconStub = () => null;
const styleStub = new Proxy({}, { get: (_target, property) => String(property) });
const reactStub = {
  useEffect: () => undefined,
  useMemo: (factory) => factory(),
  useRef: (value) => ({ current: value }),
  useState: (value) => [typeof value === "function" ? value() : value, () => undefined],
};
const jsxRuntimeStub = {
  Fragment: Symbol("Fragment"),
  jsx: () => null,
  jsxs: () => null,
};
const emptyConditions = {
  school: "",
  majorArea: null,
  major: null,
  interests: [],
  experience: null,
  methods: [],
  period: null,
  dataAccess: null,
  avoid: [],
};
const emptyProfessorContext = {
  university: "",
  college: "",
  major: "",
  studentStage: "",
  goal: "",
  interests: [],
  careerInterests: [],
  careerConcerns: [],
  secondaryMajorType: "없음",
  secondaryCollege: "",
  secondaryMajor: "",
  topic: "",
  careerGoal: "",
  meetingSituation: "",
  preferredSupport: "",
  experience: "",
  additionalContext: "",
};

const commonStubs = {
  "lucide-react": new Proxy({}, { get: () => iconStub }),
  react: reactStub,
  "react/jsx-runtime": jsxRuntimeStub,
  "next/navigation": { useRouter: () => ({ push: () => undefined }) },
  "@/components/brand/brand-logo": { BrandLogo: iconStub },
  "@/store/profile-store": { useProfileStore: () => undefined },
  "@/store/research-store": { useResearchStore: () => undefined },
};

function loadTutorialModule(relativePath, moduleStubs) {
  const sourcePath = path.join(repositoryRoot, relativePath);
  const compiled = ts.transpileModule(fs.readFileSync(sourcePath, "utf8"), {
    compilerOptions: {
      esModuleInterop: true,
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: relativePath,
    reportDiagnostics: true,
  });
  assert.equal(
    (compiled.diagnostics ?? []).filter(
      (diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error,
    ).length,
    0,
    `${relativePath} 테스트용 변환에 실패했습니다.`,
  );

  const loaded = { exports: {} };
  new Function("exports", "module", "require", compiled.outputText)(
    loaded.exports,
    loaded,
    (specifier) => {
      if (specifier.endsWith(".module.css")) return styleStub;
      if (specifier in moduleStubs) return moduleStubs[specifier];
      throw new Error(`예상하지 못한 테스트 모듈 요청: ${specifier}`);
    },
  );
  return loaded.exports;
}

const researchModule = loadTutorialModule(
  "components/tutorial/research-tutorial-screen.tsx",
  {
    ...commonStubs,
    "next/link": { __esModule: true, default: iconStub },
    "@/data/academic-options": {
      MAJOR_AREAS: [],
      MAJOR_SUGGESTIONS: {},
      UNIVERSAL_INTEREST_TAGS: [],
      mergeAcademicProfileDefaults: () => ({}),
    },
    "@/data/co-design": { IDEA_MODES: [], modeById: () => null },
    "@/data/research-mvp": {
      DATA_ACCESS: [],
      EXPERIENCE_LEVELS: [],
      METHOD_TAGS: [],
      PERIODS: [],
    },
    "@/lib/professor-discovery-client": { isDankookUniversity: () => true },
    "@/lib/recommend": { emptyConditions },
  },
);

const professorModule = loadTutorialModule(
  "components/tutorial/professor-tutorial-screen.tsx",
  {
    ...commonStubs,
    "next/image": { __esModule: true, default: iconStub },
    "@/lib/brand-assets": {
      brandLogoV2: { mark: "/mark.svg" },
      tutorialScene: { firstPath: "/scene.webp" },
    },
    "@/lib/professor-discovery-model": {
      DIRECT_ACADEMIC_ENTRY: "직접 입력",
      EMPTY_PROFESSOR_DISCOVERY_CONTEXT: emptyProfessorContext,
      INTEREST_OPTIONS: [],
      MAX_DISCOVERY_INTERESTS: 5,
      discoveryContextToMatchTopic: () => ({ id: "topic" }),
      toggleLimitedValue: () => [],
      validateProfessorDiscoverySecondary: () => null,
      validateProfessorDiscoverySetup: () => null,
    },
    "@/lib/professor-discovery-client": { requestProfessorDiscoveryMatches: async () => ({}) },
    "@/lib/professor-academic-taxonomy": {
      findAcademicSelection: () => null,
      getDepartmentsForCollege: () => [],
    },
  },
);

const tutorials = [
  {
    label: "프로젝트 설계 튜토리얼",
    read: researchModule.readResearchTutorialStorage,
    write: researchModule.writeResearchTutorialStorage,
    runStoredAction: researchModule.runResearchTutorialStoredAction,
  },
  {
    label: "교수 매칭 튜토리얼",
    read: professorModule.readProfessorTutorialStorage,
    write: professorModule.writeProfessorTutorialStorage,
    remove: professorModule.removeProfessorTutorialStorage,
    runStoredAction: professorModule.runProfessorTutorialStoredAction,
  },
];

for (const tutorial of tutorials) {
  test(`${tutorial.label}은 localStorage getter와 getItem 오류를 화면 상태로 바꾼다`, () => {
    assert.equal(typeof tutorial.read, "function", "안전한 저장 초안 읽기 함수가 필요합니다.");

    assert.deepEqual(
      tutorial.read(() => {
        throw new DOMException("저장소 접근 차단", "SecurityError");
      }),
      { value: null, error: STORAGE_ERROR_MESSAGE },
    );
    assert.deepEqual(
      tutorial.read(() => ({
        getItem() {
          throw new DOMException("저장소 읽기 차단", "SecurityError");
        },
      })),
      { value: null, error: STORAGE_ERROR_MESSAGE },
    );
  });

  test(`${tutorial.label}은 setItem 오류를 던지지 않고 명시 상태를 반환한다`, () => {
    assert.equal(typeof tutorial.write, "function", "안전한 저장 초안 쓰기 함수가 필요합니다.");

    assert.equal(
      tutorial.write("draft", () => ({
        setItem() {
          throw new DOMException("저장 공간 부족", "QuotaExceededError");
        },
      })),
      STORAGE_ERROR_MESSAGE,
    );
  });

  test(`${tutorial.label}은 메모리 갱신 뒤 저장 오류가 나도 다음 동작을 계속할 수 있다`, () => {
    assert.equal(
      typeof tutorial.runStoredAction,
      "function",
      "저장 예외를 흐름 중단으로 바꾸지 않는 실행 함수가 필요합니다.",
    );
    let memoryValue = "before";

    const error = tutorial.runStoredAction(() => {
      memoryValue = "after";
      throw new DOMException("저장 공간 부족", "QuotaExceededError");
    });

    assert.equal(memoryValue, "after");
    assert.equal(error, STORAGE_ERROR_MESSAGE);
    assert.throws(
      () => tutorial.runStoredAction(() => {
        throw new Error("storage와 무관한 구현 오류");
      }),
      /storage와 무관한 구현 오류/,
    );
  });
}

test("교수 매칭 튜토리얼은 removeItem 오류를 던지지 않고 명시 상태를 반환한다", () => {
  assert.equal(
    typeof professorModule.removeProfessorTutorialStorage,
    "function",
    "안전한 저장 초안 삭제 함수가 필요합니다.",
  );
  assert.equal(
    professorModule.removeProfessorTutorialStorage(() => ({
      removeItem() {
        throw new DOMException("저장소 삭제 차단", "SecurityError");
      },
    })),
    STORAGE_ERROR_MESSAGE,
  );
});

function elementText(node) {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(elementText).join(" ");
  if (!node || typeof node !== "object") return "";
  return elementText(node.props?.children);
}

function findButton(node, label) {
  if (Array.isArray(node)) {
    for (const child of node) {
      const match = findButton(child, label);
      if (match) return match;
    }
    return null;
  }
  if (!node || typeof node !== "object") return null;
  if (node.type === "button" && elementText(node).includes(label)) return node;
  return findButton(node.props?.children, label);
}

test("교수 튜토리얼 재시작과 새 검색 요청은 성공 응답 전 기존 교수 연결을 지우지 않는다", async () => {
  const calls = {
    clear: 0,
    loading: [],
    matches: [],
    routes: [],
  };
  const context = {
    ...emptyProfessorContext,
    university: "단국대학교",
    college: "공과대학",
    major: "기계공학과",
    interests: ["AI·데이터"],
  };
  const stateSeeds = ["ready", context, false, true, false, 0, null, null];
  let stateIndex = 0;
  const reactHarness = {
    useEffect: () => undefined,
    useMemo: (factory) => factory(),
    useRef: (value) => ({ current: value }),
    useState: (initial) => {
      const seeded = stateSeeds[stateIndex];
      stateIndex += 1;
      return [seeded === undefined ? (typeof initial === "function" ? initial() : initial) : seeded, () => undefined];
    },
  };
  const jsxHarness = {
    Fragment: Symbol("Fragment"),
    jsx: (type, props) => ({ type, props: props ?? {} }),
    jsxs: (type, props) => ({ type, props: props ?? {} }),
  };
  const profileState = {
    hasHydrated: true,
    markServiceEntered: () => undefined,
    profile: {
      name: "학생",
      school: "단국대학교",
      major: "기계공학과",
      grade: "3학년",
      careerConcern: "",
      interests: ["AI·데이터"],
    },
    saveProfile: () => undefined,
    completeProfessorTutorial: () => undefined,
  };
  const useProfileStore = (selector) => selector(profileState);
  useProfileStore.getState = () => profileState;
  const researchState = {
    setProfessorMatchLoading: (topicId) => calls.loading.push(topicId),
    setProfessorMatches: (response) => calls.matches.push(response),
    setProfessorDiscoveryTopic: () => undefined,
    setProfessorDiscoverySummary: () => undefined,
    setProfessorMatchError: () => undefined,
    setProfessorRejectedIds: () => undefined,
    clearProfessorMatches: () => { calls.clear += 1; },
  };
  const useResearchStore = (selector) => selector(researchState);
  const matchResponse = { topicId: "topic-1", matches: [] };

  const harnessModule = loadTutorialModule(
    "components/tutorial/professor-tutorial-screen.tsx",
    {
      ...commonStubs,
      react: reactHarness,
      "react/jsx-runtime": jsxHarness,
      "next/image": { __esModule: true, default: iconStub },
      "next/navigation": { useRouter: () => ({ push: (href) => calls.routes.push(href) }) },
      "@/lib/brand-assets": {
        brandLogoV2: { mark: "/mark.svg" },
        tutorialScene: { firstPath: "/scene.webp" },
      },
      "@/lib/professor-discovery-model": {
        DIRECT_ACADEMIC_ENTRY: "직접 입력",
        EMPTY_PROFESSOR_DISCOVERY_CONTEXT: emptyProfessorContext,
        INTEREST_OPTIONS: [],
        MAX_DISCOVERY_INTERESTS: 5,
        discoveryContextToMatchTopic: () => ({ id: "topic-1" }),
        toggleLimitedValue: () => [],
        validateProfessorDiscoverySecondary: () => null,
        validateProfessorDiscoverySetup: () => null,
      },
      "@/lib/professor-discovery-client": {
        requestProfessorDiscoveryMatches: async () => matchResponse,
      },
      "@/lib/professor-academic-taxonomy": {
        findAcademicSelection: () => null,
        getDepartmentsForCollege: () => ["기계공학과"],
      },
      "@/store/profile-store": { useProfileStore },
      "@/store/research-store": { useResearchStore },
    },
  );
  const tree = harnessModule.ProfessorTutorialScreen({
    taxonomy: { university: "단국대학교", colleges: [] },
  });
  const resetButton = findButton(tree, "처음부터");
  const searchButton = findButton(tree, "교수님 찾기");
  assert.ok(resetButton, "처음부터 버튼을 실제 렌더 트리에서 찾아야 합니다.");
  assert.ok(searchButton, "교수님 찾기 버튼을 실제 렌더 트리에서 찾아야 합니다.");

  resetButton.props.onClick();
  assert.equal(calls.clear, 0, "로컬 입력 재시작이 기존 교수 연결을 삭제하면 안 됩니다.");

  await searchButton.props.onClick();
  assert.equal(calls.clear, 0, "새 검색은 성공 응답 전 기존 교수 연결을 삭제하면 안 됩니다.");
  assert.deepEqual(calls.loading, ["topic-1"]);
  assert.deepEqual(calls.matches, [matchResponse]);
  assert.deepEqual(calls.routes, ["/professors/pitch"]);
});
