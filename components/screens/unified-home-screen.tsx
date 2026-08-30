"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRight,
  BookOpenCheck,
  CalendarDays,
  Check,
  ChevronRight,
  CircleHelp,
  Compass,
  FileQuestion,
  GraduationCap,
  Lightbulb,
  LoaderCircle,
  Mail,
  MessageSquareText,
  NotebookPen,
  Search,
  ShieldCheck,
  UserRound,
  UsersRound,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect } from "react";
import { AppShell } from "@/components/app/primitives";
import { ServiceBottomNav } from "@/components/app/side-nav";
import { HomeAiMapPreview } from "@/components/screens/home-ai-map-preview";
import { ProfessorQuickStartPanel } from "@/components/screens/professor-quick-start-panel";
import { ProjectQuickStartPanel } from "@/components/screens/project-quick-start-panel";
import type { ProfessorAcademicTaxonomy } from "@/lib/professor-academic-taxonomy";
import { getJourneyProgress } from "@/lib/journey-progress";
import { useQuestContext } from "@/lib/quest-context";
import {
  cardsForTool,
  useQuestStore,
  type QuestToolId,
  type SavedQuestCard,
} from "@/store/quest-store";
import { useResearchStore } from "@/store/research-store";
import styles from "./home-dashboard.module.css";

type JourneyStepId = "professor" | "paper" | "question" | "email" | "meeting";

type JourneyStep = {
  id: JourneyStepId;
  label: string;
  shortLabel: string;
  href: string;
  icon: LucideIcon;
  done: boolean;
};

type NextAction = {
  heading: string;
  supporting: string;
  title: string;
  description: string;
  cta: string;
  href: string;
  icon: LucideIcon;
};

type RecentItem = {
  id: string;
  label: string;
  title: string;
  meta: string;
  href: string;
  icon: LucideIcon;
};

const TOOL_META: Record<QuestToolId, { label: string; href: string; icon: LucideIcon }> = {
  "paper-bite": {
    label: "저장한 논문 한입",
    href: "/paper/reader?mode=bite&source=favorites",
    icon: BookOpenCheck,
  },
  "first-line": { label: "준비한 첫 질문", href: "/quest/first-line", icon: CircleHelp },
  "silence-rescue": { label: "저장한 대비 질문", href: "/quest/silence-rescue", icon: MessageSquareText },
  "email-guard": { label: "검토한 이메일", href: "/quest/email-guard", icon: Mail },
  "next-seed": { label: "정리한 다음 행동", href: "/mentor-loop", icon: CalendarDays },
};

const UTILITY_LINKS = [
  {
    href: "/home?professor=quick",
    label: "교수 매칭",
    description: "내 고민과 이어지는 교수를 학교 공식 정보로 찾아보세요.",
    icon: Search,
  },
  {
    href: "/quest",
    label: "교수 만남 준비",
    description: "연락 전 준비부터 대화 중 질문, 면담 후 기록까지 한곳에서 이어가요.",
    icon: MessageSquareText,
  },
  {
    href: "/home?project=quick",
    label: "AI 프로젝트 설계",
    description: "관심사를 수업·프로젝트·연구 주제로 더 구체화해요.",
    icon: Lightbulb,
  },
  {
    href: "/project-professors",
    label: "맞춤 교수 추천",
    description: "선택한 프로젝트의 주제·방법·응용 맥락에 맞는 교수를 확인해요.",
    icon: GraduationCap,
  },
] as const;

function formatSavedDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "저장됨";
  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
  }).format(date) + " 저장";
}

function recentFromCard(card: SavedQuestCard): RecentItem {
  const meta = TOOL_META[card.tool];
  return {
    id: card.id,
    label: meta.label,
    title: card.title || card.body,
    meta: formatSavedDate(card.updatedAt),
    href: meta.href,
    icon: meta.icon,
  };
}

export function UnifiedHomeScreen({
  professorTaxonomy,
}: {
  professorTaxonomy: ProfessorAcademicTaxonomy;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const professorQuickOpen = searchParams.get("professor") === "quick";
  const projectQuickOpen = searchParams.get("project") === "quick";
  const quickPanelOpen = professorQuickOpen || projectQuickOpen;
  const hasResearchHydrated = useResearchStore((state) => state.hasHydrated);
  const result = useResearchStore((state) => state.result);
  const matches = useResearchStore((state) => state.professorMatches);
  const professorMatchStatus = useResearchStore((state) => state.professorMatchStatus);
  const professorMatchTopicId = useResearchStore((state) => state.professorMatchTopicId);
  const discoverySummary = useResearchStore((state) => state.professorDiscoverySummary);
  const discoveryTopic = useResearchStore((state) => state.professorDiscoveryTopic);
  const selectedPaper = useResearchStore((state) => state.selectedProfessorPaper);
  const knockKitDrafts = useResearchStore((state) => state.knockKitDrafts);
  const mentorLoopEntries = useResearchStore((state) => state.mentorLoopEntries);
  const hasQuestHydrated = useQuestStore((state) => state.hasHydrated);
  const questCards = useQuestStore((state) => state.cards);
  const { topic, match: connectedProfessor } = useQuestContext({ includeFavoriteFallback: false });
  const hasStoredProfessorPitch = professorMatchStatus === "success"
    && matches.length > 0
    && discoveryTopic !== null
    && professorMatchTopicId === discoveryTopic.id;

  useEffect(() => {
    if (!hasResearchHydrated || !professorQuickOpen || !hasStoredProfessorPitch) return;
    router.replace("/professors/pitch", { scroll: false });
  }, [hasResearchHydrated, hasStoredProfessorPitch, professorQuickOpen, router]);

  if (!hasResearchHydrated || !hasQuestHydrated || (professorQuickOpen && hasStoredProfessorPitch)) {
    return (
      <div className="research-loading">
        <LoaderCircle className="spin" />
        <p>{professorQuickOpen && hasStoredProfessorPitch ? "저장한 교수 피칭을 불러오고 있어요." : "저장된 여정을 불러오고 있어요."}</p>
      </div>
    );
  }

  const journeyProgress = getJourneyProgress({
    topicId: topic?.id ?? null,
    professorId: connectedProfessor?.professor.id ?? null,
    cards: questCards,
    emailDrafts: knockKitDrafts,
    mentorEntries: mentorLoopEntries,
  });
  const hasPaper = journeyProgress.before.paper > 0;
  const hasQuestion = journeyProgress.before.question > 0;
  const hasEmail = journeyProgress.before.email > 0;
  const hasMeeting = journeyProgress.after.total > 0;
  const hasConcernContext = Boolean(result || discoveryTopic || discoverySummary);

  let nextAction: NextAction;
  if (!connectedProfessor && matches.length === 0 && !hasConcernContext) {
    nextAction = {
      heading: "전공과 관심 분야부터 가볍게 설정해 볼까요?",
      supporting: "가입 없이 두 단계 기본 설정을 마치면 첫 교수 연결을 시작할 수 있어요.",
      title: "교수 매칭 기본 설정",
      description: "학교·전공과 관심 분야를 설정하면 공식 정보에서 연결 이유가 다른 교수 세 분을 보여드려요.",
      cta: "기본 설정하기",
      href: "/home?professor=quick",
      icon: Compass,
    };
  } else if (!connectedProfessor && matches.length === 0) {
    nextAction = {
      heading: "이제 누구와 이야기할지 찾아볼까요?",
      supporting: "정리한 고민을 학교 공식 교수 정보와 연결해 첫 대화 후보를 찾아요.",
      title: "공식 정보로 교수 찾기",
      description: "연구 분야와 소속 근거를 확인하며 서로 다른 역할의 교수를 살펴봐요.",
      cta: "교수 찾기 이어가기",
      href: "/home?professor=quick",
      icon: Search,
    };
  } else if (!connectedProfessor) {
    nextAction = {
      heading: "첫 대화를 나눌 교수를 선택해 볼까요?",
      supporting: "순위보다 내 고민과 연결된 이유와 함께 살펴볼 정보를 비교해 보세요.",
      title: `교수 ${matches.length}인 피칭 살펴보기`,
      description: "학교 공식 정보에서 확인한 연결 근거를 읽고 첫 교수를 선택해요.",
      cta: "교수 피칭 보기",
      href: "/professors/pitch",
      icon: UsersRound,
    };
  } else if (!hasPaper) {
    nextAction = {
      heading: "교수님의 연구를 먼저 한입 살펴볼까요?",
      supporting: `${connectedProfessor.professor.name} 교수님과의 첫 대화를 위해, 오늘 할 일 하나만 이어가면 돼요.`,
      title: "논문 한입 준비하기",
      description: "공식 프로필의 논문을 고르고 문제·방법·결과·질문으로 가볍게 정리해요.",
      cta: "논문 한입 시작하기",
      href: "/paper/reader?mode=bite&source=favorites",
      icon: BookOpenCheck,
    };
  } else if (!hasQuestion) {
    nextAction = {
      heading: "이제 첫 질문을 준비해 볼까요?",
      supporting: `${connectedProfessor.professor.name} 교수님과의 첫 대화를 위해, 오늘 할 일 하나만 이어가면 돼요.`,
      title: "첫 질문 3개 준비하기",
      description: "교수님의 연구 분야와 내 고민을 연결해 질문을 정리해요.",
      cta: "대화 준비 이어가기",
      href: "/quest/first-line",
      icon: CircleHelp,
    };
  } else if (!hasEmail) {
    nextAction = {
      heading: "첫 연락을 보내기 전에 점검해 볼까요?",
      supporting: "자동으로 보내지 않아요. 연결 이유와 질문을 담은 초안을 내가 검토해요.",
      title: "이메일 초안 점검하기",
      description: "모호한 요청과 과한 표현을 덜어내고, 교수님께 드릴 요청을 분명히 해요.",
      cta: "이메일 준비하기",
      href: "/quest/email-guard",
      icon: Mail,
    };
  } else if (!hasMeeting) {
    nextAction = {
      heading: "면담에서 얻은 조언을 다음 행동으로 바꿔 볼까요?",
      supporting: "들은 내용을 기록하고, 이번 주에 실행할 세 가지 행동으로 이어가요.",
      title: "면담 후 7일 행동 정리하기",
      description: "피드백과 수정 전후를 남겨 다음 만남에서 보여줄 결과를 준비해요.",
      cta: "면담 기록 이어가기",
      href: "/mentor-loop",
      icon: CalendarDays,
    };
  } else {
    nextAction = {
      heading: "지금까지의 변화를 한 번 돌아볼까요?",
      supporting: "교수를 찾고 준비하고 실행하며 달라진 과정을 한곳에서 확인해요.",
      title: "나의 성장 과정 확인하기",
      description: "저장한 근거만 모아 주제·교수·질문·면담 후 행동의 흐름을 살펴봐요.",
      cta: "성장 기록 보기",
      href: "/portfolio",
      icon: NotebookPen,
    };
  }

  const steps: JourneyStep[] = [
    {
      id: "professor",
      label: "교수 선택",
      shortLabel: "교수 선택",
      href: connectedProfessor
        ? `/professors/${connectedProfessor.professor.id}?from=home`
        : matches.length
          ? "/professors/pitch"
          : "/home?professor=quick",
      icon: UserRound,
      done: Boolean(connectedProfessor),
    },
    {
      id: "paper",
      label: "논문 한입",
      shortLabel: "논문 한입",
      href: "/paper/reader?mode=bite&source=favorites",
      icon: BookOpenCheck,
      done: hasPaper,
    },
    {
      id: "question",
      label: "첫 질문",
      shortLabel: "첫 질문",
      href: "/quest/first-line",
      icon: CircleHelp,
      done: hasQuestion,
    },
    {
      id: "email",
      label: "이메일 초안",
      shortLabel: "이메일",
      href: "/quest/email-guard",
      icon: Mail,
      done: hasEmail,
    },
    {
      id: "meeting",
      label: "면담 기록",
      shortLabel: "면담 기록",
      href: "/mentor-loop",
      icon: CalendarDays,
      done: hasMeeting,
    },
  ];
  const currentStepId = steps.find((step) => !step.done)?.id ?? null;
  const completedStepCount = steps.filter((step) => step.done).length;
  const currentStep = steps.find((step) => step.id === currentStepId) ?? steps[0]!;
  const CurrentStepIcon = currentStep.icon;
  const journeyComplete = currentStepId === null;

  const recentItems: RecentItem[] = [];
  if (selectedPaper) {
    recentItems.push({
      id: `paper:${selectedPaper.paperId}`,
      label: "선택한 공식 논문",
      title: selectedPaper.title,
      meta: `${selectedPaper.professorName} 교수 · ${formatSavedDate(selectedPaper.selectedAt)}`,
      href: "/paper/reader?mode=bite&source=favorites",
      icon: BookOpenCheck,
    });
  }
  const seenBundles = new Set<string>();
  const uniqueCards = [...questCards]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .filter((card) => {
      if (!card.bundleId) return true;
      if (seenBundles.has(card.bundleId)) return false;
      seenBundles.add(card.bundleId);
      return true;
    });
  for (const card of uniqueCards) {
    if (recentItems.length >= 2) break;
    if (selectedPaper && card.tool === "paper-bite") continue;
    recentItems.push(recentFromCard(card));
  }

  const NextIcon = nextAction.icon;

  return (
    <AppShell
      title="너의 교수님은?"
      className={`${styles.shell} unified-home-screen`}
      showHeader={false}
      bottomNav={<ServiceBottomNav />}
    >
      <div
        className={`${styles.dashboard} ${quickPanelOpen ? styles.quickDashboard : ""}`}
        data-service-onboarding="home-content"
      >
        {professorQuickOpen ? (
          <ProfessorQuickStartPanel
            taxonomy={professorTaxonomy}
            onClose={() => router.replace("/home", { scroll: false })}
          />
        ) : projectQuickOpen ? (
          <ProjectQuickStartPanel
            onClose={() => router.replace("/home", { scroll: false })}
          />
        ) : (
          <>
          <div className={styles.primaryGrid}>
          <section
            className={styles.nextAction}
            aria-labelledby="next-action-title"
            data-service-help="home-next-action"
          >
            <span className={styles.heroGlow} aria-hidden="true" />
            <header className={styles.intro}>
              <h1>{nextAction.heading}</h1>
              <p>{nextAction.supporting}</p>
            </header>
            <div className={styles.nextActionRow}>
              <span className={styles.nextIcon}><NextIcon size={25} aria-hidden="true" /></span>
              <div className={styles.nextCopy}>
                <h2 id="next-action-title">{nextAction.title}</h2>
                <p>{nextAction.description}</p>
              </div>
              <Link href={nextAction.href} className={styles.primaryButton}>
                {nextAction.cta} <ArrowRight size={18} aria-hidden="true" />
              </Link>
            </div>
          </section>

          <section
            className={styles.professorPanel}
            aria-labelledby="connected-professor-title"
            data-service-help="home-professor"
          >
            <div className={styles.sectionHeader}>
              <h2 id="connected-professor-title">나의 첫 교수 연결</h2>
            </div>
            {connectedProfessor ? (
              <>
                <div className={styles.professorIdentity}>
                  <span className={styles.professorInitial} aria-hidden="true">
                    {connectedProfessor.professor.name.slice(0, 1)}
                  </span>
                  <div>
                    <h3>{connectedProfessor.professor.name} {connectedProfessor.professor.title}</h3>
                    <p>{connectedProfessor.professor.department}</p>
                    <span className={styles.officialStatus}>
                      <ShieldCheck size={14} aria-hidden="true" /> 학교 공식 정보 확인
                    </span>
                  </div>
                </div>
                <div className={styles.professorActions}>
                  <Link href={`/professors/${connectedProfessor.professor.id}?from=home`}>교수 정보 보기</Link>
                  <Link href="/professors/pitch">다른 교수도 보기</Link>
                </div>
              </>
            ) : (
              <div className={styles.professorEmpty}>
                <Image
                  className={styles.professorEmptyArt}
                  src="/brand/nyp-v03/characters/guide01/nyp-char-connect-guide01-connect-opener-alpha-512-v01.webp"
                  width={128}
                  height={128}
                  alt=""
                  aria-hidden="true"
                  priority
                />
                <div>
                  <h3>아직 선택한 교수가 없어요</h3>
                  <p>공식 근거를 비교한 뒤 첫 대화를 준비할 교수를 선택해요.</p>
                </div>
                <Link href={matches.length ? "/professors/pitch" : "/home?professor=quick"}>
                  {matches.length ? "교수 피칭 보기" : "교수 찾기"} <ChevronRight size={16} />
                </Link>
              </div>
            )}
          </section>
        </div>

        <section
          className={styles.progressSection}
          aria-labelledby="journey-progress-title"
          data-service-help="home-progress"
        >
          <div className={styles.progressHeading}>
            <h2 id="journey-progress-title">첫 대화 준비 진행률</h2>
            <strong>{completedStepCount}<span>/ {steps.length} 완료</span></strong>
          </div>
          <div className={styles.mobileProgressCard}>
            <span className={styles.mobileProgressIcon} aria-hidden="true">
              {journeyComplete ? <Check size={18} /> : <CurrentStepIcon size={18} />}
            </span>
            <div className={styles.mobileProgressCopy}>
              <small>{journeyComplete ? "준비 완료" : "지금 할 일"}</small>
              <strong>{journeyComplete ? "첫 대화 준비를 마쳤어요" : currentStep.label}</strong>
            </div>
            <Link href={journeyComplete ? "/portfolio" : currentStep.href}>
              {journeyComplete ? "성장 보기" : "이어가기"} <ChevronRight size={16} aria-hidden="true" />
            </Link>
          </div>
          <div
            className={styles.mobileProgressTrack}
            role="progressbar"
            aria-label="첫 대화 준비 진행률"
            aria-valuemin={0}
            aria-valuemax={steps.length}
            aria-valuenow={completedStepCount}
          >
            <span style={{ width: `${(completedStepCount / steps.length) * 100}%` }} />
          </div>
          <ol className={styles.progressRail}>
            {steps.map((step) => {
              const Icon = step.icon;
              const isCurrent = currentStepId === step.id;
              return (
                <li
                  key={step.id}
                  className={step.done ? styles.stepDone : isCurrent ? styles.stepCurrent : undefined}
                >
                  <Link href={step.href} aria-current={isCurrent ? "step" : undefined}>
                    <span className={styles.stepMarker}>
                      {step.done ? <Check size={17} aria-hidden="true" /> : <Icon size={17} aria-hidden="true" />}
                    </span>
                    <strong className={styles.desktopStepLabel}>{step.label}</strong>
                    <strong className={styles.mobileStepLabel}>{step.shortLabel}</strong>
                    <small>{step.done ? "완료" : isCurrent ? "진행 중" : "예정"}</small>
                  </Link>
                </li>
              );
            })}
          </ol>
        </section>

        <div data-service-help="home-ai-map">
          <HomeAiMapPreview />
        </div>

        <div className={styles.lowerGrid}>
          <section className={styles.recentSection} aria-labelledby="recent-title">
            <div className={styles.sectionHeader}>
              <h2 id="recent-title">최근 기록</h2>
              <Link href="/portfolio">전체 기록 보기 <ChevronRight size={15} /></Link>
            </div>
            {recentItems.length ? (
              <div className={styles.recordList}>
                {recentItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link key={item.id} href={item.href} className={styles.recordRow}>
                      <span><Icon size={19} aria-hidden="true" /></span>
                      <div>
                        <small>{item.label}</small>
                        <strong>{item.title}</strong>
                        <em>{item.meta}</em>
                      </div>
                      <ChevronRight size={18} aria-hidden="true" />
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className={styles.emptyRecords}>
                <FileQuestion size={23} aria-hidden="true" />
                <div>
                  <strong>아직 저장된 기록이 없어요</strong>
                  <p>첫 행동을 완료하면 준비한 내용이 여기에 이어집니다.</p>
                </div>
              </div>
            )}
          </section>

          <section className={styles.utilitySection} aria-labelledby="utility-title">
            <div className={styles.sectionHeader}>
              <h2 id="utility-title">전체 기능</h2>
            </div>
            <div className={styles.utilityList}>
              {UTILITY_LINKS.map((item) => {
                const Icon = item.icon;
                return (
                  <Link key={item.href} href={item.href}>
                    <Icon size={20} aria-hidden="true" />
                    <div>
                      <strong>{item.label}</strong>
                      <p>{item.description}</p>
                    </div>
                    <ChevronRight size={17} aria-hidden="true" />
                  </Link>
                );
              })}
            </div>
          </section>
        </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
