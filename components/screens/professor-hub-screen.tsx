"use client";

import Link from "next/link";
import {
  ArrowRight,
  Bookmark,
  CalendarCheck,
  CheckCircle2,
  Compass,
  LoaderCircle,
  MessageCircleQuestion,
  MessageSquareText,
  Search,
  Settings2,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { AppShell } from "@/components/app/primitives";
import { JourneyStageHero } from "@/components/app/journey-stage-hero";
import { ServiceBottomNav } from "@/components/app/side-nav";
import {
  HubList,
  HubRow,
  HubUtilityLink,
  HubUtilityLinks,
  serviceHubStyles as styles,
} from "@/components/app/service-hub";
import { getBeforePreparationDoneCount, getJourneyProgress } from "@/lib/journey-progress";
import { getSavedProfessorSummary } from "@/lib/professor-hub-home";
import { useQuestContext } from "@/lib/quest-context";
import { useQuestStore } from "@/store/quest-store";
import { useResearchStore } from "@/store/research-store";
import routeStyles from "./professor-hub-screen.module.css";

export function ProfessorHubScreen() {
  const hasHydrated = useResearchStore((state) => state.hasHydrated);
  const hasQuestHydrated = useQuestStore((state) => state.hasHydrated);
  const cards = useQuestStore((state) => state.cards);
  const matches = useResearchStore((state) => state.professorMatches);
  const selectedProfessorId = useResearchStore((state) => state.selectedProfessorId);
  const favoriteProfessorIds = useResearchStore((state) => state.favoriteProfessorIds);
  const growthProfessorHistory = useResearchStore((state) => state.growthProfessorHistory);
  const emailDrafts = useResearchStore((state) => state.knockKitDrafts);
  const mentorEntries = useResearchStore((state) => state.mentorLoopEntries);
  const selectedProfessorPaper = useResearchStore((state) => state.selectedProfessorPaper);
  const selectProfessorPaper = useResearchStore((state) => state.selectProfessorPaper);
  const { topic: questTopic } = useQuestContext({ includeFavoriteFallback: false, includePaperSelection: false });

  if (!hasHydrated || !hasQuestHydrated) {
    return (
      <div className="research-loading">
        <LoaderCircle className="spin" />
        <p>교수 연결을 불러오고 있어요.</p>
      </div>
    );
  }

  const selected = matches.find((match) => match.professor.id === selectedProfessorId) ?? null;
  const savedSummary = getSavedProfessorSummary({
    favoriteProfessorIds,
    currentProfessors: matches.map((match) => ({ id: match.professor.id, name: match.professor.name })),
    history: growthProfessorHistory,
  });
  const journeyProgress = getJourneyProgress({
    topicId: questTopic?.id ?? null,
    professorId: selected?.professor.id ?? null,
    cards,
    emailDrafts,
    mentorEntries,
  });
  const beforeDoneCount = getBeforePreparationDoneCount(journeyProgress.before);

  const primary = selected
    ? {
        title: `${selected.professor.name} 교수님과 첫 대화를 준비해 볼까요?`,
        description: "선택한 교수님의 공식 연구 근거를 다시 보고, 논문과 첫 질문부터 차례로 준비해요.",
        cta: "대화 준비 이어가기",
        href: "/quest",
        icon: MessageCircleQuestion,
        secondary: { label: "다른 교수 연결 보기", href: "/professors/pitch" },
      }
    : matches.length > 0
      ? {
          title: "연결 이유를 비교하고 첫 교수를 골라볼까요?",
          description: "순위가 아니라 전공·관심 분야와 연결된 공식 근거를 보고 대화할 교수를 선택해요.",
          cta: "교수 피칭 이어보기",
          href: "/professors/pitch",
          icon: UserRound,
          secondary: { label: "새로 찾기", href: "/tutorial" },
        }
      : {
          title: "전공과 관심 분야부터 가볍게 설정해 볼까요?",
          description: "가입 없이 두 단계 기본 설정을 마치면 학교 공식 정보에서 첫 교수 연결을 시작할 수 있어요.",
          cta: "기본 설정하기",
          href: "/tutorial",
          icon: Compass,
          secondary: { label: "질문을 한 화면에서 입력하기", href: "/professors/discover" },
        };
  const PrimaryIcon = primary.icon;
  const journeySteps = [
    {
      label: "교수 선택",
      detail: selected ? `${selected.professor.name} 교수 연결` : "먼저 선택",
      done: Boolean(selected),
      icon: UserRound,
    },
    {
      label: "만나기 전",
      detail: `${beforeDoneCount}/3 준비`,
      done: beforeDoneCount === 3,
      icon: MessageCircleQuestion,
    },
    {
      label: "대화 중",
      detail: journeyProgress.during.total ? "질문 저장" : "시작 전",
      done: journeyProgress.readySteps.during,
      icon: MessageSquareText,
    },
    {
      label: "만난 후",
      detail: journeyProgress.after.total ? "기록 완료" : "시작 전",
      done: journeyProgress.readySteps.after,
      icon: CalendarCheck,
    },
  ] as const;
  const completedJourneySteps = journeySteps.filter((step) => step.done).length;
  const currentJourneyStep = journeySteps.findIndex((step) => !step.done);

  return (
    <AppShell
      showHeader={false}
      className={`${styles.shell} ${routeStyles.matchShell}`}
      bottomNav={<ServiceBottomNav />}
    >
      <div className={styles.hub}>
        <div data-service-help="professor-hub-primary">
          <JourneyStageHero
            stage="match"
            eyebrow="교수 연결 · 1단계"
            title={primary.title}
            description={primary.description}
            className={routeStyles.matchHero}
          >
            <Link
              href={primary.href}
              className={routeStyles.heroPrimaryAction}
              onClick={() => {
                if (selected && selectedProfessorPaper?.professorId !== selected.professor.id) {
                  selectProfessorPaper(null);
                }
              }}
            >
              <PrimaryIcon size={18} aria-hidden="true" /> {primary.cta} <ArrowRight size={17} aria-hidden="true" />
            </Link>
            {primary.secondary ? (
              <Link href={primary.secondary.href} className={routeStyles.heroSecondaryAction}>
                {primary.secondary.label}
              </Link>
            ) : null}
          </JourneyStageHero>
        </div>

        <div className={routeStyles.workspace}>
          <div className={routeStyles.connectionArea} data-service-help="professor-hub-connection">
            <HubList title="나의 첫 교수 연결">
              <HubRow
                icon={UserRound}
                title={selected ? `${selected.professor.name} ${selected.professor.title}` : "아직 선택한 교수가 없어요"}
                description={selected ? `${selected.professor.department} · 첫 대화 준비 중` : "공식 근거를 비교한 뒤 첫 대화를 준비할 교수를 선택해요."}
                status={selected ? "연결됨" : "시작 전"}
                href={selected ? `/professors/${selected.professor.id}` : matches.length ? "/professors/pitch" : "/tutorial"}
                tone={selected ? "mint" : "neutral"}
              />
              <HubRow
                icon={Bookmark}
                title="저장한 교수"
                description={savedSummary.description}
                status={savedSummary.count ? `${savedSummary.count}명` : "비어 있음"}
                href={savedSummary.count ? "/portfolio/manage?from=professors" : matches.length ? "/professors/pitch" : "/tutorial"}
                tone={savedSummary.count ? "violet" : "neutral"}
              />
            </HubList>
          </div>

          <section className={routeStyles.progressPanel} aria-labelledby="professor-journey-progress-title">
            <header className={routeStyles.progressHeader}>
              <div><small>첫 대화 여정</small><h2 id="professor-journey-progress-title">첫 대화 준비 진행률</h2></div>
              <strong>{completedJourneySteps} / {journeySteps.length} 완료</strong>
            </header>
            <div
              className={routeStyles.progressTrack}
              role="progressbar"
              aria-label="첫 대화 준비 진행률"
              aria-valuemin={0}
              aria-valuemax={journeySteps.length}
              aria-valuenow={completedJourneySteps}
            >
              <span style={{ width: `${(completedJourneySteps / journeySteps.length) * 100}%` }} />
            </div>
            <ol className={routeStyles.progressSteps}>
              {journeySteps.map((step, index) => {
                const StepIcon = step.icon;
                const isCurrent = index === currentJourneyStep || (currentJourneyStep < 0 && index === journeySteps.length - 1);
                return (
                  <li key={step.label} className={step.done ? routeStyles.progressStepDone : isCurrent ? routeStyles.progressStepCurrent : undefined}>
                    <span>{step.done ? <CheckCircle2 size={17} aria-hidden="true" /> : <StepIcon size={17} aria-hidden="true" />}</span>
                    <div><small>{index + 1}단계</small><strong>{step.label}</strong><em>{step.detail}</em></div>
                  </li>
                );
              })}
            </ol>
          </section>

          <aside
            className={routeStyles.contextRail}
            aria-label="내 교수 연결 요약"
          >
            <p className={`${styles.trustNote} ${routeStyles.officialStatus}`}>
              <ShieldCheck size={18} aria-hidden="true" />
              <span>
                <strong>공식정보 상태</strong>
                <small>
                  {matches.length
                    ? `학교 공식 정보로 확인한 후보 ${matches.length}명을 비교하고 있어요.`
                    : "교수 탐색을 시작하면 학교 공식 정보 안에서 연결 근거를 확인해요."}
                </small>
              </span>
            </p>
            <div data-service-help="professor-hub-tools">
              <HubUtilityLinks>
              <HubUtilityLink icon={Search} href="/professors/discover">조건을 직접 입력해 교수 찾기</HubUtilityLink>
              <HubUtilityLink icon={Settings2} href="/portfolio/manage?from=professors">저장한 연결 관리</HubUtilityLink>
              </HubUtilityLinks>
            </div>
          </aside>
        </div>
      </div>
    </AppShell>
  );
}
