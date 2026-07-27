export type ProfessorDataStatus =
  | "FOUND"
  | "NOT_LISTED_ON_OFFICIAL_PROFILE"
  | "PROFILE_UNAVAILABLE"
  | "PARSE_FAILED"
  | "ROBOTS_BLOCKED";

export type ProfessorMatchRole = "TOPIC" | "METHOD" | "CONTEXT";
export type ProfessorMatchStrength = "DIRECT" | "RELATED" | "LIMITED";

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

export type ProfessorMatch = {
  professor: OfficialProfessor;
  role: ProfessorMatchRole;
  strength: ProfessorMatchStrength;
  reason: string;
  evidenceIds: string[];
  matchedTerms: string[];
  doesNotEstablish: string[];
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
  generatedAt: string;
  officialRecordCount: number;
  scopeStatus: "SAMPLE" | "PARTIAL" | "COMPLETE";
  coverageGaps: ProfessorCoverageGap[];
  note: string;
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
