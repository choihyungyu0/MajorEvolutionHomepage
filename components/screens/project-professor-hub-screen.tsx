"use client";

import Link from "next/link";
import {
  ArrowRight,
  ChevronDown,
  FlaskConical,
  GraduationCap,
  LoaderCircle,
  Sparkles,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { AppShell } from "@/components/app/primitives";
import { ServiceBottomNav } from "@/components/app/side-nav";
import {
  HubList,
  HubPrimaryTask,
  HubRow,
  ServiceHubIntro,
  serviceHubStyles as hubStyles,
} from "@/components/app/service-hub";
import type { ProfessorMatch } from "@/lib/professor-domain";
import type { TopicWithChecks } from "@/lib/recommend";
import {
  isCurrentProjectProfessorMatch,
  useResearchStore,
} from "@/store/research-store";
import styles from "./project-professor-hub-screen.module.css";

const ROLE_LABEL = {
  TOPIC: "연구주제 연결",
  METHOD: "방법론 연결",
  CONTEXT: "응용 맥락 연결",
} as const;

const SCOPE_LABEL = {
  SAMPLE: "파일럿 범위",
  PARTIAL: "일부 공식 정보",
  COMPLETE: "공식 정보 확인",
} as const;

function findSelectedTopic(
  result: ReturnType<typeof useResearchStore.getState>["result"],
  selectedTopicId: string | null,
): TopicWithChecks | null {
  if (!result || !selectedTopicId || result.kind === "empty") return null;
  if (result.kind === "insufficient") {
    return result.candidate.topic.id === selectedTopicId ? result.candidate : null;
  }
  return result.candidates.find((candidate) => candidate.topic.id === selectedTopicId) ?? null;
}

function LeadProfessorCard({ match }: { match: ProfessorMatch }) {
  return (
    <Link
      href={`/professors/${match.professor.id}?from=project`}
      className={styles.leadProfessorCard}
      aria-label={`${match.professor.name} ${match.professor.title} 추천 근거 확인`}
    >
      <span className={styles.leadProfessorIcon} aria-hidden="true">
        <UserRound size={23} />
      </span>
      <div className={styles.leadProfessorCopy}>
        <span className={styles.leadProfessorRole}>{ROLE_LABEL[match.role]}</span>
        <strong>{match.professor.name} {match.professor.title}</strong>
        <small>{match.professor.department}</small>
        <p>{match.mentorFitReason ?? match.reason}</p>
      </div>
      <span className={styles.leadProfessorAction}>
        근거 확인 <ArrowRight size={17} aria-hidden="true" />
      </span>
    </Link>
  );
}

export function ProjectProfessorHubScreen() {
  const hasHydrated = useResearchStore((state) => state.hasHydrated);
  const result = useResearchStore((state) => state.result);
  const selectedTopicId = useResearchStore((state) => state.selectedTopicId);
  const professorMatches = useResearchStore((state) => state.professorMatches);
  const professorCoverage = useResearchStore((state) => state.professorCoverage);
  const professorMatchTopicId = useResearchStore((state) => state.professorMatchTopicId);

  if (!hasHydrated) {
    return (
      <div className="research-loading">
        <LoaderCircle className="spin" />
        <p>프로젝트 교수 추천을 불러오고 있어요.</p>
      </div>
    );
  }

  const selectedTopic = findSelectedTopic(result, selectedTopicId);
  const hasCurrentProjectMatches = isCurrentProjectProfessorMatch({
    selectedTopicId,
    professorMatchTopicId,
  });
  const projectCoverage = hasCurrentProjectMatches ? professorCoverage : null;
  const projectMatches = projectCoverage
    ? professorMatches
    : [];
  const rankingSourceLabel = projectCoverage?.rankingSource === "ai-reranked"
    ? "AI 재정렬"
    : "공식 근거 규칙";
  const leadMatch = projectMatches[0] ?? null;
  const supportingMatches = projectMatches.slice(1);
  const matchedRoleCount = new Set(projectMatches.map((match) => match.role)).size;

  const primary = !result
    ? {
        title: "나만의 프로젝트부터 설계해 볼까요?",
        description: "AI와 공통 질문 3개, 맞춤 질문 2개를 나누며 프로젝트의 문제·방법·범위를 정해요.",
        cta: "AI 프로젝트 설계하기",
        href: "/research/tutorial",
        icon: FlaskConical,
      }
    : !selectedTopic
      ? {
          title: "프로젝트 후보를 하나 골라주세요",
          description: "두 후보의 근거와 실행 조건을 비교해 고르면 그 프로젝트에 맞는 교수 추천이 이어져요.",
          cta: "프로젝트 후보 고르기",
          href: "/result",
          icon: FlaskConical,
        }
      : projectMatches.length > 0
        ? {
            title: "프로젝트에 맞는 교수님을 찾았어요",
            description: "공식 교수 후보 안에서 연구주제·방법론·응용 맥락을 도울 교수님을 나누어 확인했어요.",
            cta: "추천 근거 자세히 보기",
            href: "/result?section=professor-connection#professor-connection",
            icon: GraduationCap,
          }
        : {
            title: "선택한 프로젝트의 교수 추천을 이어가세요",
            description: "프로젝트 결과에서 공식 교수 후보를 불러오고 AI가 역할별 연결 이유를 정리해요.",
            cta: "맞춤 교수 추천 확인하기",
            href: "/result?section=professor-connection#professor-connection",
            icon: GraduationCap,
          };

  return (
    <AppShell
      showHeader={false}
      className={`${hubStyles.shell} ${styles.shell}`}
      bottomNav={<ServiceBottomNav />}
    >
      <div className={`${hubStyles.hub} ${styles.hub}`}>
        <ServiceHubIntro
          title="내 프로젝트에 맞는 교수님을 찾아볼까요?"
          description="학생 고민을 위한 첫 교수 매칭과 분리해, 선택한 프로젝트의 성공적인 실행에 필요한 전문성을 기준으로 연결해요."
          variant="compact"
        />

        <div className={styles.responsiveLayout}>
          <div className={styles.mainColumn}>
            <div className={styles.primaryTaskWrap} data-service-help="project-primary">
              {leadMatch ? (
                <section className={styles.recommendationReady} aria-label="프로젝트 교수 추천 완료">
                  <span className={styles.recommendationReadyIcon} aria-hidden="true">
                    <GraduationCap size={23} />
                  </span>
                  <div>
                    <span>추천 준비 완료</span>
                    <strong>먼저 확인할 교수님과 연결 근거를 골랐어요</strong>
                    <p>아래 대표 교수 카드에서 연구 역할과 공식 근거를 확인해 보세요.</p>
                  </div>
                </section>
              ) : (
                <HubPrimaryTask {...primary} />
              )}
            </div>

            {/*
              추천 기준이 되는 프로젝트는 화면 위쪽에 한 번만 둔다.
              이전에는 같은 내용이 오른쪽 레일에도 있어 좁은 화면에서 두 번 읽혔다.
              도움말 투어가 선택자를 못 찾으면 투어 전체가 중단되므로(service-help-guide.tsx)
              선택 전에도 이 영역은 항상 렌더링한다.
            */}
            <div className={styles.projectSection} data-service-help="project-summary">
              <HubList
                title="선택한 프로젝트"
                trailing={<span>{selectedTopic ? "AI 공동설계 완료" : "선택 전"}</span>}
              >
                <HubRow
                  icon={FlaskConical}
                  title={selectedTopic?.topic.title ?? "아직 고른 프로젝트가 없어요"}
                  description={selectedTopic?.topic.question
                    ?? "프로젝트를 고르면 그 프로젝트에 맞춰 교수님을 추천해요."}
                  status={selectedTopic ? "선택됨" : "선택하기"}
                  href={selectedTopic ? "/result" : primary.href}
                  tone="violet"
                />
              </HubList>
            </div>

            {leadMatch ? (
              <section
                className={styles.leadProfessorSection}
                aria-labelledby="lead-project-professor"
                data-service-help="project-results"
              >
                <header className={styles.sectionHeading}>
                  <div>
                    <span>프로젝트 실행을 위한 첫 연결</span>
                    <h2 id="lead-project-professor">먼저 확인할 교수님</h2>
                  </div>
                  <strong>{projectMatches.length}명 · {rankingSourceLabel}</strong>
                </header>
                <LeadProfessorCard match={leadMatch} />
              </section>
            ) : null}

            {supportingMatches.length > 0 ? (
              <div className={styles.supportingSection}>
                <HubList title="함께 볼 역할별 교수님" trailing={<span>{supportingMatches.length}명</span>}>
                  {supportingMatches.map((match) => (
                    <HubRow
                      key={match.professor.id}
                      icon={UserRound}
                      title={`${match.professor.name} ${match.professor.title}`}
                      description={`${match.professor.department} · ${match.mentorFitReason ?? match.reason}`}
                      status={ROLE_LABEL[match.role]}
                      href={`/professors/${match.professor.id}?from=project`}
                      tone="mint"
                    />
                  ))}
                </HubList>
              </div>
            ) : null}
          </div>

          <aside className={styles.contextRail} aria-label="프로젝트 교수 추천 기준과 신뢰 안내">
            {/*
              추천 기준과 신뢰 안내는 읽고 넘어가는 참고 정보다. 매번 펼쳐 두면
              정작 봐야 할 교수 카드가 밀려나서, 접어 두고 요약만 한 줄로 보여준다.
              닫힌 상태에서도 정렬 방식과 역할 충족 수가 드러나게 한다.
            */}
            <details className={styles.contextDetails} data-service-help="recommendation-criteria">
              <summary>
                <span className={`${styles.contextIcon} ${styles.contextIconMint}`} aria-hidden="true">
                  <Sparkles size={18} />
                </span>
                <span className={styles.contextDetailsCopy}>
                  <span className={styles.contextLabel}>추천 기준</span>
                  <strong>
                    {rankingSourceLabel}
                    {projectMatches.length > 0 ? ` · ${matchedRoleCount}/3 역할 확인` : ""}
                  </strong>
                </span>
                <ChevronDown size={16} aria-hidden="true" className={styles.contextChevron} />
              </summary>
              <div className={styles.contextDetailsBody}>
                <h2>
                  {projectCoverage?.rankingSource === "ai-reranked"
                    ? "공식 후보 안에서 AI가 다시 정렬했어요"
                    : "공식 근거 후보를 먼저 확인해요"}
                </h2>
                <p>점수 순위가 아니라 프로젝트 실행에 필요한 역할을 나누어 살펴봐요.</p>
                <ul className={styles.roleList}>
                  {Object.entries(ROLE_LABEL).map(([role, label]) => (
                    <li key={role} data-covered={projectMatches.some((match) => match.role === role)}>
                      <span aria-hidden="true" /> {label}
                    </li>
                  ))}
                </ul>
                {projectMatches.length > 0 ? (
                  <small>{matchedRoleCount}개 역할 · {projectMatches.length}명 확인</small>
                ) : null}
              </div>
            </details>

            <details className={`${styles.contextDetails} ${styles.trustCard}`}>
              <summary>
                <span className={`${styles.contextIcon} ${styles.contextIconTrust}`} aria-hidden="true">
                  <ShieldCheck size={18} />
                </span>
                <span className={styles.contextDetailsCopy}>
                  <span className={styles.contextLabel}>신뢰 안내</span>
                  <strong>확인 가능한 공식 정보만 사용해요</strong>
                </span>
                <ChevronDown size={16} aria-hidden="true" className={styles.contextChevron} />
              </summary>
              <div className={styles.contextDetailsBody}>
                <p>
                  {projectCoverage
                    ? `${projectCoverage.officialRecordCount}명 공식 레코드 · ${SCOPE_LABEL[projectCoverage.scopeStatus]}`
                    : "공식 교수 데이터 범위 안에서만 후보를 연결해요."}
                </p>
                <small>추천 이유는 연결 근거이며, 면담 가능 여부와 프로젝트 성공을 보장하지 않아요.</small>
              </div>
            </details>
          </aside>
        </div>
      </div>
    </AppShell>
  );
}
