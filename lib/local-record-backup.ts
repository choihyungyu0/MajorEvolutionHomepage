export const LOCAL_RECORD_BACKUP_FORMAT = "major-evolution-local-record-backup";
export const LOCAL_RECORD_BACKUP_FORMAT_VERSION = 2;
export const LOCAL_RECORD_BACKUP_MAX_BYTES = 2 * 1024 * 1024;
export const LOCAL_RECORD_MAX_PROJECT_EXECUTION_RECORDS = 100;

const LOCAL_RECORD_MAX_AUXILIARY_BYTES = 64 * 1024;
const RESEARCH_TUTORIAL_STORAGE_KEY = "major-evolution-research-tutorial-v1";
const PROJECT_EXECUTION_STORAGE_PREFIX = "project-execution:";
const RESTORE_STAGING_STORAGE_PREFIX = "major-evolution-restore-staging-v1:";

export const LOCAL_RECORD_STORAGE_KEYS = [
  "major-evolution-profile-v1",
  "major-evolution-research-v1",
  "nyp-quest-cards-v1",
  "major-evolution-ai-professor-v1",
] as const;

type LocalRecordStorageKey = typeof LOCAL_RECORD_STORAGE_KEYS[number];
type AuxiliaryRecord = Record<string, unknown>;

type PersistedSnapshot = {
  state: Record<string, unknown>;
  version: number;
};

export type LocalRecordBackup = {
  format: typeof LOCAL_RECORD_BACKUP_FORMAT;
  formatVersion: typeof LOCAL_RECORD_BACKUP_FORMAT_VERSION;
  exportedAt: string;
  snapshots: Record<LocalRecordStorageKey, PersistedSnapshot>;
  records: Record<string, AuxiliaryRecord>;
};

export type LocalStorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem" | "key" | "length">;

const EMPTY_SNAPSHOTS: Record<LocalRecordStorageKey, PersistedSnapshot> = {
  "major-evolution-profile-v1": {
    state: {
      hasEnteredService: false,
      hasCompletedProfessorTutorial: false,
      profile: {
        name: "",
        school: "",
        major: "",
        grade: "",
        careerConcern: "",
        interests: [],
        updatedAt: null,
      },
    },
    version: 2,
  },
  "major-evolution-research-v1": {
    state: {
      conditions: {
        school: "",
        majorArea: null,
        major: null,
        interests: [],
        experience: null,
        methods: [],
        period: null,
        dataAccess: null,
        avoid: [],
      },
      coDesignAnswers: [],
      coDesignFollowUpQuestions: [],
      professorMatches: [],
      projectProfessorMatches: [],
      professorRejectedIds: [],
      favoriteProfessorIds: [],
      growthProjectHistory: [],
      growthProfessorHistory: [],
      knockKitDrafts: {},
      mentorLoopEntries: {},
      seenIds: [],
    },
    version: 9,
  },
  "nyp-quest-cards-v1": { state: { cards: [] }, version: 2 },
  "major-evolution-ai-professor-v1": {
    state: {
      messages: [],
      growthNotes: [],
      mapDecisions: {},
      collapsedMapNodeIds: [],
      detachedMapNodeIds: [],
    },
    version: 7,
  },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function unsupportedFormat(): Error {
  return new Error("지원하지 않는 형식의 기록 파일입니다. 이 서비스에서 새로 내려받은 백업 파일을 선택해 주세요.");
}

function hasStringFields(value: Record<string, unknown>, fields: readonly string[]): boolean {
  return fields.every((field) => typeof value[field] === "string");
}

function hasBooleanFields(value: Record<string, unknown>, fields: readonly string[]): boolean {
  return fields.every((field) => typeof value[field] === "boolean");
}

function isArrayOf(
  value: unknown,
  isItem: (item: unknown) => boolean,
): boolean {
  return Array.isArray(value) && value.every(isItem);
}

function isStringArray(value: unknown): boolean {
  return isArrayOf(value, (item) => typeof item === "string");
}

function isNullableStringValue(value: unknown): boolean {
  return value === null || typeof value === "string";
}

function isOneOf(value: unknown, allowed: readonly string[]): boolean {
  return typeof value === "string" && allowed.includes(value);
}

function isConfirmedAnswer(value: unknown): boolean {
  return isRecord(value)
    && hasStringFields(value, ["questionId", "label", "value"])
    && value.status === "사용자 확인";
}

function isCoDesignQuestion(value: unknown): boolean {
  return isRecord(value)
    && hasStringFields(value, ["id", "prompt", "helper", "contextLabel"])
    && isStringArray(value.options)
    && (value.allowCustom === undefined || typeof value.allowCustom === "boolean");
}

function isOfficialPublication(value: unknown): boolean {
  return isRecord(value)
    && hasStringFields(value, ["id", "title", "publicationType", "officialProfileUrl"])
    && isNullableStringValue(value.publishedDate)
    && isNullableStringValue(value.doi)
    && isNullableStringValue(value.kciId);
}

function isOfficialProfessor(value: unknown): boolean {
  if (!isRecord(value)
    || !hasStringFields(value, [
      "id",
      "university",
      "college",
      "department",
      "name",
      "title",
      "officialProfileUrl",
      "sourceUrl",
      "collectedAt",
      "profileEvidenceId",
    ])) return false;
  return isStringArray(value.departments)
    && isStringArray(value.associationStatuses)
    && isStringArray(value.researchFields)
    && isArrayOf(value.publications, isOfficialPublication)
    && typeof value.publicationCount === "number"
    && Number.isInteger(value.publicationCount)
    && value.publicationCount >= 0
    && isOneOf(value.status, [
      "FOUND",
      "NOT_LISTED_ON_OFFICIAL_PROFILE",
      "PROFILE_UNAVAILABLE",
      "PARSE_FAILED",
      "ROBOTS_BLOCKED",
    ])
    && isOneOf(value.researchFieldsStatus, [
      "FOUND",
      "NOT_LISTED_ON_OFFICIAL_PROFILE",
      "PROFILE_UNAVAILABLE",
      "PARSE_FAILED",
      "ROBOTS_BLOCKED",
    ])
    && isOneOf(value.publicationsStatus, [
      "FOUND",
      "NOT_LISTED_ON_OFFICIAL_PROFILE",
      "PROFILE_UNAVAILABLE",
      "PARSE_FAILED",
      "ROBOTS_BLOCKED",
    ])
    && isNullableStringValue(value.failureReason);
}

function isMatchedAcademicAffiliation(value: unknown): boolean {
  return isRecord(value)
    && isOneOf(value.type, ["PRIMARY", "SECONDARY"])
    && hasStringFields(value, ["label", "college", "major", "officialDepartment"]);
}

function isProfessorMatchDecisionBasis(value: unknown): boolean {
  if (!isRecord(value)
    || !isStringArray(value.matchedConcepts)
    || typeof value.departmentMatchesMajor !== "boolean"
    || !isRecord(value.roleMatches)
    || !hasBooleanFields(value.roleMatches, ["topic", "method", "context"])
    || !isRecord(value.sources)
    || !hasBooleanFields(value.sources, ["officialProfile", "researchFields", "matchedPublication"])) {
    return false;
  }
  return value.matchedAcademicAffiliation === undefined
    || value.matchedAcademicAffiliation === null
    || isMatchedAcademicAffiliation(value.matchedAcademicAffiliation);
}

function isProfessorMatch(value: unknown): boolean {
  return isRecord(value)
    && isOfficialProfessor(value.professor)
    && isOneOf(value.role, ["TOPIC", "METHOD", "CONTEXT"])
    && isOneOf(value.strength, ["DIRECT", "RELATED", "LIMITED"])
    && typeof value.reason === "string"
    && (value.mentorFitReason === undefined || typeof value.mentorFitReason === "string")
    && isStringArray(value.evidenceIds)
    && isStringArray(value.matchedTerms)
    && isStringArray(value.doesNotEstablish)
    && isProfessorMatchDecisionBasis(value.decisionBasis);
}

function isGrowthProjectRecord(value: unknown): boolean {
  return isRecord(value)
    && hasStringFields(value, ["topicId", "title", "question", "selectedAt"]);
}

function isGrowthProfessorRecord(value: unknown): boolean {
  return isRecord(value)
    && hasStringFields(value, [
      "professorId",
      "name",
      "title",
      "college",
      "department",
      "reason",
      "connectedAt",
    ])
    && isOneOf(value.role, ["TOPIC", "METHOD", "CONTEXT"])
    && isOneOf(value.source, ["student", "project", "paper"])
    && isNullableStringValue(value.selectedAt);
}

function isQuestEvidence(value: unknown): boolean {
  return isRecord(value)
    && typeof value.label === "string"
    && (value.page === null || (typeof value.page === "number" && Number.isFinite(value.page)))
    && isNullableStringValue(value.href);
}

function isSavedQuestCard(value: unknown): boolean {
  return isRecord(value)
    && hasStringFields(value, ["id", "title", "body", "createdAt", "updatedAt"])
    && isOneOf(value.tool, ["paper-bite", "first-line", "silence-rescue", "email-guard", "next-seed"])
    && (value.evidence === null || isQuestEvidence(value.evidence))
    && isNullableStringValue(value.professorId)
    && isNullableStringValue(value.topicId)
    && isNullableStringValue(value.paperId)
    && isNullableStringValue(value.bundleId)
    && (value.slot === null || isOneOf(value.slot, ["problem", "method", "result", "limitations", "questions"]));
}

function isGrowthProfessorSuggestion(value: unknown): boolean {
  return isRecord(value)
    && typeof value.text === "string"
    && isOneOf(value.kind, ["continue", "branch"])
    && isOneOf(value.axis, ["clarify", "evidence_action", "alternative"]);
}

function isAiProfessorMessage(value: unknown): boolean {
  return isRecord(value)
    && hasStringFields(value, ["id", "content", "createdAt"])
    && isOneOf(value.role, ["user", "assistant"])
    && isNullableStringValue(value.branchParentMessageId)
    && (value.reflection === null || (
      isRecord(value.reflection)
      && hasStringFields(value.reflection, ["title", "body"])
    ))
    && isArrayOf(value.suggestedPrompts, isGrowthProfessorSuggestion);
}

function isAiGrowthNote(value: unknown): boolean {
  return isRecord(value)
    && hasStringFields(value, ["id", "title", "body", "sourceMessageId", "createdAt"]);
}

function isAiProfessorMessages(value: unknown): boolean {
  if (!Array.isArray(value) || !value.every(isAiProfessorMessage)) return false;
  const messageIndex = new Map<string, { index: number; role: "user" | "assistant" }>();
  for (let index = 0; index < value.length; index += 1) {
    const message = value[index] as Record<string, unknown>;
    const id = message.id as string;
    const role = message.role as "user" | "assistant";
    if (messageIndex.has(id)) return false;
    messageIndex.set(id, { index, role });
  }
  for (let index = 0; index < value.length; index += 1) {
    const message = value[index] as Record<string, unknown>;
    const parentId = message.branchParentMessageId as string | null;
    if (message.role === "assistant") {
      if (parentId !== null) return false;
      continue;
    }
    if (!parentId) continue;
    const parent = messageIndex.get(parentId);
    // 오래된 메시지 보존 한도로 부모 답변이 잘린 갈래는 루트처럼 복원할 수 있습니다.
    if (parent && (parent.role !== "assistant" || parent.index >= index)) return false;
  }
  return true;
}

function isProfileState(value: unknown): boolean {
  return isRecord(value)
    && hasStringFields(value, ["name", "school", "major", "grade", "careerConcern"])
    && isStringArray(value.interests)
    && isNullableStringValue(value.updatedAt);
}

function isResearchConditions(value: unknown): boolean {
  return isRecord(value)
    && typeof value.school === "string"
    && isNullableStringValue(value.majorArea)
    && isNullableStringValue(value.major)
    && isStringArray(value.interests)
    && isNullableStringValue(value.experience)
    && isStringArray(value.methods)
    && isNullableStringValue(value.period)
    && isNullableStringValue(value.dataAccess)
    && isStringArray(value.avoid);
}

function isProfessorKnockKitDraft(value: unknown): boolean {
  if (!isRecord(value)
    || !hasStringFields(value, [
      "topicId",
      "professorId",
      "introduction",
      "agenda",
      "emailDraft",
      "updatedAt",
    ])) return false;
  const questions = value.questions;
  return Array.isArray(questions)
    && questions.length === 3
    && questions.every((question) => typeof question === "string");
}

function isProfessorMentorLoopEntry(value: unknown): boolean {
  if (!isRecord(value)
    || !hasStringFields(value, [
      "topicId",
      "professorId",
      "meetingDate",
      "feedbackSummary",
      "recommendedResources",
      "cautionPoint",
      "commitment",
      "nextCheckAt",
      "followUpEmail",
      "updatedAt",
    ])
    || !isRecord(value.before)
    || !hasStringFields(value.before, ["question", "methodDetail", "scope"])
    || !isRecord(value.after)
    || !hasStringFields(value.after, ["question", "methodDetail", "scope"])) return false;
  const sevenDayActions = value.sevenDayActions;
  return Array.isArray(sevenDayActions)
    && sevenDayActions.length === 3
    && sevenDayActions.every((action) => typeof action === "string");
}

function isRecordOf(value: unknown, isItem: (item: unknown) => boolean): boolean {
  return isRecord(value) && Object.values(value).every(isItem);
}

function isTopicCheck(value: unknown): boolean {
  return isRecord(value)
    && isOneOf(value.status, ["확인됨", "조건부", "확인 필요"])
    && typeof value.note === "string";
}

function isResearchTopic(value: unknown): boolean {
  if (!isRecord(value)
    || !hasStringFields(value, [
      "id",
      "pairId",
      "title",
      "question",
      "reason",
      "methodDetail",
      "scope",
      "firstAction",
    ])
    || !isOneOf(value.variant, ["안전 축소형", "차별 심화형"])
    || typeof value.minWeeks !== "number"
    || ![4, 8, 16].includes(value.minWeeks)
    || !isStringArray(value.majors)
    || !isStringArray(value.interests)
    || !isStringArray(value.methods)
    || !isStringArray(value.goodDataAccess)
    || !isStringArray(value.avoidTags)
    || !isStringArray(value.uncertainties)
    || !(value.problem === undefined || typeof value.problem === "string")
    || !(value.userConfirmed === undefined || isStringArray(value.userConfirmed))
    || !(value.aiProposed === undefined || isStringArray(value.aiProposed))) return false;
  return isArrayOf(value.dataOptions, (item) => (
    isRecord(item)
    && typeof item.name === "string"
    && isOneOf(item.status, ["확인됨", "조건부", "확인 필요"])
  )) && isArrayOf(value.evidence, (item) => (
    isRecord(item)
    && hasStringFields(item, ["id", "title", "type", "verifiedAt"])
  ));
}

function isTopicWithChecks(value: unknown): boolean {
  if (!isRecord(value)
    || !isResearchTopic(value.topic)
    || !isStringArray(value.matchedInterests)
    || !isStringArray(value.matchedMethods)) return false;
  const checks = value.checks;
  if (!isRecord(checks)) return false;
  return ["personalLink", "dataAccess", "method", "period", "uncertainty"]
    .every((key) => isTopicCheck(checks[key]));
}

function isRecommendResult(value: unknown): boolean {
  if (!isRecord(value) || !isOneOf(value.kind, ["ok", "insufficient", "empty"])) return false;
  if (value.kind === "empty") return true;
  if (value.kind === "insufficient") return isTopicWithChecks(value.candidate);
  return Array.isArray(value.candidates)
    && value.candidates.length === 2
    && value.candidates.every(isTopicWithChecks);
}

function isGrowthDirectionSnapshot(value: unknown): boolean {
  return isRecord(value)
    && hasStringFields(value, ["major", "capturedAt"])
    && isStringArray(value.interests)
    && isStringArray(value.careerConcerns);
}

function isProfessorDiscoverySummary(value: unknown): boolean {
  return isRecord(value)
    && typeof value.major === "string"
    && isStringArray(value.interests)
    && isStringArray(value.careerConcerns);
}

function isProfessorCoverage(value: unknown): boolean {
  return isRecord(value)
    && typeof value.officialRecordCount === "number"
    && Number.isFinite(value.officialRecordCount)
    && isOneOf(value.scopeStatus, ["SAMPLE", "PARTIAL", "COMPLETE"])
    && isArrayOf(value.coverageGaps, (gap) => (
      isRecord(gap)
      && hasStringFields(gap, ["university", "reason", "scopeImpact", "sourceUrl"])
      && (gap.department === undefined || typeof gap.department === "string")
      && isOneOf(gap.status, [
        "FOUND",
        "NOT_LISTED_ON_OFFICIAL_PROFILE",
        "PROFILE_UNAVAILABLE",
        "PARSE_FAILED",
        "ROBOTS_BLOCKED",
      ])
    ))
    && hasStringFields(value, ["note", "selectionPolicy", "rankingSource"])
    && isNullableStringValue(value.rankingModel);
}

function isProfessorPaperSelection(value: unknown): boolean {
  if (!isRecord(value)
    || !hasStringFields(value, [
      "professorId",
      "professorName",
      "professorDepartment",
      "paperId",
      "title",
      "publicationType",
      "officialProfileUrl",
      "selectedAt",
    ])
    || !isNullableStringValue(value.publishedDate)
    || !isNullableStringValue(value.doi)
    || !isNullableStringValue(value.kciId)) return false;
  if (value.confirmedPublicPaper === undefined || value.confirmedPublicPaper === null) return true;
  return isRecord(value.confirmedPublicPaper)
    && hasStringFields(value.confirmedPublicPaper, ["officialPaperId", "title", "confirmedAt"])
    && isNullableStringValue(value.confirmedPublicPaper.publishedDate)
    && isNullableStringValue(value.confirmedPublicPaper.doi)
    && isNullableStringValue(value.confirmedPublicPaper.sourceUrl)
    && isNullableStringValue(value.confirmedPublicPaper.license);
}

function isProfessorMatchTopic(value: unknown): boolean {
  if (!isRecord(value)
    || !hasStringFields(value, ["id", "title", "question", "methodDetail", "scope", "major"])
    || !isStringArray(value.interests)
    || !isStringArray(value.methods)
    || !(value.careerInterests === undefined || isStringArray(value.careerInterests))
    || !(value.careerConcerns === undefined || isStringArray(value.careerConcerns))) return false;
  return [
    "university",
    "college",
    "goal",
    "studentStage",
    "secondaryMajorType",
    "secondaryCollege",
    "secondaryMajor",
    "careerGoal",
    "meetingSituation",
    "preferredSupport",
    "experience",
    "additionalContext",
  ].every((key) => value[key] === undefined || typeof value[key] === "string");
}

function isOptionalNullableStringValue(value: unknown): boolean {
  return value === undefined || isNullableStringValue(value);
}

function isCurrentSnapshotState(key: LocalRecordStorageKey, state: Record<string, unknown>): boolean {
  if (key === "major-evolution-profile-v1") {
    return isProfileState(state.profile)
      && typeof state.hasEnteredService === "boolean"
      && typeof state.hasCompletedProfessorTutorial === "boolean";
  }
  if (key === "major-evolution-research-v1") {
    if (!isResearchConditions(state.conditions)) return false;
    return isArrayOf(state.coDesignAnswers, isConfirmedAnswer)
      && isArrayOf(state.coDesignFollowUpQuestions, isCoDesignQuestion)
      && isArrayOf(state.professorMatches, isProfessorMatch)
      && isArrayOf(state.projectProfessorMatches, isProfessorMatch)
      && isStringArray(state.professorRejectedIds)
      && isStringArray(state.favoriteProfessorIds)
      && isArrayOf(state.growthProjectHistory, isGrowthProjectRecord)
      && isArrayOf(state.growthProfessorHistory, isGrowthProfessorRecord)
      && isStringArray(state.seenIds)
      && isRecordOf(state.knockKitDrafts, isProfessorKnockKitDraft)
      && isRecordOf(state.mentorLoopEntries, isProfessorMentorLoopEntry)
      && (state.result === undefined || state.result === null || isRecommendResult(state.result))
      && (state.professorCoverage === undefined || state.professorCoverage === null || isProfessorCoverage(state.professorCoverage))
      && (state.projectProfessorCoverage === undefined || state.projectProfessorCoverage === null || isProfessorCoverage(state.projectProfessorCoverage))
      && (state.professorDiscoveryTopic === undefined || state.professorDiscoveryTopic === null || isProfessorMatchTopic(state.professorDiscoveryTopic))
      && (state.professorDiscoverySummary === undefined || state.professorDiscoverySummary === null || isProfessorDiscoverySummary(state.professorDiscoverySummary))
      && (state.growthDirectionBaseline === undefined || state.growthDirectionBaseline === null || isGrowthDirectionSnapshot(state.growthDirectionBaseline))
      && (state.selectedProfessorPaper === undefined || state.selectedProfessorPaper === null || isProfessorPaperSelection(state.selectedProfessorPaper))
      && isOptionalNullableStringValue(state.selectedTopicId)
      && isOptionalNullableStringValue(state.professorMatchError)
      && isOptionalNullableStringValue(state.professorMatchTopicId)
      && isOptionalNullableStringValue(state.projectProfessorMatchError)
      && isOptionalNullableStringValue(state.projectProfessorMatchTopicId)
      && isOptionalNullableStringValue(state.selectedProjectProfessorId)
      && isOptionalNullableStringValue(state.selectedProfessorId)
      && isOptionalNullableStringValue(state.groundingNote)
      && isOptionalNullableStringValue(state.reRecommendNote)
      && (state.professorMatchStatus === undefined || isOneOf(state.professorMatchStatus, ["idle", "loading", "success", "error"]))
      && (state.projectProfessorMatchStatus === undefined || isOneOf(state.projectProfessorMatchStatus, ["idle", "loading", "success", "error"]))
      && (state.ideaMode === undefined || state.ideaMode === null || isOneOf(state.ideaMode, ["free", "trend", "fusion"]))
      && (state.coDesignQuestionSource === undefined || state.coDesignQuestionSource === null || isOneOf(state.coDesignQuestionSource, ["ai", "fallback"]))
      && (state.resultOrigin === undefined || state.resultOrigin === null || isOneOf(state.resultOrigin, ["ai", "reviewed-fallback"]))
      && (state.coDesignStep === undefined || (typeof state.coDesignStep === "number" && Number.isInteger(state.coDesignStep)))
      && (state.loadKey === undefined || (typeof state.loadKey === "number" && Number.isInteger(state.loadKey)));
  }
  if (key === "nyp-quest-cards-v1") return isArrayOf(state.cards, isSavedQuestCard);
  return isAiProfessorMessages(state.messages)
    && isArrayOf(state.growthNotes, isAiGrowthNote)
    && isStringArray(state.collapsedMapNodeIds)
    && isStringArray(state.detachedMapNodeIds)
    && isRecord(state.mapDecisions)
    && Object.values(state.mapDecisions).every((decision) => isOneOf(decision, ["keep", "exclude"]));
}

function isPersistedSnapshot(value: unknown, key: LocalRecordStorageKey): value is PersistedSnapshot {
  if (!isRecord(value)
    || !isRecord(value.state)
    || typeof value.version !== "number"
    || !Number.isInteger(value.version)
    || value.version < 0) return false;
  const currentVersion = EMPTY_SNAPSHOTS[key].version;
  return value.version === currentVersion && isCurrentSnapshotState(key, value.state);
}

function validateSnapshots(value: unknown): Record<LocalRecordStorageKey, PersistedSnapshot> {
  if (!isRecord(value)) throw unsupportedFormat();
  const keys = Object.keys(value).sort();
  const allowedKeys = [...LOCAL_RECORD_STORAGE_KEYS].sort();
  if (keys.length !== allowedKeys.length || keys.some((key, index) => key !== allowedKeys[index])) {
    throw unsupportedFormat();
  }

  const snapshots = {} as Record<LocalRecordStorageKey, PersistedSnapshot>;
  for (const key of LOCAL_RECORD_STORAGE_KEYS) {
    const snapshot = value[key];
    if (!isPersistedSnapshot(snapshot, key)) throw unsupportedFormat();
    snapshots[key] = { state: snapshot.state, version: snapshot.version };
  }
  return snapshots;
}

function cloneEmptySnapshot(key: LocalRecordStorageKey): PersistedSnapshot {
  const snapshot = EMPTY_SNAPSHOTS[key];
  return JSON.parse(JSON.stringify(snapshot)) as PersistedSnapshot;
}

function parseStoredSnapshot(rawValue: string, key: LocalRecordStorageKey): PersistedSnapshot {
  try {
    const parsed: unknown = JSON.parse(rawValue);
    if (!isPersistedSnapshot(parsed, key)) throw unsupportedFormat();
    return { state: parsed.state, version: parsed.version };
  } catch (error) {
    if (error instanceof Error && error.message.includes("지원하지 않는 형식")) throw error;
    throw new Error(`현재 ${key} 기록을 읽을 수 없습니다. 기록을 정리한 뒤 다시 시도해 주세요.`);
  }
}

function byteLength(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength;
}

function isString(value: unknown, maxLength: number): value is string {
  return typeof value === "string" && value.length <= maxLength;
}

function isStringList(value: unknown, maxItems: number, maxLength: number): value is string[] {
  return Array.isArray(value)
    && value.length <= maxItems
    && value.every((item) => isString(item, maxLength));
}

function isNullableString(value: unknown, maxLength: number): boolean {
  return value === null || isString(value, maxLength);
}

function isTutorialDraft(value: unknown): value is AuxiliaryRecord {
  if (!isRecord(value)
    || value.version !== 1
    || !["welcome", "major", "mode", "interests", "readiness", "feasibility", "review"].includes(String(value.step))
    || !(value.ideaMode === null || ["free", "trend", "fusion"].includes(String(value.ideaMode)))
    || !isRecord(value.conditions)) return false;
  const conditions = value.conditions;
  return isString(conditions.school, 80)
    && isNullableString(conditions.majorArea, 40)
    && isNullableString(conditions.major, 80)
    && isStringList(conditions.interests, 3, 60)
    && isNullableString(conditions.experience, 40)
    && isStringList(conditions.methods, 2, 60)
    && isNullableString(conditions.period, 40)
    && isNullableString(conditions.dataAccess, 80)
    && isStringList(conditions.avoid, 10, 60);
}

function projectExecutionKeyParts(key: string): { topicId: string; professorId: string } | null {
  if (key.length > 300) return null;
  const match = /^project-execution:([^:\s\x00-\x1f]{1,128}):([^:\s\x00-\x1f]{1,128})$/.exec(key);
  return match ? { topicId: match[1], professorId: match[2] } : null;
}

function isProjectExecutionDraft(key: string, value: unknown): value is AuxiliaryRecord {
  const keyParts = projectExecutionKeyParts(key);
  if (!keyParts || !isRecord(value) || !isRecord(value.materials)) return false;
  return value.topicId === keyParts.topicId
    && value.professorId === keyParts.professorId
    && isString(value.meetingGoal, 2000)
    && isString(value.executionPlan, 2000)
    && isStringList(value.questions, 3, 2000)
    && value.questions.length === 3
    && typeof value.materials["project-brief"] === "boolean"
    && typeof value.materials.evidence === "boolean"
    && typeof value.materials["sample-data"] === "boolean"
    && typeof value.materials["decision-log"] === "boolean"
    && isString(value.reflection, 2000)
    && isString(value.updatedAt, 40);
}

function validateAuxiliaryRecord(key: string, value: unknown): AuxiliaryRecord {
  if (byteLength(value) > LOCAL_RECORD_MAX_AUXILIARY_BYTES) throw unsupportedFormat();
  const valid = key === RESEARCH_TUTORIAL_STORAGE_KEY
    ? isTutorialDraft(value)
    : isProjectExecutionDraft(key, value);
  if (!valid) throw unsupportedFormat();
  return value as AuxiliaryRecord;
}

function validateRecords(value: unknown): Record<string, AuxiliaryRecord> {
  if (!isRecord(value)) throw unsupportedFormat();
  const projectKeys = Object.keys(value).filter((key) => key.startsWith(PROJECT_EXECUTION_STORAGE_PREFIX));
  if (projectKeys.length > LOCAL_RECORD_MAX_PROJECT_EXECUTION_RECORDS) {
    throw new Error(`프로젝트 실행 기록은 최대 ${LOCAL_RECORD_MAX_PROJECT_EXECUTION_RECORDS}개까지 가져올 수 있습니다.`);
  }
  const records: Record<string, AuxiliaryRecord> = {};
  for (const key of Object.keys(value).sort()) records[key] = validateAuxiliaryRecord(key, value[key]);
  return records;
}

function storageProjectExecutionKeys(storage: LocalStorageLike): string[] {
  const keys: string[] = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key && projectExecutionKeyParts(key)) keys.push(key);
  }
  if (keys.length > LOCAL_RECORD_MAX_PROJECT_EXECUTION_RECORDS) {
    throw new Error(`프로젝트 실행 기록은 최대 ${LOCAL_RECORD_MAX_PROJECT_EXECUTION_RECORDS}개까지 백업할 수 있습니다.`);
  }
  return keys.sort();
}

function readAuxiliaryRecord(storage: LocalStorageLike, key: string): AuxiliaryRecord | null {
  const rawValue = storage.getItem(key);
  if (rawValue === null) return null;
  try {
    return validateAuxiliaryRecord(key, JSON.parse(rawValue));
  } catch (error) {
    if (error instanceof Error && error.message.includes("지원하지 않는 형식")) throw error;
    throw new Error(`현재 ${key} 기록을 읽을 수 없습니다. 기록을 정리한 뒤 다시 시도해 주세요.`);
  }
}

export function createLocalRecordBackup(
  storage: LocalStorageLike,
  options: { now?: () => string } = {},
): LocalRecordBackup {
  const snapshots = {} as Record<LocalRecordStorageKey, PersistedSnapshot>;
  for (const key of LOCAL_RECORD_STORAGE_KEYS) {
    const rawValue = storage.getItem(key);
    snapshots[key] = rawValue === null ? cloneEmptySnapshot(key) : parseStoredSnapshot(rawValue, key);
  }
  const records: Record<string, AuxiliaryRecord> = {};
  const tutorialDraft = readAuxiliaryRecord(storage, RESEARCH_TUTORIAL_STORAGE_KEY);
  if (tutorialDraft) records[RESEARCH_TUTORIAL_STORAGE_KEY] = tutorialDraft;
  for (const key of storageProjectExecutionKeys(storage)) {
    const record = readAuxiliaryRecord(storage, key);
    if (record) records[key] = record;
  }
  return {
    format: LOCAL_RECORD_BACKUP_FORMAT,
    formatVersion: LOCAL_RECORD_BACKUP_FORMAT_VERSION,
    exportedAt: options.now?.() ?? new Date().toISOString(),
    snapshots,
    records,
  };
}

export function parseLocalRecordBackup(rawValue: string): LocalRecordBackup {
  if (new TextEncoder().encode(rawValue).byteLength > LOCAL_RECORD_BACKUP_MAX_BYTES) {
    throw new Error("백업 파일은 2MB 이하만 가져올 수 있습니다.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawValue);
  } catch {
    throw unsupportedFormat();
  }
  if (!isRecord(parsed)
    || parsed.format !== LOCAL_RECORD_BACKUP_FORMAT
    || parsed.formatVersion !== LOCAL_RECORD_BACKUP_FORMAT_VERSION
    || typeof parsed.exportedAt !== "string") {
    throw unsupportedFormat();
  }
  return {
    format: LOCAL_RECORD_BACKUP_FORMAT,
    formatVersion: LOCAL_RECORD_BACKUP_FORMAT_VERSION,
    exportedAt: parsed.exportedAt,
    snapshots: validateSnapshots(parsed.snapshots),
    records: validateRecords(parsed.records),
  };
}

export function restoreLocalRecordBackup(storage: LocalStorageLike, backup: LocalRecordBackup): void {
  const validatedBackup = parseLocalRecordBackup(JSON.stringify(backup));
  const existingProjectKeys = storageProjectExecutionKeys(storage);
  const incomingRecordKeys = Object.keys(validatedBackup.records);
  const affectedKeys = Array.from(new Set<string>([
    ...LOCAL_RECORD_STORAGE_KEYS,
    RESEARCH_TUTORIAL_STORAGE_KEY,
    ...existingProjectKeys,
    ...incomingRecordKeys,
  ]));
  const previousValues = new Map<string, string | null>();
  for (const key of affectedKeys) previousValues.set(key, storage.getItem(key));

  const stagingKey = `${RESTORE_STAGING_STORAGE_PREFIX}${Date.now()}:${Math.random().toString(36).slice(2)}`;
  const stagingPayload = JSON.stringify(validatedBackup);
  try {
    if (storage.getItem(stagingKey) !== null) throw new Error("임시 저장 키가 이미 사용 중입니다.");
    storage.setItem(stagingKey, stagingPayload);
    if (storage.getItem(stagingKey) !== stagingPayload) {
      throw new Error("복원 파일을 임시 저장소에서 확인하지 못했습니다.");
    }
    storage.removeItem(stagingKey);
    if (storage.getItem(stagingKey) !== null) {
      throw new Error("복원 임시 저장소를 정리하지 못했습니다.");
    }
  } catch (error) {
    try {
      storage.removeItem(stagingKey);
    } catch {
      // 실제 사용자 기록은 아직 바꾸지 않았으므로 임시 키 정리만 최선 범위에서 시도한다.
    }
    const detail = error instanceof Error ? error.message : "알 수 없는 저장소 오류";
    throw new Error(`기록을 저장하지 못했습니다. 저장 공간을 확인한 뒤 다시 시도해 주세요. (${detail})`);
  }

  try {
    for (const key of LOCAL_RECORD_STORAGE_KEYS) {
      storage.setItem(key, JSON.stringify(validatedBackup.snapshots[key]));
    }
    for (const key of incomingRecordKeys) {
      storage.setItem(key, JSON.stringify(validatedBackup.records[key]));
    }
    if (!(RESEARCH_TUTORIAL_STORAGE_KEY in validatedBackup.records)) {
      storage.removeItem(RESEARCH_TUTORIAL_STORAGE_KEY);
    }
    for (const key of existingProjectKeys) {
      if (!(key in validatedBackup.records)) storage.removeItem(key);
    }
  } catch (error) {
    for (const key of affectedKeys) {
      const previous = previousValues.get(key) ?? null;
      try {
        if (previous === null) storage.removeItem(key);
        else storage.setItem(key, previous);
      } catch {
        // 브라우저 저장소가 더 이상 쓰기를 허용하지 않으면 가능한 범위만 되돌린다.
      }
    }
    const detail = error instanceof Error ? error.message : "알 수 없는 저장소 오류";
    throw new Error(`기록을 저장하지 못했습니다. 저장 공간을 확인한 뒤 다시 시도해 주세요. (${detail})`);
  }
}
