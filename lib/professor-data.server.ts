import "server-only";

import dkuRuntime from "@/data/professors/runtime/dku-professors.json";
import {
  buildProfessorAcademicTaxonomy,
  comparableDepartmentName,
  type ProfessorAcademicTaxonomy,
} from "@/lib/professor-academic-taxonomy";
import { PROFESSOR_MATCH_POLICY } from "@/lib/professor-domain";
import { buildProfessorEvidenceText } from "@/lib/professor-match-evidence";
import type {
  OfficialProfessor,
  OfficialPublication,
  ProfessorCoverageGap,
  ProfessorDataStatus,
  ProfessorMatch,
  ProfessorMatchDecisionBasis,
  ProfessorMatchedAcademicAffiliation,
  ProfessorMatchResponse,
  ProfessorMatchRole,
  ProfessorMatchStrength,
  ProfessorMatchTopic,
} from "@/lib/professor-domain";

type RawPublication = {
  id?: string;
  title: string;
  publication_type: string;
  published_date: string | null;
  doi: string | null;
  kci_id: string | null;
  official_profile_url: string;
};

type RawProfessor = {
  id: string;
  university: string;
  college: string;
  department: string;
  departments?: string[];
  association_statuses?: string[];
  name: string;
  title: string;
  research_fields: string[];
  publications: RawPublication[];
  publication_count?: number;
  official_profile_url: string;
  source_url: string;
  collected_at: string;
  status: ProfessorDataStatus;
  research_fields_status: ProfessorDataStatus;
  publications_status: ProfessorDataStatus;
  failure_reason: string | null;
};

type RawDataset = {
  records: RawProfessor[];
  scope_status: "SAMPLE" | "PARTIAL" | "COMPLETE";
  official_record_count: number;
  note: string;
  coverage_gaps?: Array<{
    university?: string;
    department?: string;
    status: ProfessorDataStatus;
    source_url: string;
    reason: string;
    scope_impact: string;
  }>;
};

const dataset = dkuRuntime as unknown as RawDataset;

const matchingConcepts: Array<{
  label: string;
  topicTerms: string[];
  evidenceTerms: string[];
  role: ProfessorMatchRole;
}> = [
  {
    label: "AI·텍스트 분석",
    topicTerms: [
      "ai",
      "인공지능",
      "머신러닝",
      "딥러닝",
      "자연어",
      "텍스트 분석",
      "분류 모델",
    ],
    evidenceTerms: [
      "ai",
      "인공지능",
      "머신러닝",
      "딥러닝",
      "자연어",
      "텍스트",
      "데이터마이닝",
      "data mining",
    ],
    role: "METHOD",
  },
  {
    label: "소비자 가치·선택",
    topicTerms: ["소비자", "지불의사", "가격 프리미엄", "선택실험", "구매", "설문"],
    evidenceTerms: [
      "소비자",
      "지불의사",
      "가치평가",
      "비시장재화",
      "구매행태",
      "수요",
      "마케팅",
      "선택실험",
    ],
    role: "TOPIC",
  },
  {
    label: "경제·금융",
    topicTerms: [
      "경제·금융",
      "경제",
      "금융",
      "금리",
      "증권",
      "투자",
      "거시경제",
      "미시경제",
      "계량경제",
    ],
    evidenceTerms: [
      "경제",
      "경제학",
      "금융",
      "금리",
      "증권",
      "투자",
      "계량경제",
      "거시경제",
      "미시경제",
      "화폐",
      "재정",
    ],
    role: "TOPIC",
  },
  {
    label: "농식품·식품 시장",
    topicTerms: ["농식품", "식품", "농산물", "푸드", "먹거리"],
    evidenceTerms: [
      "농식품",
      "식품",
      "농산물",
      "농업",
      "먹거리",
      "로컬푸드",
      "식품산업",
    ],
    role: "TOPIC",
  },
  {
    label: "가격·시장",
    topicTerms: ["가격", "시장", "급등", "수급", "유통", "무역"],
    evidenceTerms: ["가격", "시장", "수급", "유통", "무역", "경제", "마케팅"],
    role: "TOPIC",
  },
  {
    label: "친환경·지속가능성",
    topicTerms: ["친환경", "esg", "지속가능", "그린워싱", "환경 표시", "탄소"],
    evidenceTerms: ["친환경", "esg", "지속가능", "환경", "녹색", "탄소", "자원순환"],
    role: "CONTEXT",
  },
  {
    label: "정책·행정",
    topicTerms: ["정책", "공공", "규제", "정부", "제도"],
    evidenceTerms: ["정책", "공공", "규제", "정부", "행정", "제도"],
    role: "CONTEXT",
  },
  {
    label: "시계열·예측",
    topicTerms: ["시계열", "조기경보", "예측", "추세", "패널"],
    evidenceTerms: ["시계열", "예측", "forecast", "패널", "계량", "회귀"],
    role: "METHOD",
  },
  {
    label: "설문·통계 분석",
    topicTerms: ["설문", "회귀", "통계", "실험", "상관"],
    evidenceTerms: ["설문", "회귀", "통계", "실험", "계량", "조사"],
    role: "METHOD",
  },
  {
    label: "문학·서사",
    topicTerms: ["고전", "소설", "설화", "서사", "문학", "시가", "시조", "한시"],
    evidenceTerms: ["고전", "소설", "설화", "서사", "문학", "시가", "시조", "한시"],
    role: "TOPIC",
  },
  {
    label: "프로젝트·실무 연결",
    topicTerms: ["프로젝트", "학부연구", "연구 참여", "실무 경험", "산학"],
    evidenceTerms: ["프로젝트", "융합", "응용", "산학", "현장", "실무"],
    role: "CONTEXT",
  },
  {
    label: "대학원·학술 탐색",
    topicTerms: ["대학원", "연구실", "학술", "논문 준비"],
    evidenceTerms: ["대학원", "연구실", "학술", "세미나", "논문"],
    role: "CONTEXT",
  },
  {
    label: "교수와의 만남 상황",
    topicTerms: ["수업 후", "오피스아워", "이메일", "연구실 방문", "면담"],
    evidenceTerms: ["교육", "학생", "상담", "멘토링", "지도", "세미나"],
    role: "CONTEXT",
  },
];

/**
 * 개념 사전은 고정이므로 정규화한 형태를 미리 만들어 둡니다.
 * 근거 용어는 화면에 그대로 보여주므로 원문(raw)을 함께 들고 다닙니다.
 */
const normalizedConcepts = matchingConcepts.map((concept) => ({
  label: concept.label,
  role: concept.role,
  topicTerms: concept.topicTerms.map((term) => normalize(term)),
  evidenceTerms: concept.evidenceTerms.map((term) => ({
    raw: term,
    normalized: normalize(term),
  })),
}));

const genericTerms = new Set([
  "연구",
  "분석",
  "데이터",
  "기반",
  "활용",
  "관련",
  "영향",
  "효과",
  "방법",
  "모델",
  "설계",
  "탐색",
  "관계",
  "경제",
  "학과",
  "전공",
  "국내",
  "분야",
  "과정",
  "대한",
  "어떤",
  "있는가",
  "에서",
  "관점에서",
  "어떻게",
  "있을까",
  "통해",
  "위한",
]);

function normalize(value: string): string {
  return value.toLocaleLowerCase("ko-KR").replace(/\s+/g, " ").trim();
}

function meaningfulTerms(value: string): string[] {
  return normalize(value)
    .split(/[^0-9a-z가-힣]+/u)
    .map((term) => term.trim())
    .filter((term) => term.length >= 2);
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

/** 짧은 영문·숫자 용어의 단어 경계 정규식. 같은 용어를 다시 컴파일하지 않으려고 모아 둡니다. */
const boundaryPatterns = new Map<string, RegExp>();

function boundaryPattern(normalizedTerm: string): RegExp {
  const cached = boundaryPatterns.get(normalizedTerm);
  if (cached) return cached;
  const escaped = normalizedTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`(?:^|[^a-z0-9])${escaped}(?:$|[^a-z0-9])`, "i");
  boundaryPatterns.set(normalizedTerm, pattern);
  return pattern;
}

/**
 * 이미 normalize를 거친 텍스트와 용어를 대조합니다.
 *
 * normalize는 toLocaleLowerCase를 타서 문자열 길이에 비례해 무겁습니다.
 * 교수 1,051명을 훑는 동안 같은 문자열을 수백 번 다시 정규화하지 않으려고,
 * 정규화된 값을 그대로 받는 길을 따로 둡니다.
 */
function normalizedContains(normalizedText: string, normalizedTerm: string): boolean {
  if (!normalizedTerm) return false;
  if (normalizedTerm.length <= 3 && /^[a-z0-9]+$/.test(normalizedTerm)) {
    return boundaryPattern(normalizedTerm).test(normalizedText);
  }
  return normalizedText.includes(normalizedTerm);
}

/**
 * 아직 정규화하지 않은 값을 대조할 때 씁니다.
 * 1,051명을 훑는 경로에서는 쓰지 마세요. 거기서는 정규화를 미리 끝내고
 * normalizedContains를 직접 부릅니다.
 */
function containsTerm(text: string, term: string): boolean {
  return normalizedContains(normalize(text), normalize(term));
}

function toPublication(raw: RawPublication, professorId: string, index: number): OfficialPublication {
  return {
    id: raw.id ?? `publication:${professorId}:${index + 1}`,
    title: raw.title,
    publicationType: raw.publication_type,
    publishedDate: raw.published_date,
    doi: raw.doi,
    kciId: raw.kci_id,
    officialProfileUrl: raw.official_profile_url,
  };
}

function toProfessor(raw: RawProfessor): OfficialProfessor {
  return {
    id: raw.id,
    university: raw.university,
    college: raw.college,
    department: raw.department,
    departments: raw.departments ?? [raw.department],
    associationStatuses: raw.association_statuses ?? [],
    name: raw.name,
    title: raw.title,
    researchFields: raw.research_fields,
    publications: raw.publications.map((publication, index) =>
      toPublication(publication, raw.id, index)),
    publicationCount: raw.publication_count ?? raw.publications.length,
    officialProfileUrl: raw.official_profile_url,
    sourceUrl: raw.source_url,
    collectedAt: raw.collected_at,
    status: raw.status,
    researchFieldsStatus: raw.research_fields_status,
    publicationsStatus: raw.publications_status,
    failureReason: raw.failure_reason,
    profileEvidenceId: `profile:${raw.id}`,
  };
}

const officialProfessors = dataset.records.map(toProfessor);
const professorById = new Map(officialProfessors.map((professor) => [professor.id, professor]));

/**
 * 교수 쪽 대조 문자열을 미리 정규화해 둡니다.
 *
 * 학과·연구분야·논문 제목은 주제와 무관하게 늘 같으므로, 요청마다 1,051명분을
 * 다시 소문자로 접을 이유가 없습니다. 프로세스가 살아 있는 동안 한 번만 만듭니다.
 */
type ProfessorSearchIndex = {
  fieldEvidence: string;
  publicationEvidence: string;
  publicationTitles: string[];
  departments: string[];
  fieldTerms: string[];
};

function buildSearchIndex(professor: OfficialProfessor): ProfessorSearchIndex {
  return {
    fieldEvidence: normalize([
      professor.department,
      ...professor.researchFields,
    ].join(" ")),
    publicationEvidence: normalize(
      professor.publications.map((publication) => publication.title).join(" "),
    ),
    publicationTitles: professor.publications.map((publication) =>
      normalize(publication.title)),
    departments: professor.departments.map(normalize),
    fieldTerms: unique(professor.researchFields.flatMap(meaningfulTerms)),
  };
}

const professorSearchIndex = new Map<string, ProfessorSearchIndex>(
  officialProfessors.map((professor) => [professor.id, buildSearchIndex(professor)]),
);

function searchIndexFor(professor: OfficialProfessor): ProfessorSearchIndex {
  const cached = professorSearchIndex.get(professor.id);
  if (cached) return cached;
  const built = buildSearchIndex(professor);
  professorSearchIndex.set(professor.id, built);
  return built;
}

const coverageGaps: ProfessorCoverageGap[] = (dataset.coverage_gaps ?? []).map((gap) => ({
    university: gap.university ?? "단국대학교",
    department: gap.department,
    status: gap.status,
    reason: gap.reason,
    scopeImpact: gap.scope_impact,
    sourceUrl: gap.source_url,
  }));

/** topicTerms와 titles는 모두 정규화된 상태로 받습니다. */
function publicationEvidence(
  professor: OfficialProfessor,
  topicTerms: string[],
  titles: string[],
): OfficialPublication | undefined {
  return professor.publications
    .filter((publication, index) =>
      topicTerms.some((term) =>
        term.length >= 2 && normalizedContains(titles[index] ?? "", term)))
    .sort((left, right) => left.id.localeCompare(right.id))[0];
}

type EvaluatedProfessor = {
  match: ProfessorMatch;
  hasRelevantEvidence: boolean;
  roleEvidenceCounts: Record<ProfessorMatchRole, number>;
  matchedConcepts: Set<string>;
  researchFieldConcepts: Set<string>;
  publicationConcepts: Set<string>;
  researchFieldRoles: Set<ProfessorMatchRole>;
  publicationRoles: Set<ProfessorMatchRole>;
};

const rolePreference: ProfessorMatchRole[] = ["TOPIC", "METHOD", "CONTEXT"];
const conceptsForRole = (role: ProfessorMatchRole) =>
  matchingConcepts.filter((concept) => concept.role === role);

function compareDecisionBasis(
  left: ProfessorMatchDecisionBasis,
  right: ProfessorMatchDecisionBasis,
): number {
  const rules: Array<(basis: ProfessorMatchDecisionBasis) => boolean> = [
    (basis) => basis.roleMatches.topic,
    (basis) => basis.roleMatches.method,
    (basis) => basis.roleMatches.context,
    (basis) => basis.sources.matchedPublication,
    (basis) => basis.sources.researchFields,
    (basis) => basis.sources.officialProfile,
  ];

  for (const rule of rules) {
    const leftMatches = rule(left);
    const rightMatches = rule(right);
    if (leftMatches !== rightMatches) return leftMatches ? -1 : 1;
  }
  return 0;
}

function compareEvaluatedProfessors(
  left: EvaluatedProfessor,
  right: EvaluatedProfessor,
): number {
  for (const concept of conceptsForRole("TOPIC")) {
    const leftMatches = left.matchedConcepts.has(concept.label);
    const rightMatches = right.matchedConcepts.has(concept.label);
    if (leftMatches !== rightMatches) return leftMatches ? -1 : 1;
  }
  if (
    left.match.decisionBasis.departmentMatchesMajor
    !== right.match.decisionBasis.departmentMatchesMajor
  ) {
    return left.match.decisionBasis.departmentMatchesMajor ? -1 : 1;
  }
  for (const role of ["METHOD", "CONTEXT"] as const) {
    for (const concept of conceptsForRole(role)) {
      const leftMatches = left.matchedConcepts.has(concept.label);
      const rightMatches = right.matchedConcepts.has(concept.label);
      if (leftMatches !== rightMatches) return leftMatches ? -1 : 1;
    }
  }
  return compareDecisionBasis(left.match.decisionBasis, right.match.decisionBasis)
    || left.match.professor.id.localeCompare(right.match.professor.id);
}

/**
 * 주제 한 건에서 한 번만 구하면 되는 값들.
 *
 * 예전에는 이걸 교수 1,051명마다 다시 만들었습니다. 주제 문장을 다시 정규화하고,
 * 12개 개념의 주제 용어를 교수 수만큼 되풀이해 훑느라 요청당 2초 넘게 썼습니다.
 */
type TopicMatchContext = {
  evidenceText: string;
  topicTerms: string[];
  evidenceTopicTerms: string[];
  academicAffiliations: Array<Omit<ProfessorMatchedAcademicAffiliation, "officialDepartment"> & {
    normalizedMajor: string;
  }>;
  normalizedMethods: string[];
  /**
   * 주제 쪽에서 이미 걸린 개념만 남깁니다.
   * 주제에 걸리지 않은 개념은 어떤 교수와도 이어질 수 없으므로 교수마다 다시 볼 이유가 없습니다.
   */
  activeConcepts: typeof normalizedConcepts;
};

function buildTopicMatchContext(topic: ProfessorMatchTopic): TopicMatchContext {
  // 공식 연구근거 대조에는 전공·연구/산업 관심·희망 직무만 사용합니다.
  // 취업 고민, 학년, 만남 방식 같은 학생 맥락은 면담 질문을 개인화하되
  // 교수의 연구분야와 직접 일치하는 근거로 간주하지 않습니다.
  const evidenceText = normalize(buildProfessorEvidenceText(topic));
  const topicTerms = meaningfulTerms(evidenceText);
  const primaryMajor = topic.major.trim();
  const secondaryMajor = topic.secondaryMajor?.trim() ?? "";
  const academicAffiliations: TopicMatchContext["academicAffiliations"] = [];
  if (primaryMajor) {
    academicAffiliations.push({
      type: "PRIMARY",
      label: "주전공",
      college: topic.college?.trim() ?? "",
      major: primaryMajor,
      normalizedMajor: normalize(comparableDepartmentName(primaryMajor)),
    });
  }
  if (
    secondaryMajor
    && topic.secondaryMajorType
    && topic.secondaryMajorType !== "없음"
    && !academicAffiliations.some((affiliation) =>
      comparableDepartmentName(affiliation.major)
        === comparableDepartmentName(secondaryMajor))
  ) {
    academicAffiliations.push({
      type: "SECONDARY",
      label: topic.secondaryMajorType.trim(),
      college: topic.secondaryCollege?.trim() ?? "",
      major: secondaryMajor,
      normalizedMajor: normalize(comparableDepartmentName(secondaryMajor)),
    });
  }
  return {
    evidenceText,
    topicTerms,
    evidenceTopicTerms: topicTerms.filter((term) => !genericTerms.has(term)),
    academicAffiliations,
    normalizedMethods: topic.methods.map((method) => normalize(method)),
    activeConcepts: normalizedConcepts.filter((concept) =>
      concept.topicTerms.some((term) => normalizedContains(evidenceText, term))),
  };
}

function evaluateProfessor(
  professor: OfficialProfessor,
  topic: ProfessorMatchTopic,
  context: TopicMatchContext,
): EvaluatedProfessor {
  const { evidenceText, evidenceTopicTerms } = context;
  const index = searchIndexFor(professor);
  const fieldTerms = index.fieldTerms;
  const directTerms = fieldTerms.filter(
    (term) => !genericTerms.has(term) && normalizedContains(evidenceText, term),
  );
  const professorFieldEvidence = index.fieldEvidence;
  const professorPublicationEvidence = index.publicationEvidence;
  const conceptMatches = context.activeConcepts
    .map((concept) => {
      const fieldHits = concept.evidenceTerms
        .filter((term) => normalizedContains(professorFieldEvidence, term.normalized))
        .map((term) => term.raw);
      const publicationHits = concept.evidenceTerms
        .filter((term) => normalizedContains(professorPublicationEvidence, term.normalized))
        .map((term) => term.raw);
      const evidenceHits = unique([...fieldHits, ...publicationHits]);
      return {
        label: concept.label,
        role: concept.role,
        fieldHits,
        publicationHits,
        evidenceHits,
      };
    })
    .filter((concept) => concept.evidenceHits.length > 0);
  const roleMatches = new Set<ProfessorMatchRole>(
    conceptMatches.map((concept) => concept.role),
  );
  const roleEvidenceTerms: Record<ProfessorMatchRole, Set<string>> = {
    TOPIC: new Set<string>(),
    METHOD: new Set<string>(),
    CONTEXT: new Set<string>(),
  };
  for (const concept of conceptMatches) {
    for (const term of concept.evidenceHits) roleEvidenceTerms[concept.role].add(term);
  }
  const researchFieldRoles = new Set<ProfessorMatchRole>(
    conceptMatches
      .filter((concept) => concept.fieldHits.length > 0)
      .map((concept) => concept.role),
  );
  const publicationRoles = new Set<ProfessorMatchRole>(
    conceptMatches
      .filter((concept) => concept.publicationHits.length > 0)
      .map((concept) => concept.role),
  );
  const methodDirectTerms = directTerms.filter((term) =>
    context.normalizedMethods.some((method) => normalizedContains(method, term)));
  if (directTerms.length > 0) {
    const directRole = methodDirectTerms.length > 0 ? "METHOD" : "TOPIC";
    roleMatches.add(directRole);
    researchFieldRoles.add(directRole);
    for (const term of directTerms) roleEvidenceTerms[directRole].add(term);
  }
  const hasRelevantEvidence = roleMatches.size > 0;
  const publication = hasRelevantEvidence
    ? publicationEvidence(professor, evidenceTopicTerms, index.publicationTitles)
    : undefined;
  const matchedAcademicAffiliation = context.academicAffiliations
    .map((affiliation) => {
      const officialDepartment = index.departments.find((department) =>
        normalize(comparableDepartmentName(department)) === affiliation.normalizedMajor);
      return officialDepartment ? { ...affiliation, officialDepartment } : null;
    })
    .find((affiliation) => Boolean(affiliation))
    ?? null;
  const departmentMatchesMajor = Boolean(matchedAcademicAffiliation);

  let role: ProfessorMatchRole = "CONTEXT";
  let strength: ProfessorMatchStrength = "LIMITED";
  let reason = `현재 수집된 공식 프로필에서 이 주제와 직접 일치하는 근거는 찾지 못했습니다. 공식 프로필의 ‘${professor.researchFields[0] ?? "연구분야 미기재"}’ 관점으로 범위를 검토할 대안 후보입니다.`;
  const matchedTerms: string[] = [];

  if (conceptMatches.length > 0) {
    const preferredRole = rolePreference.find((candidateRole) =>
      roleMatches.has(candidateRole));
    const best = conceptMatches.find((concept) => concept.role === preferredRole)
      ?? conceptMatches[0];
    role = best.role;
    matchedTerms.push(...best.evidenceHits.slice(0, 3));
    reason = `공식 프로필의 ‘${best.evidenceHits.slice(0, 3).join(", ")}’ 근거가 이 주제의 ${best.label} ${role === "METHOD" ? "방법" : role === "TOPIC" ? "내용" : "맥락"}과 연결됩니다.`;
  } else if (directTerms.length > 0) {
    role = methodDirectTerms.length > 0 ? "METHOD" : "TOPIC";
    matchedTerms.push(...directTerms.slice(0, 3));
    reason = `공식 프로필 연구분야의 ‘${matchedTerms.join(", ")}’ 표현이 선택한 주제와 직접 연결됩니다.`;
  }

  if (publication) {
    const publicationTitle = normalize(publication.title);
    matchedTerms.push(
      ...evidenceTopicTerms
        .filter((term) => normalizedContains(publicationTitle, term))
        .slice(0, 2),
    );
  }
  strength = directTerms.length > 0 || publication
    ? "DIRECT"
    : hasRelevantEvidence
      ? "RELATED"
      : "LIMITED";

  const evidenceIds = [professor.profileEvidenceId];
  if (publication) evidenceIds.push(publication.id);
  const decisionBasis: ProfessorMatchDecisionBasis = {
    matchedConcepts: conceptMatches.map((concept) => concept.label),
    departmentMatchesMajor,
    ...(matchedAcademicAffiliation
      ? {
          matchedAcademicAffiliation: {
            type: matchedAcademicAffiliation.type,
            label: matchedAcademicAffiliation.label,
            college: matchedAcademicAffiliation.college,
            major: matchedAcademicAffiliation.major,
            officialDepartment: matchedAcademicAffiliation.officialDepartment,
          },
        }
      : {}),
    roleMatches: {
      topic: roleMatches.has("TOPIC"),
      method: roleMatches.has("METHOD"),
      context: roleMatches.has("CONTEXT"),
    },
    sources: {
      officialProfile: professor.status === "FOUND"
        && Boolean(professor.officialProfileUrl)
        && Boolean(professor.sourceUrl),
      researchFields: researchFieldRoles.size > 0,
      matchedPublication: Boolean(publication) || publicationRoles.size > 0,
    },
  };

  return {
    match: {
      professor,
      role,
      strength,
      reason,
      evidenceIds,
      matchedTerms: unique(matchedTerms),
      doesNotEstablish: [
        "교수의 면담·지도·모집 가능 여부",
        "선택 주제에 대한 교수의 참여 의사",
        strength === "LIMITED"
          ? "현재 공식 프로필 범위에서의 직접적인 연구주제 적합성"
          : "추천 결과의 우열이나 성공 가능성",
      ],
      decisionBasis,
    },
    hasRelevantEvidence,
    roleEvidenceCounts: {
      TOPIC: roleEvidenceTerms.TOPIC.size,
      METHOD: roleEvidenceTerms.METHOD.size,
      CONTEXT: roleEvidenceTerms.CONTEXT.size,
    },
    matchedConcepts: new Set(conceptMatches.map((concept) => concept.label)),
    researchFieldConcepts: new Set(
      conceptMatches
        .filter((concept) => concept.fieldHits.length > 0)
        .map((concept) => concept.label),
    ),
    publicationConcepts: new Set(
      conceptMatches
        .filter((concept) => concept.publicationHits.length > 0)
        .map((concept) => concept.label),
    ),
    researchFieldRoles,
    publicationRoles,
  };
}

const roleDecisionKey: Record<
  ProfessorMatchRole,
  keyof ProfessorMatchDecisionBasis["roleMatches"]
> = {
  TOPIC: "topic",
  METHOD: "method",
  CONTEXT: "context",
};

function hasOfficialMatchEvidence(candidate: EvaluatedProfessor): boolean {
  const sources = candidate.match.decisionBasis.sources;
  return candidate.hasRelevantEvidence
    && sources.officialProfile
    && (sources.researchFields || sources.matchedPublication);
}

function hasOfficialProfileEvidence(candidate: EvaluatedProfessor): boolean {
  return candidate.match.decisionBasis.sources.officialProfile;
}

function compareForRole(
  role: ProfessorMatchRole,
  left: EvaluatedProfessor,
  right: EvaluatedProfessor,
): number {
  if (role === "CONTEXT") {
    const leftSharesCore = left.match.decisionBasis.roleMatches.topic
      || left.match.decisionBasis.roleMatches.method;
    const rightSharesCore = right.match.decisionBasis.roleMatches.topic
      || right.match.decisionBasis.roleMatches.method;
    if (leftSharesCore !== rightSharesCore) return leftSharesCore ? -1 : 1;
    if (
      left.match.decisionBasis.departmentMatchesMajor
      !== right.match.decisionBasis.departmentMatchesMajor
    ) {
      return left.match.decisionBasis.departmentMatchesMajor ? -1 : 1;
    }
  }
  const leftHasFieldEvidence = left.researchFieldRoles.has(role);
  const rightHasFieldEvidence = right.researchFieldRoles.has(role);
  if (leftHasFieldEvidence !== rightHasFieldEvidence) {
    return leftHasFieldEvidence ? -1 : 1;
  }
  const leftHasPublicationEvidence = left.publicationRoles.has(role);
  const rightHasPublicationEvidence = right.publicationRoles.has(role);
  if (leftHasPublicationEvidence !== rightHasPublicationEvidence) {
    return leftHasPublicationEvidence ? -1 : 1;
  }
  const evidenceCountDifference = right.roleEvidenceCounts[role] - left.roleEvidenceCounts[role];
  if (evidenceCountDifference !== 0) return evidenceCountDifference;
  for (const concept of conceptsForRole(role)) {
    const leftFieldMatch = left.researchFieldConcepts.has(concept.label);
    const rightFieldMatch = right.researchFieldConcepts.has(concept.label);
    if (leftFieldMatch !== rightFieldMatch) return leftFieldMatch ? -1 : 1;
    const leftPublicationMatch = left.publicationConcepts.has(concept.label);
    const rightPublicationMatch = right.publicationConcepts.has(concept.label);
    if (leftPublicationMatch !== rightPublicationMatch) return leftPublicationMatch ? -1 : 1;
  }
  if (
    left.match.decisionBasis.departmentMatchesMajor
    !== right.match.decisionBasis.departmentMatchesMajor
  ) {
    return left.match.decisionBasis.departmentMatchesMajor ? -1 : 1;
  }
  return compareDecisionBasis(left.match.decisionBasis, right.match.decisionBasis)
    || left.match.professor.id.localeCompare(right.match.professor.id);
}

function presentAsRole(
  candidate: EvaluatedProfessor,
  role: ProfessorMatchRole,
): ProfessorMatch {
  if (candidate.match.role === role) return candidate.match;

  const roleHasDirectEvidence =
    candidate.match.decisionBasis.roleMatches[roleDecisionKey[role]];
  const officialEvidenceText = normalize([
    candidate.match.professor.department,
    ...candidate.match.professor.researchFields,
    ...candidate.match.professor.publications.map((publication) => publication.title),
  ].join(" "));
  const roleEvidenceTerms = unique(conceptsForRole(role)
    .filter((concept) => candidate.matchedConcepts.has(concept.label))
    .flatMap((concept) => concept.evidenceTerms.filter((term) =>
      containsTerm(officialEvidenceText, term))));
  const roleLabel = role === "TOPIC"
    ? "연구 내용"
    : role === "METHOD"
      ? "연구 방법"
      : "확장 맥락";
  const evidenceTerms = (
    roleEvidenceTerms.length > 0 ? roleEvidenceTerms : candidate.match.matchedTerms
  ).slice(0, 3);
  if (evidenceTerms.length === 0) {
    evidenceTerms.push(
      candidate.match.professor.researchFields[0] ?? candidate.match.professor.department,
    );
  }
  if (!roleHasDirectEvidence) {
    return {
      ...candidate.match,
      role,
      strength: "LIMITED",
      matchedTerms: evidenceTerms,
      reason: `공식 프로필의 ‘${evidenceTerms.join(", ")}’ 연구를 ${roleLabel}을 넓혀 볼 참고 근거로 연결했습니다. 다만 입력 조건과 직접 일치하는 ${roleLabel} 근거는 현재 공식 프로필에서 확인되지 않았습니다.`,
      doesNotEstablish: [
        ...candidate.match.doesNotEstablish,
        `입력 조건과 이 교수의 ${roleLabel} 직접 일치`,
      ],
    };
  }
  return {
    ...candidate.match,
    role,
    matchedTerms: evidenceTerms,
    reason: `공식 프로필에서 확인한 ‘${evidenceTerms.join(", ")}’ 근거가 입력한 조건의 ${roleLabel}과 연결됩니다.`,
  };
}

export function getOfficialProfessorById(id: string): OfficialProfessor | null {
  return professorById.get(id) ?? null;
}

export function getOfficialProfessors(): OfficialProfessor[] {
  return officialProfessors;
}

export function getProfessorAcademicTaxonomy(): ProfessorAcademicTaxonomy {
  return buildProfessorAcademicTaxonomy(
    dataset.records.map((record) => ({
      college: record.college,
      departments: record.departments?.length
        ? record.departments
        : [record.department],
    })),
    dataset.official_record_count,
    coverageGaps
      .map((gap) => gap.department)
      .filter((department): department is string => Boolean(department)),
  );
}

function presentAsHomeDepartment(
  candidate: EvaluatedProfessor,
  topic: ProfessorMatchTopic,
): ProfessorMatch {
  const professor = candidate.match.professor;
  const affiliation = candidate.match.decisionBasis.matchedAcademicAffiliation;
  const affiliationLabel = affiliation?.label || "입력 전공";
  const affiliationMajor = affiliation?.major || topic.major;
  const officialDepartment = affiliation?.officialDepartment || professor.department;
  const relatedEvidence = candidate.hasRelevantEvidence
    ? candidate.match.matchedTerms.slice(0, 2)
    : [];
  const relatedNote = relatedEvidence.length > 0
    ? ` 공식 연구분야의 ‘${relatedEvidence.join(", ")}’도 입력한 관심과 연결됩니다.`
    : " 관심 주제와 연구분야의 직접 연결은 교수님께 확인해야 합니다.";

  return {
    ...candidate.match,
    role: "CONTEXT",
    strength: candidate.hasRelevantEvidence ? candidate.match.strength : "LIMITED",
    matchedTerms: unique([officialDepartment, ...relatedEvidence]).slice(0, 3),
    reason: `학생이 입력한 ${affiliationLabel} ‘${affiliationMajor}’와 공식 프로필의 소속 ‘${officialDepartment}’이 같은 학과로 확인되어, 가장 가까운 전공 맥락의 첫 대화 후보로 제안합니다.${relatedNote}`,
    doesNotEstablish: unique([
      ...candidate.match.doesNotEstablish,
      ...(!candidate.hasRelevantEvidence
        ? ["학생의 관심 주제와 교수 연구분야의 직접 일치"]
        : []),
    ]),
  };
}

/**
 * AI 재정렬에 전달할 공식 근거 후보 풀입니다.
 * 교수 전체 명단을 모델에 넘기지 않고, 기존 결정 규칙으로 역할별 상위 후보만 좁힙니다.
 */
export function getOfficialProfessorRoleCandidates(
  topic: ProfessorMatchTopic,
  options: { excludeIds?: string[]; limitPerRole?: number } = {},
): ProfessorMatch[] {
  const excluded = new Set(options.excludeIds ?? []);
  const limitPerRole = Math.max(1, Math.min(options.limitPerRole ?? 4, 6));
  const context = buildTopicMatchContext(topic);
  const officialCandidates = officialProfessors
    .filter((professor) => !excluded.has(professor.id))
    .map((professor) => evaluateProfessor(professor, topic, context))
    .filter(hasOfficialMatchEvidence);
  const result: ProfessorMatch[] = [];
  const usedPairs = new Set<string>();

  for (const role of ["TOPIC", "METHOD", "CONTEXT"] as const) {
    const roleCandidates = [...officialCandidates]
      .sort((left, right) => compareForRole(role, left, right))
      .slice(0, limitPerRole);
    for (const candidate of roleCandidates) {
      const pairKey = `${candidate.match.professor.id}:${role}`;
      if (usedPairs.has(pairKey)) continue;
      usedPairs.add(pairKey);
      result.push(presentAsRole(candidate, role));
    }
  }
  return result;
}

export function matchOfficialProfessors(
  topic: ProfessorMatchTopic,
  /** 학생이 거절한 교수. 다시 찾을 때 후보에서 제외합니다. */
  options: { excludeIds?: string[]; journey?: "student" | "project" } = {},
): ProfessorMatchResponse {
  const excluded = new Set(options.excludeIds ?? []);
  // 주제 쪽 계산은 교수와 무관하므로 루프 밖에서 한 번만 합니다.
  const context = buildTopicMatchContext(topic);
  const evaluated = officialProfessors
    .filter((professor) => !excluded.has(professor.id))
    .map((professor) => evaluateProfessor(professor, topic, context))
    .sort(compareEvaluatedProfessors);
  const officialCandidates = evaluated.filter(hasOfficialMatchEvidence);

  /*
   * 프로젝트 멘토 연결은 기존의 주제·방법·확장 역할 구성을 유지합니다.
   * AI 재정렬이 실패해도 학생 개인 매칭용 '같은 학과 우선' 규칙이 섞이지 않습니다.
   */
  if (options.journey === "project") {
    const projectUsedIds = new Set<string>();
    const projectMatchByRole = new Map<ProfessorMatchRole, ProfessorMatch>();

    for (const role of ["TOPIC", "METHOD", "CONTEXT"] as const) {
      const roleKey = roleDecisionKey[role];
      const candidate = officialCandidates
        .filter((item) =>
          !projectUsedIds.has(item.match.professor.id)
          && item.match.decisionBasis.roleMatches[roleKey])
        .sort((left, right) => compareForRole(role, left, right))[0];
      if (!candidate) continue;
      projectUsedIds.add(candidate.match.professor.id);
      projectMatchByRole.set(role, presentAsRole(candidate, role));
    }

    for (const role of ["TOPIC", "METHOD", "CONTEXT"] as const) {
      if (projectMatchByRole.has(role)) continue;
      const candidate = officialCandidates
        .filter((item) => !projectUsedIds.has(item.match.professor.id))
        .sort((left, right) => compareForRole(role, left, right))[0];
      if (!candidate) continue;
      projectUsedIds.add(candidate.match.professor.id);
      projectMatchByRole.set(role, presentAsRole(candidate, role));
    }

    return {
      topicId: topic.id,
      matches: (["TOPIC", "METHOD", "CONTEXT"] as const)
        .map((role) => projectMatchByRole.get(role))
        .filter((match): match is ProfessorMatch => Boolean(match)),
      selectionPolicy: PROFESSOR_MATCH_POLICY,
      generatedAt: new Date().toISOString(),
      officialRecordCount: dataset.official_record_count,
      scopeStatus: dataset.scope_status,
      coverageGaps,
      note: `${dataset.note} 단국대학교 공식 교수 ${dataset.official_record_count.toLocaleString("ko-KR")}명 안에서 선택한 프로젝트의 주제 연결형·방법 연결형·확장 관점형을 공식 근거와 안정적 교수 ID 순서로 선택합니다.`,
      rankingSource: "official-rules",
      rankingModel: null,
    };
  }

  const officialProfileCandidates = evaluated.filter(hasOfficialProfileEvidence);
  const usedProfessorIds = new Set<string>();
  const matchByRole = new Map<ProfessorMatchRole, ProfessorMatch>();

  /*
   * 첫 후보는 학생이 상대적으로 접근하기 쉬운 주전공 소속 교수입니다.
   * 주전공 후보가 없을 때만 부·복수전공 소속으로 범위를 넓히며,
   * 공식 소속 근거와 관심 주제 근거는 분리해서 설명합니다.
   */
  const compareHomeDepartmentCandidate = (
    left: EvaluatedProfessor,
    right: EvaluatedProfessor,
  ) => {
      if (left.hasRelevantEvidence !== right.hasRelevantEvidence) {
        return left.hasRelevantEvidence ? -1 : 1;
      }
      const strengthPriority: Record<ProfessorMatchStrength, number> = {
        DIRECT: 0,
        RELATED: 1,
        LIMITED: 2,
      };
      const strengthDifference = strengthPriority[left.match.strength]
        - strengthPriority[right.match.strength];
      if (strengthDifference !== 0) return strengthDifference;
      const basisDifference = compareDecisionBasis(
        left.match.decisionBasis,
        right.match.decisionBasis,
      );
      if (basisDifference !== 0) return basisDifference;
      const affiliationPriority = (candidate: EvaluatedProfessor) => {
        const affiliation = candidate.match.decisionBasis.matchedAcademicAffiliation;
        if (affiliation?.type === "PRIMARY") return 0;
        if (affiliation?.label === "복수전공") return 1;
        if (affiliation?.label === "부전공") return 2;
        return 3;
      };
      const affiliationDifference = affiliationPriority(left) - affiliationPriority(right);
      if (affiliationDifference !== 0) return affiliationDifference;
      return compareEvaluatedProfessors(left, right);
    };
  const academicHomeCandidates = officialProfileCandidates
    .filter((item) => item.match.decisionBasis.departmentMatchesMajor);
  const primaryMajorCandidates = academicHomeCandidates.filter(
    (item) => item.match.decisionBasis.matchedAcademicAffiliation?.type === "PRIMARY",
  );
  const homeDepartmentCandidate = (
    primaryMajorCandidates.length > 0 ? primaryMajorCandidates : academicHomeCandidates
  ).sort(compareHomeDepartmentCandidate)[0];

  if (homeDepartmentCandidate) {
    usedProfessorIds.add(homeDepartmentCandidate.match.professor.id);
    matchByRole.set("CONTEXT", presentAsHomeDepartment(homeDepartmentCandidate, topic));
  } else {
    const contextCandidate = [...officialCandidates]
      .sort((left, right) => compareForRole("CONTEXT", left, right))[0];
    if (contextCandidate) {
      usedProfessorIds.add(contextCandidate.match.professor.id);
      matchByRole.set("CONTEXT", presentAsRole(contextCandidate, "CONTEXT"));
    }
  }

  /*
   * 나머지 두 후보는 입력한 주·부·복수전공 학과 밖에서 주제·방법 근거를 한 명씩 찾습니다.
   * 역할 직접 근거를 우선하고, 가능하면 서로 다른 학과를 제안합니다.
   */
  const usedExternalDepartments = new Set<string>();
  const externalCandidates = officialCandidates.filter(
    (item) => !item.match.decisionBasis.departmentMatchesMajor,
  );
  for (const role of ["TOPIC", "METHOD"] as const) {
    const roleKey = roleDecisionKey[role];
    const findCandidate = (requireDirectRole: boolean, requireNewDepartment: boolean) =>
      externalCandidates
        .filter((item) => {
          if (usedProfessorIds.has(item.match.professor.id)) return false;
          if (requireDirectRole && !item.match.decisionBasis.roleMatches[roleKey]) return false;
          const departmentKey = normalize(item.match.professor.department);
          return !requireNewDepartment || !usedExternalDepartments.has(departmentKey);
        })
        .sort((left, right) => compareForRole(role, left, right))[0];
    const candidate = findCandidate(true, true)
      ?? findCandidate(true, false)
      ?? findCandidate(false, true)
      ?? findCandidate(false, false);
    if (!candidate) continue;
    usedProfessorIds.add(candidate.match.professor.id);
    usedExternalDepartments.add(normalize(candidate.match.professor.department));
    matchByRole.set(role, presentAsRole(candidate, role));
  }

  const matches = (["CONTEXT", "TOPIC", "METHOD"] as const)
    .map((role) => matchByRole.get(role))
    .filter((match): match is ProfessorMatch => Boolean(match));

  return {
    topicId: topic.id,
    matches,
    selectionPolicy: PROFESSOR_MATCH_POLICY,
    generatedAt: new Date().toISOString(),
    officialRecordCount: dataset.official_record_count,
    scopeStatus: dataset.scope_status,
    coverageGaps,
    note: `${dataset.note} 단국대학교 공식 교수 ${dataset.official_record_count.toLocaleString("ko-KR")}명 안에서 주전공 공식 소속 교수 1명을 먼저 확인하고, 해당 학과 밖에서는 같은 단과대 여부와 무관하게 주제·방법 역할의 직접 공식 근거를 우선합니다. 역할 직접 근거가 부족하면 다른 공식 연구 연결 근거가 있는 후보만 제한적으로 보완합니다.`,
    rankingSource: "official-rules",
    rankingModel: null,
  };
}
