export type ProfessorDataStatus =
  | "FOUND"
  | "NOT_LISTED_ON_OFFICIAL_PROFILE"
  | "PROFILE_UNAVAILABLE"
  | "PARSE_FAILED"
  | "ROBOTS_BLOCKED";

export type ProfessorMatchRole = "TOPIC" | "METHOD" | "CONTEXT";
export type ProfessorMatchStrength = "DIRECT" | "RELATED" | "LIMITED";
export const PROFESSOR_MATCH_POLICY = "OFFICIAL_EVIDENCE_RULES_V5" as const;
export const SUPPORTED_PROFESSOR_UNIVERSITY = "단국대학교" as const;

export type ProfessorMatchedAcademicAffiliation = {
  type: "PRIMARY" | "SECONDARY";
  /** 학생이 직접 선택한 구분입니다. 예: 주전공, 부전공, 복수전공. */
  label: string;
  college: string;
  major: string;
  /** 교수 공식 프로필의 다중 소속 중 실제로 일치한 학과명입니다. */
  officialDepartment: string;
};

export type ProfessorMatchDecisionBasis = {
  matchedConcepts: string[];
  /** 주전공 또는 입력한 부·복수전공과 공식 프로필 소속이 일치하는지 나타냅니다. */
  departmentMatchesMajor: boolean;
  /** 어떤 학업 소속과 연결됐는지 피칭 화면에서 그대로 설명하기 위한 근거입니다. */
  matchedAcademicAffiliation?: ProfessorMatchedAcademicAffiliation;
  roleMatches: {
    topic: boolean;
    method: boolean;
    context: boolean;
  };
  sources: {
    officialProfile: boolean;
    researchFields: boolean;
    matchedPublication: boolean;
  };
};

export type OfficialPublication = {
  id: string;
  title: string;
  publicationType: string;
  publishedDate: string | null;
  doi: string | null;
  kciId: string | null;
  officialProfileUrl: string;
};

export type OfficialProfessor = {
  id: string;
  university: string;
  college: string;
  department: string;
  departments: string[];
  associationStatuses: string[];
  name: string;
  title: string;
  researchFields: string[];
  publications: OfficialPublication[];
  publicationCount: number;
  officialProfileUrl: string;
  sourceUrl: string;
  collectedAt: string;
  status: ProfessorDataStatus;
  researchFieldsStatus: ProfessorDataStatus;
  publicationsStatus: ProfessorDataStatus;
  failureReason: string | null;
  profileEvidenceId: string;
};

/**
 * 즐겨찾기 논문 선택 창에 필요한 최소 교수 정보입니다.
 *
 * 연락처·사진 원본처럼 논문 선택에 불필요한 필드는 API로 보내지 않습니다.
 */
export type FavoriteProfessorPaperCatalog = Pick<
  OfficialProfessor,
  | "id"
  | "university"
  | "college"
  | "department"
  | "name"
  | "title"
  | "publications"
  | "publicationCount"
  | "publicationsStatus"
  | "officialProfileUrl"
>;

export type FavoriteProfessorPaperCatalogResponse = {
  professors: FavoriteProfessorPaperCatalog[];
  missingProfessorIds: string[];
  fetchedAt: string;
};

/**
 * 논문 한입에 전달하는 공식 논문 메타데이터입니다.
 *
 * 제목과 출처만 자동 입력하며, 초록·본문은 저작권과 정확성을 위해
 * 학생이 직접 붙여 넣어야 합니다.
 */
export type ProfessorPaperSelection = {
  professorId: string;
  professorName: string;
  professorDepartment: string;
  paperId: string;
  title: string;
  publicationType: string;
  publishedDate: string | null;
  doi: string | null;
  kciId: string | null;
  officialProfileUrl: string;
  selectedAt: string;
  confirmedPublicPaper?: {
    officialPaperId: string;
    title: string;
    publishedDate: string | null;
    doi: string | null;
    sourceUrl: string | null;
    license: string | null;
    confirmedAt: string;
  } | null;
};

export type ProfessorMatch = {
  professor: OfficialProfessor;
  role: ProfessorMatchRole;
  strength: ProfessorMatchStrength;
  reason: string;
  evidenceIds: string[];
  matchedTerms: string[];
  doesNotEstablish: string[];
  decisionBasis: ProfessorMatchDecisionBasis;
  /** 선택한 프로젝트 맥락을 기준으로 AI가 정리한 멘토 적합 이유. 공식 후보 안에서만 생성합니다. */
  mentorFitReason?: string;
};

export type ProfessorMatchTopic = {
  id: string;
  title: string;
  question: string;
  methodDetail: string;
  scope: string;
  interests: string[];
  methods: string[];
  major: string;
  /** 기존 만들다 → 찾다 호출과 호환하기 위해 선택 필드로 둡니다. API는 별도로 학교를 검증합니다. */
  university?: string;
  college?: string;
  goal?: string;
  studentStage?: string;
  secondaryMajorType?: string;
  secondaryCollege?: string;
  secondaryMajor?: string;
  careerInterests?: string[];
  careerConcerns?: string[];
  careerGoal?: string;
  meetingSituation?: string;
  preferredSupport?: string;
  experience?: string;
  additionalContext?: string;
};

export type ProfessorCoverageGap = {
  university: string;
  department?: string;
  status: ProfessorDataStatus;
  reason: string;
  scopeImpact: string;
  sourceUrl: string;
};

export type ProfessorMatchResponse = {
  topicId: string;
  matches: ProfessorMatch[];
  selectionPolicy: typeof PROFESSOR_MATCH_POLICY;
  generatedAt: string;
  officialRecordCount: number;
  scopeStatus: "SAMPLE" | "PARTIAL" | "COMPLETE";
  coverageGaps: ProfessorCoverageGap[];
  note: string;
  rankingSource: "ai-reranked" | "official-rules";
  rankingModel: string | null;
};

export type ProfessorKnockKitDraft = {
  topicId: string;
  professorId: string;
  introduction: string;
  questions: [string, string, string];
  agenda: string;
  emailDraft: string;
  updatedAt: string;
};

export type ProfessorMentorLoopEntry = {
  topicId: string;
  professorId: string;
  meetingDate: string;
  feedbackSummary: string;
  recommendedResources: string;
  cautionPoint: string;
  commitment: string;
  before: {
    question: string;
    methodDetail: string;
    scope: string;
  };
  after: {
    question: string;
    methodDetail: string;
    scope: string;
  };
  sevenDayActions: [string, string, string];
  nextCheckAt: string;
  followUpEmail: string;
  updatedAt: string;
};
