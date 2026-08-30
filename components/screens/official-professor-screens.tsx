"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  BookOpenCheck,
  CalendarClock,
  CircleAlert,
  Compass,
  ExternalLink,
  FlaskConical,
  Globe2,
  GraduationCap,
  Lightbulb,
  Link2,
  LoaderCircle,
  MessageCircleQuestion,
  SearchCheck,
  ShieldCheck,
  Sparkles,
  Star,
  ThumbsDown,
} from "lucide-react";
import {
  AppShell,
  Card,
  PrimaryButton,
  SecondaryButton,
  SectionHeading,
  StatusBanner,
  Tag,
} from "@/components/app/primitives";
import { SceneBanner } from "@/components/app/scene-banner";
import { ProfessorDiscoveryForm } from "@/components/screens/professor-discovery-form";
import type { ResearchTopic } from "@/data/research-mvp";
import { brandScene } from "@/lib/brand-assets";
import {
  findAcademicSelection,
  type ProfessorAcademicTaxonomy,
} from "@/lib/professor-academic-taxonomy";
import {
  discoveryContextToMatchTopic,
  isDankookUniversity,
  requestProfessorDiscoveryMatches,
  type ProfessorDiscoveryContext,
} from "@/lib/professor-discovery-client";
import {
  buildProfessorContextQuestions,
  DIRECT_ACADEMIC_ENTRY,
  EMPTY_PROFESSOR_DISCOVERY_CONTEXT,
  PRESENTATION_PROFESSOR_DEFAULTS,
  professorMatchTopicToDiscoveryContext,
  validateProfessorDiscoveryBasics,
  validateProfessorDiscoverySecondary,
} from "@/lib/professor-discovery-model";
import type {
  OfficialProfessor,
  ProfessorDataStatus,
  ProfessorMatch,
  ProfessorMatchRole,
} from "@/lib/professor-domain";
import { ProfessorMatchRequestAbortedError } from "@/lib/professor-match-http";
import { resolveProfessorPortrait } from "@/lib/professor-photo";
import { MAX_FAVORITE_PROFESSORS } from "@/lib/professor-paper-selection";
import { buildProfessorPitch, professorMatchRoleLabel } from "@/lib/professor-pitch";
import { professorDetailNavigation, professorDetailQuery } from "@/lib/navigation-flow";
import { useProfileStore, type ProfileGrade } from "@/store/profile-store";
import { useResearchStore } from "@/store/research-store";

function profileGradeToStudentStage(grade: ProfileGrade): string {
  if (grade === "1학년" || grade === "2학년") return "전공 기초를 배우는 중";
  if (grade === "3학년" || grade === "4학년 이상") return "전공을 심화하는 중";
  if (grade === "대학원생") return "연구·대학원을 준비하는 중";
  if (grade === "휴학 중") return "진로를 다시 탐색하는 중";
  return "";
}

function matchRoleLabel(match: ProfessorMatch): string {
  return professorMatchRoleLabel(match);
}

function officialDataStatusLabel(status: ProfessorDataStatus, subject: string): string {
  const labels: Record<ProfessorDataStatus, string> = {
    FOUND: `${subject} 확인`,
    NOT_LISTED_ON_OFFICIAL_PROFILE: `공식 프로필에 ${subject} 미기재`,
    PROFILE_UNAVAILABLE: "공식 프로필에 현재 접근할 수 없음",
    PARSE_FAILED: `${subject} 수집 형식을 확인하지 못함`,
    ROBOTS_BLOCKED: "공식 사이트 수집 정책으로 자동 확인 제한",
  };
  return labels[status];
}

/** 저장된 연구주제. 만들다에서 넘어온 경우에만 존재합니다. */
function useSelectedTopic(): ResearchTopic | null {
  const result = useResearchStore((state) => state.result);
  const selectedTopicId = useResearchStore((state) => state.selectedTopicId);
  return useMemo(() => {
    if (!result || !selectedTopicId) return null;
    if (result.kind === "ok") {
      return result.candidates.find((c) => c.topic.id === selectedTopicId)?.topic ?? null;
    }
    if (result.kind === "insufficient" && result.candidate.topic.id === selectedTopicId) {
      return result.candidate.topic;
    }
    return null;
  }, [result, selectedTopicId]);
}

/**
 * 승인된 공식 사진만 실제 사진으로 표시하고, 그 외에는 역할별 브랜드 일러스트를 씁니다.
 */
function ProfessorPortrait({
  professor,
  variant,
  large = false,
}: {
  professor: OfficialProfessor;
  variant: ProfessorMatchRole | "PROFILE";
  large?: boolean;
}) {
  const portrait = resolveProfessorPortrait({
    professorId: professor.id,
    professorName: professor.name,
    variant,
  });
  return (
    <div
      className={`official-professor-avatar${large ? " official-professor-avatar--large" : ""}`}
      title={portrait.sourceLabel}
    >
      <Image
        src={portrait.src}
        alt={portrait.alt}
        width={large ? 64 : 48}
        height={large ? 64 : 48}
        priority={large}
        style={{ width: "100%", height: "100%", objectFit: "contain", borderRadius: "inherit" }}
      />
    </div>
  );
}

function ProfessorFavoriteButton({
  professorId,
  professorName,
}: {
  professorId: string;
  professorName: string;
}) {
  const hasHydrated = useResearchStore((state) => state.hasHydrated);
  const favoriteProfessorIds = useResearchStore((state) => state.favoriteProfessorIds);
  const toggleFavoriteProfessor = useResearchStore((state) => state.toggleFavoriteProfessor);
  const [limitNotice, setLimitNotice] = useState(false);
  const isFavorite = favoriteProfessorIds.includes(professorId);
  const isAtLimit = !isFavorite && favoriteProfessorIds.length >= MAX_FAVORITE_PROFESSORS;
  const label = isFavorite ? "관심 교수님 저장됨" : "관심 교수님으로 저장";
  const noticeId = `favorite-limit-${professorId}`;

  return (
    <div className="professor-favorite-control">
      <button
        type="button"
        className={`professor-favorite-button${isFavorite ? " is-active" : ""}`}
        aria-label={`${professorName} 교수님 ${isFavorite ? "즐겨찾기 해제" : "즐겨찾기 등록"}`}
        aria-pressed={isFavorite}
        aria-describedby={limitNotice ? noticeId : undefined}
        disabled={!hasHydrated}
        title={isAtLimit ? `즐겨찾기는 ${MAX_FAVORITE_PROFESSORS}명까지 등록할 수 있어요.` : undefined}
        onClick={() => {
          const result = toggleFavoriteProfessor(professorId);
          setLimitNotice(result === "full");
        }}
      >
        <Star size={16} fill={isFavorite ? "currentColor" : "none"} aria-hidden="true" />
        {hasHydrated ? label : "불러오는 중"}
      </button>
      {limitNotice && (
        <small id={noticeId} role="status">
          즐겨찾기는 {MAX_FAVORITE_PROFESSORS}명까지 등록할 수 있어요.
        </small>
      )}
    </div>
  );
}

/**
 * 주제·방법·확장 관점의 교수님 3인 피칭 카드.
 *
 * 궁합도·순위·면담 가능성은 표시하지 않습니다(제품 경계).
 * 학생 입력, 대학 공식 근거, 서비스가 제안한 표현을 명확히 나눠 보여줍니다.
 */
function MatchCard({
  match,
  context,
  onOpen,
  onOpenPaper,
  onChoose,
  onReject,
}: {
  match: ProfessorMatch;
  context: ProfessorDiscoveryContext;
  onOpen: () => void;
  onOpenPaper: () => void;
  onChoose: () => void;
  onReject: () => void;
}) {
  const professor = match.professor;
  const hasHydrated = useResearchStore((state) => state.hasHydrated);
  const favoriteProfessorIds = useResearchStore((state) => state.favoriteProfessorIds);
  const toggleFavoriteProfessor = useResearchStore((state) => state.toggleFavoriteProfessor);
  const [paperNotice, setPaperNotice] = useState<string | null>(null);
  const isFavorite = favoriteProfessorIds.includes(professor.id);
  const hasPublications = professor.publicationsStatus === "FOUND";
  const portrait = resolveProfessorPortrait({
    professorId: professor.id,
    professorName: professor.name,
    variant: match.role,
  });
  const contextQuestions = buildProfessorContextQuestions(
    context,
    professor.researchFields[0] ?? "",
  );
  const pitch = buildProfessorPitch(match, context, contextQuestions[0] ?? "");
  const evidenceStrengthLabel = {
    DIRECT: "직접 연결 근거 확인",
    RELATED: "관련 근거 확인",
    LIMITED: "확인 가능한 근거 제한",
  }[match.strength];
  const evidenceStatuses = [
    {
      label: "대학 공식 프로필",
      value: match.decisionBasis.sources.officialProfile ? "확인됨" : "확인 필요",
      verified: match.decisionBasis.sources.officialProfile,
    },
    {
      label: "공식 연구분야",
      value: match.decisionBasis.sources.researchFields
        ? `${professor.researchFields.length}건 확인`
        : "연결 근거 확인 필요",
      verified: match.decisionBasis.sources.researchFields,
    },
    {
      label: "관련 논문 근거",
      value: match.decisionBasis.sources.matchedPublication
        ? "연결 항목 확인"
        : hasPublications ? "연구분야 중심 연결" : "공식 프로필 미기재",
      verified: match.decisionBasis.sources.matchedPublication,
    },
  ];
  const isHomeDepartment = match.role === "CONTEXT"
    && match.decisionBasis.departmentMatchesMajor;
  const roleIcon = match.role === "TOPIC"
    ? <Compass size={16} aria-hidden="true" />
    : match.role === "METHOD"
      ? <FlaskConical size={16} aria-hidden="true" />
      : isHomeDepartment
        ? <GraduationCap size={16} aria-hidden="true" />
        : <Globe2 size={16} aria-hidden="true" />;

  const openPaperBite = () => {
    setPaperNotice(null);
    if (!pitch.hasOfficialPublications) {
      setPaperNotice("공식 프로필에 자동 선택할 논문 목록이 없어 직접 입력이 필요해요.");
      return;
    }
    if (!isFavorite) {
      const result = toggleFavoriteProfessor(professor.id);
      if (result === "full") {
        setPaperNotice(
          `즐겨찾기는 ${MAX_FAVORITE_PROFESSORS}명까지예요. 한 명을 정리한 뒤 다시 시도해 주세요.`,
        );
        return;
      }
    }
    onOpenPaper();
  };

  return (
    <article className={`match-card match-card--${match.role.toLocaleLowerCase()}${isHomeDepartment ? " match-card--home-department" : ""}`}>
      <header className="match-card__head">
        <div className="match-card__casting">
          <span className="match-card__role">{roleIcon}{pitch.roleLabel}</span>
          <span className="match-card__nickname">{pitch.roleNickname}</span>
        </div>
        <div className="match-card__identity">
          <ProfessorPortrait professor={professor} variant={match.role} />
          <div>
            <Tag tone={portrait.isActualProfessorPhoto ? "mint" : "violet"}>
              {portrait.badgeLabel}
            </Tag>
            <h2>{professor.name} {professor.title}</h2>
            <p>{professor.university} · {professor.college} · {professor.department}</p>
          </div>
        </div>
      </header>

      <section className="match-card__pitch">
        <span><Sparkles size={14} aria-hidden="true" /> 공식 데이터 기반 캐스팅 한마디</span>
        <p>“{pitch.pitchLine}”</p>
      </section>

      <div className="match-card__chips match-card__chips--official" aria-label="공식 프로필 연결 근거">
        {pitch.officialConnections.map((item) => <span key={item}>{item}</span>)}
      </div>

      <section className="match-card__question">
        <h3><MessageCircleQuestion size={16} aria-hidden="true" /> 먼저 물어볼 질문</h3>
        <p>“{pitch.firstQuestion}”</p>
      </section>

      <footer className="match-card__actions">
        <button type="button" className="match-card__conversation" onClick={onChoose}>
          이 교수님과 첫 대화 준비하기 <ArrowRight size={17} aria-hidden="true" />
        </button>
        <details className="match-card__more">
          <summary>추천 이유와 공식 근거 더 보기</summary>
          <div className="match-card__more-content">
            <section className="match-card__reason-panel">
              <header>
                <span><SearchCheck size={16} aria-hidden="true" /> 왜 이 교수님을 제안했나요?</span>
                <em>{evidenceStrengthLabel}</em>
              </header>
              <p>{match.mentorFitReason?.trim() || match.reason}</p>
              <div className="match-card__reason-grid">
                <div>
                  <strong>내가 입력한 조건</strong>
                  <div className="match-card__chips">
                    {pitch.studentConnections.map((item) => <span key={item}>{item}</span>)}
                  </div>
                </div>
                <div>
                  <strong>공식 프로필에서 연결된 항목</strong>
                  <div className="match-card__chips match-card__chips--official">
                    {pitch.officialConnections.map((item) => <span key={item}>{item}</span>)}
                  </div>
                </div>
              </div>
            </section>

            <section className="match-card__basis-status">
              <h3><ShieldCheck size={15} aria-hidden="true" /> 근거 확인 상태</h3>
              <ul>
                {evidenceStatuses.map((item) => (
                  <li key={item.label} className={item.verified ? "is-verified" : "is-unverified"}>
                    <span>{item.label}</span>
                    <strong>{item.value}</strong>
                  </li>
                ))}
              </ul>
              {match.decisionBasis.matchedConcepts.length > 0 ? (
                <div className="match-card__matched-concepts">
                  <strong>조건에서 연결된 개념</strong>
                  <p>{match.decisionBasis.matchedConcepts.join(" · ")}</p>
                </div>
              ) : null}
            </section>

            <section className="match-card__block">
              <h3><Lightbulb size={15} aria-hidden="true" /> 배워볼 수 있는 것</h3>
              <ul className="match-card__learning">
                {pitch.potentialLearning.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </section>

            <section className="match-card__mentor">
              <span>서비스가 제안한 탐색 역할</span>
              <strong>{pitch.mentorRole}</strong>
            </section>

            <section className="match-card__block match-card__block--check">
              <h3>직접 확인할 부분</h3>
              <ul>
                {pitch.verificationItems.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </section>

            <section className="match-card__evidence-details" aria-label="공식 근거와 출처">
              <h3><Link2 size={15} aria-hidden="true" /> 공식 근거와 출처</h3>
              <p>{match.reason}</p>
              <ul className="match-card__evidence">
                <li>
                  <ShieldCheck size={15} aria-hidden="true" />
                  <span>공식 프로필 연구분야 {professor.researchFields.length}건</span>
                </li>
                <li>
                  <BookOpenCheck size={15} aria-hidden="true" />
                  <span>
                    {hasPublications
                      ? `공식 프로필 노출 논문 ${professor.publicationCount}건`
                      : "공식 프로필에 논문 목록 미기재"}
                  </span>
                </li>
              </ul>
              <p className="match-card__evidence-ids">근거 ID {match.evidenceIds.join(" · ")}</p>
              <div className="match-card__source-row">
                <button type="button" onClick={onOpen}>상세 근거 보기 <ArrowRight size={15} /></button>
                <Link href={professor.officialProfileUrl} target="_blank" rel="noopener noreferrer">
                  대학 공식 프로필 <ExternalLink size={15} />
                </Link>
              </div>
            </section>

            <div className="match-card__secondary-actions">
              <ProfessorFavoriteButton
                professorId={professor.id}
                professorName={professor.name}
              />
              <button
                type="button"
                className="match-card__paper"
                disabled={!hasHydrated || !pitch.hasOfficialPublications}
                onClick={openPaperBite}
              >
                <BookOpenCheck size={16} aria-hidden="true" />
                {pitch.hasOfficialPublications
                  ? isFavorite ? "공식 논문 한입 보기" : "저장하고 공식 논문 한입"
                  : "공식 논문 미기재"}
              </button>
              <button type="button" className="match-card__reject" onClick={onReject}>
                <ThumbsDown size={15} /> 이 유형의 다른 교수 보기
              </button>
            </div>
            {paperNotice && (
              <p className="match-card__action-notice" role="status">{paperNotice}</p>
            )}
          </div>
        </details>
      </footer>
    </article>
  );
}

export function OfficialProfessorsScreen({
  taxonomy,
}: {
  taxonomy: ProfessorAcademicTaxonomy;
}) {
  const router = useRouter();
  const hasHydrated = useResearchStore((state) => state.hasHydrated);
  const conditions = useResearchStore((state) => state.conditions);
  const matches = useResearchStore((state) => state.professorMatches);
  const coverage = useResearchStore((state) => state.professorCoverage);
  const status = useResearchStore((state) => state.professorMatchStatus);
  const matchError = useResearchStore((state) => state.professorMatchError);
  const setLoading = useResearchStore((state) => state.setProfessorMatchLoading);
  const setMatches = useResearchStore((state) => state.setProfessorMatches);
  const storedDiscoveryTopic = useResearchStore((state) => state.professorDiscoveryTopic);
  const setDiscoveryTopic = useResearchStore((state) => state.setProfessorDiscoveryTopic);
  const setDiscoverySummary = useResearchStore((state) => state.setProfessorDiscoverySummary);
  const setError = useResearchStore((state) => state.setProfessorMatchError);
  const clearProfessorMatches = useResearchStore((state) => state.clearProfessorMatches);
  const profileHasHydrated = useProfileStore((state) => state.hasHydrated);
  const profile = useProfileStore((state) => state.profile);
  const savedTopic = useSelectedTopic();

  const [context, setContext] = useState<ProfessorDiscoveryContext>(() => ({
    ...EMPTY_PROFESSOR_DISCOVERY_CONTEXT,
    university: taxonomy.university,
    college: PRESENTATION_PROFESSOR_DEFAULTS.college,
    major: PRESENTATION_PROFESSOR_DEFAULTS.major,
    interests: [...PRESENTATION_PROFESSOR_DEFAULTS.interests],
    careerInterests: [],
    careerConcerns: [],
  }));
  const rejectedIds = useResearchStore((state) => state.professorRejectedIds);
  const setRejectedIds = useResearchStore((state) => state.setProfessorRejectedIds);
  const [inputError, setInputError] = useState<string | null>(null);
  const [scopeNotice, setScopeNotice] = useState<string | null>(null);
  const [prefilled, setPrefilled] = useState(false);
  const [searchAttempted, setSearchAttempted] = useState(false);
  const activeRequestRef = useRef<AbortController | null>(null);

  const markInputsChanged = () => {
    activeRequestRef.current?.abort();
    activeRequestRef.current = null;
    setSearchAttempted(false);
    setScopeNotice(null);
    setInputError(null);
    setRejectedIds([]);
  };

  const updateContext = (
    updater: (current: ProfessorDiscoveryContext) => ProfessorDiscoveryContext,
  ) => {
    markInputsChanged();
    setContext(updater);
  };

  useEffect(() => () => {
    activeRequestRef.current?.abort();
  }, []);

  // 저장한 검색 맥락·내 프로필·프로젝트 조건을 우선순위대로 한 번만 채웁니다.
  useEffect(() => {
    if (!hasHydrated || !profileHasHydrated || prefilled) return;
    /*
     * v4 개발 과정처럼 결과만 남고 검색 맥락이 없는 비정상 저장값은 재사용하지 않습니다.
     * 이 상태를 그대로 노출하면 입력은 비어 있는데 결과가 보이고, 재추천 요청은 검증에서 멈춥니다.
     */
    if (matches.length > 0 && !storedDiscoveryTopic) {
      clearProfessorMatches();
    }
    setContext((current) => {
      const storedContext = storedDiscoveryTopic
        ? professorMatchTopicToDiscoveryContext(storedDiscoveryTopic)
        : EMPTY_PROFESSOR_DISCOVERY_CONTEXT;
      const sourceMajor = current.major
        || storedContext.major
        || profile.major
        || conditions.major
        || "";
      const academicSelection = findAcademicSelection(taxonomy, sourceMajor);
      return {
        ...current,
        university: current.university
          || storedContext.university
          || (isDankookUniversity(profile.school) ? taxonomy.university : "")
          || (isDankookUniversity(conditions.school) ? "단국대학교" : ""),
        college: current.college
          || storedContext.college
          || academicSelection?.college
          || (sourceMajor ? DIRECT_ACADEMIC_ENTRY : ""),
        major: current.major
          || storedContext.major
          || academicSelection?.department
          || sourceMajor,
        studentStage: current.studentStage
          || storedContext.studentStage
          || profileGradeToStudentStage(profile.grade),
        goal: current.goal || storedContext.goal,
        interests: current.interests.length > 0
          ? current.interests
          : storedContext.interests.length > 0
            ? storedContext.interests
            : profile.interests.length > 0
              ? profile.interests.slice(0, 5)
              : conditions.interests.slice(0, 5),
        careerInterests: current.careerInterests.length > 0
          ? current.careerInterests
          : storedContext.careerInterests,
        careerConcerns: current.careerConcerns.length > 0
          ? current.careerConcerns
          : storedContext.careerConcerns,
        secondaryMajorType: current.secondaryMajorType !== "없음"
          ? current.secondaryMajorType
          : storedContext.secondaryMajorType,
        secondaryCollege: current.secondaryCollege || storedContext.secondaryCollege,
        secondaryMajor: current.secondaryMajor || storedContext.secondaryMajor,
        topic: current.topic || storedContext.topic || savedTopic?.title || "",
        careerGoal: current.careerGoal || storedContext.careerGoal,
        meetingSituation: current.meetingSituation || storedContext.meetingSituation,
        preferredSupport: current.preferredSupport || storedContext.preferredSupport,
        experience: current.experience || storedContext.experience,
        additionalContext: current.additionalContext || storedContext.additionalContext,
      };
    });
    setPrefilled(true);
  }, [
    hasHydrated,
    profileHasHydrated,
    prefilled,
    storedDiscoveryTopic,
    matches.length,
    conditions,
    savedTopic,
    profile,
    taxonomy,
    clearProfessorMatches,
  ]);

  const runSearch = async (excludeIds: string[]) => {
    const interests = [...new Set(context.interests)].slice(0, 5);
    if (!context.university.trim()) {
      setInputError("단국대학교를 선택해 주세요.");
      return;
    }
    if (!isDankookUniversity(context.university)) {
      setInputError(null);
      setSearchAttempted(false);
      setScopeNotice("현재 교수님 연결은 단국대학교 공식 교수 1,051명 데이터 파일럿만 지원합니다. 다른 학교 학생도 전공 아이디어 만들기는 이용할 수 있어요.");
      return;
    }
    const basicIssue = validateProfessorDiscoveryBasics({ ...context, interests });
    if (basicIssue) {
      setInputError(basicIssue.message);
      return;
    }
    const secondaryIssue = validateProfessorDiscoverySecondary(context);
    if (secondaryIssue) {
      setInputError(secondaryIssue);
      return;
    }

    const requestContext = { ...context, university: "단국대학교", interests };
    const useSaved = Boolean(savedTopic && savedTopic.title === context.topic.trim());
    const matchTopic = discoveryContextToMatchTopic(requestContext, useSaved ? savedTopic : null);
    activeRequestRef.current?.abort();
    const requestController = new AbortController();
    activeRequestRef.current = requestController;
    setInputError(null);
    setScopeNotice(null);
    setSearchAttempted(true);
    setLoading(matchTopic.id);
    try {
      const response = await requestProfessorDiscoveryMatches(requestContext, {
        excludeIds,
        savedTopic: useSaved ? savedTopic : null,
        signal: requestController.signal,
      });
      if (activeRequestRef.current !== requestController) return;
      setMatches(response);
      setDiscoveryTopic(matchTopic);
      // 찾다만 이용한 학생도 성장 포트폴리오의 주제 탐색이 채워지도록 조건을 남깁니다.
      setDiscoverySummary({
        major: requestContext.major,
        interests: requestContext.interests,
        careerConcerns: requestContext.careerConcerns,
      });
      const profileState = useProfileStore.getState();
      profileState.saveProfile({
        name: profileState.profile.name,
        school: requestContext.university,
        major: requestContext.major,
        grade: profileState.profile.grade,
        careerConcern: requestContext.careerConcerns.join(" · ")
          || profileState.profile.careerConcern,
        interests: requestContext.interests,
      });
      profileState.completeProfessorTutorial();
      /*
       * 피칭 결과는 폼 아래가 아니라 전용 주소에서 봅니다.
       * 결과가 폼 밑에 붙어 있으면 세 장을 비교하는 동안에도 입력이 화면을 차지했습니다.
       */
      router.push("/professors/pitch");
    } catch (error) {
      if (
        error instanceof ProfessorMatchRequestAbortedError
        || activeRequestRef.current !== requestController
      ) {
        return;
      }
      setError(
        matchTopic.id,
        error instanceof Error ? error.message : "공식 교수 데이터를 연결하지 못했습니다.",
      );
    } finally {
      if (activeRequestRef.current === requestController) {
        activeRequestRef.current = null;
      }
    }
  };

  /*
   * 이전에 찾은 결과는 화면을 다시 열어도 그대로 보여줍니다.
   *
   * searchAttempted는 이번 방문에만 사는 값이라, 잇다에 갔다 돌아오면
   * 저장소에 결과가 있는데도 빈 폼이 떴습니다. 즐겨찾기·논문 한입·포트폴리오가
   * 모두 이 결과를 이어받으므로 왕복해도 끊기지 않아야 합니다.
   * 입력을 바꿔도 기존 결과는 유지하고, 새 검색에 성공할 때만 결과를 교체합니다.
   */
  const showsStoredMatches = hasHydrated
    && !searchAttempted
    && matches.length > 0
    && Boolean(storedDiscoveryTopic);

  return (
    <AppShell title="조건 직접 입력" backHref="/professors" className="find-professor-screen">
      <SceneBanner
        scene={brandScene.find}
        alt="공식 자료로 관심 분야에 맞는 교수님을 찾는 장면"
        eyebrow="CORE 01"
        title="나의 교수님 — 찾다"
        description="전공·관심 분야와 취업·진로 고민을 나눠 입력하면, 공식 근거와 함께 서로 다른 세 관점의 교수님을 찾아드려요."
        priority
      />

      <StatusBanner icon={ShieldCheck} title="현재 연결 범위: 단국대학교 공식 교수 1,051명" tone="info">
        현재는 단국대학교 버튼만 제공합니다. 캠퍼스는 묻지 않으며,
        단과대–학과 관계가 안전하게 확인된 공식 교수 데이터만 종속 선택지로 보여줍니다.
      </StatusBanner>

      <ProfessorDiscoveryForm
        taxonomy={taxonomy}
        context={context}
        inputError={inputError}
        loading={status === "loading"}
        rejectedCount={rejectedIds.length}
        onContextChange={updateContext}
        onSubmit={() => {
          setRejectedIds([]);
          void runSearch([]);
        }}
        onResetRejected={() => {
          setRejectedIds([]);
          void runSearch([]);
        }}
      />

      {scopeNotice && (
        <StatusBanner icon={CircleAlert} title="교수 데이터 범위를 확인해 주세요" tone="warning">
          {scopeNotice}
        </StatusBanner>
      )}

      {searchAttempted && status === "loading" && (
        <Card className="official-professor-empty professor-match-loading" role="status">
          <LoaderCircle className="spin" size={26} />
          <h2>같은 학과와 맞춤 전문성을 함께 확인 중이에요</h2>
          <p>첫 요청은 공식 데이터를 여는 시간까지 약 3~10초 걸릴 수 있어요. 화면을 닫지 않아도 결과가 바로 이어집니다.</p>
          <div className="professor-match-loading__steps" aria-hidden="true">
            <span>입력 구조화</span>
            <span>공식 근거 대조</span>
            <span>3인 피칭 구성</span>
          </div>
        </Card>
      )}

      {searchAttempted && status === "error" && (
        <StatusBanner icon={CircleAlert} title="연결하지 못했어요" tone="warning">
          {matchError ?? "공식 교수 데이터를 연결하지 못했습니다."} 입력한 내용은 그대로 두었으니 다시 시도해 주세요.
        </StatusBanner>
      )}

      {!searchAttempted && !showsStoredMatches && !scopeNotice && (
        <Card className="official-professor-empty">
          <SearchCheck size={28} />
          <h2>기본분석 5개 질문부터 시작하세요</h2>
          <p>학교·전공·현재 단계·관심 분야·진로 고민을 먼저 고르고, 선택 심층질문으로 면담 질문을 구체화할 수 있어요.</p>
        </Card>
      )}

      {showsStoredMatches && (
        <Link className="professor-pitch-resume" href="/professors/pitch">
          <SearchCheck size={22} aria-hidden="true" />
          <div>
            <strong>지난번에 찾은 교수님 {matches.length}인 피칭 보기</strong>
            <p>
              위 질문에서 조건을 바꾸면 새로 찾습니다. 그때까지는 이 결과가 그대로 유지됩니다.
            </p>
          </div>
          <ArrowRight size={17} aria-hidden="true" />
        </Link>
      )}

      {searchAttempted && status === "success" && matches.length === 0 && (
        <Card className="official-professor-empty">
          <CircleAlert size={28} />
          <h2>공식 근거가 있는 후보를 찾지 못했어요</h2>
          <p>관심 분야를 더 구체적인 연구 키워드로 바꾸거나 구체 연구주제를 추가해 다시 찾아보세요.</p>
        </Card>
      )}
    </AppShell>
  );
}

/**
 * 교수님 3인 피칭 전용 화면(/professors/pitch).
 *
 * 찾기 폼과 결과를 한 화면에 쌓아 두면 세 장을 나란히 비교하기 어려워,
 * 검색이 끝나면 이 주소로 이동해 결과만 보여줍니다.
 * 표시할 결과는 저장소에 있는 마지막 검색 결과이며, 입력을 바꾸면 사라집니다.
 */
export function ProfessorPitchScreen() {
  const router = useRouter();
  const hasHydrated = useResearchStore((state) => state.hasHydrated);
  const matches = useResearchStore((state) => state.professorMatches);
  const coverage = useResearchStore((state) => state.professorCoverage);
  const status = useResearchStore((state) => state.professorMatchStatus);
  const matchError = useResearchStore((state) => state.professorMatchError);
  const storedDiscoveryTopic = useResearchStore((state) => state.professorDiscoveryTopic);
  const rejectedIds = useResearchStore((state) => state.professorRejectedIds);
  const setRejectedIds = useResearchStore((state) => state.setProfessorRejectedIds);
  const setLoading = useResearchStore((state) => state.setProfessorMatchLoading);
  const setMatches = useResearchStore((state) => state.setProfessorMatches);
  const setDiscoveryTopic = useResearchStore((state) => state.setProfessorDiscoveryTopic);
  const setError = useResearchStore((state) => state.setProfessorMatchError);
  const selectProfessor = useResearchStore((state) => state.selectProfessor);
  const savedTopic = useSelectedTopic();
  const activeRequestRef = useRef<AbortController | null>(null);

  useEffect(() => () => {
    activeRequestRef.current?.abort();
  }, []);

  /*
   * 피칭 문구는 학생이 입력한 맥락을 그대로 써야 합니다.
   * 폼의 지역 상태는 이 주소에 없으므로 저장된 요청 맥락에서 되살립니다.
   */
  const context = useMemo<ProfessorDiscoveryContext>(
    () => storedDiscoveryTopic
      ? professorMatchTopicToDiscoveryContext(storedDiscoveryTopic)
      : {
        ...EMPTY_PROFESSOR_DISCOVERY_CONTEXT,
        interests: [],
        careerInterests: [],
        careerConcerns: [],
      },
    [storedDiscoveryTopic],
  );

  const runSearch = async (excludeIds: string[]) => {
    if (!storedDiscoveryTopic) {
      router.push("/professors/discover");
      return;
    }
    const useSaved = Boolean(savedTopic && savedTopic.title === context.topic.trim());
    const matchTopic = discoveryContextToMatchTopic(context, useSaved ? savedTopic : null);
    activeRequestRef.current?.abort();
    const requestController = new AbortController();
    activeRequestRef.current = requestController;
    setLoading(matchTopic.id);
    try {
      const response = await requestProfessorDiscoveryMatches(context, {
        excludeIds,
        savedTopic: useSaved ? savedTopic : null,
        signal: requestController.signal,
      });
      if (activeRequestRef.current !== requestController) return;
      setMatches(response);
      setDiscoveryTopic(matchTopic);
    } catch (error) {
      if (
        error instanceof ProfessorMatchRequestAbortedError
        || activeRequestRef.current !== requestController
      ) {
        return;
      }
      setError(
        matchTopic.id,
        error instanceof Error ? error.message : "공식 교수 데이터를 연결하지 못했습니다.",
      );
    } finally {
      if (activeRequestRef.current === requestController) {
        activeRequestRef.current = null;
      }
    }
  };

  const rejectMatch = (professorId: string) => {
    const next = [...rejectedIds, professorId];
    setRejectedIds(next);
    void runSearch(next);
  };

  const openProfessor = (match: ProfessorMatch) => {
    router.push(`/professors/${match.professor.id}?from=pitch`);
  };

  const openProfessorPaper = () => {
    router.push("/paper/reader?mode=bite&source=favorites");
  };

  const chooseProfessor = (match: ProfessorMatch) => {
    selectProfessor(match.professor.id);
    router.push("/quest");
  };
  const hasHomeDepartmentMatch = matches.some(
    (match) => match.role === "CONTEXT" && match.decisionBasis.departmentMatchesMajor,
  );
  const homeDepartmentMatch = matches.find(
    (match) => match.role === "CONTEXT" && match.decisionBasis.departmentMatchesMajor,
  );
  const matchedAffiliation = homeDepartmentMatch?.decisionBasis.matchedAcademicAffiliation;

  return (
    <AppShell title="교수님 3인 피칭" backHref="/professors" className="professor-pitch-screen">
      {!hasHydrated ? (
        <Card className="official-professor-empty" role="status">
          <LoaderCircle className="spin" size={26} />
          <h1>저장한 피칭 결과를 불러오는 중이에요</h1>
        </Card>
      ) : status === "loading" ? (
        <Card className="official-professor-empty professor-match-loading" role="status">
          <LoaderCircle className="spin" size={26} />
          <h2>공식 교수 1,051명을 세 관점으로 확인 중이에요</h2>
          <p>첫 요청은 공식 데이터를 여는 시간까지 약 3~10초 걸릴 수 있어요. 화면을 닫지 않아도 결과가 바로 이어집니다.</p>
          <div className="professor-match-loading__steps" aria-hidden="true">
            <span>입력 구조화</span>
            <span>공식 근거 대조</span>
            <span>3인 피칭 구성</span>
          </div>
        </Card>
      ) : (
        <>
          {status === "error" && (
            <StatusBanner icon={CircleAlert} title="연결하지 못했어요" tone="warning">
              {matchError ?? "공식 교수 데이터를 연결하지 못했습니다."}{" "}
              입력한 내용은 그대로 두었으니 찾기 화면에서 다시 시도해 주세요.
            </StatusBanner>
          )}

          {matches.length === 0 ? (
            <Card className="official-professor-empty">
              <SearchCheck size={28} />
              <h1>아직 보여드릴 피칭이 없어요</h1>
              <p>찾기 화면에서 전공·관심 분야와 진로 고민을 입력하면 세 관점의 교수님을 찾아드려요.</p>
              <PrimaryButton onClick={() => router.push("/professors/discover")}>
                교수님 찾기로 가기 <ArrowRight size={17} />
              </PrimaryButton>
            </Card>
          ) : (
            <>
              <section className="professor-pitch-intro" aria-labelledby="professor-pitch-title">
                <div className="professor-pitch-intro__copy">
                  <h1 id="professor-pitch-title">세 분 중 한 분과 첫 대화를 시작해 보세요</h1>
                  <p>
                    {hasHomeDepartmentMatch
                      ? matchedAffiliation
                        ? `입력한 ${matchedAffiliation.label} ‘${matchedAffiliation.major}’의 공식 소속 교수님을 가까운 시작점으로 먼저 제안하고, 다른 학과에서는 내 관심 주제와 방법에 맞는 교수님을 찾아드렸어요.`
                        : "입력한 학과의 공식 소속 교수님을 가까운 시작점으로 먼저 제안하고, 다른 학과에서는 내 관심 주제와 방법에 맞는 교수님을 찾아드렸어요."
                      : "공식 데이터에서 입력한 주전공·부전공·복수전공 소속 교수를 확인하지 못해, 내 관심 주제와 방법을 넓혀 볼 세 분을 근거와 함께 제안했어요."}
                  </p>
                  <small>
                    <ShieldCheck size={14} aria-hidden="true" />
                    카드를 비교한 뒤 ‘첫 대화 준비하기’를 누르면 선택이 저장되고 다음 단계로 바로 이어집니다.
                  </small>
                </div>
                <div className="professor-pitch-intro__cast" aria-label="연결된 교수님">
                  {matches.map((match) => (
                    <div key={match.professor.id}>
                      <ProfessorPortrait professor={match.professor} variant={match.role} large />
                      <strong>{matchRoleLabel(match)}</strong>
                      <span>{match.professor.name}</span>
                    </div>
                  ))}
                </div>
              </section>

              {matches.length < 3 && (
                <StatusBanner icon={CircleAlert} title="세 관점을 모두 채우지 못했어요" tone="warning">
                  공식 프로필에서 확인 가능한 직접 근거가 있는 교수만 표시했습니다. 키워드를 보완하면 다른 관점이 추가될 수 있습니다.
                </StatusBanner>
              )}

              <div className="professor-pitch-toolbar">
                <Link href="/professors/discover">
                  <SearchCheck size={16} aria-hidden="true" /> 조건 바꿔 다시 찾기
                </Link>
                {rejectedIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setRejectedIds([]);
                      void runSearch([]);
                    }}
                  >
                    제외한 교수 {rejectedIds.length}명 다시 포함하기
                  </button>
                )}
              </div>

              <div className="match-grid">
                {matches.map((match) => (
                  <MatchCard
                    key={match.professor.id}
                    match={match}
                    context={context}
                    onOpen={() => openProfessor(match)}
                    onOpenPaper={openProfessorPaper}
                    onChoose={() => chooseProfessor(match)}
                    onReject={() => rejectMatch(match.professor.id)}
                  />
                ))}
              </div>
              {coverage && <p className="prof-scope-note">{coverage.note}</p>}
            </>
          )}
        </>
      )}
    </AppShell>
  );
}

export function OfficialProfessorDetailScreen({ professor }: { professor: OfficialProfessor }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get("from");
  const journey = searchParams.get("journey");
  const detailNavigation = professorDetailNavigation(from, journey);
  const studentMatches = useResearchStore((state) => state.professorMatches);
  const projectMatches = useResearchStore((state) => state.projectProfessorMatches);
  const selectStudentProfessor = useResearchStore((state) => state.selectProfessor);
  const selectProjectProfessor = useResearchStore((state) => state.selectProjectProfessor);
  const matches = detailNavigation.matchBucket === "project" ? projectMatches : studentMatches;
  const match = useMemo(
    () => matches.find((item) => item.professor.id === professor.id),
    [matches, professor.id],
  );
  const recentPublications = professor.publications.slice(0, 6);

  return (
    <AppShell
      title="교수 공식 근거"
      backHref={detailNavigation.backHref}
      stickyAction={(
        <>
          <ProfessorFavoriteButton
            professorId={professor.id}
            professorName={professor.name}
          />
          {match ? (
            <PrimaryButton onClick={() => {
              if (detailNavigation.matchBucket === "project") selectProjectProfessor(professor.id);
              else selectStudentProfessor(professor.id);
              router.push(detailNavigation.nextHref);
            }}>
              {detailNavigation.matchBucket === "project" ? "이 교수님과 프로젝트 시작하기" : "이 교수님과 첫 대화 준비하기"} <ArrowRight size={17} />
            </PrimaryButton>
          ) : (
            <SecondaryButton onClick={() => router.push(detailNavigation.matchBucket === "project" ? "/result/compare" : "/professors/discover")}>
              {detailNavigation.matchBucket === "project" ? "프로젝트 근거에서 연결 맥락 만들기" : "교수님 찾기에서 연결 맥락 만들기"} <ArrowRight size={17} />
            </SecondaryButton>
          )}
        </>
      )}
    >
      <p className="official-data-pill"><ShieldCheck size={14} /> 대학 공식 페이지 수집 데이터</p>
      <section className="official-professor-hero">
        <ProfessorPortrait professor={professor} variant="PROFILE" large />
        <div>
          <h1>{professor.name} {professor.title}</h1>
          <p>{professor.university} · {professor.college} · {professor.department}</p>
          <div className="tag-row">
            {professor.researchFields.map((field) => <Tag key={field}>{field}</Tag>)}
          </div>
        </div>
      </section>

      {match ? (
        <>
          <SectionHeading title="선택한 주제와의 연결" description="연결 역할과 공식 근거 ID를 확인하세요." />
          <Card className="official-match-detail">
            <Tag tone={match.strength === "LIMITED" ? "warning" : "mint"}>{matchRoleLabel(match)}</Tag>
            <p>{match.reason}</p>
            <dl>
              <div><dt>근거 ID</dt><dd>{match.evidenceIds.join(" · ")}</dd></div>
              <div><dt>판단하지 않은 항목</dt><dd>{match.doesNotEstablish.join(" · ")}</dd></div>
            </dl>
          </Card>
        </>
      ) : (
        <StatusBanner icon={CircleAlert} title="주제 연결 맥락 없음" tone="warning">
          이 주소로 직접 들어왔기 때문에 선택 주제와의 연결 이유는 표시하지 않습니다. 연구 결과 화면에서 다시 연결해 주세요.
        </StatusBanner>
      )}

      <SectionHeading title="공식 강의정보" description="대학이 공개한 강의·시간표를 확인합니다." />
      <Link className="official-courses-link" href={`/professors/${professor.id}/courses${professorDetailQuery(from, journey)}`}>
        <CalendarClock size={18} aria-hidden="true" />
        <div>
          <strong>공식 강의정보 보기</strong>
          <p>학기별 강의명·시간·강의실과 공식 시간표 링크</p>
        </div>
        <ArrowRight size={16} aria-hidden="true" />
      </Link>

      <SectionHeading title="공식 프로필의 연구분야" />
      <Card className="official-field-list">
        {professor.researchFieldsStatus === "FOUND"
          ? professor.researchFields.map((field) => (
              <div key={field}><GraduationCap size={18} /><span>{field}</span></div>
            ))
          : <p>{officialDataStatusLabel(professor.researchFieldsStatus, "연구분야")}</p>}
      </Card>

      <SectionHeading
        title="공식 프로필에 노출된 논문"
        description={professor.publicationsStatus === "FOUND"
          ? `공식 프로필에서 수집한 전체 ${professor.publicationCount}건 중 최근 논문 최대 6건`
          : "논문이 없다는 뜻이 아니라 공식 프로필에 목록이 노출되지 않았다는 뜻입니다."}
      />
      {recentPublications.length > 0 ? (
        <div className="official-publication-list">
          {recentPublications.map((publication) => (
            <article key={publication.id}>
              <BookOpenCheck size={18} />
              <div>
                <h3>{publication.title}</h3>
                <p>{publication.publicationType} · {publication.publishedDate ?? "발행일 미기재"}</p>
                <small>{publication.id}</small>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <Card className="official-publication-empty">
          <CircleAlert size={18} />
          <div>
            <strong>{officialDataStatusLabel(professor.publicationsStatus, "논문 목록")}</strong>
            <p>공식 프로필에 논문 목록이 노출되지 않아 논문 근거를 만들지 않았습니다.</p>
          </div>
        </Card>
      )}

      <SectionHeading title="공식 출처" description={`수집일 ${new Date(professor.collectedAt).toLocaleDateString("ko-KR")}`} />
      <div className="official-source-actions">
        <Link href={professor.officialProfileUrl} target="_blank" rel="noopener noreferrer">
          <ExternalLink size={17} /> 대학 공식 프로필 열기
        </Link>
        <Link href={professor.sourceUrl} target="_blank" rel="noopener noreferrer">
          <ExternalLink size={17} /> 학과 교수 목록 열기
        </Link>
      </div>
      <StatusBanner icon={CircleAlert} title="직접 확인할 점" tone="warning">
        교수의 면담·지도·모집 가능 여부는 수집하거나 추정하지 않습니다. 연락 전 공식 페이지의 최신 안내를 직접 확인하세요.
      </StatusBanner>
    </AppShell>
  );
}
